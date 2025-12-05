import React, { useState, useRef, useEffect } from 'react';
import { Role, Message, UserProfile, ChatSession } from './types';
import { sendMessageToGemini } from './services/geminiService';
import { ChatMessage } from './components/ChatMessage';
import { TypingIndicator } from './components/TypingIndicator';
import { SUGGESTED_QUESTIONS } from './constants';
import { Send, Heart, BookOpen, Users, LogOut, Menu, MessageSquarePlus, MessageSquare, Trash2 } from 'lucide-react';

const STORAGE_KEY = 'conselheiro_familia_sessions';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile>(UserProfile.MARCELO);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // History State
  const [sessions, setSessions] = useState<Record<UserProfile, ChatSession[]>>({
    [UserProfile.MARCELO]: [],
    [UserProfile.FERNANDA]: []
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Derived state for current messages
  const activeSession = sessions[currentUser].find(s => s.id === currentSessionId);
  const messages = activeSession ? activeSession.messages : [];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load from LocalStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Need to convert date strings back to Date objects
        const hydrated: Record<UserProfile, ChatSession[]> = {
            [UserProfile.MARCELO]: parsed[UserProfile.MARCELO]?.map((s: any) => ({
                ...s,
                messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
            })) || [],
            [UserProfile.FERNANDA]: parsed[UserProfile.FERNANDA]?.map((s: any) => ({
                ...s,
                messages: s.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
            })) || []
        };
        setSessions(hydrated);
      } catch (e) {
        console.error("Failed to parse sessions", e);
      }
    }
  }, []);

  // Save to LocalStorage whenever sessions change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // Scroll to bottom effect
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Start a new session if none exists for user or explicitly requested
  const createNewSession = (user: UserProfile) => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: `Conversa de ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour:'2-digit', minute:'2-digit' })}`,
      lastModified: Date.now(),
      messages: [
        {
          id: 'welcome',
          role: Role.MODEL,
          text: `Olá, **${user}**. Sou o Conselheiro da Família e posso pesquisar na Bíblia e na internet para te ajudar. \n\nSei que você e ${user === UserProfile.MARCELO ? 'a Fernanda' : 'o Marcelo'} estão buscando reconstruir o casamento. O que está pesando no seu coração hoje?`,
          timestamp: new Date()
        }
      ]
    };

    setSessions(prev => {
      const userSessions = [...prev[user]];
      // Add new session to start
      userSessions.unshift(newSession);
      
      // Keep only top 5 recent
      if (userSessions.length > 5) {
        // Sort by lastModified desc just in case, then slice
        userSessions.sort((a, b) => b.lastModified - a.lastModified);
        return {
          ...prev,
          [user]: userSessions.slice(0, 5)
        };
      }

      return {
        ...prev,
        [user]: userSessions
      };
    });
    
    setCurrentSessionId(newSession.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  // Initialize session if empty on user switch
  useEffect(() => {
    // If user has no sessions, create one automatically
    if (sessions[currentUser].length === 0) {
       createNewSession(currentUser);
    } else if (!currentSessionId || !sessions[currentUser].find(s => s.id === currentSessionId)) {
       // Select most recent
       setCurrentSessionId(sessions[currentUser][0].id);
    }
  }, [currentUser]);

  const handleUserSwitch = (user: UserProfile) => {
    if (user === currentUser) return;
    setCurrentUser(user);
    // currentSessionId will be handled by useEffect above
    setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions(prev => ({
        ...prev,
        [currentUser]: prev[currentUser].filter(s => s.id !== sessionId)
    }));
    if (currentSessionId === sessionId) {
        setCurrentSessionId(null); // useEffect will pick the next one or create new
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !currentSessionId) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: input,
      timestamp: new Date(),
    };

    // Optimistically update UI
    setSessions(prev => {
        const userSessions = prev[currentUser].map(s => {
            if (s.id === currentSessionId) {
                return { 
                    ...s, 
                    messages: [...s.messages, userMsg],
                    lastModified: Date.now(),
                    // Update title if it's the first user message
                    title: s.messages.length <= 1 ? (input.length > 20 ? input.substring(0, 20) + '...' : input) : s.title
                };
            }
            return s;
        });
        // Sort sessions so active one bubbles to top
        userSessions.sort((a, b) => b.lastModified - a.lastModified);
        return { ...prev, [currentUser]: userSessions };
    });

    setInput('');
    setIsLoading(true);

    try {
      // Get current conversation context
      const currentHistory = sessions[currentUser].find(s => s.id === currentSessionId)?.messages || [];
      const context = [...currentHistory, userMsg];

      const { text, sources } = await sendMessageToGemini(context, userMsg.text, currentUser);
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: text,
        timestamp: new Date(),
        sources: sources
      };

      // Update with AI response
      setSessions(prev => {
        const userSessions = prev[currentUser].map(s => {
            if (s.id === currentSessionId) {
                return { 
                    ...s, 
                    messages: [...s.messages, aiMsg],
                    lastModified: Date.now()
                };
            }
            return s;
        });
        return { ...prev, [currentUser]: userSessions };
    });

    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  return (
    <div className="flex h-screen bg-slate-50 relative overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:relative z-30 w-72 h-full bg-slate-900 text-white flex flex-col transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-2 text-emerald-400">
            <BookOpen size={24} />
            <h1 className="font-serif text-xl font-bold tracking-wide">O Nosso Mundo M&F</h1>
          </div>
          <p className="text-xs text-slate-400 mt-2">Bíblia + Apostila + Busca Web</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
          {/* User Switcher */}
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3 pl-2">Quem está falando?</h3>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleUserSwitch(UserProfile.MARCELO)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all border ${currentUser === UserProfile.MARCELO ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 hover:border-indigo-500 text-slate-300'}`}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center font-bold text-sm">M</div>
                <span className="text-sm font-medium">Marcelo</span>
              </button>
              
              <button 
                 onClick={() => handleUserSwitch(UserProfile.FERNANDA)}
                 className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all border ${currentUser === UserProfile.FERNANDA ? 'bg-pink-600 border-pink-500 text-white' : 'bg-slate-800 border-slate-700 hover:border-pink-500 text-slate-300'}`}
              >
                <div className="w-8 h-8 rounded-full bg-pink-200 text-pink-800 flex items-center justify-center font-bold text-sm">F</div>
                <span className="text-sm font-medium">Fernanda</span>
              </button>
            </div>
          </div>

          {/* History Section */}
          <div>
            <div className="flex items-center justify-between mb-3 px-2">
               <h3 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Histórico (Max 5)</h3>
               <button 
                  onClick={() => createNewSession(currentUser)}
                  className="p-1.5 bg-emerald-600 rounded-lg hover:bg-emerald-500 transition-colors"
                  title="Nova Conversa"
               >
                 <MessageSquarePlus size={16} />
               </button>
            </div>
            
            <div className="space-y-2">
                {sessions[currentUser].map((session) => (
                    <div 
                        key={session.id}
                        onClick={() => {
                            setCurrentSessionId(session.id);
                            if (window.innerWidth < 768) setIsSidebarOpen(false);
                        }}
                        className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all border ${session.id === currentSessionId ? 'bg-slate-800 border-emerald-500/50' : 'bg-transparent border-transparent hover:bg-slate-800'}`}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <MessageSquare size={16} className={session.id === currentSessionId ? "text-emerald-400" : "text-slate-500"} />
                            <div className="flex flex-col truncate">
                                <span className={`text-sm font-medium truncate ${session.id === currentSessionId ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>
                                    {session.title}
                                </span>
                                <span className="text-[10px] text-slate-600">
                                    {new Date(session.lastModified).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={(e) => deleteSession(e, session.id)}
                            className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}
                
                {sessions[currentUser].length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-4 italic">Nenhuma conversa salva.</p>
                )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-emerald-400 mb-2">
                <Users size={14} /> Meta 2026
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Reconstruir a aliança. Pesquiso na Bíblia e Internet para ajudar.
              </p>
            </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full w-full">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="md:hidden text-slate-600">
                <Menu size={24} />
            </button>
            <div>
                <h2 className="font-serif text-lg text-slate-800 font-semibold flex items-center gap-2">
                    Conselheiro da Família
                    <Heart size={16} className="text-rose-500 fill-rose-500" />
                </h2>
                <p className="text-xs text-slate-500">Mentoria Matrimonial com Apoio Bíblico</p>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 bg-slate-50 scroll-smooth">
          <div className="max-w-3xl mx-auto w-full">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 p-4 md:p-6">
          <div className="max-w-3xl mx-auto w-full space-y-4">
            
            {/* Suggestions */}
            {messages.length < 4 && !isLoading && (
               <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                      <button 
                        key={idx}
                        onClick={() => handleSuggestionClick(q)}
                        className="flex-shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs md:text-sm rounded-full transition-colors border border-slate-200"
                      >
                        {q}
                      </button>
                  ))}
               </div>
            )}

            {/* Input Field */}
            <div className="relative flex items-center shadow-lg shadow-slate-200/50 rounded-2xl bg-white border border-slate-200 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Pergunte algo como ${currentUser === UserProfile.MARCELO ? 'esposo' : 'esposa'}...`}
                className="w-full max-h-32 py-4 pl-5 pr-12 bg-transparent border-none focus:ring-0 resize-none text-slate-700 placeholder:text-slate-400"
                rows={1}
                style={{ minHeight: '3.5rem' }}
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="absolute right-2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-all"
              >
                <Send size={18} />
              </button>
            </div>
            
            <p className="text-center text-[10px] text-slate-400">
              O conselho usa IA para pesquisar na Bíblia e internet. Confirme sempre na Palavra de Deus.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;