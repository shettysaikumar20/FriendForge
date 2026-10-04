const crypto = require('node:crypto');
const COOKIE = 'friendforge_session';
const AGE = 8 * 60 * 60 * 1000;
const digest = value => crypto.createHash('sha256').update(value).digest();
function equal(a,b) { return typeof a === 'string' && typeof b === 'string' && crypto.timingSafeEqual(digest(a),digest(b)); }
function signature(value) { return crypto.createHmac('sha256',process.env.APP_PASSWORD).update(value).digest('hex'); }
function authenticated(req) {
  if (!process.env.APP_PASSWORD) return process.env.NODE_ENV !== 'production';
  const token = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if (!token) return false;
  const [expires, sig] = token.split('.');
  return /^\d+$/.test(expires) && Number(expires)>Date.now() && Number(expires)<=Date.now()+AGE && equal(sig,signature(expires));
}
function cookie(res, value, maxAge) {
  res.cookie(COOKIE,value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',maxAge,path:'/'});
}
function installAccess(app) {
  const attempts = new Map();
  app.get('/api/session',(req,res)=>res.json({success:true,authenticated:authenticated(req),passwordRequired:Boolean(process.env.APP_PASSWORD)}));
  app.post('/api/session',(req,res)=>{
    const now=Date.now(), key=req.ip;
    for(const [ip,v] of attempts)if(v.until<now)attempts.delete(ip);
    const attempt=attempts.get(key)||{count:0,until:now+15*60*1000};
    if(attempt.count>=10)return res.status(429).json({message:'Too many password attempts. Please wait 15 minutes.'});
    if(!process.env.APP_PASSWORD || !equal(req.body?.password,process.env.APP_PASSWORD)){
      attempt.count++;attempts.set(key,attempt);return res.status(401).json({message:'That study password is not correct.'});
    }
    attempts.delete(key);const expires=String(now+AGE);cookie(res,expires+'.'+signature(expires),AGE);res.json({success:true});
  });
  app.delete('/api/session',(req,res)=>{cookie(res,'',0);res.json({success:true});});
  app.use('/api',(req,res,next)=>{
    if(['/health','/config','/local-ai/status'].includes(req.path))return next();
    if(!authenticated(req))return res.status(401).json({message:'Please sign in with the shared study password.'});
    res.setHeader('Cache-Control','no-store');next();
  });
}
module.exports={installAccess,authenticated};
