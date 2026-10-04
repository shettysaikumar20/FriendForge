const {test}=require('node:test');
const assert=require('node:assert/strict');
const memory=require('../src/services/studyMemory');
test('study schema rejects invalid statuses and malformed model JSON',()=>{
  assert.throws(()=>memory.validateMemory({subject:'DBMS',topic:'SQL',status:'Excellent'}));
  assert.throws(()=>memory.parseJSON('not JSON'));
  assert.deepEqual(memory.validateMemory({subject:' DBMS ',topic:'SQL',status:'Strong'}),{subject:'DBMS',topic:'SQL',status:'Strong'});
});
test('remote CRUD updates a topic rather than appending stale status',async()=>{
  process.env.BACKBOARD_ASSISTANT_ID='test-assistant';
  const records=[];
  const client={ getMemories:async()=>({memories:records}), addMemory:async(id,v)=>records.push({id:'m1',...v}), updateMemory:async(id,mid,v)=>Object.assign(records.find(m=>m.id===mid),v), deleteMemory:async()=>records.splice(0) };
  await memory.save(client,[{subject:'DBMS',topic:'Normalization',status:'Needs practice'}]);
  await memory.save(client,[{subject:'DBMS',topic:'Normalization',status:'Strong'}]);
  assert.equal(records.length,1); assert.equal((await memory.list(client))[0].status,'Strong');
  await memory.clear(client); assert.deepEqual(await memory.list(client),[]);
});
