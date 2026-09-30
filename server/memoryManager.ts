export interface ConversationArtifacts {
  lastCode?: {
    language: string;
    code: string;
    title?: string;
    summary?: string;
    executionOutput?: string;
  };
  lastLink?: {
    title: string;
    url: string;
    summary?: string;
  };
  lastImage?: {
    title: string;
    prompt: string;
    url: string;
  };
  lastTranslation?: {
    originalText: string;
    translatedText: string;
    targetLanguage: string;
    pronunciation?: string;
  };
  lastTable?: {
    title?: string;
    headers: string[];
    rows: string[][];
  };
  lastCommand?: {
    command: string;
    title?: string;
  };
  lastTopic?: string;
}

export interface StructuredTurn {
  user: string;
  assistant: string;
  visualContent?: any;
  timestamp: string;
}

export interface SessionMemoryState {
  userId: string;
  turns: StructuredTurn[];
  artifacts: ConversationArtifacts;
  summaryOfOlderTurns: string;
  lastUpdated: number;
}

// In-memory session store (keyed by userId)
const sessionStore = new Map<string, SessionMemoryState>();

export function getOrCreateSessionMemory(userId: string): SessionMemoryState {
  let session = sessionStore.get(userId);
  if (!session) {
    session = {
      userId,
      turns: [],
      artifacts: {},
      summaryOfOlderTurns: '',
      lastUpdated: Date.now(),
    };
    sessionStore.set(userId, session);
  }
  return session;
}

/**
 * Updates structured conversation memory with a new exchange and any generated artifacts
 */
export function recordExchange(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  visualContent?: any
) {
  const session = getOrCreateSessionMemory(userId);
  session.lastUpdated = Date.now();

  // 1. Record the turn
  session.turns.push({
    user: userMessage,
    assistant: assistantResponse,
    visualContent,
    timestamp: new Date().toISOString(),
  });

  // 2. Extract and index artifacts
  if (visualContent) {
    if (visualContent.type === 'code' && visualContent.code) {
      session.artifacts.lastCode = {
        language: visualContent.language || 'python',
        code: visualContent.code,
        title: visualContent.title,
        summary: visualContent.summary,
      };
    } else if (visualContent.type === 'link' && visualContent.url) {
      session.artifacts.lastLink = {
        title: visualContent.title || 'Web Portal',
        url: visualContent.url,
        summary: visualContent.summary,
      };
    } else if (visualContent.type === 'image' && visualContent.imageUrl) {
      session.artifacts.lastImage = {
        title: visualContent.title || 'Generated Image',
        prompt: visualContent.prompt || '',
        url: visualContent.imageUrl,
      };
    } else if (visualContent.type === 'table' && visualContent.tableHeaders) {
      session.artifacts.lastTable = {
        title: visualContent.title,
        headers: visualContent.tableHeaders,
        rows: visualContent.tableRows || [],
      };
    } else if (visualContent.type === 'command' && visualContent.command) {
      session.artifacts.lastCommand = {
        command: visualContent.command,
        title: visualContent.title,
      };
    }
  }

  // 3. Detect translation patterns in text
  const lowerUser = userMessage.toLowerCase();
  const lowerAssistant = assistantResponse.toLowerCase();
  if (
    lowerUser.includes('translate') ||
    lowerUser.includes('in japanese') ||
    lowerUser.includes('in spanish') ||
    lowerUser.includes('in french') ||
    lowerUser.includes('in german') ||
    lowerUser.includes('in hindi') ||
    lowerUser.includes('in telugu')
  ) {
    let targetLang = 'Japanese';
    if (lowerUser.includes('spanish')) targetLang = 'Spanish';
    if (lowerUser.includes('french')) targetLang = 'French';
    if (lowerUser.includes('german')) targetLang = 'German';
    if (lowerUser.includes('hindi')) targetLang = 'Hindi';
    if (lowerUser.includes('telugu')) targetLang = 'Telugu';

    session.artifacts.lastTranslation = {
      originalText: userMessage,
      translatedText: assistantResponse,
      targetLanguage: targetLang,
    };
  }

  // 4. Summarize older turns if context exceeds 10 turns
  if (session.turns.length > 10) {
    const olderTurns = session.turns.slice(0, session.turns.length - 8);
    const summaryItems = olderTurns.map(
      (t) => `- User asked about "${t.user.slice(0, 50)}", assistant explained or provided ${t.visualContent?.type || 'answer'}`
    );
    session.summaryOfOlderTurns = [
      session.summaryOfOlderTurns,
      ...summaryItems,
    ]
      .filter(Boolean)
      .join('\n');
    session.turns = session.turns.slice(-8); // keep 8 most recent
  }
}

/**
 * Contextual Reference Resolution:
 * Analyzes the user's prompt for pronoun references ("it", "that", "again", "repeat", "open it")
 * and injects explicit artifact resolution instructions into the AI context.
 */
export function resolveConversationReferences(
  userId: string,
  userMessage: string
): {
  enhancedPrompt: string;
  referencedArtifact?: any;
  actionIntent?: 'OPEN_WEBSITE' | 'RUN_CODE' | 'REPEAT_TRANSLATION' | 'MODIFY_CODE' | 'GENERATE_IMAGE';
} {
  const session = getOrCreateSessionMemory(userId);
  const lower = (userMessage || '').toLowerCase().trim();
  const artifacts = session.artifacts;

  // 1. "Open it" / "Open that website" / "Open the portal"
  if (
    (lower === 'open it' ||
      lower === 'open that' ||
      lower.includes('open it') ||
      lower.includes('open that website') ||
      lower.includes('open the portal') ||
      lower.includes('open this link') ||
      lower.includes('take me there')) &&
    artifacts.lastLink
  ) {
    return {
      enhancedPrompt: `[Context: User says "${userMessage}" referencing the previously displayed website/portal: "${artifacts.lastLink.title}" with URL "${artifacts.lastLink.url}". Acknowledge warmly that you've prepared the confirmation dialog to open this official website, and trigger user confirmation.]`,
      referencedArtifact: artifacts.lastLink,
      actionIntent: 'OPEN_WEBSITE',
    };
  }

  // 2. "Repeat it" / "Can you repeat it again?" / "Say it again"
  if (
    (lower.includes('repeat') ||
      lower.includes('say it again') ||
      lower.includes('repeat that') ||
      lower.includes('say that again')) &&
    artifacts.lastTranslation
  ) {
    const t = artifacts.lastTranslation;
    return {
      enhancedPrompt: `[Context: User asks to repeat previous translation. The previous ${t.targetLanguage} translation was: "${t.translatedText}". Repeat this exact translation clearly with correct pronunciation.]`,
      referencedArtifact: t,
      actionIntent: 'REPEAT_TRANSLATION',
    };
  }

  // 3. "Now add percentage calculation" / "Modify that code" / "Update it" / "Explain line 5"
  if (
    artifacts.lastCode &&
    (lower.includes('percentage') ||
      lower.includes('add to it') ||
      lower.includes('modify that') ||
      lower.includes('change it') ||
      lower.includes('update it') ||
      lower.includes('explain line') ||
      lower.includes('what does line') ||
      lower.includes('show that in') ||
      lower.includes('convert it to') ||
      lower.includes('rewrite in'))
  ) {
    return {
      enhancedPrompt: `[Context: User says "${userMessage}". "it" refers to the previously generated ${artifacts.lastCode.language} code:\n\`\`\`${artifacts.lastCode.language}\n${artifacts.lastCode.code}\n\`\`\`\nMaintain and modify this exact code rather than generating an unrelated version.]`,
      referencedArtifact: artifacts.lastCode,
      actionIntent: 'MODIFY_CODE',
    };
  }

  // 4. "Run it" / "Run that code" / "Execute it"
  if (
    artifacts.lastCode &&
    (lower === 'run it' ||
      lower === 'run that code' ||
      lower.includes('run that code') ||
      lower.includes('execute that') ||
      lower.includes('execute the code'))
  ) {
    return {
      enhancedPrompt: `[Context: User requested to run the active code. The code to execute is ${artifacts.lastCode.language} code:\n${artifacts.lastCode.code}]`,
      referencedArtifact: artifacts.lastCode,
      actionIntent: 'RUN_CODE',
    };
  }

  // 5. "Generate it again" / "Change the background" for image
  if (
    artifacts.lastImage &&
    (lower.includes('generate it again') ||
      lower.includes('another image') ||
      lower.includes('change the background of that image'))
  ) {
    return {
      enhancedPrompt: `[Context: User is referring to the previous image with prompt "${artifacts.lastImage.prompt}". Generate an updated version.]`,
      referencedArtifact: artifacts.lastImage,
      actionIntent: 'GENERATE_IMAGE',
    };
  }

  return { enhancedPrompt: userMessage };
}

/**
 * Formats structured memory context for prompt injection
 */
export function buildMemoryContextPrompt(userId: string): string {
  const session = getOrCreateSessionMemory(userId);
  const parts: string[] = [];

  if (session.summaryOfOlderTurns) {
    parts.push(`Summary of earlier session context:\n${session.summaryOfOlderTurns}`);
  }

  const art = session.artifacts;
  const activeArtifacts: string[] = [];
  if (art.lastCode) {
    activeArtifacts.push(`- Active Code (${art.lastCode.language}): "${art.lastCode.title || 'Code Snippet'}"\n  \`\`\`${art.lastCode.language}\n  ${art.lastCode.code.slice(0, 300)}...\n  \`\`\``);
  }
  if (art.lastLink) {
    activeArtifacts.push(`- Active Link/Portal: "${art.lastLink.title}" (${art.lastLink.url})`);
  }
  if (art.lastImage) {
    activeArtifacts.push(`- Active Generated Image: "${art.lastImage.title}" (Prompt: ${art.lastImage.prompt})`);
  }
  if (art.lastTranslation) {
    activeArtifacts.push(`- Active Translation: "${art.lastTranslation.translatedText}" (${art.lastTranslation.targetLanguage})`);
  }
  if (art.lastTable) {
    activeArtifacts.push(`- Active Comparison Table: "${art.lastTable.title || 'Table'}" (${art.lastTable.headers.join(' vs ')})`);
  }

  if (activeArtifacts.length > 0) {
    parts.push(`CURRENT ACTIVE CONVERSATION ARTIFACTS (Resolve pronouns like "it", "that", "repeat", "open it", "modify it" using these):\n${activeArtifacts.join('\n')}`);
  }

  return parts.join('\n\n');
}
