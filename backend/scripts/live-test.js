// Uses an isolated assistant and removes only resources created by this test.
const assert = require('node:assert/strict');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const service = require('../src/services/backboardService');
const memory = require('../src/services/studyMemory');
(async () => {
 const client = await service.getClient();
 const assistant = await client.createAssistant({name:'FriendForge automated test ' + Date.now()});
 process.env.BACKBOARD_ASSISTANT_ID = assistant.assistantId;
 try {
  const a = await service.sendChatMessage({message:'My DBMS exam is coming up and I struggle with normalization. Please remember that normalization needs practice.'});
  assert.ok(a.threadId); assert.ok(!a.memoryWarning, a.memoryWarning);
  assert.ok((await service.getStudyMemory()).some(m => /normalization/i.test(m.topic) && m.status==='Needs practice')); console.log('PASS memory saved');
  const b = await service.sendChatMessage({message:'What DBMS topic do I struggle with?'});
  assert.notEqual(a.threadId,b.threadId); assert.match(b.content,/normalization/i); console.log('PASS NEW thread recalls normalization');
  const c = await service.sendChatMessage({message:'I practiced normalization and understand it well now.',threadId:b.threadId});
  assert.ok(!c.memoryWarning,c.memoryWarning);
  assert.ok((await service.getStudyMemory()).some(m=> /normalization/i.test(m.topic) && m.status==='Strong')); console.log('PASS memory updated to Strong');
  const continued = await service.sendChatMessage({message:'Which topic did I just say I understand?',threadId:b.threadId});
  assert.equal(continued.threadId,b.threadId); assert.match(continued.content,/normalization/i); console.log('PASS thread continuation');
  assert.equal(continued.model.name,service.DEFAULT_MODEL); console.log('PASS model '+continued.model.name);
  const doc = await service.uploadStudyDocument({filePath:path.join(__dirname,'../test/fixtures/study-notes.txt'), originalName:'friendforge-rag-test.txt'});
  for(let attempt=0;attempt<60 && doc.status!=='indexed';attempt++){await new Promise(r=>setTimeout(r,2000));const status=await service.getStudyDocumentStatus(doc.documentId);doc.status=status.status;if(['failed','error'].includes(doc.status))break;} assert.equal(doc.status,'indexed');
  const rag = await service.sendChatMessage({message:'What is the unique verification code in the uploaded notes? Quote the code exactly.',threadId:doc.threadId,hasDocuments:true});
  assert.match(rag.content,/FF-RAG-2026/); assert.ok(rag.retrievedFiles.length); console.log('PASS RAG FF-RAG-2026 with sources');
  const missing = await service.sendChatMessage({message:'According only to the uploaded notes, what is the capital of Iceland? Say if the notes do not include it.',threadId:doc.threadId,hasDocuments:true});
  assert.match(missing.content,/no relevant|not|don't|doesn't|couldn't|cannot/i); console.log('PASS RAG missing-information acknowledgement');
  const modes = require('../src/services/studyModes');
  const explain = await service.sendChatMessage({message:'Explain normalization simply.',mode:'explain',threadId:doc.threadId,hasDocuments:true});
  assert.ok(explain.content.length > 50); console.log('PASS Explain');
  const quiz = await modes.generate({message:'Quiz me on normalization using my uploaded study notes. Use DBMS as subject and Normalization as topic for all five questions.',threadId:doc.threadId,hasDocuments:true});
  assert.equal(quiz.quiz.questions.length,5);assert.ok(quiz.retrievedFiles.length);assert.ok(!JSON.stringify(quiz.quiz).includes('correctAnswer'));console.log('PASS grounded quiz generation');
  let score=0; let result;
  for (let index=0;index<5;index++) {result=await modes.answer(quiz.quiz.id,index,0); if(result.correct)score++;assert.ok(result.explanation);}
  assert.equal(result.score,score);assert.ok(result.complete);assert.ok(!result.memoryWarning);assert.ok(result.memoryUpdated);console.log('PASS quiz scoring, explanations and memory update');
  await memory.save(client,[{subject:'DBMS',topic:'Normalization',status:'Needs practice'}]);
  const revision = await modes.revise({threadId:doc.threadId,hasDocuments:true});
  assert.equal(revision.revisionTopic.status,'Needs practice');assert.ok(revision.content.length>30);console.log('PASS Revise selects weak topic');
  await memory.clear(client); assert.equal((await memory.list(client)).length,0); console.log('PASS clear study memory');
 } finally { await client.deleteAssistant(assistant.assistantId); }
})().catch(error=> { console.error('FAIL live integration:',error instanceof assert.AssertionError ? error.message : ['Invalid quiz','Quiz retrieval unavailable'].includes(error.message) ? error.message : 'Service request failed (details suppressed).'); process.exitCode=1; });

