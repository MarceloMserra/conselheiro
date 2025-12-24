/// <reference types="vite/client" />

import { GoogleGenerativeAI } from "@google/generative-ai";
import { Message, UserProfile, Role, Source } from "../types";
import { KNOWLEDGE_BASE } from "../constants";

// Configuração da API Key
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// Modelo Flash (Rápido e Eficiente)
const MODEL_NAME = "gemini-1.5-flash";

export const sendMessageToGemini = async (
  history: Message[],
  userMessage: string,
  currentUser: UserProfile
): Promise<{ text: string; sources: Source[] }> => {
  if (!apiKey) {
    return { 
      text: "Erro: Chave de API não configurada. Verifique o arquivo .env.local.", 
      sources: [] 
    };
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: {
        role: "system",
        parts: [{ text: `
          Você é o 'Conselheiro da Família', um conselheiro matrimonial cristão, sábio, paciente e amoroso.
          
          BASE DE CONHECIMENTO (APOSTILA):
          ${KNOWLEDGE_BASE}

          CONTEXTO ATUAL:
          Você está conversando com: ${currentUser}.
          O casal é Marcelo e Fernanda.
          
          DIRETRIZES:
          1. Use a Bíblia como base principal.
          2. Integre os princípios da Apostila.
          3. Seja empático e prático.
        `}]
      }
    });

    // Converte histórico para o formato do Google
    const chatHistory = history.map((msg) => ({
      role: msg.role === Role.USER ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    // Inicia o chat
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0.7,
      },
    });

    // Envia a mensagem
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;
    const responseText = response.text() || "Sem resposta textual.";
    
    // Tratamento básico de fontes (se houver metadados)
    const sources: Source[] = [];
    // Nota: O SDK Web padrão nem sempre retorna groundingMetadata da mesma forma que a API REST
    // Mantemos a estrutura vazia para compatibilidade com seu frontend
    
    return { text: responseText, sources: sources };

  } catch (error) {
    console.error("Erro na comunicação com a IA:", error);
    return { 
      text: "Desculpe, tive um problema técnico momentâneo. Verifique sua conexão e tente novamente.", 
      sources: [] 
    };
  }
};