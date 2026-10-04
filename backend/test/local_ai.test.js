const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../src/index');
const backboardService = require('../src/services/backboardService');

function restoreEnv(key, oldVal) {
  if (oldVal !== undefined) {
    process.env[key] = oldVal;
  } else {
    delete process.env[key];
  }
}

test('Local AI: status reports available when Ollama and configured model are available', async () => {
  const oldUrl = process.env.OLLAMA_URL;
  const oldModel = process.env.OLLAMA_MODEL;

  const mockOllama = http.createServer((req, res) => {
    if (req.url === '/api/tags' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        models: [{ name: 'gemma3:4b', model: 'gemma3:4b' }]
      }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(r => mockOllama.listen(0, '127.0.0.1', r));
  const mockPort = mockOllama.address().port;
  process.env.OLLAMA_URL = `http://127.0.0.1:${mockPort}`;
  process.env.OLLAMA_MODEL = 'gemma3:4b';

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${appUrl}/api/local-ai/status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.available, true);
    assert.equal(body.provider, 'ollama');
    assert.equal(body.model, 'gemma3:4b');
    assert.equal(body.local, true);
  } finally {
    restoreEnv('OLLAMA_URL', oldUrl);
    restoreEnv('OLLAMA_MODEL', oldModel);
    await new Promise(r => server.close(r));
    await new Promise(r => mockOllama.close(r));
  }
});

test('Local AI: status reports unavailable cleanly when Ollama cannot be reached or model is missing', async () => {
  const oldUrl = process.env.OLLAMA_URL;
  const oldModel = process.env.OLLAMA_MODEL;
  process.env.OLLAMA_URL = 'http://127.0.0.1:1'; // unreachable port
  delete process.env.OLLAMA_MODEL;

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${appUrl}/api/local-ai/status`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.available, false);
    assert.equal(body.provider, 'ollama');
    assert.equal(body.model, 'gemma3:4b');
    assert.equal(body.local, true);
    assert.equal(body.stack, undefined);
  } finally {
    restoreEnv('OLLAMA_URL', oldUrl);
    restoreEnv('OLLAMA_MODEL', oldModel);
    await new Promise(r => server.close(r));
  }
});

test('Local AI: local chat returns normalized Gemma response and strictly isolates from Backboard', async () => {
  const oldUrl = process.env.OLLAMA_URL;
  const oldModel = process.env.OLLAMA_MODEL;

  let backboardCalls = 0;
  const originalSend = backboardService.sendChatMessage;
  backboardService.sendChatMessage = async () => {
    backboardCalls++;
    return originalSend.apply(backboardService, arguments);
  };

  let ollamaReceivedPayload = null;
  const mockOllama = http.createServer((req, res) => {
    if (req.url === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        ollamaReceivedPayload = JSON.parse(body);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          model: 'gemma3:4b',
          message: {
            role: 'assistant',
            content: 'Normalization is the process of organizing database tables to reduce redundancy.'
          }
        }));
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise(r => mockOllama.listen(0, '127.0.0.1', r));
  const mockPort = mockOllama.address().port;

  process.env.OLLAMA_URL = `http://127.0.0.1:${mockPort}`;
  process.env.OLLAMA_MODEL = 'gemma3:4b';

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Explain normalization.',
        messages: [
          { role: 'user', content: 'What is a database?' },
          { role: 'assistant', content: 'A database is an organized collection of data.' },
          { role: 'user', content: 'Explain normalization.' }
        ]
      })
    });

    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.provider, 'ollama');
    assert.equal(body.local, true);
    assert.equal(body.model.name, 'gemma3:4b');
    assert.equal(body.model.provider, 'ollama');
    assert.equal(body.model.local, true);
    assert.equal(body.content, 'Normalization is the process of organizing database tables to reduce redundancy.');
    assert.equal(body.message, 'Normalization is the process of organizing database tables to reduce redundancy.');

    // Crucial: No source citations fabricated
    assert.equal(body.retrievedFiles, undefined);
    assert.equal(body.sourceContext, undefined);

    // Crucial: Provider isolation - ZERO Backboard calls on success
    assert.equal(backboardCalls, 0);

    // Context bounds sent to Ollama
    assert.ok(ollamaReceivedPayload);
    assert.equal(ollamaReceivedPayload.model, 'gemma3:4b');
    assert.ok(ollamaReceivedPayload.messages.length >= 3);
    assert.equal(ollamaReceivedPayload.messages[0].role, 'system');
  } finally {
    backboardService.sendChatMessage = originalSend;
    restoreEnv('OLLAMA_URL', oldUrl);
    restoreEnv('OLLAMA_MODEL', oldModel);
    await new Promise(r => server.close(r));
    await new Promise(r => mockOllama.close(r));
  }
});

test('Local AI: failure produces clean error and NEVER falls back to Backboard', async () => {
  const oldUrl = process.env.OLLAMA_URL;
  const oldModel = process.env.OLLAMA_MODEL;

  let backboardCalls = 0;
  const originalSend = backboardService.sendChatMessage;
  backboardService.sendChatMessage = async () => {
    backboardCalls++;
    return originalSend.apply(backboardService, arguments);
  };

  process.env.OLLAMA_URL = 'http://127.0.0.1:1'; // unreachable
  delete process.env.OLLAMA_MODEL;

  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hello Gemma' })
    });

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, 'Local AI is unavailable. Make sure Ollama is running and gemma3:4b is installed.');

    // Crucial: ZERO Backboard calls on failure
    assert.equal(backboardCalls, 0);
  } finally {
    backboardService.sendChatMessage = originalSend;
    restoreEnv('OLLAMA_URL', oldUrl);
    restoreEnv('OLLAMA_MODEL', oldModel);
    await new Promise(r => server.close(r));
  }
});

test('Local AI: security controls reject client-supplied URL or model overrides', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // 1. Client supplies arbitrary Ollama URL
    const resUrl = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi', url: 'http://malicious-server.com' })
    });
    assert.equal(resUrl.status, 400);

    // 2. Client supplies arbitrary model
    const resModel = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi', model: 'gpt-4o' })
    });
    assert.equal(resModel.status, 400);

    // 3. Client supplies ollamaUrl
    const resOllamaUrl = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi', ollamaUrl: 'http://malicious-server.com' })
    });
    assert.equal(resOllamaUrl.status, 400);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('Local AI: invalid payloads and excessive messages are rejected cleanly', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const appUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    // Empty payload
    const resEmpty = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(resEmpty.status, 400);

    // Empty message
    const resBlank = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' })
    });
    assert.equal(resBlank.status, 400);

    // Excessive message length > 6000
    const resTooLong = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'a'.repeat(6001) })
    });
    assert.equal(resTooLong.status, 400);

    // Too many messages in history (> 15)
    const tooManyMessages = Array.from({ length: 16 }, (_, i) => ({ role: 'user', content: `msg ${i}` }));
    const resTooMany = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: tooManyMessages })
    });
    assert.equal(resTooMany.status, 400);

    // Invalid role
    const resBadRole = await fetch(`${appUrl}/api/local-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'admin', content: 'test' }] })
    });
    assert.equal(resBadRole.status, 400);
  } finally {
    await new Promise(r => server.close(r));
  }
});

test('Local AI: system prompt establishes strict capability and transparency boundaries', async () => {
  const ollamaService = require('../src/services/ollamaService');
  assert.ok(ollamaService.LOCAL_SYSTEM_PROMPT, 'LOCAL_SYSTEM_PROMPT should be defined');
  const prompt = ollamaService.LOCAL_SYSTEM_PROMPT;

  // 1. Local AI cannot access uploaded study notes
  assert.match(prompt, /NOT have access to uploaded study notes/i);
  assert.match(prompt, /switch to Online Study mode for note-grounded RAG/i);

  // 2. Local AI cannot access Backboard memory
  assert.match(prompt, /NOT have access to Backboard/i);
  assert.match(prompt, /persistent Study Memory/i);

  // 3. Local AI cannot access Online Study sessions
  assert.match(prompt, /previous Online Study sessions/i);

  // 4. Local AI must not claim internet/retrieval access
  assert.match(prompt, /NOT have access to external websites.*internet-based retrieval/is);
  assert.match(prompt, /NEVER claim, imply, or hallucinate that you searched, read, retrieved/i);

  // 5. Local conversation history is conversation context, not an uploaded document
  assert.match(prompt, /conversation context, NOT an? uploaded document/i);
  assert.match(prompt, /NEVER claim that a previous assistant(-generated)? explanation is an uploaded note/i);

  // 6. Test that constructed Ollama request prepends this exact system message
  let dispatchedMessages = null;
  const mockOllama = http.createServer((req, res) => {
    if (req.url === '/api/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        dispatchedMessages = JSON.parse(body).messages;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          model: 'gemma3:4b',
          message: { role: 'assistant', content: 'No, I cannot access your notes.' }
        }));
      });
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
      body: JSON.stringify({ message: 'Are you using my uploaded notes?' })
    });
    assert.equal(res.status, 200);
    assert.ok(dispatchedMessages && dispatchedMessages.length >= 2);
    assert.equal(dispatchedMessages[0].role, 'system');
    assert.equal(dispatchedMessages[0].content, ollamaService.LOCAL_SYSTEM_PROMPT);
  } finally {
    restoreEnv('OLLAMA_URL', oldUrl);
    await new Promise(r => server.close(r));
    await new Promise(r => mockOllama.close(r));
  }
});

