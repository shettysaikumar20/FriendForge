const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
process.env.APP_PASSWORD=crypto.randomBytes(24).toString('hex');process.env.NODE_ENV='production';const app=require('../src/index');
test('production gate protects study data and uses a secure cookie',async()=>{
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(url+'/api/health')).status,200);
  assert.equal((await fetch(url+'/api/memory')).status,401);
  assert.equal((await fetch(url+'/api/health',{headers:{Origin:'https://untrusted.invalid'}})).status,403);
  const bad=await fetch(url+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:'incorrect'})});assert.equal(bad.status,401);
  const good=await fetch(url+'/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:process.env.APP_PASSWORD})});assert.equal(good.status,200);
  const cookie=good.headers.get('set-cookie');assert.ok(cookie.includes('HttpOnly'));assert.ok(cookie.includes('Secure'));assert.ok(cookie.includes('SameSite=Strict'));assert.ok(!cookie.includes(process.env.APP_PASSWORD));
  const session=await fetch(url+'/api/session',{headers:{Cookie:cookie.split(';')[0]}});assert.equal((await session.json()).authenticated,true);
  const tampered=await fetch(url+'/api/session',{headers:{Cookie:cookie.split(';')[0]+'bad'}});assert.equal((await tampered.json()).authenticated,false);
  const config=await fetch(url+'/api/config');const text=await config.text();assert.ok(!text.includes(process.env.APP_PASSWORD));assert.ok(text.includes('meta-llama/llama-3.1-8b-instruct'));
  const index=await fetch(url+'/');assert.equal(index.status,200);assert.ok(index.headers.get('content-type').includes('text/html'));
  const csp=index.headers.get('content-security-policy');
  assert.ok(csp, 'CSP header must be present in production');
  assert.ok(csp.includes("default-src 'self'"), "default-src must remain 'self'");
  assert.ok(csp.includes("media-src 'self' blob:"), "media-src must explicitly allow 'self' and blob:");
  assert.ok(csp.includes("script-src 'self'"), "script-src must remain 'self'");
  assert.ok(!csp.includes("script-src 'self' 'unsafe-inline'"), "script-src must not be weakened");
  assert.ok(!csp.includes("script-src *"), "script-src must not contain *");
  assert.ok(!csp.includes("connect-src *"), "connect-src must not contain *");
  const secret=await fetch(url+'/.env');assert.equal(secret.status,404);
 }finally{await new Promise(r=>server.close(r));}
});
