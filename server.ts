import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { storage } from './server/storage.ts';
import { processAuraChat, generateGeminiSpeech, transcribeAudio, isDemoMode, generateGeminiImage } from './server/gemini.ts';
import { setupLiveRelay } from './server/liveRelay.ts';
import { executeCode } from './server/codeRunner.ts';
import { prepareTextForSpeech } from './src/utils/speechSanitizer.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Mount real-time Gemini Live WebSocket relay
  setupLiveRelay(server);

  // JSON body parser with large payload limit for multi-modal images & documents
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // --- API ROUTES ---

  // Health & Status
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      demoMode: isDemoMode(),
      version: 'AURA-1.0.0',
    });
  });

  // Auth: Users list (for quick testing/switching)
  app.get('/api/auth/users', (req, res) => {
    const defaultUser = storage.getUserById('user_abhishek');
    res.json({
      users: defaultUser ? [defaultUser] : [],
    });
  });

  // Auth: Register
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, education, interests, careerArea } = req.body;
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const existing = storage.getUserByEmail(email);
    if (existing) {
      return res.json({ user: existing, message: 'Existing user logged in' });
    }

    const newUser = storage.createUser({
      id: 'user_' + Date.now(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      education: education?.trim() || undefined,
      interests: Array.isArray(interests) ? interests : interests ? [interests] : [],
      careerArea: careerArea?.trim() || undefined,
      createdAt: new Date().toISOString(),
    });

    res.json({ user: newUser });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    let user = storage.getUserByEmail(email);
    if (!user) {
      // Create user automatically if not found for seamless trial
      const name = email.split('@')[0];
      const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
      user = storage.createUser({
        id: 'user_' + Date.now(),
        name: capitalizedName,
        email: email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
      });
    }

    res.json({ user });
  });

  // Auth: Get Current User Profile
  app.get('/api/auth/me', (req, res) => {
    const userId = (req.query.userId as string) || 'user_abhishek';
    const user = storage.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  });

  // Personalized Greeting
  app.get('/api/greeting', (req, res) => {
    const userId = (req.query.userId as string) || 'user_abhishek';
    const clientHour = parseInt(req.query.hour as string) || new Date().getHours();
    const user = storage.getUserById(userId);
    const name = user ? user.name : 'there';

    let timeOfDay = 'day';
    if (clientHour >= 5 && clientHour < 12) timeOfDay = 'morning';
    else if (clientHour >= 12 && clientHour < 17) timeOfDay = 'afternoon';
    else if (clientHour >= 17 && clientHour < 21) timeOfDay = 'evening';
    else timeOfDay = 'night';

    // Check if relevant conversation history exists
    const convs = storage.getUserConversations(userId);
    let greetingText = '';
    let hasPreviousContext = false;

    if (convs.length > 0) {
      // Find the most recent topic
      const recentConv = convs[0];
      const titleLower = recentConv.title.toLowerCase();
      if (titleLower.includes('dsa') || titleLower.includes('tree') || titleLower.includes('algorithm')) {
        greetingText = `Good ${timeOfDay}, ${name}. We were working on DSA yesterday. Would you like to continue?`;
        hasPreviousContext = true;
      } else {
        greetingText = `Good ${timeOfDay}, ${name}. We were exploring ${recentConv.title} recently. Would you like to continue?`;
        hasPreviousContext = true;
      }
    }

    if (!greetingText) {
      greetingText = `Good ${timeOfDay}, ${name}. How can I help you today?`;
    }

    res.json({
      greeting: greetingText,
      name,
      timeOfDay,
      hasPreviousContext,
    });
  });

  // Chat Processing
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        userId = 'user_abhishek',
        userMessage,
        conversationHistory = [],
        imageAttachment,
        documentAttachment,
        enableWebSearch = true,
      } = req.body;

      if (!userMessage && !imageAttachment && !documentAttachment) {
        return res.status(400).json({ error: 'Message or attachment required' });
      }

      // 1. Retrieve user-specific memories (RAG)
      const allMemories = storage.getUserMemories(userId);
      // Rank/filter memories relevant to current input or keep top relevant
      const lower = (userMessage || '').toLowerCase();
      const relevantMemories = allMemories.filter(m => {
        const memContent = m.content.toLowerCase();
        return (
          m.category === 'GOAL' ||
          m.category === 'PREFERENCE' ||
          lower.split(' ').some(w => w.length > 3 && memContent.includes(w))
        );
      }).slice(0, 6);

      // 2. Retrieve learning profile
      const learningProfile = storage.getUserTopics(userId);

      // 3. Process via Gemini or adaptive engine
      const result = await processAuraChat({
        userId,
        userMessage,
        conversationHistory,
        relevantMemories,
        learningProfile,
        imageAttachment,
        documentAttachment,
        enableWebSearch,
      });

      res.json(result);
    } catch (err: any) {
      console.warn('[AURA] Notice in /api/chat, using resilient fallback:', err?.message || err);
      res.json({
        text: "I'm right here with you. What would you like to explore next in our study session?",
        language: 'en',
      });
    }
  });

  // Text-To-Speech (Gemini TTS)
  app.post('/api/tts', async (req, res) => {
    try {
      const { text, voiceName = 'Kore' } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required for TTS' });
      }

      // Dedicated Speech Sanitization Layer
      // Eliminates markdown, syntax characters, and creates clean natural speech
      const spokenText = prepareTextForSpeech(text);
      const audioBase64 = await generateGeminiSpeech(spokenText, voiceName);
      if (audioBase64) {
        return res.json({ audio: audioBase64, format: 'audio/pcm;rate=24000' });
      } else {
        return res.json({ fallback: true, message: 'Use browser SpeechSynthesis for low-latency audio' });
      }
    } catch (err: any) {
      console.warn('[AURA] TTS endpoint fallback to browser voice:', err?.message || err);
      res.json({ fallback: true });
    }
  });

  // Audio Speech Transcription (High-reliability fallback for browsers/iframes without Web Speech API)
  app.post('/api/transcribe', async (req, res) => {
    try {
      const { audio, mimeType = 'audio/webm' } = req.body;
      if (!audio) {
        return res.status(400).json({ error: 'Audio data is required' });
      }
      const transcribedText = await transcribeAudio(audio, mimeType);
      res.json({ text: transcribedText });
    } catch (err: any) {
      console.warn('[AURA] Transcription route error:', err?.message || err);
      res.json({ text: '' });
    }
  });

  // Isolated Code Execution Endpoint (Python, JavaScript sandbox)
  app.post('/api/execute-code', async (req, res) => {
    try {
      const { code, language = 'python', stdin } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'Code is required for execution' });
      }
      const result = await executeCode(language, code, stdin);
      res.json(result);
    } catch (err: any) {
      console.error('[AURA CodeRunner] Execution error:', err);
      res.status(500).json({
        success: false,
        stdout: '',
        stderr: err?.message || 'Execution error in sandbox',
        exitCode: 1,
        executionTimeMs: 0,
        language: req.body?.language || 'python',
      });
    }
  });

  // Image Generation Endpoint (calls Google's supported Gemini image models)
  app.post('/api/generate-image', async (req, res) => {
    try {
      const { prompt = '', title, aspectRatio = '1:1', imageSize = '1K' } = req.body;
      const cleanPrompt = (prompt || '').trim();
      if (!cleanPrompt) {
        return res.status(400).json({ success: false, error: 'Prompt is required' });
      }

      let resolvedTitle = title;
      if (!resolvedTitle) {
        resolvedTitle = cleanPrompt.length > 35 
          ? cleanPrompt.slice(0, 35).replace(/\s+\S*$/, '') + '...'
          : cleanPrompt;
        resolvedTitle = resolvedTitle.charAt(0).toUpperCase() + resolvedTitle.slice(1);
      }

      const result = await generateGeminiImage(cleanPrompt, { aspectRatio, imageSize });

      if (result.success && result.imageUrl) {
        res.json({
          success: true,
          imageUrl: result.imageUrl,
          mimeType: result.mimeType,
          prompt: cleanPrompt,
          title: resolvedTitle,
        });
      } else {
        console.error('[AURA ImageGen] Generation failed:', result.error);
        const isQuota = result.error?.includes('Quota') || result.error?.includes('429');
        res.status(isQuota ? 429 : 500).json({
          success: false,
          error: result.error || 'Failed to generate image',
          prompt: cleanPrompt,
          title: resolvedTitle,
        });
      }
    } catch (err: any) {
      console.error('[AURA ImageGen] Generation exception:', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to generate image',
      });
    }
  });

  // Memory endpoints
  app.get('/api/memory', (req, res) => {
    const userId = (req.query.userId as string) || 'user_abhishek';
    const memories = storage.getUserMemories(userId);
    res.json({ memories });
  });

  app.post('/api/memory', (req, res) => {
    const { userId = 'user_abhishek', category, title, content, confidence = 0.9, source = 'User edited' } = req.body;
    if (!content || !category) {
      return res.status(400).json({ error: 'Category and content are required' });
    }
    const mem = storage.addMemory({
      userId,
      category,
      title: title || `${category} Note`,
      content,
      confidence,
      source,
    });
    res.json({ memory: mem });
  });

  app.put('/api/memory/:id', (req, res) => {
    const { id } = req.params;
    const { userId = 'user_abhishek', title, content, category } = req.body;
    const updated = storage.updateMemory(id, userId, { title, content, category });
    if (!updated) {
      return res.status(404).json({ error: 'Memory item not found' });
    }
    res.json({ memory: updated });
  });

  app.delete('/api/memory/:id', (req, res) => {
    const { id } = req.params;
    const userId = (req.query.userId as string) || 'user_abhishek';
    const success = storage.deleteMemory(id, userId);
    res.json({ success });
  });

  app.delete('/api/memory-clear', (req, res) => {
    const userId = (req.query.userId as string) || 'user_abhishek';
    storage.clearUserMemories(userId);
    res.json({ success: true, message: 'All memories cleared' });
  });

  // Learning Endpoints
  app.get('/api/learning', (req, res) => {
    const userId = (req.query.userId as string) || 'user_abhishek';
    const topics = storage.getUserTopics(userId);
    const mistakes = storage.getUserMistakes(userId);

    const strong = topics.filter(t => t.level === 'strong');
    const developing = topics.filter(t => t.level === 'developing');
    const needsPractice = topics.filter(t => t.level === 'needs_practice');
    const revisionRecommended = topics.filter(t => t.needsRevision);

    res.json({
      topics,
      strong,
      developing,
      needsPractice,
      revisionRecommended,
      mistakes,
    });
  });

  app.post('/api/learning/quiz-result', (req, res) => {
    const { userId = 'user_abhishek', topic, isCorrect, mistakeDescription } = req.body;
    const topics = storage.getUserTopics(userId);
    const existing = topics.find(t => t.topic.toLowerCase() === (topic || '').toLowerCase());

    const attempted = (existing?.questionsAttempted || 0) + 1;
    const correct = (existing?.correct || 0) + (isCorrect ? 1 : 0);
    const ratio = correct / attempted;

    let level: 'strong' | 'developing' | 'needs_practice' = 'developing';
    if (attempted >= 5) {
      if (ratio >= 0.8) level = 'strong';
      else if (ratio < 0.55) level = 'needs_practice';
    }

    const updated = storage.updateUserTopic(userId, topic, {
      questionsAttempted: attempted,
      correct,
      level,
      lastStudied: new Date().toISOString(),
      needsRevision: !isCorrect,
    });

    if (!isCorrect && mistakeDescription) {
      storage.addMistake({
        userId,
        subject: 'Practice',
        topic,
        mistakeDescription,
        revised: false,
      });
    }

    res.json({ topic: updated });
  });

  app.post('/api/learning/mark-revised', (req, res) => {
    const { id, userId = 'user_abhishek' } = req.body;
    storage.markMistakeRevised(id, userId);
    res.json({ success: true });
  });

  // Notes Endpoints
  app.get('/api/notes', (req, res) => {
    const userId = (req.query.userId as string) || 'user_abhishek';
    const notes = storage.getUserNotes(userId);
    res.json({ notes });
  });

  app.post('/api/notes', (req, res) => {
    const { userId = 'user_abhishek', title, content, tags = [] } = req.body;
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    const note = storage.addNote({
      userId,
      title: title || 'Voice Note',
      content,
      tags,
    });
    res.json({ note });
  });

  app.delete('/api/notes/:id', (req, res) => {
    const { id } = req.params;
    const userId = (req.query.userId as string) || 'user_abhishek';
    const success = storage.deleteNote(id, userId);
    res.json({ success });
  });

  // Conversation History Endpoints
  app.get('/api/history', (req, res) => {
    const userId = (req.query.userId as string) || 'user_abhishek';
    const convs = storage.getUserConversations(userId);
    res.json({ conversations: convs });
  });

  app.post('/api/history/save', (req, res) => {
    const { userId = 'user_abhishek', convId, title, messages } = req.body;
    storage.saveConversation(userId, convId || 'conv_' + Date.now(), title, messages);
    res.json({ success: true });
  });

  // Daily Briefing
  app.get('/api/briefing', (req, res) => {
    const userId = (req.query.userId as string) || 'user_abhishek';
    const user = storage.getUserById(userId);
    const topics = storage.getUserTopics(userId);
    const notes = storage.getUserNotes(userId);
    const memories = storage.getUserMemories(userId);

    const goals = memories.filter(m => m.category === 'GOAL');
    const weakTopics = topics.filter(t => t.level === 'needs_practice' || t.needsRevision);

    const text = `Good ${getTimeOfDay()}, ${user?.name || 'there'}. You've got ${goals.length > 0 ? goals[0].content : 'active learning goals'}. I recommend dedicating 30 minutes to ${weakTopics.length > 0 ? weakTopics[0].topic : 'DSA revision'} today to solidify your grasp.`;

    res.json({
      text,
      goals: goals.map(g => g.content),
      priorityTopics: weakTopics.map(t => t.topic),
      pendingNotes: notes.slice(0, 3),
    });
  });

  function getTimeOfDay() {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }

  // Vite Middleware / Static Serving
  const distPath = path.join(process.cwd(), 'dist');
  const hasDist = fs.existsSync(path.join(distPath, 'index.html'));
  const isDev = process.env.NODE_ENV === 'development';
  const isProduction = (process.env.NODE_ENV === 'production' || !isDev) && hasDist;
  console.log(`[AURA Server] mode=${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} port=${PORT} hasDist=${hasDist}`);

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Not Found');
      }
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[AURA AI] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal Server Error:', err);
  process.exit(1);
});
