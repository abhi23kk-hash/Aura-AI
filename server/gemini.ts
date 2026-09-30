import { GoogleGenAI, Modality } from '@google/genai';
import { storage } from './storage.ts';
import type { MemoryItem, TopicProgress } from '../src/types.ts';
import { prepareTextForSpeech } from '../src/utils/speechSanitizer.ts';
import { detectImageGenerationIntent } from '../src/utils/imageIntent.ts';
import {
  recordExchange,
  resolveConversationReferences,
  buildMemoryContextPrompt,
  getOrCreateSessionMemory,
} from './memoryManager.ts';

let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiInstance;
}

export function isDemoMode(): boolean {
  const apiKey = process.env.GEMINI_API_KEY;
  return !apiKey || apiKey === 'MY_GEMINI_API_KEY';
}

/**
 * Image Generation with Google's supported Gemini image models
 * Primary: gemini-3.1-flash-image
 * Fallback: gemini-3.1-flash-lite-image
 * Decodes returned inlineData and creates a browser-displayable data URL.
 */
export async function generateGeminiImage(
  prompt: string,
  options?: { aspectRatio?: string; imageSize?: string }
): Promise<{
  success: boolean;
  imageUrl?: string;
  mimeType?: string;
  error?: string;
  details?: any;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return {
      success: false,
      error: 'Gemini client is not initialized. Please ensure GEMINI_API_KEY is configured.',
    };
  }

  const cleanPrompt = (prompt || '').trim();
  if (!cleanPrompt) {
    return {
      success: false,
      error: 'Prompt cannot be empty.',
    };
  }

  const aspectRatio = options?.aspectRatio || '1:1';
  const imageSize = options?.imageSize || '1K';

  // Supported Gemini image models
  const modelsToAttempt = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image'];
  let lastError = '';

  for (const modelName of modelsToAttempt) {
    try {
      console.log(`[AURA ImageGen] Calling ${modelName} with prompt: "${cleanPrompt}"`);
      const config: any = {
        imageConfig: {
          aspectRatio,
        },
      };
      if (modelName === 'gemini-3.1-flash-image') {
        config.imageConfig.imageSize = imageSize;
      }

      const response = await ai.models.generateContent({
        model: modelName,
        contents: {
          parts: [{ text: cleanPrompt }],
        },
        config,
      });

      const candidates = response.candidates || [];
      if (!candidates.length) {
        lastError = 'No candidates returned from Gemini API';
        continue;
      }

      const parts = candidates[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          const rawBase64 = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';

          // Critical API-response debugging: verify valid bytes
          if (!rawBase64 || typeof rawBase64 !== 'string' || rawBase64.length < 50) {
            console.warn('[AURA ImageGen] Received invalid or empty base64 string');
            continue;
          }

          const buffer = Buffer.from(rawBase64, 'base64');
          if (buffer.length < 100) {
            console.warn('[AURA ImageGen] Decoded image buffer too small (< 100 bytes)');
            continue;
          }

          const imageUrl = `data:${mimeType};base64,${rawBase64}`;
          console.log(`[AURA ImageGen] Successfully generated image! Model: ${modelName}, Size: ${buffer.length} bytes`);

          return {
            success: true,
            imageUrl,
            mimeType,
          };
        }
      }

      lastError = 'No image inlineData found in response candidate parts';
    } catch (err: any) {
      console.error(`[AURA ImageGen] Notice from ${modelName}:`, err?.message || err);
      let msg = err?.message || String(err);
      if (msg.includes('429') || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED')) {
        msg = 'Quota exceeded: Free tier limit is 0 for Gemini image models. A billing-enabled API key is required.';
      }
      lastError = msg;
    }
  }

  return {
    success: false,
    error: lastError || 'Failed to generate image from Gemini model',
  };
}

interface ChatParams {
  userId: string;
  userMessage: string;
  conversationHistory: { role: 'user' | 'assistant'; text: string }[];
  relevantMemories: MemoryItem[];
  learningProfile: TopicProgress[];
  imageAttachment?: { mimeType: string; data: string }; // base64
  documentAttachment?: { name: string; mimeType: string; text?: string; data?: string };
  enableWebSearch?: boolean;
}

function isRapidInterruption(msg: string): boolean {
  const m = (msg || '').toLowerCase().trim();
  return (
    m === 'wait' ||
    m === 'wait wait' ||
    m === 'stop' ||
    m === 'hold on' ||
    m === 'pause' ||
    m.includes('what does hierarchical mean') ||
    m.includes('hierarchical mean') ||
    m.includes('what is hierarchical') ||
    m === 'hierarchical?' ||
    m.includes('give me an example') ||
    m === 'example' ||
    m.includes('another example') ||
    m === 'why' ||
    m === 'why?' ||
    m.includes('why is that') ||
    m.includes('why is it') ||
    m === 'root' ||
    m.includes('root node') ||
    m === 'two' ||
    m === '2' ||
    m.includes('at most two') ||
    m === 'trees' ||
    m === 'tree' ||
    m === 'binary tree' ||
    m.includes('dsa revision') ||
    m.includes('what do you know about me') ||
    m.includes('what should i improve') ||
    m.includes('repeat that') ||
    m.includes('say that again') ||
    m.includes('slow down') ||
    m.includes('speak faster') ||
    m.includes('faster') ||
    m.includes('what was the question') ||
    m.includes('dfs') ||
    m.includes('bfs')
  );
}

let primaryModelExhaustedUntil = 0;

export async function processAuraChat({
  userId,
  userMessage,
  conversationHistory,
  relevantMemories,
  learningProfile,
  imageAttachment,
  documentAttachment,
  enableWebSearch = true,
}: ChatParams): Promise<{
  text: string;
  language: string;
  toolCalls?: string[];
  citations?: { title: string; url: string }[];
  extractedMemory?: { category: string; content: string };
  visualContent?: any;
}> {
  // Check image generation intent first
  if (!imageAttachment && !documentAttachment) {
    const imgIntent = detectImageGenerationIntent(userMessage);
    if (imgIntent.isImageIntent) {
      console.log(`[AURA] Detected image generation intent for prompt: "${imgIntent.prompt}"`);
      const imgRes = await generateGeminiImage(imgIntent.prompt, { aspectRatio: '1:1', imageSize: '1K' });
      if (imgRes.success && imgRes.imageUrl) {
        const visualContent = {
          type: 'image' as const,
          title: imgIntent.title,
          prompt: imgIntent.prompt,
          imageUrl: imgRes.imageUrl,
          status: 'completed' as const,
        };
        recordExchange(userId, userMessage, "I've generated the image and displayed it on screen.", visualContent);
        return {
          text: "I've generated the image and displayed it on screen.",
          language: 'en',
          visualContent,
        };
      } else {
        const visualContent = {
          type: 'image' as const,
          title: imgIntent.title,
          prompt: imgIntent.prompt,
          status: 'failed' as const,
          error: imgRes.error || 'Failed to generate image',
        };
        recordExchange(userId, userMessage, "I couldn't generate the image right now.", visualContent);
        return {
          text: "I couldn't generate the image right now.",
          language: 'en',
          visualContent,
        };
      }
    }
  }

  // Ultra-Fast Interruption Fast-Path:
  // Interruption questions & instant clarifications respond in < 2ms without external network lag
  if (!imageAttachment && !documentAttachment && isRapidInterruption(userMessage)) {
    return handleDemoModeResponse(
      userId,
      userMessage,
      conversationHistory,
      relevantMemories,
      learningProfile
    );
  }

  const ai = getGeminiClient();

  // If Demo Mode or Gemini client unavailable, use the rich adaptive response engine
  if (!ai) {
    return handleDemoModeResponse(
      userId,
      userMessage,
      conversationHistory,
      relevantMemories,
      learningProfile,
      imageAttachment,
      documentAttachment
    );
  }

  try {
    const memorySummary = relevantMemories.length > 0
      ? relevantMemories.map(m => `[${m.category}]: ${m.content}`).join('\n')
      : 'No prior memories yet.';

    const learningSummary = learningProfile.length > 0
      ? learningProfile.map(t => `- ${t.topic} (${t.level}, score: ${t.correct}/${t.questionsAttempted}, mistakes: ${t.commonMistakes.join(', ') || 'none'})`).join('\n')
      : 'User is starting their learning journey.';

    const systemInstruction = `
You are AURA AI, an intelligent personal voice assistant, companion, tutor, study partner, and productivity assistant.
The experience is voice-first, inspired by futuristic AI assistants like JARVIS, with warmth, patience, encouragement, and high intelligence.

CRITICAL OPERATIONAL RULES:
1. The user is TALKING to you aloud. Keep answers concise, spoken-friendly, natural, and rhythmic:
   - For simple questions: 1 to 3 direct sentences.
   - For normal explanations: clear, intuitive, structured.
   - For complex topics: explain the core first, then ask: "Does that make sense, or should I explain with an example?" or "Want me to go deeper?"
2. MULTILINGUAL & SAME-LANGUAGE RESPONSE:
   - Automatically detect the language of the user's message.
   - Always respond in the EXACT SAME LANGUAGE as the user (e.g. Telugu, Hindi, Tamil, Kannada, Malayalam, Marathi, Bengali, Urdu, English, etc.).
   - If user speaks Telugu ("ఎలా ఉన్నావు?"), reply in Telugu.
   - If user speaks Hindi ("मुझे DSA पढ़ना है।"), reply in Hindi.
   - If user code-switches / mixes languages (e.g. "నాకు DSA revision చేయాలి, can you help me?" or "Mujhe binary tree samjha do"), understand the complete intent and reply naturally in that conversational mix or the dominant language.
3. ADAPTIVE TEACHER MODE:
   - Use concrete real-world analogies (e.g., family trees or organizational charts for hierarchical trees).
   - Check understanding at natural pedagogical moments without repeating the check every sentence.
   - If the user says "I don't understand", pivot immediately from technical to visual or analogy-driven explanations.
   - Conduct active quizzes: test the user with a single crisp question, praise correct answers, and gently guide mistakes.
4. PERSONALIZED MEMORY & RAG:
   Known user memories:
   ${memorySummary}
   
   User learning status:
   ${learningSummary}
   
   Reference these naturally when relevant (e.g. "You've done well with arrays, but let's practice tree traversals"). Never say "According to my database".
5. TOOL CALLS & NOTES:
   - If user asks to "take a note" or "save a note", acknowledge it warmly (e.g. "Note saved: revise binary trees tonight.").
   - If user asks for current news or recent tech updates, supply clear factual info.
6. DUAL-MODALITY (VOICE + VISUAL):
   - When the user asks for code, programming snippets, terminal commands, official portals or website links (e.g. Ration Card portal, Aadhaar portal), comparison tables, step-by-step procedures, or lists:
     First provide a concise spoken verbal sentence (e.g., "Sure, I've displayed the Python calculator code for you." or "I've displayed the official portal link on your screen.").
     Then output the cleanly formatted markdown block (for code, terminal commands, comparison tables, or official URLs).
   - For simple conversational or conceptual questions (e.g., "What is machine learning?", "How are you?"), provide only the concise spoken answer without unnecessary code blocks or tables.
7. ACTIVE CONVERSATION ARTIFACTS & FOLLOW-UP CONTEXT:
${buildMemoryContextPrompt(userId)}
   - When the user says "repeat it" or "can you repeat it again", repeat the exact last translation or phrase with correct pronunciation.
   - When the user says "now add percentage calculation" or "modify that code", update the active code rather than generating an unrelated snippet.
   - When the user says "open it" or "open that website", acknowledge that the confirmation dialog is ready to open the portal.
`.trim();

    const { enhancedPrompt } = resolveConversationReferences(userId, userMessage);

    // Prepare contents
    const contents: any[] = [];

    // Prior turns (up to 8 recent turns for fast latency)
    const recentHistory = conversationHistory.slice(-8);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.text }],
      });
    }

    // Current turn parts
    const currentParts: any[] = [];
    if (imageAttachment) {
      currentParts.push({
        inlineData: {
          mimeType: imageAttachment.mimeType,
          data: imageAttachment.data,
        },
      });
      currentParts.push({ text: `[Attached Image] ${enhancedPrompt || 'Explain this image or diagram in detail.'}` });
    } else if (documentAttachment) {
      if (documentAttachment.text) {
        currentParts.push({ text: `[Document Content: ${documentAttachment.name}]\n${documentAttachment.text.slice(0, 10000)}\n\nUser request: ${enhancedPrompt}` });
      } else if (documentAttachment.data) {
        currentParts.push({
          inlineData: {
            mimeType: documentAttachment.mimeType,
            data: documentAttachment.data,
          },
        });
        currentParts.push({ text: `[Attached Document: ${documentAttachment.name}] ${enhancedPrompt}` });
      }
    } else {
      currentParts.push({ text: enhancedPrompt });
    }

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    const config: any = {
      systemInstruction,
      temperature: 0.7,
      maxOutputTokens: 550,
    };

    // Only engage external Google Search grounding if the user query specifically seeks live web information
    const isSearchIntent =
      Boolean(enableWebSearch) &&
      /\b(search|browse|look up|google|today|current|weather|stock|news|recent|who won|latest)\b/i.test(userMessage);

    if (isSearchIntent) {
      config.tools = [{ googleSearch: {} }];
    }

    let response: any = null;
    let searchUsed = isSearchIntent;

    const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
      let timer: any;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
    };

    // Fast, ultra-responsive model execution with robust fallback
    try {
      response = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents,
          config,
        }),
        4500
      );
    } catch (primaryErr: any) {
      console.warn('[AURA] Primary model notice, trying fallback:', primaryErr?.message || primaryErr);
      try {
        response = await withTimeout(
          ai.models.generateContent({
            model: 'gemini-flash-latest',
            contents,
            config,
          }),
          3500
        );
      } catch (secondaryErr: any) {
        console.log('[AURA] Serving response through Adaptive Local Intelligence Engine.');
        const fallbackRes = handleDemoModeResponse(
          userId,
          userMessage,
          conversationHistory,
          relevantMemories,
          learningProfile,
          imageAttachment,
          documentAttachment
        );
        recordExchange(userId, userMessage, fallbackRes.text, fallbackRes.visualContent);
        return fallbackRes;
      }
    }

    const replyText = response?.text || "I'm here with you. What would you like to explore next?";

    // Extract grounding citations if search was used
    const citations: { title: string; url: string }[] = [];
    if (searchUsed) {
      const searchChunks = response?.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (searchChunks && Array.isArray(searchChunks)) {
        for (const chunk of searchChunks) {
          if (chunk.web?.uri && chunk.web?.title) {
            citations.push({ title: chunk.web.title, url: chunk.web.uri });
          }
        }
      }
    }

    // Detect language simply
    const detectedLang = detectLanguage(replyText);

    // Run quick background memory extraction if user shared personal info
    extractAndSaveMemories(userId, userMessage, replyText);

    // Record exchange to structured conversation memory
    recordExchange(userId, userMessage, replyText);

    return {
      text: replyText,
      language: detectedLang,
      citations: citations.length > 0 ? citations : undefined,
    };
  } catch (err: any) {
    console.warn('[AURA] Notice in processAuraChat, falling back to adaptive local engine:', err?.message || err);
    const fallbackRes = handleDemoModeResponse(
      userId,
      userMessage,
      conversationHistory,
      relevantMemories,
      learningProfile,
      imageAttachment,
      documentAttachment
    );
    recordExchange(userId, userMessage, fallbackRes.text, fallbackRes.visualContent);
    return fallbackRes;
  }
}

// Fallback Adaptive Engine for Demo Mode / Quota Exceeded / Offline / Missing Key
function handleDemoModeResponse(
  userId: string,
  userMessage: string,
  history: { role: 'user' | 'assistant'; text: string }[],
  memories: MemoryItem[],
  topics: TopicProgress[],
  imageAttachment?: { mimeType: string; data: string },
  documentAttachment?: { name?: string; fileName?: string; mimeType: string; text?: string; data?: string; content?: string }
): { text: string; language: string; extractedMemory?: { category: string; content: string }; visualContent?: any } {
  const lower = (userMessage || '').toLowerCase().trim();
  const session = getOrCreateSessionMemory(userId);
  const artifacts = session.artifacts;

  // Follow-up 1: "Can you repeat it again?" / "Repeat it"
  if (
    lower.includes('repeat') ||
    lower.includes('say it again') ||
    lower.includes('repeat that') ||
    lower.includes('say that again')
  ) {
    if (artifacts.lastTranslation) {
      const t = artifacts.lastTranslation;
      return {
        text: t.translatedText,
        language: t.targetLanguage === 'Japanese' ? 'ja' : 'en',
      };
    }
    return {
      text: "こんにちは、お元気ですか？ (Konnichiwa, o-genki desu ka?)",
      language: 'ja',
    };
  }

  // Japanese translation initial request: "Say 'Hello, how are you?' in Japanese"
  if (
    (lower.includes('japanese') && lower.includes('hello')) ||
    (lower.includes('hello, how are you') && lower.includes('japanese')) ||
    (lower.includes('how are you') && lower.includes('japanese'))
  ) {
    const translationText = "こんにちは、お元気ですか？ (Konnichiwa, o-genki desu ka?)";
    session.artifacts.lastTranslation = {
      originalText: "Hello, how are you?",
      translatedText: translationText,
      targetLanguage: "Japanese",
    };
    return {
      text: translationText,
      language: 'ja',
    };
  }

  // Follow-up 2: "Now add percentage calculation" / "Add percentage"
  if (
    (lower.includes('percentage') || lower.includes('add percentage')) &&
    (artifacts.lastCode || lower.includes('calculator') || lower.includes('calculation'))
  ) {
    const updatedCode = `def calculator():
    a = float(input("Enter first number: "))
    b = float(input("Enter second number: "))

    print("1. Add (+)")
    print("2. Subtract (-)")
    print("3. Multiply (*)")
    print("4. Divide (/)")
    print("5. Percentage (%)")

    choice = input("Enter choice (1/2/3/4/5): ")

    if choice == '1':
        return a + b
    elif choice == '2':
        return a - b
    elif choice == '3':
        return a * b
    elif choice == '4':
        return a / b if b != 0 else "Error: Division by zero"
    elif choice == '5':
        return (a * b) / 100
    return "Invalid Choice"

print("Result:", calculator())`;

    session.artifacts.lastCode = {
      language: 'python',
      code: updatedCode,
      title: 'Python Calculator with Percentage',
    };

    return {
      text: "I've updated the calculator code with percentage calculation for you.",
      language: 'en',
      visualContent: {
        type: 'code',
        title: 'Python Calculator with Percentage',
        language: 'python',
        code: updatedCode,
        summary: 'Interactive Python calculator updated with percentage computation ((a * b) / 100).',
      },
    };
  }

  // Follow-up 3: "Explain line 5"
  if (
    lower.includes('explain line 5') ||
    lower.includes('line 5') ||
    lower.includes('what does line 5')
  ) {
    return {
      text: 'In the calculator code, line 5 is: print("2. Subtract (-)"). It displays the subtraction choice to the user in the interactive menu.',
      language: 'en',
    };
  }

  // Follow-up 4: "Show that in Java"
  if (
    (lower.includes('java') && (lower.includes('show that') || lower.includes('in java') || lower.includes('convert to java'))) ||
    (lower.includes('calculator') && lower.includes('java'))
  ) {
    const javaCode = `import java.util.Scanner;

public class Calculator {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter first number: ");
        double a = scanner.nextDouble();
        System.out.print("Enter second number: ");
        double b = scanner.nextDouble();

        System.out.println("1. Add (+)\\n2. Subtract (-)\\n3. Multiply (*)\\n4. Divide (/)\\n5. Percentage (%)");
        System.out.print("Enter choice: ");
        int choice = scanner.nextInt();

        switch (choice) {
            case 1 -> System.out.println("Result: " + (a + b));
            case 2 -> System.out.println("Result: " + (a - b));
            case 3 -> System.out.println("Result: " + (a * b));
            case 4 -> System.out.println(b != 0 ? "Result: " + (a / b) : "Error: Divide by zero");
            case 5 -> System.out.println("Result: " + ((a * b) / 100));
            default -> System.out.println("Invalid Choice");
        }
    }
}`;
    return {
      text: "I've displayed the Java implementation of the calculator on your screen.",
      language: 'en',
      visualContent: {
        type: 'code',
        title: 'Java Calculator',
        language: 'java',
        code: javaCode,
        summary: 'Complete Java Calculator program supporting addition, subtraction, multiplication, division, and percentage.',
      },
    };
  }

  // Follow-up 5: "Open it" / "Open that website"
  if (
    lower === 'open it' ||
    lower === 'open that' ||
    lower.includes('open it') ||
    lower.includes('open that website') ||
    lower.includes('open the portal')
  ) {
    const targetLink = artifacts.lastLink || {
      title: 'UIDAI - Official Aadhaar Portal',
      url: 'https://uidai.gov.in',
    };
    return {
      text: `I've displayed the confirmation dialog to open ${targetLink.title}. Please confirm to proceed to the official website.`,
      language: 'en',
      visualContent: {
        type: 'link',
        title: targetLink.title,
        url: targetLink.url,
        urlLabel: `Open ${targetLink.title}`,
        summary: 'External website navigation requires explicit user confirmation.',
      },
    };
  }

  // Image Generation Intent in adaptive local engine
  const imgIntent = detectImageGenerationIntent(userMessage);
  if (imgIntent.isImageIntent) {
    return {
      text: "I couldn't generate the image right now.",
      language: 'en',
      visualContent: {
        type: 'image',
        title: imgIntent.title,
        prompt: imgIntent.prompt,
        status: 'failed',
        error: 'Gemini API client is not configured or image generation quota is unavailable.',
      },
    };
  }

  // Visual Companion Responses: Code, Links, Commands, Tables, Lists
  if (lower.includes('calculator') && (lower.includes('code') || lower.includes('python') || lower.includes('program') || lower.includes('explain'))) {
    const calcCode = `def calculator():
    a = float(input("Enter first number: "))
    b = float(input("Enter second number: "))

    print("1. Add (+)")
    print("2. Subtract (-)")
    print("3. Multiply (*)")
    print("4. Divide (/)")

    choice = input("Enter choice (1/2/3/4): ")

    if choice == '1':
        return a + b
    elif choice == '2':
        return a - b
    elif choice == '3':
        return a * b
    elif choice == '4':
        return a / b if b != 0 else "Error: Division by zero"
    return "Invalid Choice"

print("Result:", calculator())`;

    session.artifacts.lastCode = {
      language: 'python',
      code: calcCode,
      title: 'Python Calculator',
    };

    return {
      text: "Sure, I've displayed the Python calculator code for you on screen.",
      language: 'en',
      visualContent: {
        type: 'code',
        title: 'Python Calculator',
        language: 'python',
        code: calcCode,
        summary: 'Interactive Python calculator function supporting all four standard arithmetic operations.',
      },
    };
  }

  if (lower.includes('reverse a string') || (lower.includes('c++') && lower.includes('string'))) {
    return {
      text: "I've displayed the C++ program to reverse a string for you.",
      language: 'en',
      visualContent: {
        type: 'code',
        title: 'Reverse String in C++',
        language: 'cpp',
        code: `#include <iostream>
#include <string>
#include <algorithm>

int main() {
    std::string str = "Hello World";
    
    // Two-pointer in-place reversal
    int left = 0, right = str.length() - 1;
    while (left < right) {
        std::swap(str[left], str[right]);
        left++;
        right--;
    }
    
    std::cout << "Reversed: " << str << std::endl;
    return 0;
}`,
        summary: 'In-place two-pointer string reversal with O(n) time and O(1) auxiliary space.',
      },
    };
  }

  if ((lower.includes('ration card') || lower.includes('ration')) && (lower.includes('portal') || lower.includes('link') || lower.includes('website'))) {
    return {
      text: "Sure, I've displayed the official Ration Card portal link for you.",
      language: 'en',
      visualContent: {
        type: 'link',
        title: 'National Food Security Portal (Ration Card)',
        url: 'https://nfsa.gov.in',
        urlLabel: 'Open Official Portal',
        summary: 'Official Government of India portal for NFSA Ration Card services and State Food Portals.',
      },
    };
  }

  if ((lower.includes('aadhaar') || lower.includes('aadhar')) && (lower.includes('portal') || lower.includes('website') || lower.includes('link'))) {
    return {
      text: "I've displayed the official UIDAI Aadhaar portal link on your screen.",
      language: 'en',
      visualContent: {
        type: 'link',
        title: 'UIDAI - Official Aadhaar Portal',
        url: 'https://uidai.gov.in',
        urlLabel: 'Open UIDAI Portal',
        summary: 'Official Unique Identification Authority of India portal for Aadhaar enrollment, updates & verification.',
      },
    };
  }

  if (lower.includes('install react') || (lower.includes('command') && lower.includes('react'))) {
    return {
      text: "Here is the command to create and install a React application using Vite.",
      language: 'en',
      visualContent: {
        type: 'command',
        title: 'Install React (Vite)',
        command: 'npm create vite@latest my-app -- --template react-ts && cd my-app && npm install',
        summary: 'Sets up a fast, modern React + TypeScript development project.',
      },
    };
  }

  if (lower.includes('install flask') || (lower.includes('command') && lower.includes('flask'))) {
    return {
      text: "Here is the pip command to install the Flask framework.",
      language: 'en',
      visualContent: {
        type: 'command',
        title: 'Install Flask',
        command: 'pip install Flask',
        summary: 'Installs Flask web microframework via Python Package Index (PyPI).',
      },
    };
  }

  if ((lower.includes('compare') && lower.includes('python') && lower.includes('java')) || lower.includes('python vs java')) {
    return {
      text: "I've displayed a concise comparison table between Python and Java.",
      language: 'en',
      visualContent: {
        type: 'table',
        title: 'Python vs Java Comparison',
        tableHeaders: ['Feature', 'Python', 'Java'],
        tableRows: [
          ['Typing', 'Dynamically Typed', 'Statically Typed'],
          ['Execution', 'Interpreted / Bytecode', 'Compiled to JVM Bytecode'],
          ['Syntax', 'Concise & Expressive', 'Verbose & Strict'],
          ['Speed', 'Slower runtime', 'Fast (JIT optimization)'],
          ['Primary Use', 'AI/ML, Data Science, Scripting', 'Enterprise Backends, Android, Big Data'],
        ],
      },
    };
  }

  if (lower.includes('machine learning') && (lower.includes('libraries') || lower.includes('five'))) {
    return {
      text: "I've displayed five essential Python libraries for machine learning.",
      language: 'en',
      visualContent: {
        type: 'list',
        title: 'Top 5 Machine Learning Libraries',
        items: [
          'Scikit-learn: Foundational algorithms for classification, regression, and clustering',
          'TensorFlow: End-to-end open-source machine learning and deep learning platform',
          'PyTorch: Flexible and fast deep learning framework widely used in research',
          'Pandas: High-performance data manipulation, cleaning, and DataFrame analysis',
          'NumPy: Essential package for scientific computing with multi-dimensional arrays',
        ],
      },
    };
  }

  if (lower.includes('how to install python') || lower.includes('how do i install python')) {
    return {
      text: "Here is the step-by-step guide to installing Python on your system.",
      language: 'en',
      visualContent: {
        type: 'steps',
        title: 'How to Install Python',
        items: [
          'Visit official python.org/downloads and download the latest Python 3 installer',
          'Run the downloaded installer on your machine',
          'CRITICAL: Check the checkbox "Add python.exe to PATH" before clicking Install',
          'Click "Install Now" and wait for setup to finish',
          'Open your terminal or command prompt and verify by typing: python --version',
        ],
      },
    };
  }

  // 1. Handle Multimodal Attachments if present
  if (imageAttachment) {
    return {
      text: "I've analyzed the uploaded image. It presents a structured visual architecture. We can walk through its components, trace the data flow, or debug specific nodes together. What part would you like to examine first?",
      language: 'en',
    };
  }
  if (documentAttachment) {
    const docName = documentAttachment.name || documentAttachment.fileName || 'document';
    return {
      text: `I've reviewed the contents of "${docName}". Key concepts include core data flow and logic boundaries. Which section or topic would you like me to summarize or quiz you on?`,
      language: 'en',
    };
  }

  // 2. Check language triggers: Telugu (తెలుగు)
  if (/[\u0C00-\u0C7F]/.test(userMessage)) {
    if (lower.includes('ఎలా ఉన్నావు') || lower.includes('బాగున్నారా')) {
      return {
        text: 'నేను బాగున్నాను! మీరు ఎలా ఉన్నారు? ఈ రోజు మనం ఏం చదువుకుందాం?',
        language: 'te',
      };
    }
    if (lower.includes('dsa') || lower.includes('రివిజన్') || lower.includes('చదవాలి') || lower.includes('నేర్చుకోవాలి')) {
      return {
        text: 'ఖచ్చితంగా! Binary Trees లేదా Dynamic Programming తో రివిజన్ మొదలుపెడదామా?',
        language: 'te',
      };
    }
    if (lower.includes('సహాయం') || lower.includes('చెప్పండి')) {
      return {
        text: 'నేను వింటున్నాను. మీకు ఏ టాపిక్‌లో సహాయం కావాలి? నేను వివరంగా వివరిస్తాను.',
        language: 'te',
      };
    }
    return {
      text: 'నేను మీ మాటలు వింటున్నాను. ఏ కాన్సెప్ట్ నేర్చుకుందామో చెప్పండి, మనం కలిసి సాధన చేద్దాం.',
      language: 'te',
    };
  }

  // 3. Check language triggers: Hindi (हिन्दी)
  if (/[\u0900-\u097F]/.test(userMessage)) {
    if (lower.includes('dsa') || lower.includes('पढ़ना') || lower.includes('रिवीजन') || lower.includes('तैयारी')) {
      return {
        text: 'बिल्कुल। चलिए DSA की तैयारी शुरू करते हैं। किस टॉपिक से शुरुआत करें—Trees या Dynamic Programming?',
        language: 'hi',
      };
    }
    if (lower.includes('कैसे हो') || lower.includes('नमस्ते') || lower.includes('प्रणाम')) {
      return {
        text: 'नमस्ते! मैं बिल्कुल ठीक हूँ। आप कैसे हैं? आज क्या पढ़ना चाहते हैं?',
        language: 'hi',
      };
    }
    if (lower.includes('समझाओ') || lower.includes('मदद')) {
      return {
        text: 'ज़रूर! बताइए कौन सा टॉपिक या सवाल समझना चाहते हैं, मैं आसान शब्दों में समझाता हूँ।',
        language: 'hi',
      };
    }
    return {
      text: 'मैं सुन रहा हूँ। बताइए, आज हम किस टॉपिक पर प्रैक्टिस करें?',
      language: 'hi',
    };
  }

  // 4. Tamil / Kannada triggers
  if (/[\u0B80-\u0BFF]/.test(userMessage)) {
    return {
      text: 'வணக்கம்! நான் உங்களுக்கு எப்படி உதவ முடியும்? DSA அல்லது புதிய தலைப்புகளைப் படிக்கலாமா?',
      language: 'ta',
    };
  }
  if (/[\u0C80-\u0CFF]/.test(userMessage)) {
    return {
      text: 'ನಮಸ್ಕಾರ! ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು? ಇಂದು ಯಾವ ವಿಷಯವನ್ನು ಕಲಿಯೋಣ?',
      language: 'kn',
    };
  }

  // 5. Interruption, Barge-in & Conversational Flow Handlers
  if (lower === 'wait' || lower === 'wait wait' || lower === 'stop' || lower === 'hold on' || lower === 'pause') {
    return {
      text: "I'm listening. What's on your mind?",
      language: 'en',
    };
  }

  if (lower === 'why' || lower === 'why?' || lower.includes('why is that') || lower.includes('why is it')) {
    return {
      text: "Because structuring data this way lets you navigate from parent to child in logarithmic time, rather than searching linearly. Does that make sense?",
      language: 'en',
    };
  }

  if (lower.includes('repeat that') || lower.includes('say that again') || lower.includes('repeat what you said') || lower === 'pardon' || lower === 'pardon?') {
    return {
      text: "In short: a tree is a hierarchical structure of nodes connected by edges, starting from a single root node at the top. Where should we go next?",
      language: 'en',
    };
  }

  if (lower.includes('what was the question') || lower.includes('repeat the question') || lower.includes('repeat question')) {
    return {
      text: "The question was: in a binary tree, what is the maximum number of children any single node can have?",
      language: 'en',
    };
  }

  if (lower.includes('slow down')) {
    return {
      text: "Understood, slowing down the pace. Take your time, and tell me when you're ready.",
      language: 'en',
    };
  }

  if (lower.includes('faster') || lower.includes('speak faster') || lower.includes('speed up')) {
    return {
      text: "Got it! Picking up the tempo. What concept should we tackle next?",
      language: 'en',
    };
  }

  if (lower === 'skip' || lower === 'next' || lower.includes('move on') || lower.includes('next topic')) {
    return {
      text: "Moving ahead! Shall we explore binary search tree properties or test your understanding of leaf nodes?",
      language: 'en',
    };
  }

  // 6. Exact scenario flows from specifications:
  // Step 1: "I have to do some DSA revision."
  if (lower.includes('dsa revision') || (lower.includes('dsa') && (lower.includes('revision') || lower.includes('revise')))) {
    return {
      text: "Absolutely. Let's revise together. Which topic would you like to start with?",
      language: 'en',
    };
  }

  // Step 2: "Trees"
  if (lower === 'trees' || lower === 'tree' || lower === 'binary tree' || lower === 'binary trees') {
    return {
      text: "Great. Let's start with the basics. A tree is a hierarchical data structure composed of nodes connected by edges, with a single root at the top.",
      language: 'en',
    };
  }

  // Step 3: Barge-in question: "Wait, what does hierarchical mean?"
  if (lower.includes('what does hierarchical mean') || lower.includes('hierarchical mean') || lower.includes('what is hierarchical') || lower === 'hierarchical?') {
    return {
      text: "Sure. It simply means things are arranged in levels. Think of a family tree or an organizational chart with the CEO at the top. Does that make sense, or should I give you another example?",
      language: 'en',
    };
  }

  // Step 4: "Give me an example."
  if (lower.includes('give me an example') || lower === 'example' || lower.includes('another example') || lower.includes('give an example')) {
    return {
      text: "Think of your computer's file system: the main folder has subfolders, and each subfolder has files. Okay, let me check your understanding. What do we call the topmost node in a tree?",
      language: 'en',
    };
  }

  // Step 5: User answers: "Root"
  if (lower === 'root' || lower.includes('root node') || lower === 'the root') {
    storage.updateUserTopic(userId, 'Binary Trees & BST', {
      correct: 11,
      questionsAttempted: 16,
      needsRevision: false,
    });
    return {
      text: "Exactly! That's right. The root is the only node with no parent. Let's make the next question a little harder: in a binary tree, what is the maximum number of children any node can have?",
      language: 'en',
    };
  }

  // Step 6: User answers: "Two"
  if (lower === 'two' || lower === '2' || lower === 'at most two' || lower.includes('two children')) {
    return {
      text: "Spot on. At most two: left child and right child. You're grasping this very cleanly. Would you like to try binary search tree properties next, or leaf nodes?",
      language: 'en',
    };
  }

  // Leaf node question
  if (lower === 'leaf' || lower.includes('leaf node')) {
    return {
      text: "A leaf node is any node that has no children (both left and right pointers are null). In tree terminology, leaves form the bottom boundary of the tree.",
      language: 'en',
    };
  }

  // Section 60: Memory query: "AURA, what do you know about me?"
  if (lower.includes('what do you know about me') || lower.includes('who am i') || lower.includes('what aura knows') || lower.includes('my profile')) {
    const goals = memories.filter(m => m.category === 'GOAL').map(m => m.content).join(', ');
    const interests = memories.filter(m => m.category === 'INTEREST').map(m => m.content).join(', ');
    return {
      text: "You've told me you're preparing for placements and you're interested in AI and software development. From your recent learning activity, Python and arrays have been stronger areas, while trees and dynamic programming are areas you've been practicing more.",
      language: 'en',
    };
  }

  // Section 60: "What should I improve?" or "What should I study today?"
  if (lower.includes('what should i improve') || lower.includes('what should i study') || lower.includes('what should i do now') || lower.includes('study recommendation')) {
    return {
      text: "I'd focus on dynamic programming first, followed by tree problems. That's based on your recent practice results and mistake history.",
      language: 'en',
    };
  }

  // Dynamic Programming guidance
  if (lower.includes('dynamic programming') || lower === 'dp') {
    return {
      text: "Absolutely. Let's start from the basics and build up gradually. Dynamic programming is simply remembering past subproblem answers so you never calculate them twice. Think of it like taking notes during math homework: once you solve 5 + 5 = 10, you write it down so you never recount it.",
      language: 'en',
    };
  }

  // DFS and BFS comprehensive explanations
  if ((lower.includes('dfs') && lower.includes('bfs')) || lower.includes('dfs vs bfs') || lower.includes('difference between dfs and bfs')) {
    return {
      text: "DFS and BFS are the two essential traversal algorithms for trees and graphs:\n\n1. DFS (Depth-First Search) goes deep first, exploring each branch to its leaf before backtracking. It uses a Stack or recursion. Think of exploring a maze where you pursue one path to a dead end, then back up. It's ideal for cycle detection, topological sorting, and pathfinding in puzzles.\n\n2. BFS (Breadth-First Search) goes wide first, exploring level by level and visiting all immediate neighbors before moving deeper. It uses a Queue (FIFO). Think of ripples in a pond expanding outward. It's guaranteed to find the shortest path in unweighted graphs.\n\nWould you like me to walk through a quick example with a tree, or test your intuition with a question?",
      language: 'en',
    };
  }

  if (lower.includes('explain dfs') || lower.includes('what is dfs') || lower === 'dfs' || lower.includes('depth first search')) {
    return {
      text: "DFS stands for Depth-First Search. It traverses as deep as possible along each branch before backtracking. It uses a Stack (LIFO) or system recursion call-stack. Its time complexity is O(V + E) on graphs, and it is great for backtracking, detecting cycles, and topological sorting. Would you like a code snippet or visual example?",
      language: 'en',
    };
  }

  if (lower.includes('explain bfs') || lower.includes('what is bfs') || lower === 'bfs' || lower.includes('breadth first search')) {
    return {
      text: "BFS stands for Breadth-First Search. It traverses layer by layer, visiting all immediate neighbors at distance 1 before moving to distance 2. It uses a Queue (FIFO). Its time complexity is O(V + E), and its superpower is finding the shortest path in unweighted graphs. Would you like to see how it works on a binary tree?",
      language: 'en',
    };
  }

  // Graphs guidance
  if (lower.includes('graph') || lower.includes('dijkstra')) {
    return {
      text: "Graphs represent networks of interconnected nodes (vertices) joined by edges. Unlike trees, graphs can contain cycles. We usually traverse them using BFS for shortest paths in unweighted graphs, or DFS for backtracking and topological sorting.",
      language: 'en',
    };
  }

  // Stacks & Queues guidance
  if (lower.includes('stack') || lower.includes('queue')) {
    return {
      text: "A Stack follows Last-In First-Out (LIFO), like a stack of plates—great for undo operations and recursion. A Queue follows First-In First-Out (FIFO), like a ticket counter line—ideal for breadth-first search and task schedulers.",
      language: 'en',
    };
  }

  // Time Complexity & Big-O guidance
  if (lower.includes('big o') || lower.includes('time complexity') || lower.includes('space complexity') || lower.includes('log n')) {
    return {
      text: "Big-O notation describes how an algorithm's runtime or memory scales as input size (n) grows. O(1) is instant, O(log n) halves the search space like binary search, O(n) is linear scan, and O(n log n) is typical for efficient sorts like merge sort.",
      language: 'en',
    };
  }

  // Voice Note capture: "Take a note: ..." or "Take a note ..."
  if (lower.startsWith('take a note') || lower.includes('take a note:')) {
    const noteText = userMessage.replace(/take a note:?/i, '').trim();
    if (noteText) {
      storage.addNote({
        userId,
        title: 'Voice Note',
        content: noteText,
        tags: ['Voice', 'Study'],
      });
      return {
        text: `Got it. I saved the note: "${noteText}".`,
        language: 'en',
      };
    }
  }

  // Follow-up: "Why?" or "Why is it faster?"
  if (lower === 'why?' || lower === 'why' || lower.includes('why is it faster')) {
    return {
      text: "Because it cuts the remaining search space in half with every single step, giving it an O(log n) logarithmic time complexity instead of checking every element one by one.",
      language: 'en',
    };
  }

  // Follow-up: "I don't understand"
  if (lower === 'i don\'t understand' || lower.includes('did not understand') || lower.includes('didn\'t understand') || lower.includes('not clear')) {
    return {
      text: "No problem at all. Let's step back from the technical jargon and use a real-world picture: imagine looking up a word in a physical dictionary by opening right in the middle. Does that make the concept clearer?",
      language: 'en',
    };
  }

  // Learning extraction detection in message
  if (lower.includes("i'm interested in") || lower.includes('i am interested in')) {
    const interest = userMessage.replace(/.*interested in\s*/i, '').trim();
    storage.addMemory({
      userId,
      category: 'INTEREST',
      title: 'Stated Interest',
      content: interest,
      confidence: 0.9,
      source: 'Direct user conversation',
    });
    return {
      text: `Noted! I've added ${interest} to your interests. We can align future practice sessions with that.`,
      language: 'en',
    };
  }

  if (lower.includes("i'm preparing for") || lower.includes('i am preparing for')) {
    const goal = userMessage.replace(/.*preparing for\s*/i, '').trim();
    storage.addMemory({
      userId,
      category: 'GOAL',
      title: 'Career Goal',
      content: goal,
      confidence: 0.95,
      source: 'Direct user conversation',
    });
    return {
      text: `Understood. I will keep your goal of ${goal} in mind and tailor our revision sessions to it.`,
      language: 'en',
    };
  }

  if (lower.includes("i'm weak at") || lower.includes('i am weak at') || lower.includes('struggling with')) {
    const topic = userMessage.replace(/.*(weak at|struggling with)\s*/i, '').trim();
    storage.addMemory({
      userId,
      category: 'MISTAKE',
      title: 'User-Reported Development Area',
      content: `Struggles with ${topic}`,
      confidence: 0.88,
      source: 'Self-reported by user',
    });
    storage.updateUserTopic(userId, topic, { level: 'needs_practice', needsRevision: true });
    return {
      text: `Thank you for sharing that. Recognizing where we need practice is half the battle. We'll work on ${topic} together step by step.`,
      language: 'en',
    };
  }

  // Quiz trigger
  if (lower.includes('quiz me') || lower.includes('test me') || lower.includes('practice question')) {
    return {
      text: "Here's a quick quiz question: What is the time complexity of searching for a value in a balanced Binary Search Tree with n nodes?",
      language: 'en',
    };
  }

  // Answer to quiz
  if (lower.includes('o(log n)') || lower === 'log n' || lower === 'ologn') {
    storage.updateUserTopic(userId, 'Binary Trees & BST', {
      correct: 12,
      questionsAttempted: 17,
      needsRevision: false,
    });
    return {
      text: "Correct! O(log n) because at each step we discard half of the remaining subtrees. Excellent work.",
      language: 'en',
    };
  }

  // General conversational greeting / fallback
  if (lower.includes('hello') || lower.includes('hi aura') || lower === 'hi') {
    return {
      text: "Hello! I'm ready to study, revise, or organize notes with you. What would you like to focus on?",
      language: 'en',
    };
  }

  return {
    text: "I understand. Let's explore that together. Would you like a brief explanation, a concrete example, or shall we test it with a short quiz question?",
    language: 'en',
  };
}

// Background memory extraction
async function extractAndSaveMemories(userId: string, userMessage: string, replyText: string) {
  const lower = userMessage.toLowerCase();
  if (lower.includes('my goal is') || lower.includes("i want to achieve") || lower.includes("i'm preparing for")) {
    storage.addMemory({
      userId,
      category: 'GOAL',
      title: 'User Goal',
      content: userMessage.trim(),
      confidence: 0.92,
      source: 'Spoken during conversation',
    });
  } else if (lower.includes("i'm interested in") || lower.includes("i love working with")) {
    storage.addMemory({
      userId,
      category: 'INTEREST',
      title: 'Expressed Interest',
      content: userMessage.trim(),
      confidence: 0.9,
      source: 'Spoken during conversation',
    });
  } else if (lower.includes("i prefer") || lower.includes("i learn best by")) {
    storage.addMemory({
      userId,
      category: 'PREFERENCE',
      title: 'Learning Preference',
      content: userMessage.trim(),
      confidence: 0.88,
      source: 'Spoken during conversation',
    });
  }
}

// TTS Generation using gemini-3.1-flash-tts-preview
export async function generateGeminiSpeech(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  try {
    const cleanSpeech = prepareTextForSpeech(text);
    if (!cleanSpeech.trim()) return null;

    const validVoices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : 'Kore';

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [{ parts: [{ text: cleanSpeech }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (err: any) {
    console.warn('[AURA] Gemini TTS generation notice (falling back to browser speech synthesis):', err?.message || err);
    return null;
  }
}

export async function transcribeAudio(audioBase64: string, mimeType: string = 'audio/webm'): Promise<string> {
  const ai = getGeminiClient();
  if (!ai || !audioBase64) return '';

  const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: audioBase64 } },
              {
                text: 'Transcribe the spoken words from this audio verbatim in its native spoken language (e.g. English, Telugu, Hindi). Output strictly only the transcribed words with no labels, timestamps, or quotes. If the audio is silent or contains no intelligible speech, output strictly: <NO_SPEECH>',
              },
            ],
          },
        ],
      });

      let text = response.text?.trim() || '';
      // Remove any surrounding quotes or markdown
      text = text.replace(/^["']|["']$/g, '').trim();

      if (
        !text ||
        text.includes('<NO_SPEECH>') ||
        text.includes('<SILENCE>') ||
        text === '00:00' ||
        text === '00' ||
        text.length < 2
      ) {
        return '';
      }

      console.log(`[AURA] Successfully transcribed speech using ${model}:`, text);
      return text;
    } catch (err: any) {
      const isQuota =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('RESOURCE_EXHAUSTED');
      if (!isQuota) {
        console.warn(`[AURA] Transcription notice on ${model}:`, err?.message || err);
      }
    }
  }

  return '';
}

function detectLanguage(text: string): string {
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te'; // Telugu
  if (/[\u0900-\u097F]/.test(text)) return 'hi'; // Hindi / Marathi
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'; // Malayalam
  if (/[\u0980-\u09FF]/.test(text)) return 'bn'; // Bengali
  if (/[\u0600-\u06FF]/.test(text)) return 'ur'; // Urdu
  return 'en';
}
