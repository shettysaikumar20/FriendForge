/**
 * ElevenLabs Text-to-Speech Service for FriendForge
 * Completely isolated service for cloud voice generation.
 * Follows official ElevenLabs REST API: POST /v1/text-to-speech/{voice_id}?output_format=mp3_44100_128
 */

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel (premade, universally available clear study voice)
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const DEFAULT_OUTPUT_FORMAT = 'mp3_44100_128';

let customFetch = null;

function setCustomFetch(fn) {
  customFetch = fn;
}

function getApiKey() {
  return (process.env.ELEVENLABS_API_KEY || '').trim();
}

function getVoiceId() {
  return (process.env.ELEVENLABS_VOICE_ID || '').trim() || DEFAULT_VOICE_ID;
}

function getTtsModel() {
  return (process.env.ELEVENLABS_TTS_MODEL || '').trim() || DEFAULT_MODEL;
}

function isConfigured() {
  return Boolean(getApiKey());
}

/**
 * Generate audio speech from text via ElevenLabs Text-to-Speech API
 * @param {string} text - The clean explanation text to synthesize
 * @returns {Promise<{ buffer: Buffer, contentType: string, size: number }>}
 */
async function generateSpeech(text) {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error('Audio generation is temporarily unavailable.');
    err.status = 503;
    err.safeMessage = 'Audio generation is temporarily unavailable.';
    throw err;
  }

  if (typeof text !== 'string' || !text.trim()) {
    const err = new Error('Text is required and must not be empty.');
    err.status = 400;
    err.safeMessage = 'Text is required and must not be empty.';
    throw err;
  }

  if (text.length > 3000) {
    const err = new Error('Text exceeds maximum length of 3000 characters.');
    err.status = 400;
    err.safeMessage = 'Text exceeds maximum length of 3000 characters.';
    throw err;
  }

  const voiceId = getVoiceId();
  const model = getTtsModel();
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${DEFAULT_OUTPUT_FORMAT}`;
  const fetchFn = customFetch || globalThis.fetch;

  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: model
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
      // Log sanitized status only - NEVER log the API key or raw sensitive payload
      console.error('[ElevenLabsService] TTS request failed with HTTP status:', res.status);
      const err = new Error('Audio generation is temporarily unavailable.');
      err.status = res.status === 429 ? 429 : 503;
      err.safeMessage = 'Audio generation is temporarily unavailable.';
      throw err;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      buffer,
      contentType: 'audio/mpeg',
      size: buffer.length
    };
  } catch (error) {
    if (error.status && error.safeMessage) {
      throw error;
    }
    console.error('[ElevenLabsService] Unexpected error during TTS request');
    const err = new Error('Audio generation is temporarily unavailable.');
    err.status = 503;
    err.safeMessage = 'Audio generation is temporarily unavailable.';
    throw err;
  }
}

module.exports = {
  generateSpeech,
  isConfigured,
  setCustomFetch,
  getApiKey,
  getVoiceId,
  getTtsModel,
  DEFAULT_VOICE_ID,
  DEFAULT_MODEL,
  DEFAULT_OUTPUT_FORMAT
};
