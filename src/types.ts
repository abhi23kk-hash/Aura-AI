export type AssistantState =
  | 'IDLE'
  | 'GREETING'
  | 'CONNECTING'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'INTERRUPTED'
  | 'ERROR';

export interface User {
  id: string;
  name: string;
  email: string;
  education?: string;
  interests?: string[];
  careerArea?: string;
  createdAt: string;
}

export type MemoryCategory =
  | 'FACT'
  | 'GOAL'
  | 'PREFERENCE'
  | 'OBSERVED_PATTERN'
  | 'SKILL'
  | 'MISTAKE'
  | 'INTEREST';

export interface MemoryItem {
  id: string;
  userId: string;
  category: MemoryCategory;
  title: string;
  content: string;
  confidence: number;
  source: string;
  date: string;
}

export interface TopicProgress {
  topic: string;
  category: string;
  level: 'strong' | 'developing' | 'needs_practice';
  questionsAttempted: number;
  correct: number;
  commonMistakes: string[];
  lastStudied: string;
  needsRevision: boolean;
}

export interface MistakeRecord {
  id: string;
  userId: string;
  subject: string;
  topic: string;
  mistakeDescription: string;
  date: string;
  revised: boolean;
}

export interface VisualContentData {
  type: 'code' | 'link' | 'command' | 'table' | 'steps' | 'list' | 'image' | 'preview';
  title?: string;
  code?: string;
  language?: string;
  url?: string;
  urlLabel?: string;
  command?: string;
  tableHeaders?: string[];
  tableRows?: string[][];
  items?: string[];
  summary?: string;
  imageUrl?: string;
  prompt?: string;
  aspectRatio?: string;
  status?: 'generating' | 'completed' | 'failed';
  error?: string;
  executionOutput?: string;
  executionError?: string;
  executionTimeMs?: number;
  isExecuting?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  audioUrl?: string;
  timestamp: string;
  language?: string;
  interrupted?: boolean;
  toolCalls?: string[];
  visualUrl?: string;
  visualContent?: VisualContentData;
  citations?: { title: string; url: string }[];
  isQuiz?: boolean;
}

export interface VoiceNote {
  id: string;
  userId: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export interface StudyPlanItem {
  day: number;
  topic: string;
  tasks: string[];
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  userId: string;
  title: string;
  durationDays: number;
  items: StudyPlanItem[];
  createdAt: string;
}

export interface ConversationSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  voiceSpeed: number;
  voiceName: string;
  handsFree: boolean;
  interruptibility: boolean;
  wakeWordEnabled: boolean;
  memoryEnabled: boolean;
  webSearchEnabled: boolean;
  languageMode: 'auto' | 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'mr' | 'bn' | 'ur';
  ttsEngine: 'gemini' | 'browser';
  theme: 'dark' | 'light' | 'system';
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  voiceSpeed: 1.05,
  voiceName: 'Kore',
  handsFree: false,
  interruptibility: true,
  wakeWordEnabled: false,
  memoryEnabled: true,
  webSearchEnabled: true,
  languageMode: 'auto',
  ttsEngine: 'browser',
  theme: 'dark',
};
