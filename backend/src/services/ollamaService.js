/**
 * Ollama Service for FriendForge API
 * Handles connection to local Ollama runtime and Gemma open-weight inference.
 * Completely isolated from Backboard and hosted APIs.
 */

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_OLLAMA_MODEL = 'gemma3:4b';

function getOllamaUrl() {
  return process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
}

function getOllamaModel() {
  return process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
}

const LOCAL_SYSTEM_PROMPT = `You are FriendForge Local AI running through Ollama.
You only know the messages explicitly included in the current local conversation.
Conversation history supplied in the local request is conversation context, NOT an uploaded document or note.

CRITICAL CAPABILITY & TRANSPARENCY BOUNDARIES:
- You do NOT have access to uploaded study notes or documents. Uploaded-note RAG is completely unavailable in Local AI mode.
- You do NOT have access to Backboard.
- You do NOT have access to persistent Study Memory.
- You do NOT have access to previous Online Study sessions.
- You do NOT have access to external websites or internet-based retrieval.
- NEVER claim, imply, or hallucinate that you searched, read, retrieved, remembered, accessed, or used any of those resources.
- NEVER claim that a previous assistant-generated explanation is an uploaded note.

RULES FOR HANDLING REQUESTS:
1. NOTE ACCESS INQUIRIES: If the user asks whether you are using uploaded notes or documents to answer (e.g., "Are you using my uploaded study notes to answer this question?"), answer clearly that Local AI cannot access uploaded notes or Backboard memory, and that they must switch to Online Study mode for note-grounded RAG.
2. NOTE CONTENT INQUIRIES: If the user asks what their uploaded notes say about a topic (e.g., "What did my uploaded notes say about normalization?"), or asks about information that would require an unavailable document, you MUST immediately explain that you cannot access uploaded notes or study documents in Local AI mode and that they must switch to Online Study mode. Do NOT guess, do NOT summarize, and do NOT pretend to know the contents of their notes.
3. GENERAL KNOWLEDGE QUESTIONS: If the user asks an ordinary general-knowledge study question without asking about their uploaded notes (e.g., "Explain normalization in 3 simple points"), continue answering normally from your general model knowledge using clear, step-by-step explanations.`;

/**
 * Check if local Ollama server is reachable and configured model is installed
 * @returns {Promise<{ available: boolean, provider: string, model: string, local: boolean }>}
 */
async function getLocalStatus() {
  const model = getOllamaModel();
  const url = getOllamaUrl();

  try {
    const res = await fetch(`${url}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });

    if (!res.ok) {
      return {
        available: false,
        provider: 'ollama',
        model,
        local: true
      };
    }

    const data = await res.json();
    const models = Array.isArray(data.models) ? data.models : [];
    const modelFound = models.some(m => {
      const name = m.name || '';
      const modelIdentifier = m.model || '';
      return name === model ||
        modelIdentifier === model ||
        name === `${model}:latest` ||
        name.split(':')[0] === model;
    });

    return {
      available: Boolean(modelFound),
      provider: 'ollama',
      model,
      local: true
    };
  } catch {
    return {
      available: false,
      provider: 'ollama',
      model,
      local: true
    };
  }
}

/**
 * Send messages to local Ollama server for chat generation
 * @param {Array<{ role: string, content: string }>} messages
 * @returns {Promise<Object>} Normalized FriendForge response
 */
async function sendLocalChat(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Messages must be a non-empty array.');
  }

  const model = getOllamaModel();
  const url = getOllamaUrl();

  // Bounded context: keep at most last 10 non-system messages to protect memory/CPU
  const nonSystemMessages = messages
    .filter(m => m.role !== 'system')
    .slice(-10)
    .map(m => ({
      role: m.role,
      content: m.content
    }));

  // Always prepend the authoritative LOCAL_SYSTEM_PROMPT
  const chatMessages = [
    { role: 'system', content: LOCAL_SYSTEM_PROMPT },
    ...nonSystemMessages
  ];

  try {
    const response = await fetch(`${url}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: chatMessages,
        stream: false
      }),
      signal: AbortSignal.timeout(180000) // 180s to account for CPU inference on 8 GB laptop
    });

    if (!response.ok) {
      throw new Error(`Ollama returned status ${response.status}`);
    }

    const data = await response.json();
    const content = data.message?.content ?? '';

    return {
      success: true,
      content,
      message: content,
      model: {
        name: data.model || model,
        provider: 'ollama',
        openWeight: true,
        local: true
      },
      provider: 'ollama',
      local: true
    };
  } catch (error) {
    console.error('[OllamaService] Local AI request failed');
    throw new Error('Local AI is unavailable. Make sure Ollama is running and gemma3:4b is installed.');
  }
}

module.exports = {
  getLocalStatus,
  sendLocalChat,
  getOllamaUrl,
  getOllamaModel,
  LOCAL_SYSTEM_PROMPT,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OLLAMA_MODEL
};