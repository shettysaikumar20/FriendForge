const assert = require('node:assert/strict');
const app = require('../src/index');

async function runTtsLiveTest() {
  console.log('--- FriendForge Real ElevenLabs TTS Integration Test ---');

  if (!process.env.ELEVENLABS_API_KEY) {
    console.error('\n[Notice] ELEVENLABS_API_KEY is not configured in backend/.env.');
    console.error('To run this test with real ElevenLabs quota:');
    console.error('1. Add your key to E:\\FriendForge\\backend\\.env:');
    console.error('   ELEVENLABS_API_KEY=your_elevenlabs_key_here');
    console.error('2. Run: npm run test:tts:live');
    process.exit(1);
  }

  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  console.log(`FriendForge backend running on ${baseUrl}`);

  try {
    const testText = 'Database normalization helps organize data and reduce unnecessary duplication.';
    console.log(`\nSending POST /api/text-to-speech with: "${testText}"...`);

    const startTime = Date.now();
    const res = await fetch(`${baseUrl}/api/text-to-speech`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: testText })
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Response received in ${elapsed}s (HTTP ${res.status})`);

    assert.equal(res.status, 200, 'Expected HTTP 200 from /api/text-to-speech');
    assert.equal(res.headers.get('content-type'), 'audio/mpeg', 'Expected Content-Type: audio/mpeg');

    const audioBytes = Buffer.from(await res.arrayBuffer());
    console.log(`Received audio buffer size: ${audioBytes.length} bytes`);
    assert.ok(audioBytes.length > 500, 'Expected non-trivial playable MP3 audio stream');

    // Verify MP3 frame sync header (0xFF, 0xFB or 0xFF, 0xF3 or ID3)
    const isMp3Header = (audioBytes[0] === 0xFF && (audioBytes[1] & 0xE0) === 0xE0) ||
                        (audioBytes[0] === 0x49 && audioBytes[1] === 0x44 && audioBytes[2] === 0x33); // 'ID3'
    assert.ok(isMp3Header, 'Audio stream must have valid MP3 or ID3 header bytes');

    console.log('\nPASS: Successfully synthesized and received valid playable MP3 audio from ElevenLabs!');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runTtsLiveTest().catch(err => {
  console.error('\nFAIL: Real ElevenLabs TTS test failed:', err);
  process.exit(1);
});
