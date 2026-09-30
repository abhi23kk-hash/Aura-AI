import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/common/Header.js';
import { AssistantOrb } from './components/assistant/AssistantOrb.js';
import { ConversationHUD } from './components/assistant/ConversationHUD.js';
import { LearningDashboard } from './components/learning/LearningDashboard.js';
import { MemoryDashboard } from './components/memory/MemoryDashboard.js';
import { NotesDashboard } from './components/notes/NotesDashboard.js';
import { ConversationHistory } from './components/history/ConversationHistory.js';
import { SettingsModal } from './components/settings/SettingsModal.js';
import { AuthModal } from './components/auth/AuthModal.js';
import { DocumentVisionModal } from './components/assistant/DocumentVisionModal.js';
import { parseVoiceCommand } from './utils/voiceCommands.js';
import { detectImageGenerationIntent } from './utils/imageIntent.js';
import { playAssistantChime } from './utils/assistantAudio.js';
import { extractVisualContentFromText } from './utils/visualContentParser.js';
import { prepareTextForSpeech } from './utils/speechSanitizer.js';
import { useVoiceEngine } from './hooks/useVoiceEngine.js';
import { 
  User, 
  ChatMessage, 
  UserSettings, 
  DEFAULT_USER_SETTINGS, 
  AssistantState,
  VisualContentData
} from './types.js';

export default function App() {
  // Navigation & User State
  const [currentTab, setCurrentTab] = useState<'assistant' | 'learning' | 'memory' | 'notes' | 'history'>('assistant');
  const [currentUser, setCurrentUser] = useState<User | null>({
    id: 'user_abhishek',
    name: 'Abhishek',
    email: 'abhi24cmrit@gmail.com',
    education: 'Computer Science Engineering (3rd Year)',
    interests: ['DSA', 'Machine Learning', 'System Design'],
    careerArea: 'Software Engineering / Placements Prep',
    createdAt: new Date().toISOString(),
  });

  // Settings
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);

  // Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [visionModalOpen, setVisionModalOpen] = useState(false);

  // Active Focus / Study Timer
  const [activeTimer, setActiveTimer] = useState<{
    secondsLeft: number;
    initialSeconds: number;
    label: string;
    isActive: boolean;
  } | null>(null);

  // Conversation Messages
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const hasGreetedRef = useRef(false);

  // Health and System check
  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.demoMode) setIsDemoMode(true);
      })
      .catch(() => setIsDemoMode(true));
  }, []);

  // Fetch or refresh user profile
  useEffect(() => {
    if (!currentUser?.id) return;
    fetch(`/api/auth/me?userId=${encodeURIComponent(currentUser.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setCurrentUser(data.user);
      })
      .catch((e) => console.warn('Could not fetch user profile:', e));
  }, [currentUser?.id]);

  // In-flight abort controller for fast interruption handling
  const inFlightAbortRef = useRef<AbortController | null>(null);
  const handleProcessUserMessageRef = useRef<(text: string, attachment?: any) => Promise<void>>(async () => {});

  // Voice Engine setup
  const handleUserSpeechFinal = useCallback((transcript: string) => {
    if (handleProcessUserMessageRef.current) {
      handleProcessUserMessageRef.current(transcript);
    }
  }, []);

  const handleUserInterrupted = useCallback(() => {
    console.log('[AURA] Assistant interrupted by user voice');
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
      inFlightAbortRef.current = null;
    }
  }, []);

  const handleToolCall = useCallback((name: string, args: any) => {
    console.log('[AURA Tool Call]', name, args);
    if (name === 'displayVisualContent' && args) {
      const visualData: VisualContentData = {
        type: args.type || 'code',
        title: args.title,
        code: args.code,
        language: args.language,
        url: args.url,
        urlLabel: args.urlLabel,
        command: args.command,
        tableHeaders: args.tableHeaders,
        tableRows: args.tableRows,
        items: args.items,
        summary: args.summary,
      };
      setMessages((prev) => {
        const lastIndex = prev.length - 1;
        if (lastIndex >= 0 && prev[lastIndex].role === 'assistant') {
          const updated = [...prev];
          updated[lastIndex] = {
            ...updated[lastIndex],
            visualContent: visualData,
          };
          return updated;
        }
        return [
          ...prev,
          {
            id: 'msg_visual_' + Date.now(),
            role: 'assistant',
            text: args.title ? `I've displayed the ${args.title} for you.` : "I've displayed this for you on screen.",
            timestamp: new Date().toISOString(),
            visualContent: visualData,
          },
        ];
      });
    } else if (name === 'navigateToTab' && args?.tab) {
      setCurrentTab(args.tab);
    } else if (name === 'createNote' && args?.title && args?.content) {
      fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || 'user_abhishek',
          title: args.title,
          content: args.content,
          tags: ['Voice Note', 'Study'],
        }),
      }).catch(() => {});
    } else if (name === 'startStudyTimer' && args?.minutes) {
      const seconds = Math.round(args.minutes * 60);
      setActiveTimer({
        secondsLeft: seconds,
        initialSeconds: seconds,
        label: args.label || 'Study Focus Session',
        isActive: true,
      });
    } else if (name === 'clearConversation') {
      setMessages([]);
    }
  }, [currentUser?.id]);

  const handleAssistantTranscript = useCallback((text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === 'assistant') {
        const fullText = last.text ? `${last.text} ${text}` : text;
        const extracted = !last.visualContent ? extractVisualContentFromText(fullText).visualContent : last.visualContent;
        return [
          ...prev.slice(0, -1),
          { 
            ...last, 
            text: fullText,
            visualContent: extracted || last.visualContent,
          },
        ];
      }
      const extracted = extractVisualContentFromText(text).visualContent;
      return [
        ...prev,
        {
          id: 'msg_live_' + Date.now(),
          role: 'assistant',
          text,
          timestamp: new Date().toISOString(),
          visualContent: extracted,
        },
      ];
    });
  }, []);

  const voiceEngine = useVoiceEngine({
    settings,
    onUserSpeechFinal: handleUserSpeechFinal,
    onUserInterrupted: handleUserInterrupted,
    onToolCall: handleToolCall,
    onAssistantTranscript: handleAssistantTranscript,
    isHandsFreeActive: settings.handsFree,
  });

  const {
    state: assistantState,
    setState: setAssistantState,
    audioLevel,
    interimTranscript,
    isMuted,
    startListening,
    stopListening,
    interruptSpeaking,
    speak,
    micPermissionDenied,
    isMicAvailable,
    isNoiseFilterActive,
    toggleNoiseFilter,
  } = voiceEngine;

  // Active Focus Timer Countdown
  useEffect(() => {
    if (!activeTimer || !activeTimer.isActive || activeTimer.secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setActiveTimer((prev) => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) {
          playAssistantChime('timer_alert');
          speak(`Timer completed: ${prev.label}! Time to review your study problem.`);
          return { ...prev, secondsLeft: 0, isActive: false };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimer, speak]);

  // Process User Input (Spoken or Typed)
  const handleProcessUserMessage = async (
    text: string,
    attachment?: { name: string; mimeType: string; data: string; previewUrl: string }
  ) => {
    if (!text.trim() && !attachment) return;

    // Check direct voice commands first
    if (!attachment) {
      const parsedCmd = parseVoiceCommand(text);
      if (parsedCmd) {
        if (parsedCmd.type === 'NAVIGATION' && parsedCmd.targetTab) {
          setCurrentTab(parsedCmd.targetTab);
          const assistantMsg: ChatMessage = {
            id: 'msg_res_' + Date.now(),
            role: 'assistant',
            text: parsedCmd.speechResponse,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, {
            id: 'msg_' + Date.now(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date().toISOString(),
          }, assistantMsg]);
          speak(parsedCmd.speechResponse, 'en');
          return;
        }

        if (parsedCmd.type === 'NOTE' && parsedCmd.noteContent) {
          fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser?.id || 'user_abhishek',
              title: parsedCmd.noteContent.slice(0, 30),
              content: parsedCmd.noteContent,
              tags: ['Voice Note', 'Study'],
            }),
          }).catch(() => {});
          const assistantMsg: ChatMessage = {
            id: 'msg_res_' + Date.now(),
            role: 'assistant',
            text: parsedCmd.speechResponse,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, {
            id: 'msg_' + Date.now(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date().toISOString(),
          }, assistantMsg]);
          speak(parsedCmd.speechResponse, 'en');
          return;
        }

        if (parsedCmd.type === 'TIMER' && parsedCmd.timerDurationSeconds) {
          setActiveTimer({
            secondsLeft: parsedCmd.timerDurationSeconds,
            initialSeconds: parsedCmd.timerDurationSeconds,
            label: parsedCmd.timerLabel || 'Study Timer',
            isActive: true,
          });
          const assistantMsg: ChatMessage = {
            id: 'msg_res_' + Date.now(),
            role: 'assistant',
            text: parsedCmd.speechResponse,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, {
            id: 'msg_' + Date.now(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date().toISOString(),
          }, assistantMsg]);
          speak(parsedCmd.speechResponse, 'en');
          return;
        }

        if (parsedCmd.type === 'FILTER') {
          if (parsedCmd.filterAction === 'enable' && !isNoiseFilterActive) {
            toggleNoiseFilter();
          } else if (parsedCmd.filterAction === 'disable' && isNoiseFilterActive) {
            toggleNoiseFilter();
          }
          const assistantMsg: ChatMessage = {
            id: 'msg_res_' + Date.now(),
            role: 'assistant',
            text: parsedCmd.speechResponse,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, {
            id: 'msg_' + Date.now(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date().toISOString(),
          }, assistantMsg]);
          speak(parsedCmd.speechResponse, 'en');
          return;
        }

        if (parsedCmd.type === 'CLEAR') {
          setMessages([]);
          speak(parsedCmd.speechResponse, 'en');
          return;
        }

        if (parsedCmd.type === 'KNOWLEDGE') {
          const assistantMsg: ChatMessage = {
            id: 'msg_res_' + Date.now(),
            role: 'assistant',
            text: parsedCmd.speechResponse,
            timestamp: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, {
            id: 'msg_' + Date.now(),
            role: 'user',
            text: text.trim(),
            timestamp: new Date().toISOString(),
          }, assistantMsg]);
          speak(parsedCmd.speechResponse, 'en');
          return;
        }
      }

      // Dedicated Image Generation Intent Handling
      const imgIntent = detectImageGenerationIntent(text);
      if (imgIntent.isImageIntent) {
        if (inFlightAbortRef.current) {
          inFlightAbortRef.current.abort();
        }
        const abortController = new AbortController();
        inFlightAbortRef.current = abortController;

        const userMsg: ChatMessage = {
          id: 'msg_' + Date.now(),
          role: 'user',
          text: text.trim(),
          timestamp: new Date().toISOString(),
        };

        const pendingMsgId = 'msg_img_' + Date.now();
        const pendingAssistantMsg: ChatMessage = {
          id: pendingMsgId,
          role: 'assistant',
          text: "Sure, I'll generate that.",
          timestamp: new Date().toISOString(),
          visualContent: {
            type: 'image',
            title: imgIntent.title,
            prompt: imgIntent.prompt,
            status: 'generating',
          },
        };

        setMessages((prev) => [...prev, userMsg, pendingAssistantMsg]);
        setAssistantState('SPEAKING');

        // Spoken acknowledgment: "Sure, I'll generate that."
        speak("Sure, I'll generate that.", 'en', () => {
          setAssistantState('PROCESSING');
        });

        try {
          const res = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: imgIntent.prompt,
              title: imgIntent.title,
            }),
            signal: abortController.signal,
          });

          const data = await res.json();

          if (data.success && data.imageUrl) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingMsgId
                  ? {
                      ...m,
                      text: "I've generated the image and displayed it on screen.",
                      visualContent: {
                        type: 'image',
                        title: data.title || imgIntent.title,
                        prompt: data.prompt || imgIntent.prompt,
                        imageUrl: data.imageUrl,
                        status: 'completed',
                      },
                    }
                  : m
              )
            );
            speak("I've generated the image and displayed it on screen.", 'en');
          } else {
            const errReason = data.error || 'Failed to generate image';
            console.error('[AURA ImageGen] API Error:', errReason);

            setMessages((prev) =>
              prev.map((m) =>
                m.id === pendingMsgId
                  ? {
                      ...m,
                      text: "I couldn't generate the image right now.",
                      visualContent: {
                        type: 'image',
                        title: imgIntent.title,
                        prompt: imgIntent.prompt,
                        status: 'failed',
                        error: errReason,
                      },
                    }
                  : m
              )
            );
            speak("I couldn't generate the image right now.", 'en');
          }
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') return;
          console.error('[AURA ImageGen] Request error:', fetchErr);

          setMessages((prev) =>
            prev.map((m) =>
              m.id === pendingMsgId
                ? {
                    ...m,
                    text: "I couldn't generate the image right now.",
                    visualContent: {
                      type: 'image',
                      title: imgIntent.title,
                      prompt: imgIntent.prompt,
                      status: 'failed',
                      error: fetchErr?.message || 'Network error during image generation',
                    },
                  }
                : m
            )
          );
          speak("I couldn't generate the image right now.", 'en');
        } finally {
          if (inFlightAbortRef.current === abortController) {
            inFlightAbortRef.current = null;
          }
        }
        return;
      }
    }

    // Abort any prior in-flight request so the new interruption takes priority instantly
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort();
    }
    const abortController = new AbortController();
    inFlightAbortRef.current = abortController;

    // 1. Add user message to state
    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: text.trim() || (attachment ? `Uploaded ${attachment.name}` : ''),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setAssistantState('PROCESSING');

    try {
      // 2. Query server endpoint with conversation history
      const historyPayload = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const bodyPayload: any = {
        userId: currentUser?.id || 'user_abhishek',
        userMessage: text.trim(),
        conversationHistory: historyPayload,
        enableWebSearch: settings.webSearchEnabled,
      };

      if (attachment) {
        if (attachment.mimeType.startsWith('image/')) {
          bodyPayload.imageAttachment = {
            mimeType: attachment.mimeType,
            data: attachment.data,
          };
        } else {
          bodyPayload.documentAttachment = {
            fileName: attachment.name,
            mimeType: attachment.mimeType,
            content: attachment.data,
          };
        }
      }

      let res: Response | null = null;
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: abortController.signal,
        });
      } catch (networkErr: any) {
        if (networkErr.name === 'AbortError') throw networkErr;
        // Retry once after brief interval
        await new Promise((resolve) => setTimeout(resolve, 350));
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
          signal: abortController.signal,
        });
      }

      let data: any = {};
      if (res && res.ok) {
        data = await res.json();
      }

      const responseText = data.text || "I'm here with you. What would you like to explore next in our study session?";
      const detectedLang = data.language || 'en';
      const citations = data.citations || [];
      const { cleanText, visualContent: extractedVisual } = extractVisualContentFromText(responseText);

      // 3. Add assistant response
      const assistantMsg: ChatMessage = {
        id: 'msg_res_' + Date.now(),
        role: 'assistant',
        text: cleanText,
        timestamp: new Date().toISOString(),
        citations,
        visualContent: data.visualContent || extractedVisual,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // 4. Save conversation snippet to persistent storage (non-blocking)
      fetch('/api/history/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id || 'user_abhishek',
          title: text.slice(0, 40) || 'Study Session',
          messages: [...messages, userMsg, assistantMsg],
        }),
      }).catch((e) => console.warn('History save warning:', e));

      // 5. Speak response aloud with voice synthesis immediately
      // Visual response keeps full rich Markdown/formatting in assistantMsg.text
      // Voice layer uses clean, natural human speech with no formatting characters
      const spokenResponse = prepareTextForSpeech(cleanText);
      speak(spokenResponse, detectedLang);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[AURA] Previous in-flight request cleanly aborted for new interruption');
        return;
      }
      console.warn('[AURA] Recovered from request notice, providing immediate answer:', err?.message || err);
      const fallbackMsg: ChatMessage = {
        id: 'msg_res_' + Date.now(),
        role: 'assistant',
        text: "I heard your question. Let's continue—what concept or problem shall we focus on next?",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
      speak(fallbackMsg.text, 'en');
    } finally {
      if (inFlightAbortRef.current === abortController) {
        inFlightAbortRef.current = null;
      }
    }
  };

  // Keep ref up to date
  useEffect(() => {
    handleProcessUserMessageRef.current = handleProcessUserMessage;
  });

  // Initial Personalized Greeting
  useEffect(() => {
    if (hasGreetedRef.current || !currentUser) return;
    hasGreetedRef.current = true;

    const hour = new Date().getHours();
    fetch(`/api/greeting?userId=${encodeURIComponent(currentUser.id)}&hour=${hour}`)
      .then((res) => res.json())
      .then((data) => {
        const greetingText = data.greeting || `Good day, ${currentUser.name}. How can I help you today?`;
        
        const initialMsg: ChatMessage = {
          id: 'greeting_msg',
          role: 'assistant',
          text: greetingText,
          timestamp: new Date().toISOString(),
        };
        setMessages([initialMsg]);

        // Greet user and settle into ready IDLE state
        setAssistantState('GREETING');
        speak(greetingText, 'en', () => {
          setAssistantState('IDLE');
        });

        // Autoplay safety timer: transition to ready IDLE state
        setTimeout(() => {
          setAssistantState((s) => (s === 'GREETING' ? 'IDLE' : s));
        }, 2500);
      })
      .catch(() => {
        const fallbackGreeting = `Good afternoon, ${currentUser.name}. We were working on DSA yesterday. Would you like to continue?`;
        const initialMsg: ChatMessage = {
          id: 'greeting_msg',
          role: 'assistant',
          text: fallbackGreeting,
          timestamp: new Date().toISOString(),
        };
        setMessages([initialMsg]);
        setAssistantState('GREETING');
        speak(fallbackGreeting, 'en', () => {
          setAssistantState('IDLE');
        });
        setTimeout(() => {
          setAssistantState((s) => (s === 'GREETING' ? 'IDLE' : s));
        }, 2500);
      });
  }, [currentUser, settings.handsFree, speak, startListening, setAssistantState]);

  // Handler for starting revision from Learning Dashboard
  const handleStartRevisionTopic = (topic: string) => {
    setCurrentTab('assistant');
    const prompt = `Let's practice and revise ${topic}. Quiz me or teach me a core concept.`;
    handleProcessUserMessage(prompt);
  };

  // Handler for resuming past session
  const handleResumeSession = (pastMessages: ChatMessage[]) => {
    setMessages(pastMessages);
    setCurrentTab('assistant');
    const lastMsg = pastMessages[pastMessages.length - 1];
    if (lastMsg) {
      const resumeText = `Resumed our previous session on "${lastMsg.text.slice(0, 50)}". Where should we pick up?`;
      speak(resumeText, 'en');
    }
  };

  // Handler for uploading file from Vision Studio
  const handleUploadFile = (
    fileData: { name: string; mimeType: string; data: string; previewUrl: string },
    userPrompt: string
  ) => {
    setCurrentTab('assistant');
    handleProcessUserMessage(userPrompt, fileData);
  };

  const toggleHandsFree = () => {
    const next = !settings.handsFree;
    setSettings((prev) => ({ ...prev, handsFree: next }));
    if (next) {
      startListening();
    } else {
      stopListening();
    }
  };

  // Orb click: Intelligently interrupts when speaking, pauses when listening, starts when idle
  const handleOrbClick = () => {
    if (assistantState === 'SPEAKING' || assistantState === 'GREETING') {
      interruptSpeaking();
      startListening();
    } else if (assistantState === 'LISTENING') {
      stopListening();
    } else {
      startListening();
    }
  };

  // Input mic button toggle
  const handleMicToggle = () => {
    if (assistantState === 'LISTENING') {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        currentUser={currentUser}
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenVision={() => setVisionModalOpen(true)}
        assistantState={assistantState}
        isDemoMode={isDemoMode}
      />

      {/* Main App Stage */}
      <main className="flex-1 flex flex-col justify-between relative overflow-hidden">
        {/* Background Ambient Radial Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-cyan-600/10 via-indigo-600/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl pointer-events-none" />

        {/* Tab Views */}
        <div className="relative z-10 w-full flex-1 flex flex-col">
          {currentTab === 'assistant' && (
            <div className="w-full flex-1 flex flex-col items-center justify-between pt-4">
              {/* Central Visual Masterpiece: The AI Assistant Orb */}
              <AssistantOrb
                state={assistantState}
                audioLevel={audioLevel}
                onClick={handleOrbClick}
                isMicMuted={isMuted}
              />

              {/* Conversational HUD & Input Bar */}
              <ConversationHUD
                messages={messages}
                state={assistantState}
                interimTranscript={interimTranscript}
                audioLevel={audioLevel}
                isNoiseFilterActive={isNoiseFilterActive}
                onToggleNoiseFilter={toggleNoiseFilter}
                onSendMessage={(text) => handleProcessUserMessage(text)}
                onInterrupt={interruptSpeaking}
                onOpenUpload={() => setVisionModalOpen(true)}
                isHandsFree={settings.handsFree}
                onToggleHandsFree={toggleHandsFree}
                isMuted={isMuted}
                onToggleMute={handleMicToggle}
                onStartListening={startListening}
                micPermissionDenied={micPermissionDenied}
                isMicAvailable={isMicAvailable}
                userName={currentUser?.name || 'Abhishek'}
              />
            </div>
          )}

          {currentTab === 'learning' && (
            <LearningDashboard
              userId={currentUser?.id || 'user_abhishek'}
              onStartRevisionTopic={handleStartRevisionTopic}
            />
          )}

          {currentTab === 'memory' && (
            <MemoryDashboard
              userId={currentUser?.id || 'user_abhishek'}
              userName={currentUser?.name || 'Abhishek'}
            />
          )}

          {currentTab === 'notes' && (
            <NotesDashboard
              userId={currentUser?.id || 'user_abhishek'}
              userName={currentUser?.name || 'Abhishek'}
            />
          )}

          {currentTab === 'history' && (
            <ConversationHistory
              userId={currentUser?.id || 'user_abhishek'}
              onResumeSession={handleResumeSession}
            />
          )}
        </div>
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={currentUser}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          hasGreetedRef.current = false;
        }}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
        isDemoMode={isDemoMode}
      />

      <DocumentVisionModal
        isOpen={visionModalOpen}
        onClose={() => setVisionModalOpen(false)}
        onSubmitFile={handleUploadFile}
      />
    </div>
  );
}
