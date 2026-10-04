import {test,expect} from '@playwright/test';

for(const width of [390,768,1440]) test('study journey at '+width+'px',async({page})=>{
 await page.setViewportSize({width,height:900});let memories=[];let polls=0;let lastChatBody;
 const questions=Array.from({length:5},(_,index)=>({index,question:'Question '+(index+1)+': What does normalization reduce?',options:['Redundancy','Security','Clarity','Learning']}));
 await page.route('**/api/**',async route=>{
  const url=new URL(route.request().url()); const path=url.pathname;let data;if(path==='/api/chat')lastChatBody=route.request().postDataJSON();
  if(path==='/api/session')data={authenticated:true,passwordRequired:false};
  else if(path==='/api/health')data={status:'ok',service:'FriendForge API'};
  else if(path==='/api/config')data={model:{name:'meta-llama/llama-3.1-8b-instruct',provider:'openrouter',openWeight:true}};
  else if(path==='/api/local-ai/status')data={available:true,provider:'ollama',model:'gemma3:4b',local:true};
  else if(path==='/api/memory'){if(route.request().method()==='DELETE')memories=[];data={success:true,memories};}
  else if(path==='/api/documents/upload')data={success:true,threadId:'thread-test',document:{id:'doc-test',name:'DBMS_Unit_3.txt',status:'pending'}};
  else if(path.includes('/status')){polls++;data={success:true,document:{id:'doc-test',name:'DBMS_Unit_3.txt',status:'indexed',threadId:'thread-test'}};}
  else if(path==='/api/quiz')data={success:true,quiz:{id:'quiz-test',questions,total:5},threadId:'thread-test',retrievedFiles:['DBMS_Unit_3.txt']};
  else if(path.includes('/answer')){const {index}=route.request().postDataJSON();if(index===4)memories=[{id:'memory-test',subject:'DBMS',topic:'Normalization',status:'Needs practice'}];data={success:true,correct:false,correctAnswer:0,explanation:'Normalization reduces redundancy.',complete:index===4,score:0,total:5,memoryUpdated:true,source:['DBMS_Unit_3.txt']};}
  else data={success:true,content:path==='/api/revise'?'Let us revise Normalization because it needs practice.':'Normalization reduces redundancy.',threadId:'thread-test',retrievedFiles:['DBMS_Unit_3.txt'],model:{name:'meta-llama/llama-3.1-8b-instruct',openWeight:true}};
  await route.fulfill({json:data});
 });
 await page.goto('/');await expect(page.getByText('No study memory yet.',{exact:false})).toBeVisible();
 await page.getByLabel('Choose study notes').setInputFiles({name:'DBMS_Unit_3.txt',mimeType:'text/plain',buffer:Buffer.from('Normalization reduces redundancy.')});
 await expect(page.getByText('Indexing your notes...', {exact:true})).toBeVisible();
 await expect(page.getByText('Indexed and ready',{exact:true})).toBeVisible();expect(polls).toBeGreaterThan(0);
 const input=page.getByLabel('Study question or quiz topic');await input.fill('What does normalization reduce?');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByText('Source: DBMS_Unit_3.txt',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Explain/}).click();await input.fill('Explain normalization');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await page.getByRole('button',{name:/Quiz Me/}).click();await input.fill('Normalization');await page.getByRole('button',{name:'Send message',exact:true}).click();
 await expect(page.getByRole('region',{name:'Interactive quiz'})).toBeVisible();await expect(page.getByText('Correct answer:',{exact:false})).toHaveCount(0);
 for(let i=0;i<5;i++){await page.getByRole('radio',{name:'Security',exact:true}).check();await page.getByRole('button',{name:'Submit answer',exact:true}).click();if(i<4)await page.getByRole('button',{name:'Next question'}).click();}
 await expect(page.getByText('Score: 0 / 5',{exact:true})).toBeVisible();await expect(page.getByText('Needs practice',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:/Revise/}).click();await expect(page.getByText('Let us revise Normalization because it needs practice.',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'New Study Session'}).click();
 await expect(page.getByRole('region',{name:'Interactive quiz'})).toHaveCount(0);await expect(page.getByText('Needs practice',{exact:true})).toBeVisible();
 await input.fill('What topic needs practice?');await page.getByRole('button',{name:'Send message',exact:true}).click();expect(lastChatBody.threadId).toBe(null);
 await page.getByRole('button',{name:'Clear study memory',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByText('Needs practice',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Clear study memory',exact:true}).click();await page.getByRole('button',{name:'Delete saved memory',exact:true}).click();await expect(page.getByText('No study memory yet.',{exact:false})).toBeVisible();
 await page.screenshot({path:'test-results/journey-'+width+'.png',fullPage:true});
});

test('invalid upload stays local and memory failure can retry',async({page})=>{
 let fail=true;await page.route('**/api/**',async r=>{if(r.request().url().endsWith('/memory')&&fail)await r.fulfill({status:502,json:{message:'Unavailable'}});else await r.fulfill({json:{authenticated:true,passwordRequired:false,success:true,memories:[],status:'ok',service:'FriendForge API',available:true,model:{name:'meta-llama/llama-3.1-8b-instruct',provider:'openrouter',openWeight:true}}});});
 await page.goto('/');await expect(page.getByRole('button',{name:'Retry memory'})).toBeVisible();fail=false;await page.getByRole('button',{name:'Retry memory'}).click();await expect(page.getByText('No study memory yet.',{exact:false})).toBeVisible();
 await page.getByLabel('Choose study notes').setInputFiles({name:'malware.exe',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});await expect(page.getByRole('alert')).toContainText('Choose a non-empty PDF or TXT');
});

test('Local AI: mode switching, availability, local chat, and feature isolation', async ({ page }) => {
  let localStatusAvailable = true;
  let localChatBody = null;
  let backboardCalled = false;

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/session') {
      await route.fulfill({ json: { authenticated: true, passwordRequired: false } });
    } else if (path === '/api/health') {
      await route.fulfill({ json: { status: 'ok', service: 'FriendForge API' } });
    } else if (path === '/api/config') {
      await route.fulfill({ json: { model: { name: 'meta-llama/llama-3.1-8b-instruct', provider: 'openrouter', openWeight: true } } });
    } else if (path === '/api/local-ai/status') {
      await route.fulfill({
        json: {
          available: localStatusAvailable,
          provider: 'ollama',
          model: 'gemma3:4b',
          local: true
        }
      });
    } else if (path === '/api/local-chat') {
      localChatBody = route.request().postDataJSON();
      await route.fulfill({
        json: {
          success: true,
          content: 'Database normalization organizes tables to reduce data redundancy.',
          message: 'Database normalization organizes tables to reduce data redundancy.',
          model: { name: 'gemma3:4b', provider: 'ollama', openWeight: true, local: true },
          provider: 'ollama',
          local: true
        }
      });
    } else if (path === '/api/chat' || path === '/api/quiz' || path === '/api/revise') {
      backboardCalled = true;
      await route.fulfill({ json: { success: true, content: 'Backboard response' } });
    } else if (path === '/api/memory') {
      await route.fulfill({ json: { success: true, memories: [] } });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });

  await page.goto('/');

  // 1. Verify Online mode is active by default
  await expect(page.getByRole('button', { name: 'Online Study' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Local AI' })).toBeVisible();
  await expect(page.getByText('Open-weight AI • meta-llama/llama-3.1-8b-instruct • Backboard')).toBeVisible();

  // 2. Switch to Local AI mode
  await page.getByRole('button', { name: 'Local AI' }).click();

  // 3. Verify Header and Banner
  await expect(page.getByText('Local AI • Gemma 3 4B • Runs locally through Ollama')).toBeVisible();
  await expect(page.getByText('Gemma 3 4B is ready locally.')).toBeVisible();
  await expect(page.getByText('Internet is not required for AI responses once Gemma is installed.')).toBeVisible();
  await expect(page.getByText('Uploaded-note RAG and persistent Backboard study memory are unavailable in Local AI mode.', { exact: true })).toBeVisible();

  // 4. Verify Backboard-only features are clearly unavailable / disabled
  await expect(page.getByText('Uploaded-note RAG and document grounding are unavailable in Local AI mode.', { exact: false })).toBeVisible();
  await expect(page.getByText('Persistent Backboard study memory is unavailable in Local AI mode.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose notes (Online only)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Quiz Me/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /Revise/ })).toBeDisabled();

  // 5. Send message in Local AI mode
  const input = page.getByLabel('Study question or quiz topic');
  await input.fill('Explain database normalization.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();

  // Verify response content and model badge
  await expect(page.getByText('Database normalization organizes tables to reduce data redundancy.')).toBeVisible();
  await expect(page.getByText('gemma3:4b', { exact: true })).toBeVisible();
  // Ensure NO source citation is fabricated
  await expect(page.getByText(/Source:/)).toHaveCount(0);

  // Ensure ZERO Backboard calls were made during Local AI chat
  expect(backboardCalled).toBe(false);
  expect(localChatBody).not.toBeNull();
  expect(localChatBody.message).toBe('Explain database normalization.');

  // 6. Test unavailable state
  localStatusAvailable = false;
  await page.getByRole('button', { name: 'Online Study' }).click();
  await expect(page.getByText('Open-weight AI • meta-llama/llama-3.1-8b-instruct • Backboard')).toBeVisible();
  await page.getByRole('button', { name: 'Local AI' }).click();
  await expect(page.getByText('Local AI is unavailable. Start Ollama and make sure gemma3:4b is installed.')).toBeVisible();

  // 7. Switch back to Online Study restores the full experience
  await page.getByRole('button', { name: 'Online Study' }).click();
  await expect(page.getByText('Open-weight AI • meta-llama/llama-3.1-8b-instruct • Backboard')).toBeVisible();
  await expect(page.getByRole('button', { name: /Quiz Me/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: /Revise/ })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Choose notes' })).toBeEnabled();
});

test('ElevenLabs TTS: explicit click, audio playback controls, duplicate prevention, and Local AI privacy', async ({ page }) => {
  let ttsCalls = 0;
  let ttsRequestBody = null;

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/session') {
      await route.fulfill({ json: { authenticated: true, passwordRequired: false } });
    } else if (path === '/api/health') {
      await route.fulfill({ json: { status: 'ok', service: 'FriendForge API' } });
    } else if (path === '/api/config') {
      await route.fulfill({ json: { model: { name: 'meta-llama/llama-3.1-8b-instruct', provider: 'openrouter', openWeight: true } } });
    } else if (path === '/api/local-ai/status') {
      await route.fulfill({ json: { available: true, provider: 'ollama', model: 'gemma3:4b', local: true } });
    } else if (path === '/api/chat') {
      await route.fulfill({
        json: {
          success: true,
          content: 'Database normalization organizes tables to reduce data redundancy.',
          model: { name: 'meta-llama/llama-3.1-8b-instruct' }
        }
      });
    } else if (path === '/api/text-to-speech') {
      ttsCalls++;
      ttsRequestBody = route.request().postDataJSON();
      await new Promise(r => setTimeout(r, 150));
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg' },
        body: Buffer.from([0xFF, 0xFB, 0x90, 0x64, 0x00, 0x00, 0x00, 0x00])
      });
    } else if (path === '/api/local-chat') {
      await route.fulfill({
        json: {
          success: true,
          content: 'Local AI explanation without cloud voice.',
          local: true
        }
      });
    } else {
      await route.fulfill({ json: { success: true, memories: [] } });
    }
  });

  await page.goto('/');

  // 1. Send question in Online Study mode
  const input = page.getByLabel('Study question or quiz topic');
  await input.fill('Explain normalization');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Database normalization organizes tables to reduce data redundancy.')).toBeVisible();

  // 2. TTS is NOT called automatically
  expect(ttsCalls).toBe(0);

  // 3. "Listen to Explanation" button is present and clickable
  const listenBtn = page.getByRole('button', { name: 'Listen to Explanation' }).first();
  await expect(listenBtn).toBeVisible();

  // 4. Click to generate speech
  await listenBtn.click();

  // 5. Verify audio was requested and voice ready state appears
  await expect(page.getByText('Voice ready')).toBeVisible();
  expect(ttsCalls).toBe(1);
  expect(ttsRequestBody.text).toContain('Database normalization organizes tables');

  // 6. Playback controls are now visible (Play/Pause, Replay)
  const replayBtn = page.getByRole('button', { name: /Replay/i });
  await expect(replayBtn).toBeVisible();

  // 7. Clicking Replay re-uses session cache and does NOT make another API call
  await replayBtn.click();
  expect(ttsCalls).toBe(1); // Still 1! Zero redundant network calls

  // 8. Switch to Local AI mode and verify privacy boundary
  await page.getByRole('button', { name: 'Local AI', exact: true }).click();
  await expect(page.getByText('Voice playback requires Online Study because ElevenLabs is a cloud service.').first()).toBeVisible();
  const disabledBtn = page.getByRole('button', { name: /Cloud voice playback disabled/i }).first();
  await expect(disabledBtn).toBeDisabled();

  // 9. Send a local chat in Local AI mode
  await input.fill('What is 2NF?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByText('Local AI explanation without cloud voice.')).toBeVisible();

  // 10. Local response also has privacy notice and zero TTS calls
  expect(ttsCalls).toBe(1); // Never called by Local AI
});

test('Markdown rendering in assistant messages: bold, lists, code, and security', async ({ page }) => {
  const markdownResponse = `**Open Source Contribution:**

Open-source contributions can include:

1. **Code contributions**
   - Fix bugs
   - Add features

2. **Documentation**
   - Improve README
   - Write guides

Use \`npm install\` to get started.

<script>window.__xss_detected = true;</script>`;

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path === '/api/session') {
      await route.fulfill({ json: { authenticated: true, passwordRequired: false } });
    } else if (path === '/api/health') {
      await route.fulfill({ json: { status: 'ok', service: 'FriendForge API' } });
    } else if (path === '/api/config') {
      await route.fulfill({ json: { model: { name: 'meta-llama/llama-3.1-8b-instruct', provider: 'openrouter', openWeight: true } } });
    } else if (path === '/api/local-ai/status') {
      await route.fulfill({ json: { available: true, provider: 'ollama', model: 'gemma3:4b', local: true } });
    } else if (path === '/api/chat') {
      await route.fulfill({
        json: {
          success: true,
          content: markdownResponse,
          model: { name: 'meta-llama/llama-3.1-8b-instruct' }
        }
      });
    } else if (path === '/api/memory') {
      await route.fulfill({ json: { success: true, memories: [] } });
    } else {
      await route.fulfill({ json: { success: true } });
    }
  });

  await page.goto('/');

  // Send message
  const input = page.getByLabel('Study question or quiz topic');
  await input.fill('What is open source contribution?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();

  // 1. Verify Bold is rendered as strong element and literal ** is not present
  const boldHeader = page.locator('.assistant-content-body strong').filter({ hasText: 'Open Source Contribution:' });
  await expect(boldHeader).toBeVisible();
  await expect(page.locator('.assistant-content-body')).not.toContainText('**Open Source Contribution:**');

  // 2. Verify Ordered list elements
  const orderedItems = page.locator('.assistant-content-body ol > li');
  await expect(orderedItems.first()).toBeVisible();
  expect(await orderedItems.count()).toBeGreaterThanOrEqual(2);

  // 3. Verify Bullet list elements
  const bulletItems = page.locator('.assistant-content-body ul > li');
  await expect(bulletItems.first()).toBeVisible();
  expect(await bulletItems.count()).toBeGreaterThanOrEqual(4);

  // 4. Verify nested list items
  const nestedLi = page.locator('.assistant-content-body ol > li ul > li');
  await expect(nestedLi.filter({ hasText: 'Fix bugs' })).toBeVisible();
  await expect(nestedLi.filter({ hasText: 'Add features' })).toBeVisible();

  // 5. Verify Inline code
  const inlineCode = page.locator('.assistant-content-body code').filter({ hasText: 'npm install' });
  await expect(inlineCode).toBeVisible();

  // 6. Security: Verify raw script tag did not execute
  const xssDetected = await page.evaluate(() => window.__xss_detected);
  expect(xssDetected).toBeUndefined();
  expect(await page.locator('.assistant-content-body script').count()).toBe(0);

  // 7. Verify user message is plain text
  await expect(page.locator('.user-bubble')).toHaveText('What is open source contribution?');
});

