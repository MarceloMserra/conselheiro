import React from 'react';
import { Message, Role } from '../types';
import { Bot, User, Link as LinkIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[95%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-indigo-600' : 'bg-emerald-600'} text-white shadow-md mt-1`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        {/* Bubble */}
        <div 
          className={`
            relative p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed
            ${isUser 
              ? 'bg-indigo-50 text-indigo-900 rounded-tr-none border border-indigo-100' 
              : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
            }
          `}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.text}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:text-emerald-800 prose-headings:font-serif prose-a:text-blue-600">
               <ReactMarkdown>{message.text}</ReactMarkdown>
            </div>
          )}

          {/* Sources Section */}
          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1">
                <LinkIcon size={10} /> Fontes de Pesquisa:
              </p>
              <div className="flex flex-wrap gap-2">
                {message.sources.map((source, idx) => (
                  <a 
                    key={idx} 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-200 truncate max-w-[200px]"
                    title={source.title}
                  >
                    {source.title}
                  </a>
                ))}
              </div>
            </div>
          )}
          
          <span className="text-[10px] opacity-50 block mt-2 text-right">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};