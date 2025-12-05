import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { Message, UserProfile, Role, Source } from "../types";
import { KNOWLEDGE_BASE } from "../constants";

// Initialize the API client
const apiKey = process.env.API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = "gemini-2.5-flash";

export const sendMessageToGemini = async (
  history: Message[],
  userMessage: string,
  currentUser: UserProfile
): Promise<{ text: string; sources: Source[] }> => {
  if (!apiKey) {
    return { 
      text: "Erro: Chave de API não configurada. Por favor, configure a variável de ambiente API_KEY.", 
      sources: [] 
    };
  }

  try {
    // Construct the system instruction
    const systemInstruction = `
      Você é o 'Conselheiro da Família', um conselheiro matrimonial cristão, sábio, paciente e amoroso.
      
      BASE DE CONHECIMENTO (APOSTILA):
      ${KNOWLEDGE_BASE}

      CONTEXTO ATUAL:
      Você está conversando com: ${currentUser}.
      O casal é Marcelo e Fernanda.
      
      DIRETRIZES:
      1. Use a FERRAMENTA DE BUSCA (Google Search) para encontrar versículos bíblicos específicos, contextos teológicos ou aplicações práticas na Bíblia que se apliquem à situação do usuário, especialmente se não estiver explícito na apostila.
      2. Suas respostas devem integrar os princípios da Apostila fornecida com a sabedoria bíblica encontrada na busca.
      3. Seja acolhedor e não julgue. O tom deve ser pastoral e encorajador.
      4. Se for o Marcelo falando, lembre-o de seu papel de sacerdote, provedor e de amar como Cristo.
      5. Se for a Fernanda falando, lembre-a de seu papel de auxiliadora, administradora e edificadora.
      6. O objetivo é ajudá-los a reconstruir o casamento em 2026.
      7. Mantenha as respostas concisas, mas profundas. Use formatação Markdown.
    `;

    // Convert app history to Gemini format
    const chatHistory = history.slice(-10).map((msg) => ({
      role: msg.role === Role.USER ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));

    const chat = ai.chats.create({
      model: MODEL_NAME,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        tools: [{ googleSearch: {} }], // Enable Google Search Grounding
      },
      history: chatHistory,
    });

    const result = await chat.sendMessage({
        message: userMessage
    });

    const responseText = result.text || "Sem resposta textual.";
    
    // Extract grounding sources
    const sources: Source[] = [];
    const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (groundingChunks) {
      groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri && chunk.web?.title) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri
          });
        }
      });
    }

    // Deduplicate sources based on URI
    const uniqueSources = Array.from(new Map(sources.map(item => [item.uri, item])).values());

    return { text: responseText, sources: uniqueSources };

  } catch (error) {
    console.error("Error communicating with Gemini:", error);
    return { 
      text: "Desculpe, tive um problema momentâneo para consultar a sabedoria divina. Por favor, tente novamente em instantes.", 
      sources: [] 
    };
  }
};
