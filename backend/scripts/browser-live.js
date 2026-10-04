const path=require('node:path');const assert=require('node:assert/strict');require('dotenv').config({path:path.join(__dirname,'../.env')});
const {chromium}=require('../../frontend/node_modules/playwright');const express=require('express');const service=require('../src/services/backboardService');const memory=require('../src/services/studyMemory');
(async()=>{const client=await service.getClient();const assistant=await client.createAssistant({name:'FriendForge browser test '+Date.now()});process.env.BACKBOARD_ASSISTANT_ID=assistant.assistantId;
let server,browser,page;
try{
 const outer=express();outer.use('/api',(req,res,next)=>{req.url='/api'+req.url;require('../src/index')(req,res,next);});outer.use(express.static(path.join(__dirname,'../../frontend/dist')));
 server=outer.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(180000);
 await page.goto('http://127.0.0.1:'+server.address().port);await page.getByText('No study memory yet.',{exact:false}).waitFor();console.log('PASS open app / empty memory');
 for(const filename of ['study-notes.txt','DBMS_Unit_3.pdf']){
  await page.getByLabel('Choose study notes').setInputFiles(path.join(__dirname,'../test/fixtures',filename));await page.getByText('Indexed and ready',{exact:true}).waitFor();console.log('PASS indexed '+filename);
 }
 const input=page.getByLabel('Study question or quiz topic');const send=page.getByRole('button',{name:'Send message',exact:true});
 async function ask(text){await input.fill(text);await send.click();await input.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('input[aria-label="Study question or quiz topic"]').disabled,{},{timeout:240000});}
 await ask('Search study-notes.txt. What is the unique test code? Quote the code exactly.');assert.match(await page.getByRole('log').innerText(),/FF-RAG-2026/);assert.match(await page.getByRole('log').innerText(),/Source:.*(study-notes.txt|DBMS_Unit_3.pdf)/);console.log('PASS grounded question / original filename');
 await page.getByRole('button',{name:/Explain Break/}).click();await ask('Explain normalization simply.');console.log('PASS Explain browser flow');
 await page.getByRole('button',{name:/Quiz Me Test/}).click();await ask('Quiz me on DBMS normalization. Use DBMS as the subject and Normalization as the topic for all five questions.');
 await page.getByRole('region',{name:'Interactive quiz'}).waitFor({timeout:10000});
 for(let index=0;index<5;index++){await page.getByRole('radio').first().check();await page.getByRole('button',{name:'Submit answer',exact:true}).click();if(index<4)await page.getByRole('button',{name:'Next question'}).click();}
 await page.getByRole('heading',{name:/Score:/}).waitFor();console.log('PASS five-question quiz / score');
 // Record an explicit weakness via the UI so revision priority is deterministic.
 await page.getByRole('button',{name:/Explain Break/}).click();await ask('I struggle with DBMS normalization. Please remember that normalization needs practice.');
 await page.getByText('Needs practice',{exact:true}).first().waitFor();console.log('PASS memory updated in UI');
 await page.getByRole('button',{name:/Revise Focus/}).click();await page.waitForFunction(()=>!document.querySelector('input[aria-label="Study question or quiz topic"]').disabled,{},{timeout:240000});
 assert.match(await page.getByRole('log').innerText(),/normalization/i);console.log('PASS Revise browser flow');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:path.join(__dirname,'../../frontend/test-results/live-journey.png'),fullPage:true});console.log('PASS mobile layout / complete live journey');
 await page.getByRole('button',{name:'New Study Session'}).click();await ask('What DBMS topic do I struggle with?');assert.match(await page.getByRole('log').innerText(),/normalization/i);console.log('PASS new session retains study memory');
 await page.getByRole('button',{name:'Clear study memory',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Clear study memory',exact:true}).click();await page.getByRole('button',{name:'Delete saved memory',exact:true}).click();await page.getByText('No study memory yet.',{exact:false}).waitFor();console.log('PASS confirmed memory clear');
}catch(error){if(page){console.log('Browser visible alerts:',await page.getByRole('alert').allTextContents());await page.screenshot({path:path.join(__dirname,'../../frontend/test-results/live-failure.png'),fullPage:true});}throw error;}finally{if(server)server.closeAllConnections();if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));await client.deleteAssistant(assistant.assistantId);}
})().catch(e=>{console.error('FAIL browser journey',e.name,e instanceof assert.AssertionError?'Assertion failed':'Request or UI state failed; inspect local test output.');process.exitCode=1;});
