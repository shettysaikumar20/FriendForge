const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/backboardService');
const registry = require('../src/services/documentRegistry');
const memory = require('../src/services/studyMemory');

test('RAG regression tests', async (t) => {
  const originalMemory = {
    assistantId: memory.assistantId,
    list: memory.list,
    extract: memory.extract
  };

  memory.assistantId = async () => 'test-assistant-id';
  memory.list = async () => [];
  memory.extract = async () => [];

  const client = await service.getClient();
  const originalSendMessage = client.sendMessage;

  t.after(() => {
    client.sendMessage = originalSendMessage;
    memory.assistantId = originalMemory.assistantId;
    memory.list = originalMemory.list;
    memory.extract = originalMemory.extract;
  });

  await t.test('1. answer present in uploaded notes -> grounded answer allowed', async () => {
    client.sendMessage = async (opts) => {
      assert.ok(opts.system_prompt.includes('STRICT RAG GROUNDING RULES'));
      return {
        status: 'COMPLETED',
        content: 'According to your notes, AES was invented by Joan Daemen and Vincent Rijmen.',
        threadId: 'test-thread-1',
        messages: [{ retrievedFiles: ['AES_notes.pdf'] }]
      };
    };
    registry.register({ id: 'AES_notes.pdf', threadId: 'test-thread-1', name: 'AES_notes.pdf', internalName: 'AES_notes.pdf' });

    const res = await service.sendChatMessage({
      message: 'According to my uploaded notes, who invented AES?',
      threadId: 'test-thread-1',
      hasDocuments: true
    });

    assert.equal(res.success, true);
    assert.ok(res.content.includes('Joan Daemen'));
    assert.deepEqual(res.retrievedFiles, ['AES_notes.pdf']);
  });

  await t.test('2. answer absent from notes -> no general-knowledge fallback', async () => {
    client.sendMessage = async (opts) => {
      assert.ok(opts.system_prompt.includes('Do NOT answer using general model knowledge'));
      assert.ok(opts.system_prompt.includes('STOP immediately'));
      return {
        status: 'COMPLETED',
        content: "I couldn't find information about who invented AES in your uploaded notes.",
        threadId: 'test-thread-2',
        messages: [{ retrievedFiles: [] }]
      };
    };

    const res = await service.sendChatMessage({
      message: 'According to my uploaded notes, who invented AES?',
      threadId: 'test-thread-2',
      hasDocuments: true
    });

    assert.equal(res.success, true);
    assert.ok(res.content.includes("couldn't find information"));
    assert.ok(!res.content.includes('Rijndael')); // No general knowledge answer fallback
    assert.deepEqual(res.retrievedFiles, []);
  });

  await t.test('3. missing answer -> no internal tool names exposed', async () => {
    client.sendMessage = async (opts) => {
      assert.ok(opts.system_prompt.includes('Do NOT mention internal tool names'));
      return {
        status: 'COMPLETED',
        content: 'The requested information is not present in the uploaded document IDEA Encryption algorithm.pdf.',
        threadId: 'test-thread-3',
        messages: [{ retrievedFiles: [] }]
      };
    };

    const res = await service.sendChatMessage({
      message: 'According to my uploaded notes, who invented AES?',
      threadId: 'test-thread-3',
      hasDocuments: true
    });

    assert.equal(res.success, true);
    assert.ok(!res.content.includes('searchDocuments'));
    assert.ok(!res.content.includes('tool'));
  });

  await t.test('4. ordinary non-note-constrained chat remains functional', async () => {
    client.sendMessage = async (opts) => {
      assert.ok(!opts.system_prompt.includes('STRICT RAG GROUNDING RULES'));
      assert.ok(opts.system_prompt.includes('You are FriendForge, a friendly study companion'));
      return {
        status: 'COMPLETED',
        content: 'AES stands for Advanced Encryption Standard.',
        threadId: 'test-thread-4',
        messages: [{ retrievedFiles: [] }]
      };
    };

    const res = await service.sendChatMessage({
      message: 'What is AES?',
      threadId: 'test-thread-4',
      hasDocuments: false
    });

    assert.equal(res.success, true);
    assert.ok(res.content.includes('Advanced Encryption Standard'));
    assert.deepEqual(res.retrievedFiles, []);
  });

  await t.test('5. Explain shows source provenance when actually retrieved', async () => {
    // Case 5a: Actually retrieved source
    client.sendMessage = async (opts) => ({
      status: 'COMPLETED',
      content: 'Here is an explanation of AES encryption...',
      threadId: 'test-thread-5a',
      messages: [{ retrievedFiles: ['crypto_overview.pdf'] }]
    });
    registry.register({ id: 'crypto_overview.pdf', threadId: 'test-thread-5a', name: 'crypto_overview.pdf', internalName: 'crypto_overview.pdf' });

    const resWithSource = await service.sendChatMessage({
      message: 'Explain AES encryption',
      threadId: 'test-thread-5a',
      hasDocuments: true,
      mode: 'explain'
    });

    assert.equal(resWithSource.success, true);
    assert.deepEqual(resWithSource.retrievedFiles, ['crypto_overview.pdf']);

    // Case 5b: No source retrieved -> empty array, no fabricated source badge
    client.sendMessage = async (opts) => ({
      status: 'COMPLETED',
      content: 'I could not find information on that in your uploaded notes.',
      threadId: 'test-thread-5b',
      messages: [{ retrievedFiles: [] }]
    });

    const resNoSource = await service.sendChatMessage({
      message: 'Explain quantum cryptography',
      threadId: 'test-thread-5b',
      hasDocuments: true,
      mode: 'explain'
    });

    assert.equal(resNoSource.success, true);
    assert.deepEqual(resNoSource.retrievedFiles, []);
  });
});
