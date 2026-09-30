import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, Type, type LiveServerMessage } from '@google/genai';
import { getGeminiClient } from './gemini.ts';
import { storage } from './storage.ts';

export function setupLiveRelay(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: '/api/live-assistant',
  });

  console.log('[AURA Live] WebSocket server mounted on /api/live-assistant');

  wss.on('connection', async (clientWs: WebSocket) => {
    console.log('[AURA Live] Client connected to live voice session');

    let session: any = null;
    let isSessionAlive = true;
    const userId = 'user_abhishek';

    const safeSend = (payload: object) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    try {
      const ai = getGeminiClient();
      if (!ai) {
        safeSend({
          type: 'error',
          message: 'Voice service is currently offline. Please verify API configuration.',
        });
        clientWs.close();
        return;
      }

      // 1. Gather user context for AURA's system instruction
      const user = storage.getUserById(userId);
      const userName = user?.name || 'Abhishek';
      const userMemories = storage.getUserMemories(userId);
      const userTopics = storage.getUserTopics(userId);

      const memorySummary = userMemories.slice(0, 5).map(m => `- ${m.content}`).join('\n');
      const weakTopics = userTopics.filter(t => t.level === 'needs_practice' || t.needsRevision).map(t => t.topic).join(', ');

      const systemInstruction = `You are AURA, an intelligent, empathetic voice assistant and computer science study tutor for ${userName}.
You speak naturally, concisely, and warmly with real-time conversational audio.
${userName} is a 3rd-year Computer Science Engineering student preparing for software engineering placements, focusing on Data Structures & Algorithms (DSA), System Design, and Machine Learning.
${memorySummary ? `Key context about ${userName}:\n${memorySummary}` : ''}
${weakTopics ? `Topics recommended for practice: ${weakTopics}` : ''}

Key conversation guidelines:
1. Speak in natural, conversational, concise spoken sentences (1 to 3 sentences by default unless ${userName} asks for a deeper explanation).
2. Answer questions accurately about computer science, DSA, system design, coding problems, study strategies, and daily productivity.
3. DUAL-MODALITY (VOICE + VISUAL):
   When ${userName} asks for code, programming snippets, terminal commands, official website or government portal links (like Ration card, Aadhaar, etc.), comparison tables, step-by-step guides, or structured lists:
   - Speak a natural, friendly, concise verbal response (e.g. "Sure, I've displayed the Python calculator code for you." or "I've displayed the official portal link on your screen." or "Here is the comparison table between Python and Java.").
   - CONCURRENTLY invoke the displayVisualContent tool with the structured data (type, title, code/url/command/table/items).
   - For normal conversational or conceptual questions (e.g., "What is machine learning?", "How are you?", "Explain DFS intuitively"): Speak the response naturally and do NOT call displayVisualContent unless visual presentation is specifically useful.
4. You have native tool calls to interact directly with the application:
   - displayVisualContent: display code, link, command, table, steps, or list visually on the screen
   - navigateToTab: to switch to 'assistant', 'learning', 'memory', 'notes', or 'history'
   - createNote: to save a study note
   - startStudyTimer: to set a focus countdown timer
   - startRevisionTopic: to begin practicing a specific topic
   - clearConversation: to clear the conversation display
   Execute the appropriate tool immediately when ${userName} asks for these actions, then confirm briefly in your voice response.
5. CRITICAL: Never say "I am Gemini", "I am Google", "Powered by Google", or reveal backend AI provider names. If asked who you are, say: "I'm AURA, your personal voice companion and study assistant."`;

      // 2. Define tools for live interaction
      const tools = [
        {
          functionDeclarations: [
            {
              name: 'displayVisualContent',
              description: 'Display visual companion content (code blocks, clickable website/portal links, terminal commands, comparison tables, step-by-step guides, or structured lists) in the application interface when content needs to be read, copied, clicked, or viewed.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  type: {
                    type: Type.STRING,
                    enum: ['code', 'link', 'command', 'table', 'steps', 'list'],
                    description: 'Visual content type',
                  },
                  title: { type: Type.STRING, description: 'Title of the visual component' },
                  code: { type: Type.STRING, description: 'Full source code for code blocks' },
                  language: { type: Type.STRING, description: 'Programming language (e.g. python, cpp, javascript, bash, java)' },
                  url: { type: Type.STRING, description: 'Official or verified URL for links' },
                  urlLabel: { type: Type.STRING, description: 'Button label for link (e.g. Open Official Portal)' },
                  command: { type: Type.STRING, description: 'Terminal command (e.g. npm install react)' },
                  tableHeaders: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Column header titles for tables',
                  },
                  tableRows: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    description: 'Matrix rows for tables',
                  },
                  items: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Items for step-by-step guides or lists',
                  },
                  summary: { type: Type.STRING, description: 'Optional short companion note' },
                },
                required: ['type'],
              },
            },
            {
              name: 'navigateToTab',
              description: 'Switch the application view to a specific tab: assistant (main voice view), learning (DSA & study progress dashboard), memory (personal context & facts), notes (voice notes), or history (past conversations).',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  tab: {
                    type: Type.STRING,
                    enum: ['assistant', 'learning', 'memory', 'notes', 'history'],
                    description: 'The destination tab identifier',
                  },
                },
                required: ['tab'],
              },
            },
            {
              name: 'createNote',
              description: 'Save a study note or idea to the user notes dashboard.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING, description: 'Short descriptive title of the note' },
                  content: { type: Type.STRING, description: 'The body text or code snippet of the note' },
                },
                required: ['title', 'content'],
              },
            },
            {
              name: 'startStudyTimer',
              description: 'Start a focused study or problem countdown timer in the application.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  minutes: { type: Type.NUMBER, description: 'Duration in minutes (e.g. 15, 25, 45)' },
                  label: { type: Type.STRING, description: 'Study topic or problem label' },
                },
                required: ['minutes'],
              },
            },
            {
              name: 'startRevisionTopic',
              description: 'Start a revision or quiz session on a specific DSA or CS topic.',
              parameters: {
                type: Type.OBJECT,
                properties: {
                  topic: { type: Type.STRING, description: 'The CS topic (e.g., Binary Trees, Graphs, Dynamic Programming)' },
                },
                required: ['topic'],
              },
            },
            {
              name: 'clearConversation',
              description: 'Clear the current conversation messages from the screen.',
              parameters: {
                type: Type.OBJECT,
                properties: {},
              },
            },
          ],
        },
      ];

      // 3. Connect to Gemini Live API
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Zephyr',
              },
            },
          },
          systemInstruction,
          tools,
        },
        callbacks: {
          onopen: () => {
            console.log('[AURA Live] Gemini Live session connected');
            safeSend({ type: 'connected' });
          },
          onmessage: async (message: LiveServerMessage) => {
            if (!isSessionAlive) return;

            // Handle interruption (Barge-in detected by Gemini Live)
            if (message.serverContent?.interrupted) {
              console.log('[AURA Live] Gemini Live detected interruption');
              safeSend({ type: 'interrupted' });
            }

            // Handle generated audio chunks & text
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts && parts.length > 0) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  safeSend({
                    type: 'audio',
                    audio: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                  });
                }
                if (part.text) {
                  safeSend({
                    type: 'transcript',
                    text: part.text,
                    role: 'assistant',
                  });
                }
              }
            }

            // Handle tool calls
            const toolCall = (message as any).toolCall;
            if (toolCall?.functionCalls && toolCall.functionCalls.length > 0) {
              console.log('[AURA Live] Function call received from Live API:', toolCall.functionCalls);
              
              const functionResponses: any[] = [];
              for (const fc of toolCall.functionCalls) {
                const { name, args, id } = fc;
                let responseOutput: any = { success: true };

                // Execute server-side actions where relevant
                if (name === 'displayVisualContent') {
                  responseOutput = { success: true, displayed: true };
                } else if (name === 'createNote') {
                  const newNote = storage.addNote({
                    userId,
                    title: args.title || 'Voice Note',
                    content: args.content || '',
                    tags: ['Voice', 'Study'],
                  });
                  responseOutput = { success: true, noteId: newNote.id, message: 'Note saved successfully' };
                } else if (name === 'startStudyTimer') {
                  responseOutput = { success: true, minutes: args.minutes, label: args.label || 'Study Timer' };
                } else if (name === 'navigateToTab') {
                  responseOutput = { success: true, tab: args.tab };
                } else if (name === 'startRevisionTopic') {
                  responseOutput = { success: true, topic: args.topic };
                } else if (name === 'clearConversation') {
                  responseOutput = { success: true };
                }

                // Notify frontend client to trigger UI action
                safeSend({
                  type: 'tool_call',
                  name,
                  args,
                  id,
                });

                functionResponses.push({
                  name,
                  id,
                  response: { result: responseOutput },
                });
              }

              // Send tool response back to Gemini Live session
              try {
                session.sendToolResponse({ functionResponses });
              } catch (err) {
                console.warn('[AURA Live] Error sending tool response:', err);
              }
            }

            // Handle turn complete
            if (message.serverContent?.turnComplete) {
              safeSend({ type: 'turn_complete' });
            }
          },
          onerror: (err: any) => {
            console.error('[AURA Live] Gemini Live session error:', err?.message || err);
            safeSend({
              type: 'error',
              message: 'Voice connection experienced a temporary interruption. Reconnecting...',
            });
          },
          onclose: (event: any) => {
            console.log('[AURA Live] Gemini Live session closed:', event?.reason || '');
            safeSend({ type: 'closed' });
          },
        },
      });

      // 4. Handle client incoming messages
      clientWs.on('message', (data: any) => {
        if (!isSessionAlive || !session) return;
        try {
          const msg = JSON.parse(data.toString());

          // Real-time audio chunk (16kHz PCM raw 16-bit little-endian)
          if (msg.type === 'realtime_audio' && msg.audio) {
            session.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: 'audio/pcm;rate=16000',
              },
            });
          } else if (msg.type === 'interrupt') {
            console.log('[AURA Live] Client-side fast barge-in interruption signal received');
          } else if (msg.type === 'tool_response' && msg.responses) {
            session.sendToolResponse({ functionResponses: msg.responses });
          } else if (msg.type === 'text' && msg.text) {
            // Text input support
            session.sendClientContent({
              turns: [{ role: 'user', parts: [{ text: msg.text }] }],
              turnComplete: true,
            });
          }
        } catch (err: any) {
          console.warn('[AURA Live] Error handling client message:', err?.message || err);
        }
      });

      clientWs.on('close', () => {
        isSessionAlive = false;
        console.log('[AURA Live] Client WebSocket closed');
        if (session) {
          try {
            session.close();
          } catch (e) {}
        }
      });

      clientWs.on('error', (err: any) => {
        isSessionAlive = false;
        console.warn('[AURA Live] Client WebSocket error:', err?.message || err);
        if (session) {
          try {
            session.close();
          } catch (e) {}
        }
      });

    } catch (err: any) {
      console.error('[AURA Live] Failed to initialize live session:', err);
      safeSend({
        type: 'error',
        message: 'Could not establish real-time voice connection. Please try again.',
      });
      clientWs.close();
    }
  });
}
