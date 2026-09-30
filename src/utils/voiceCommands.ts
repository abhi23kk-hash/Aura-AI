// Direct voice command processor & client-side intelligence

export interface ParsedVoiceCommand {
  type: 'NAVIGATION' | 'NOTE' | 'TIMER' | 'FILTER' | 'MUTE' | 'CLEAR' | 'KNOWLEDGE' | 'CHAT';
  targetTab?: 'assistant' | 'learning' | 'memory' | 'notes' | 'history';
  noteContent?: string;
  timerDurationSeconds?: number;
  timerLabel?: string;
  filterAction?: 'enable' | 'disable' | 'toggle';
  speechResponse: string;
  displayCard?: {
    title: string;
    body: string;
    category?: string;
    chips?: string[];
  };
}

// Local technical knowledge repository for instant, zero-latency answers
const KNOWLEDGE_BASE: Record<string, { answer: string; displayTitle: string; chips: string[] }> = {
  'dfs': {
    displayTitle: 'Depth-First Search (DFS)',
    answer: 'DFS is a graph traversal algorithm that explores as deep as possible along each branch before backtracking. It uses a Stack or recursion, has a time complexity of O(V + E), and is great for cycle detection, topological sorting, and maze solving.',
    chips: ['DFS vs BFS', 'Topological Sort', 'Time Complexity of DFS'],
  },
  'bfs': {
    displayTitle: 'Breadth-First Search (BFS)',
    answer: 'BFS is a graph traversal algorithm that explores all neighbor nodes at the present depth level before moving deeper. It uses a Queue (FIFO), runs in O(V + E) time, and is the standard way to find the shortest path in unweighted graphs.',
    chips: ['BFS vs DFS', 'Shortest Path Algorithm', 'Queue implementation'],
  },
  'tree': {
    displayTitle: 'Tree Data Structures',
    answer: 'A tree is a non-linear, hierarchical data structure of nodes connected by edges, starting from a single Root node. Each child has exactly one parent. Common types include Binary Trees, Binary Search Trees, AVL Trees, and Tries.',
    chips: ['Binary Search Tree', 'Tree Traversals', 'AVL Tree'],
  },
  'quicksort': {
    displayTitle: 'QuickSort Algorithm',
    answer: 'QuickSort is a divide-and-conquer sorting algorithm. It selects a pivot, partitions elements into smaller and greater subsets, and recursively sorts them. Its average time complexity is O(N log N), while worst-case is O(N²).',
    chips: ['MergeSort vs QuickSort', 'Pivot Selection', 'Time Complexity'],
  },
  'mergesort': {
    displayTitle: 'MergeSort Algorithm',
    answer: 'MergeSort is a stable, divide-and-conquer sorting algorithm. It divides the array in half, sorts each half recursively, and merges them. It guarantees O(N log N) time complexity in all cases with O(N) auxiliary space.',
    chips: ['QuickSort vs MergeSort', 'Inversion Count', 'Stable Sorting'],
  },
  'system design': {
    displayTitle: 'System Design Fundamentals',
    answer: 'Key building blocks of scalable system design include: Load Balancers (like Nginx), Reverse Proxies, Caching (Redis/Memcached), Database Sharding & Replication, Message Queues (Kafka/RabbitMQ), and CDN delivery.',
    chips: ['Load Balancers', 'Database Sharding', 'Microservices vs Monolith'],
  },
  'dynamic programming': {
    displayTitle: 'Dynamic Programming (DP)',
    answer: 'Dynamic Programming optimizes recursive problems with Overlapping Subproblems and Optimal Substructure. We either use Top-Down with Memoization, or Bottom-Up Tabulation to avoid redundant calculations.',
    chips: ['0/1 Knapsack', 'Longest Common Subsequence', 'Fibonacci DP'],
  },
};

export function parseVoiceCommand(input: string): ParsedVoiceCommand | null {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  // Strip leading wake phrases
  const normalized = lower
    .replace(/^(hey aura|aura|hey assistant|assistant|hey google|ok google|okay google)\s*,?\s*/i, '')
    .trim();

  // 1. Navigation Commands
  if (
    normalized.includes('open learning') ||
    normalized.includes('go to learning') ||
    normalized.includes('show learning') ||
    normalized.includes('learning dashboard')
  ) {
    return {
      type: 'NAVIGATION',
      targetTab: 'learning',
      speechResponse: 'Opening your Learning Dashboard.',
      displayCard: {
        title: 'Navigating to Learning Dashboard',
        body: 'Viewing your topic mastery, revision schedule, and mistake logs.',
        chips: ['Review Trees', 'Check System Design', 'DSA Practice'],
      },
    };
  }

  if (
    normalized.includes('open memory') ||
    normalized.includes('go to memory') ||
    normalized.includes('show memory') ||
    normalized.includes('what do you know about me') ||
    normalized.includes('my memory')
  ) {
    return {
      type: 'NAVIGATION',
      targetTab: 'memory',
      speechResponse: 'Opening your Memory and Profile insights.',
      displayCard: {
        title: 'User Memory & Profile',
        body: 'Showing stored career goals (CSE 3rd Year), learned patterns, and study preferences.',
        chips: ['Update Goals', 'Add Preference', 'View Skills'],
      },
    };
  }

  if (
    normalized.includes('open notes') ||
    normalized.includes('go to notes') ||
    normalized.includes('show notes') ||
    normalized.includes('my notes') ||
    normalized.includes('study plan')
  ) {
    return {
      type: 'NAVIGATION',
      targetTab: 'notes',
      speechResponse: 'Opening your Study Notes and preparation plans.',
      displayCard: {
        title: 'Study Notes & Plans',
        body: 'Accessing your quick audio memos, technical summaries, and study schedule.',
        chips: ['New Note', 'View 7-Day Plan', 'DSA Checkpoints'],
      },
    };
  }

  if (
    normalized.includes('open history') ||
    normalized.includes('go to history') ||
    normalized.includes('show history') ||
    normalized.includes('past conversations')
  ) {
    return {
      type: 'NAVIGATION',
      targetTab: 'history',
      speechResponse: 'Opening your conversation history.',
      displayCard: {
        title: 'Conversation History',
        body: 'Browsing past study sessions and recorded voice discussions.',
        chips: ['Latest Session', 'Filter by DSA', 'Export Session'],
      },
    };
  }

  if (
    normalized.includes('go to assistant') ||
    normalized.includes('go home') ||
    normalized.includes('open assistant') ||
    normalized.includes('back to assistant')
  ) {
    return {
      type: 'NAVIGATION',
      targetTab: 'assistant',
      speechResponse: 'Returning to assistant view.',
    };
  }

  // 2. Note Taking Command
  const noteMatch = normalized.match(/(?:take a note|add a note|create note|write down|remember that)\s+(.*)/i);
  if (noteMatch && noteMatch[1]) {
    const noteText = noteMatch[1].trim();
    return {
      type: 'NOTE',
      noteContent: noteText,
      speechResponse: `Got it. I saved that note to your study notebook.`,
      displayCard: {
        title: 'Note Saved to Notebook',
        body: `"${noteText}"`,
        category: 'Quick Note',
        chips: ['View All Notes', 'Add Tag', 'Practice Note'],
      },
    };
  }

  // 3. Timer Command
  const timerMatch = normalized.match(/(?:start|set|create)\s+(?:a\s+)?(\d+)\s*(minute|min|second|sec)s?\s*(?:timer|countdown)?/i);
  if (timerMatch) {
    const amount = parseInt(timerMatch[1], 10);
    const unit = timerMatch[2].toLowerCase();
    const seconds = unit.startsWith('min') ? amount * 60 : amount;
    return {
      type: 'TIMER',
      timerDurationSeconds: seconds,
      timerLabel: `${amount} ${unit} Timer`,
      speechResponse: `Starting a ${amount} ${unit} countdown timer for your study session.`,
      displayCard: {
        title: `${amount} ${unit.toUpperCase()} TIMER RUNNING`,
        body: 'Timer active. Stay focused on your technical problem.',
        chips: ['Pause', 'Reset', 'Cancel Timer'],
      },
    };
  }

  // 4. Noise Filter Toggle Command
  if (
    normalized.includes('turn on noise') ||
    normalized.includes('enable noise') ||
    normalized.includes('activate noise filter')
  ) {
    return {
      type: 'FILTER',
      filterAction: 'enable',
      speechResponse: 'Acoustic noise filter is now active.',
      displayCard: {
        title: 'Acoustic Noise Filter Enabled',
        body: 'Mains hum, room reflections, and ambient hiss are actively suppressed.',
      },
    };
  }

  if (
    normalized.includes('turn off noise') ||
    normalized.includes('disable noise filter')
  ) {
    return {
      type: 'FILTER',
      filterAction: 'disable',
      speechResponse: 'Acoustic noise filter disabled.',
    };
  }

  // 5. Clear conversation
  if (
    normalized.includes('clear chat') ||
    normalized.includes('clear conversation') ||
    normalized.includes('clear messages') ||
    normalized.includes('reset conversation')
  ) {
    return {
      type: 'CLEAR',
      speechResponse: 'Conversation cleared. What would you like to study next?',
    };
  }

  // 6. Direct Technical Knowledge Matching (instant client-side response)
  for (const [key, data] of Object.entries(KNOWLEDGE_BASE)) {
    if (normalized.includes(key)) {
      return {
        type: 'KNOWLEDGE',
        speechResponse: data.answer,
        displayCard: {
          title: data.displayTitle,
          body: data.answer,
          chips: data.chips,
        },
      };
    }
  }

  return null;
}
