import fs from 'fs';
import path from 'path';
import type { User, MemoryItem, TopicProgress, MistakeRecord, ChatMessage, VoiceNote, StudyPlan } from '../src/types.ts';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filename: string, defaultValue: T): T {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn(`[Storage] Notice reading ${filename}:`, err);
  }
  return defaultValue;
}

function writeJsonFile<T>(filename: string, data: T): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[Storage] Notice writing ${filename}:`, err);
  }
}

// Initial Seed Data for Abhishek
const defaultUsers: User[] = [
  {
    id: 'user_abhishek',
    name: 'Abhishek',
    email: 'abhishek@aura.ai',
    education: 'Computer Science Engineering',
    interests: ['AI', 'Software Development', 'Algorithms'],
    careerArea: 'Software Development & AI Engineering',
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
  }
];

const defaultMemories: MemoryItem[] = [
  {
    id: 'mem_1',
    userId: 'user_abhishek',
    category: 'GOAL',
    title: 'Career Placement',
    content: 'Preparing for software engineering placements and campus interviews',
    confidence: 0.95,
    source: 'User stated during study planning',
    date: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'mem_2',
    userId: 'user_abhishek',
    category: 'INTEREST',
    title: 'Core Interests',
    content: 'Deeply interested in Artificial Intelligence and Software Development',
    confidence: 0.9,
    source: 'User profile discussion',
    date: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'mem_3',
    userId: 'user_abhishek',
    category: 'OBSERVED_PATTERN',
    title: 'Strong Foundation in Python & Arrays',
    content: 'Consistently demonstrates strong problem solving with Python syntax and Array manipulations',
    confidence: 0.92,
    source: 'Practice quizzes and code exercises',
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'mem_4',
    userId: 'user_abhishek',
    category: 'MISTAKE',
    title: 'Dynamic Programming Practice Need',
    content: 'Struggles with identifying state transitions and memoization table structure in DP',
    confidence: 0.88,
    source: 'Self-reported and recent quiz results',
    date: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'mem_5',
    userId: 'user_abhishek',
    category: 'PREFERENCE',
    title: 'Learning Style',
    content: 'Prefers real-world analogies first before dense formal definitions',
    confidence: 0.85,
    source: 'Observed during binary search explanation',
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
  }
];

const defaultTopics: Record<string, TopicProgress[]> = {
  user_abhishek: [
    {
      topic: 'Python Basics & OOP',
      category: 'Programming',
      level: 'strong',
      questionsAttempted: 25,
      correct: 23,
      commonMistakes: [],
      lastStudied: new Date(Date.now() - 3 * 86400000).toISOString(),
      needsRevision: false,
    },
    {
      topic: 'Arrays & Two Pointers',
      category: 'Data Structures',
      level: 'strong',
      questionsAttempted: 30,
      correct: 27,
      commonMistakes: ['Off-by-one boundary index'],
      lastStudied: new Date(Date.now() - 2 * 86400000).toISOString(),
      needsRevision: false,
    },
    {
      topic: 'Binary Trees & BST',
      category: 'Data Structures',
      level: 'developing',
      questionsAttempted: 15,
      correct: 10,
      commonMistakes: ['inorder vs preorder confusion', 'Null check on leaf nodes'],
      lastStudied: new Date(Date.now() - 1 * 86400000).toISOString(),
      needsRevision: true,
    },
    {
      topic: 'SQL & Database Queries',
      category: 'Databases',
      level: 'developing',
      questionsAttempted: 12,
      correct: 8,
      commonMistakes: ['LEFT JOIN vs INNER JOIN null handling'],
      lastStudied: new Date(Date.now() - 4 * 86400000).toISOString(),
      needsRevision: false,
    },
    {
      topic: 'Dynamic Programming',
      category: 'Algorithms',
      level: 'needs_practice',
      questionsAttempted: 14,
      correct: 4,
      commonMistakes: ['Difficulty identifying state transition', 'Overlapping subproblem memoization bounds'],
      lastStudied: new Date(Date.now() - 1 * 86400000).toISOString(),
      needsRevision: true,
    },
    {
      topic: 'Graph Algorithms & BFS',
      category: 'Algorithms',
      level: 'needs_practice',
      questionsAttempted: 9,
      correct: 3,
      commonMistakes: ['BFS complexity calculation mistake (O(V+E))', 'Forgetting visited set in cycle detection'],
      lastStudied: new Date(Date.now() - 2 * 86400000).toISOString(),
      needsRevision: true,
    }
  ]
};

const defaultMistakes: MistakeRecord[] = [
  {
    id: 'mst_1',
    userId: 'user_abhishek',
    subject: 'DSA',
    topic: 'Tree Traversal',
    mistakeDescription: 'Inorder vs Preorder confusion during recursive visits',
    date: new Date(Date.now() - 1 * 86400000).toISOString(),
    revised: false,
  },
  {
    id: 'mst_2',
    userId: 'user_abhishek',
    subject: 'DSA',
    topic: 'Graphs',
    mistakeDescription: 'BFS time complexity mistaken as O(V*E) instead of O(V + E)',
    date: new Date(Date.now() - 2 * 86400000).toISOString(),
    revised: false,
  },
  {
    id: 'mst_3',
    userId: 'user_abhishek',
    subject: 'DSA',
    topic: 'Dynamic Programming',
    mistakeDescription: 'Difficulty identifying DP state parameters for 0/1 Knapsack',
    date: new Date(Date.now() - 3 * 86400000).toISOString(),
    revised: false,
  }
];

const defaultNotes: VoiceNote[] = [
  {
    id: 'note_1',
    userId: 'user_abhishek',
    title: 'Revise Binary Trees',
    content: 'Review difference between pre-order, in-order, and post-order traversals before tomorrow.',
    tags: ['DSA', 'Trees', 'Urgent'],
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'note_2',
    userId: 'user_abhishek',
    title: 'Placement Practice List',
    content: 'Finish 2 medium tree problems on LeetCode and dynamic programming memoization template.',
    tags: ['Placement', 'Plan'],
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  }
];

const defaultConversations: Record<string, { id: string; title: string; updatedAt: string; messages: ChatMessage[] }[]> = {
  user_abhishek: [
    {
      id: 'conv_yesterday',
      title: 'DSA Revision — Binary Trees & Traversal',
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
      messages: [
        {
          id: 'msg_1',
          role: 'assistant',
          text: 'Good afternoon, Abhishek. Ready for our DSA revision?',
          timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
        },
        {
          id: 'msg_2',
          role: 'user',
          text: 'Yes, let us focus on Binary Trees today.',
          timestamp: new Date(Date.now() - 1 * 86400000 + 30000).toISOString(),
        },
        {
          id: 'msg_3',
          role: 'assistant',
          text: 'Great. We reviewed root, children, and started traversal order. Let us continue soon.',
          timestamp: new Date(Date.now() - 1 * 86400000 + 60000).toISOString(),
        }
      ]
    }
  ]
};

export class StorageEngine {
  private users: User[];
  private memories: MemoryItem[];
  private topics: Record<string, TopicProgress[]>;
  private mistakes: MistakeRecord[];
  private notes: VoiceNote[];
  private conversations: Record<string, { id: string; title: string; updatedAt: string; messages: ChatMessage[] }[]>;

  constructor() {
    this.users = readJsonFile<User[]>('users.json', defaultUsers);
    this.memories = readJsonFile<MemoryItem[]>('memories.json', defaultMemories);
    this.topics = readJsonFile<Record<string, TopicProgress[]>>('topics.json', defaultTopics);
    this.mistakes = readJsonFile<MistakeRecord[]>('mistakes.json', defaultMistakes);
    this.notes = readJsonFile<VoiceNote[]>('notes.json', defaultNotes);
    this.conversations = readJsonFile<Record<string, { id: string; title: string; updatedAt: string; messages: ChatMessage[] }[]>>('conversations.json', defaultConversations);
  }

  // Users
  getUserById(userId: string): User | undefined {
    return this.users.find(u => u.id === userId);
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  createUser(user: User): User {
    this.users.push(user);
    writeJsonFile('users.json', this.users);

    // Initialize default profile for new user
    this.topics[user.id] = [
      {
        topic: 'Core Fundamentals',
        category: 'Basics',
        level: 'developing',
        questionsAttempted: 0,
        correct: 0,
        commonMistakes: [],
        lastStudied: new Date().toISOString(),
        needsRevision: false,
      }
    ];
    writeJsonFile('topics.json', this.topics);
    return user;
  }

  // Memories (RAG)
  getUserMemories(userId: string): MemoryItem[] {
    return this.memories.filter(m => m.userId === userId);
  }

  addMemory(memory: Omit<MemoryItem, 'id' | 'date'>): MemoryItem {
    const newMem: MemoryItem = {
      ...memory,
      id: 'mem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      date: new Date().toISOString(),
    };
    this.memories.push(newMem);
    writeJsonFile('memories.json', this.memories);
    return newMem;
  }

  updateMemory(id: string, userId: string, updates: Partial<MemoryItem>): MemoryItem | null {
    const idx = this.memories.findIndex(m => m.id === id && m.userId === userId);
    if (idx !== -1) {
      this.memories[idx] = { ...this.memories[idx], ...updates };
      writeJsonFile('memories.json', this.memories);
      return this.memories[idx];
    }
    return null;
  }

  deleteMemory(id: string, userId: string): boolean {
    const initialLen = this.memories.length;
    this.memories = this.memories.filter(m => !(m.id === id && m.userId === userId));
    if (this.memories.length !== initialLen) {
      writeJsonFile('memories.json', this.memories);
      return true;
    }
    return false;
  }

  clearUserMemories(userId: string): void {
    this.memories = this.memories.filter(m => m.userId !== userId);
    writeJsonFile('memories.json', this.memories);
  }

  // Learning & Topics
  getUserTopics(userId: string): TopicProgress[] {
    return this.topics[userId] || [];
  }

  updateUserTopic(userId: string, topicName: string, updates: Partial<TopicProgress>): TopicProgress {
    if (!this.topics[userId]) {
      this.topics[userId] = [];
    }
    let topic = this.topics[userId].find(t => t.topic.toLowerCase() === topicName.toLowerCase());
    if (topic) {
      Object.assign(topic, updates);
    } else {
      topic = {
        topic: topicName,
        category: updates.category || 'General',
        level: updates.level || 'developing',
        questionsAttempted: updates.questionsAttempted || 1,
        correct: updates.correct || 1,
        commonMistakes: updates.commonMistakes || [],
        lastStudied: new Date().toISOString(),
        needsRevision: updates.needsRevision ?? false,
      };
      this.topics[userId].push(topic);
    }
    writeJsonFile('topics.json', this.topics);
    return topic;
  }

  // Mistake Journal
  getUserMistakes(userId: string): MistakeRecord[] {
    return this.mistakes.filter(m => m.userId === userId);
  }

  addMistake(mistake: Omit<MistakeRecord, 'id' | 'date'>): MistakeRecord {
    const newRecord: MistakeRecord = {
      ...mistake,
      id: 'mst_' + Date.now(),
      date: new Date().toISOString(),
    };
    this.mistakes.push(newRecord);
    writeJsonFile('mistakes.json', this.mistakes);
    return newRecord;
  }

  markMistakeRevised(id: string, userId: string): void {
    const item = this.mistakes.find(m => m.id === id && m.userId === userId);
    if (item) {
      item.revised = true;
      writeJsonFile('mistakes.json', this.mistakes);
    }
  }

  // Voice Notes
  getUserNotes(userId: string): VoiceNote[] {
    return this.notes.filter(n => n.userId === userId);
  }

  addNote(note: Omit<VoiceNote, 'id' | 'createdAt'>): VoiceNote {
    const newNote: VoiceNote = {
      ...note,
      id: 'note_' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    this.notes.push(newNote);
    writeJsonFile('notes.json', this.notes);
    return newNote;
  }

  deleteNote(id: string, userId: string): boolean {
    const len = this.notes.length;
    this.notes = this.notes.filter(n => !(n.id === id && n.userId === userId));
    if (this.notes.length !== len) {
      writeJsonFile('notes.json', this.notes);
      return true;
    }
    return false;
  }

  // Conversations
  getUserConversations(userId: string) {
    return this.conversations[userId] || [];
  }

  saveConversation(userId: string, convId: string, title: string, messages: ChatMessage[]) {
    if (!this.conversations[userId]) {
      this.conversations[userId] = [];
    }
    const existing = this.conversations[userId].find(c => c.id === convId);
    if (existing) {
      existing.title = title || existing.title;
      existing.messages = messages;
      existing.updatedAt = new Date().toISOString();
    } else {
      this.conversations[userId].unshift({
        id: convId,
        title: title || 'Conversation',
        updatedAt: new Date().toISOString(),
        messages,
      });
    }
    writeJsonFile('conversations.json', this.conversations);
  }
}

export const storage = new StorageEngine();
