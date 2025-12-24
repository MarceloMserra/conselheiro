import React, { useState, useRef, useEffect } from 'react';
import { Send, Heart, BookOpen, Users, LogOut, Menu, MessageSquarePlus, MessageSquare, Trash2 } from 'lucide-react';

// CORREÇÃO: Todos agora usam './' porque estão na mesma pasta raiz (src)
import { Role, Message, UserProfile, ChatSession } from './types';
import { sendMessageToGemini } from './services/geminiService';
import { ChatMessage } from './components/ChatMessage';
import { TypingIndicator } from './components/TypingIndicator';
import { SUGGESTED_QUESTIONS } from './constants';

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

  const activeSession = sessions[currentUser].find(s => s.id === currentSessionId);
  const messages = activeSession ? activeSession.messages : [];

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load from LocalStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Converte strings de data de volta para objetos Date
        Object.keys(parsed).forEach(user => {
          parsed[user].forEach((session: ChatSession) => {
            session.messages.forEach((msg: Message) => {
              msg.timestamp = new Date(msg.timestamp);
            });
          });
        });
        setSessions(parsed);
      } catch (e) {
        console.error("Erro ao carregar histórico", e);
      }
    }
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  // Keep a valid session selected for the active user.
  // Fix: when switching between Marcelo/Fernanda, the previous user's sessionId
  // could remain selected, causing messages to not append/show.
  useEffect(() => {
    const userSessions = sessions[currentUser] || [];
    const hasValidSelection = !!currentSessionId && userSessions.some(s => s.id === currentSessionId);

    if (!hasValidSelection) {
      if (userSessions.length > 0) {
        setCurrentSessionId(userSessions[0].id);
      } else {
        createNewSession();
      }
    }
  }, [currentUser, sessions]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Nova Conversa',
      messages: [{
        id: 'welcome',
        role: Role.MODEL,
        text: `Olá, ${currentUser}. Sou o Conselheiro da Família. Como posso ajudar vocês hoje a fortalecerem a união em Cristo?`,
        timestamp: new Date()
      }],
      lastModified: Date.now()
    };

    setSessions(prev => ({
      ...prev,
      [currentUser]: [newSession, ...prev[currentUser]]
    }));
    setCurrentSessionId(newSession.id);
    setIsSidebarOpen(false);
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja apagar essa conversa?')) {
      setSessions(prev => {
        const updated = { ...prev };
        updated[currentUser] = updated[currentUser].filter(s => s.id !== sessionId);
        return updated;
      });
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !currentSessionId) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: input,
      timestamp: new Date()
    };

    // Update UI immediately with user message
    setSessions(prev => {
      const updatedSessions = [...prev[currentUser]];
      const sessionIndex = updatedSessions.findIndex(s => s.id === currentSessionId);
      if (sessionIndex !== -1) {
        const updatedSession = { ...updatedSessions[sessionIndex] };
        updatedSession.messages = [...updatedSession.messages, userMsg];
        
        // Update title if it's the first user message
        if (updatedSession.messages.length === 2) {
           updatedSession.title = input.slice(0, 30) + (input.length > 30 ? '...' : '');
        }
        updatedSession.lastModified = Date.now();
        
        updatedSessions[sessionIndex] = updatedSession;
        updatedSessions.sort((a, b) => b.lastModified - a.lastModified);
        
        return { ...prev, [currentUser]: updatedSessions };
      }
      return prev;
    });

    setInput('');
    setIsLoading(true);

    try {
      const currentHistory = sessions[currentUser].find(s => s.id === currentSessionId)?.messages || [];
      const fullHistory = [...currentHistory, userMsg];

      const response = await sendMessageToGemini(fullHistory, userMsg.text, currentUser);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.MODEL,
        text: response.text,
        timestamp: new Date(),
        sources: response.sources
      };

      setSessions(prev => {
        const updatedSessions = [...prev[currentUser]];
        const sessionIndex = updatedSessions.findIndex(s => s.id === currentSessionId);
        if (sessionIndex !== -1) {
          updatedSessions[sessionIndex].messages.push(aiMsg);
          updatedSessions[sessionIndex].lastModified = Date.now();
        }
        return { ...prev, [currentUser]: updatedSessions };
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

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:relative z-30 w-72 h-full bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <BookOpen className="text-emerald-600" size={24} />
            </div>
            <h1 className="font-serif text-xl font-bold text-slate-800 leading-tight">
              Conselheiro<br/><span className="text-emerald-600 text-base font-sans font-normal">da Família</span>
            </h1>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setCurrentSessionId(null);
                setCurrentUser(UserProfile.MARCELO);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                currentUser === UserProfile.MARCELO 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Users size={16} /> Marcelo
            </button>
            <button
              onClick={() => {
                setCurrentSessionId(null);
                setCurrentUser(UserProfile.FERNANDA);
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${
                currentUser === UserProfile.FERNANDA 
                  ? 'bg-white text-pink-500 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Heart size={16} /> Fernanda
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button 
            onClick={createNewSession}
            className="w-full flex items-center gap-3 p-3 text-emerald-700 bg-emerald-50 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100"
          >
            <MessageSquarePlus size={20} />
            <span className="font-medium">Nova Conversa</span>
          </button>

          <div className="mt-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Histórico</h3>
            {sessions[currentUser].length === 0 && (
              <p className="text-sm text-slate-400 px-2 italic">Nenhuma conversa ainda.</p>
            )}
            {sessions[currentUser].map((session) => (
              <div 
                key={session.id}
                onClick={() => {
                  setCurrentSessionId(session.id);
                  setIsSidebarOpen(false);
                }}
                className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  currentSessionId === session.id 
                    ? 'bg-slate-100 text-slate-900 border border-slate-200' 
                    : 'text-slate-600 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={18} className={currentSessionId === session.id ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="truncate text-sm font-medium">{session.title}</span>
                </div>
                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <a href="/" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 px-2">
            <LogOut size={16} /> Voltar ao App Principal
          </a>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full w-full relative">
        <header className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-10">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-600">
            <Menu size={24} />
          </button>
          <span className="font-serif font-bold text-slate-800">
            {currentUser === UserProfile.MARCELO ? 'Marcelo' : 'Fernanda'}
          </span>
          <div className="w-8" /> 
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            {messages.length < 2 && (
               <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                 {SUGGESTED_QUESTIONS.map((q, i) => (
                   <button 
                     key={i}
                     onClick={() => setInput(q)}
                     className="flex-shrink-0 px-4 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-xs font-medium rounded-full transition-colors border border-slate-200"
                   >
                     {q}
                   </button>
                 ))}
               </div>
            )}

            <div className="relative flex items-center shadow-lg shadow-slate-200/50 rounded-2xl bg-white border border-slate-200 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Pergunte algo como ${currentUser === UserProfile.MARCELO ? 'esposo' : 'esposa'}...`}
                className="w-full max-h-32 py-4 pl-5 pr-12 bg-transparent border-none focus:ring-0 resize-none text-slate-700 placeholder:text-slate-400 outline-none"
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
            
            <p className="text-center text-[10px] text-slate-400 mt-3">
              O conselho usa IA para pesquisar na Bíblia e internet. Confirme sempre na Palavra de Deus.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;