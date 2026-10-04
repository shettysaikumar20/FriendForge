const {test}=require('node:test');
const assert=require('node:assert/strict');
const app=require('../src/index');
test('health and validation do not need model access',async()=>{
 const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
 const url='http://127.0.0.1:'+server.address().port;
 try {
  const health=await fetch(url+'/api/health'); assert.deepEqual(await health.json(),{status:'ok',service:'FriendForge API'});
  const empty=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:' '})});assert.equal(empty.status,400);
  const clear=await fetch(url+'/api/memory',{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(clear.status,400);
 } finally {await new Promise(r=>server.close(r));}
});

test('rejects bad payloads and uploads before any model call',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  for(const body of [{message:'x'.repeat(6001)},{message:'hi',threadId:'wrong'},{message:'hi',hasDocuments:'yes'}]){const r=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,400);}
  const invalid=await fetch(url+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:'{bad'});assert.equal(invalid.status,400);assert.ok(!(await invalid.text()).includes('SyntaxError'));
  for(const [name,content,type] of [['bad.exe','text','text/plain'],['fake.pdf','not a PDF','application/pdf'],['empty.txt','','text/plain'],['huge.txt','x'.repeat(10*1024*1024+1),'text/plain']]){
   const form=new FormData();form.append('document',new Blob([content],{type}),name);const r=await fetch(url+'/api/documents/upload',{method:'POST',body:form});assert.equal(r.status,400,name);
  }
 }finally{await new Promise(r=>server.close(r));}
});
