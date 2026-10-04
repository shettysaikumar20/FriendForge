const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/index');
const elevenLabsService = require('../src/services/elevenLabsService');
const backboardService = require('../src/services/backboardService');
const ollamaService = require('../src/services/ollamaService');

function restoreEnv(key, oldVal) {
  if (oldVal !== undefined) {
    process.env[key] = oldVal;
  } else {
    delete process.env[key];
  }
}

test('TTS: rejects empty or missing text with 400', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Missing body
    const res1 = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(res1.status, 400);
    const body1 = await res1.json();
    assert.match(body1.message, /Text property is required/i);

    // 2. Empty string
    const res2 = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '   ' })
    });
    assert.equal(res2.status, 400);

    // 3. Non-string
    const res3 = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 12345 })
    });
    assert.equal(res3.status, 400);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('TTS: enforces text-length limits (> 3000 chars rejected)', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const longText = 'a'.repeat(3001);
    const res = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: longText })
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /exceeds maximum length/i);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('TTS: client cannot override ElevenLabs credentials, voice, or endpoints', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. client supplies apiKey
    const resKey = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Valid explanation', apiKey: 'custom-secret' })
    });
    assert.equal(resKey.status, 400);
    const bodyKey = await resKey.json();
    assert.match(bodyKey.message, /Client-specified/i);

    // 2. client supplies voiceId
    const resVoice = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Valid explanation', voiceId: 'custom-voice' })
    });
    assert.equal(resVoice.status, 400);

    // 3. client supplies model
    const resModel = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Valid explanation', model: 'eleven_turbo' })
    });
    assert.equal(resModel.status, 400);

    // 4. client supplies arbitrary endpoint url
    const resUrl = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Valid explanation', url: 'https://attacker.com' })
    });
    assert.equal(resUrl.status, 400);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('TTS: API key remains backend-only and is never exposed via config or health', async () => {
  const oldKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = 'test_secret_elevenlabs_key_123';

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // Check /api/config
    const resConfig = await fetch(`${appUrl}/api/config`);
    assert.equal(resConfig.status, 200);
    const bodyConfig = await resConfig.json();
    assert.equal(bodyConfig.elevenLabsKey, undefined);
    assert.equal(bodyConfig.apiKey, undefined);
    assert.equal(JSON.stringify(bodyConfig).includes('test_secret'), false);

    // Check /api/health
    const resHealth = await fetch(`${appUrl}/api/health`);
    assert.equal(resHealth.status, 200);
    const bodyHealth = await resHealth.json();
    assert.equal(JSON.stringify(bodyHealth).includes('test_secret'), false);
  } finally {
    restoreEnv('ELEVENLABS_API_KEY', oldKey);
    await new Promise(r => server.close(r));
  }
});

test('TTS: returns 503 sanitized error when ElevenLabs is unconfigured', async () => {
  const oldKey = process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Database normalization reduces redundancy.' })
    });

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'Service Unavailable');
    assert.equal(body.message, 'Audio generation is temporarily unavailable.');
  } finally {
    restoreEnv('ELEVENLABS_API_KEY', oldKey);
    await new Promise(r => server.close(r));
  }
});

test('TTS: returns 200 with audio/mpeg buffer when ElevenLabs succeeds', async () => {
  const oldKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = 'mock_valid_elevenlabs_key';

  const fakeAudioBytes = Buffer.from([0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00]); // MP3 frame header
  let receivedHeaders = null;
  let receivedBody = null;

  elevenLabsService.setCustomFetch(async (url, options) => {
    receivedHeaders = options.headers;
    receivedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'audio/mpeg' }),
      arrayBuffer: async () => fakeAudioBytes
    };
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Database normalization helps organize data.' })
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'audio/mpeg');
    assert.equal(res.headers.get('cache-control'), 'no-store');

    const receivedBuffer = Buffer.from(await res.arrayBuffer());
    assert.deepEqual(receivedBuffer, fakeAudioBytes);

    // Verify ElevenLabs headers and payload
    assert.ok(receivedHeaders);
    assert.equal(receivedHeaders['xi-api-key'], 'mock_valid_elevenlabs_key');
    assert.equal(receivedHeaders['Accept'], 'audio/mpeg');
    assert.equal(receivedBody.text, 'Database normalization helps organize data.');
    assert.equal(receivedBody.model_id, 'eleven_multilingual_v2');
  } finally {
    elevenLabsService.setCustomFetch(null);
    restoreEnv('ELEVENLABS_API_KEY', oldKey);
    await new Promise(r => server.close(r));
  }
});

test('TTS: upstream failure returns sanitized error without leaking API details', async () => {
  const oldKey = process.env.ELEVENLABS_API_KEY;
  process.env.ELEVENLABS_API_KEY = 'mock_valid_elevenlabs_key';

  elevenLabsService.setCustomFetch(async () => {
    return {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: { status: 'invalid_api_key', message: 'Invalid API key provided' } })
    };
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${appUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Database normalization helps organize data.' })
    });

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.error, 'Service Unavailable');
    assert.equal(body.message, 'Audio generation is temporarily unavailable.');
    assert.equal(JSON.stringify(body).includes('invalid_api_key'), false);
    assert.equal(JSON.stringify(body).includes('mock_valid'), false);
  } finally {
    elevenLabsService.setCustomFetch(null);
    restoreEnv('ELEVENLABS_API_KEY', oldKey);
    await new Promise(r => server.close(r));
  }
});

test('TTS: Local AI continues making zero ElevenLabs and zero Backboard calls', async () => {
  let elevenLabsCalls = 0;
  let backboardCalls = 0;

  const originalGenerate = elevenLabsService.generateSpeech;
  elevenLabsService.generateSpeech = async () => {
    elevenLabsCalls++;
    return originalGenerate.apply(elevenLabsService, arguments);
  };

  const originalBackboard = backboardService.sendChatMessage;
  backboardService.sendChatMessage = async () => {
    backboardCalls++;
    return originalBackboard.apply(backboardService, arguments);
  };

  const mockOllama = http.createServer((req, res) => {
    if (req.url === '/api/chat' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        model: 'gemma3:4b',
        message: { role: 'assistant', content: 'Local response strictly offline.' }
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(r => mockOllama.listen(0, '127.0.0.1', r));
  const mockPort = mockOllama.address().port;
  const oldUrl = process.env.OLLAMA_URL;
  process.env.OLLAMA_URL = `http://127.0.0.1:${mockPort}`;

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'What is 1NF?' })
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.local, true);

    // Verify strict isolation
    assert.equal(elevenLabsCalls, 0, 'Local AI must make ZERO ElevenLabs requests');
    assert.equal(backboardCalls, 0, 'Local AI must make ZERO Backboard requests');
  } finally {
    elevenLabsService.generateSpeech = originalGenerate;
    backboardService.sendChatMessage = originalBackboard;
    restoreEnv('OLLAMA_URL', oldUrl);
    await new Promise(r => server.close(r));
    await new Promise(r => mockOllama.close(r));
  }
});
