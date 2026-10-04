const assert = require('node:assert/strict');
const app = require('../src/index');

async function runLocalLiveTest() {
  console.log('--- FriendForge Real Local AI Integration & Transparency Test ---');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`FriendForge backend running on ${baseUrl}`);

  try {
    // 1. Status Check
    console.log('\n[Step 1] Checking GET /api/local-ai/status...');
    const statusRes = await fetch(`${baseUrl}/api/local-ai/status`);
    assert.equal(statusRes.status, 200);
    const status = await statusRes.json();
    console.log('Status result:', status);
    assert.equal(status.available, true, 'Ollama and gemma3:4b should be available');
    assert.equal(status.provider, 'ollama');
    assert.equal(status.model, 'gemma3:4b');
    assert.equal(status.local, true);

    // Helper to query /api/local-chat
    async function askLocalChat(prompt) {
      console.log(`\nSending POST /api/local-chat: "${prompt}"...`);
      const startTime = Date.now();
      const res = await fetch(`${baseUrl}/api/local-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`Received response in ${elapsed}s (HTTP ${res.status})`);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);
      assert.equal(data.provider, 'ollama');
      assert.equal(data.local, true);
      assert.equal(data.retrievedFiles, undefined, 'Must not fabricate source citations');
      console.log('Response content:');
      console.log('----------------------------------------');
      console.log(data.content);
      console.log('----------------------------------------');
      return data.content;
    }

    // 2. Transparency Test 1: "Are you using my uploaded study notes to answer this question?"
    console.log('\n[Step 2] Testing Transparency Question: Note access inquiry');
    const answer1 = await askLocalChat('Are you using my uploaded study notes to answer this question?');
    // Must acknowledge that Local AI cannot access uploaded notes / Backboard
    assert.match(
      answer1,
      /no|not|cannot|don't|online study/i,
      'Gemma must answer that it cannot access uploaded study notes in Local AI mode'
    );

    // 3. Transparency Test 2: "What did my uploaded notes say about normalization?"
    console.log('\n[Step 3] Testing Transparency Question: Note content inquiry');
    const answer2 = await askLocalChat('What did my uploaded notes say about normalization?');
    // Must explain that it cannot access uploaded notes rather than pretending
    assert.match(
      answer2,
      /cannot|do not have|don't have|unable to|online study|not access/i,
      'Gemma must state it cannot access uploaded notes'
    );

    // 4. General Knowledge Test: "Explain normalization in 3 simple points."
    console.log('\n[Step 4] Testing General Study Knowledge: Standard explanation');
    const answer3 = await askLocalChat('Explain normalization in 3 simple points.');
    assert.ok(answer3 && answer3.length > 50, 'Gemma should still answer normally from its model knowledge');

    console.log('\nPASS: All real Local AI capability transparency tests passed successfully!');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runLocalLiveTest().catch(err => {
  console.error('\nFAIL: Real Local AI integration test failed:', err);
  process.exitCode = 1;
});
