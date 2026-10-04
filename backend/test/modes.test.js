const {test}=require('node:test');const assert=require('node:assert/strict');
const {validateQuiz,publicQuiz,quizStatus}=require('../src/services/studyModes');
const question={subject:'DBMS',topic:'Normalization',question:'Which?',options:['A','B','C','D'],correctAnswer:0,explanation:'Because A.'};
test('quiz rejects broken output and does not leak answers',()=>{
 const quiz=validateQuiz({questions:Array.from({length:5},()=>({...question}))});
 const publicData=JSON.stringify(publicQuiz('test',quiz)); assert.ok(!publicData.includes('correctAnswer'));assert.ok(!publicData.includes('Because'));
 assert.throws(()=>validateQuiz({questions:[question]}));
 assert.throws(()=>validateQuiz({questions:Array.from({length:5},()=>({...question,correctAnswer:4}))}));
 assert.throws(()=>validateQuiz({questions:Array.from({length:5},()=>({...question,options:['A','A','B','C']}))}));
});
test('quiz mastery needs enough evidence',()=>{assert.equal(quizStatus(4,5),'Strong');assert.equal(quizStatus(1,5),'Needs practice');assert.equal(quizStatus(3,5),'Reviewing');assert.equal(quizStatus(1,1),'Reviewing');});

test('server scores sequential answers, is idempotent and updates weakness',async()=>{
 const service=require('../src/services/backboardService');const memory=require('../src/services/studyMemory');const modes=require('../src/services/studyModes');
 const old={send:service.sendChatMessage,get:service.getClient,list:memory.list,save:memory.save};let saved;
 service.sendChatMessage=async()=>({content:JSON.stringify({questions:Array.from({length:5},()=>({...question}))}),retrievedFiles:['notes.txt'],threadId:'test'});
 service.getClient=async()=>({});memory.list=async()=>[];memory.save=async(c,entries)=>{saved=entries;};
 try {
  const {quiz}=await modes.generate({message:'DBMS',hasDocuments:true});
  await assert.rejects(()=>modes.answer(quiz.id,2,0));
  const first=await modes.answer(quiz.id,0,1); assert.equal(first.correct,false);
  assert.deepEqual(await modes.answer(quiz.id,0,1),first);
  await assert.rejects(()=>modes.answer(quiz.id,0,0));
  for(let i=1;i<4;i++)await modes.answer(quiz.id,i,1);
  const final=await modes.answer(quiz.id,4,0);assert.equal(final.score,1);assert.equal(final.complete,true);assert.equal(saved[0].status,'Needs practice');
 } finally {service.sendChatMessage=old.send;service.getClient=old.get;memory.list=old.list;memory.save=old.save;}
});

test('malformed model JSON retries once and remains rejected if invalid',async()=>{
 const service=require('../src/services/backboardService');const modes=require('../src/services/studyModes');const original=service.sendChatMessage;let calls=0;
 service.sendChatMessage=async()=>{calls++;return {content:'{{broken',retrievedFiles:[]};};
 try{await assert.rejects(()=>modes.generate({message:'DBMS'}),/Invalid quiz/);assert.equal(calls,3);}finally{service.sendChatMessage=original;}
});

test('revision handles empty memory and prioritizes weakness',async()=>{
 const service=require('../src/services/backboardService');const modes=require('../src/services/studyModes');const original={get:service.getStudyMemory,send:service.sendChatMessage};
 try{
  service.getStudyMemory=async()=>[];service.sendChatMessage=async()=>{throw new Error('No model should be called');};
  assert.match((await modes.revise({})).content,/No study memory/);
  service.getStudyMemory=async()=>[{subject:'DBMS',topic:'SQL',status:'Strong'},{subject:'DBMS',topic:'Transactions',status:'Reviewing'},{subject:'DBMS',topic:'Normalization',status:'Needs practice'}];
  service.sendChatMessage=async()=>({success:true,content:'Review'});
  assert.equal((await modes.revise({})).revisionTopic.topic,'Normalization');
 }finally{service.getStudyMemory=original.get;service.sendChatMessage=original.send;}
});

test('exact answer text maps safely to an option index',()=>{
 const quiz=validateQuiz({questions:Array.from({length:5},()=>({...question,correctAnswer:'B'}))});assert.equal(quiz.questions[0].correctAnswer,1);
 assert.throws(()=>validateQuiz({questions:Array.from({length:5},()=>({...question,correctAnswer:'not an option'}))}));
});

test('quiz reuses only previously retrieved evidence with explicit provenance',async()=>{
 const service=require('../src/services/backboardService');const modes=require('../src/services/studyModes');const old={send:service.sendChatMessage,context:service.getRetrievedContext};let calls=0;
 service.sendChatMessage=async()=>++calls===1?{content:'An ungrounded answer',threadId:'t',retrievedFiles:[]}:{content:JSON.stringify({questions:Array.from({length:5},()=>({...question}))}),retrievedFiles:[]};
 service.getRetrievedContext=()=>({content:'Previously retrieved normalization facts',retrievedFiles:['notes.txt']});
 try{const result=await modes.generate({message:'Normalization',threadId:'t',hasDocuments:true});assert.equal(result.sourceContext,'earlier');assert.deepEqual(result.retrievedFiles,['notes.txt']);}
 finally{service.sendChatMessage=old.send;service.getRetrievedContext=old.context;}
});
