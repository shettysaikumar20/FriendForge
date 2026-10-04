const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

dotenv.config({path:path.join(__dirname,'../.env')});

const { sendChatMessage, uploadStudyDocument, getStudyMemory, clearStudyMemory, getStudyDocumentStatus, DEFAULT_MODEL, DEFAULT_PROVIDER } = require('./services/backboardService');
const ollamaService = require('./services/ollamaService');
const elevenLabsService = require('./services/elevenLabsService');

const modes = require('./services/studyModes');
const app = express();
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// Ensure temporary upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage & file validation (10MB limit, PDF/TXT allowed)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, 'note-' + uniqueSuffix + safeExt);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.pdf', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype;

  if (allowedExts.includes(ext) && (mime === 'application/pdf' || mime === 'text/plain' || mime === 'application/octet-stream')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and TXT study notes are supported.'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: fileFilter
});

// Exact origins only. Same-origin production requests work without a hardcoded URL.
const allowedOrigins = (process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173')).split(',').filter(Boolean);
app.use(cors({origin(origin,callback){
  callback(null,!origin || allowedOrigins.includes(origin));
}, credentials:true, methods:['GET','POST','DELETE'], allowedHeaders:['Content-Type']}));
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('X-Frame-Options','DENY');
  if(process.env.NODE_ENV==='production') res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  const origin=req.get('origin');
  const sameOrigin=req.protocol+'://'+req.get('host');
  if(origin && origin!==sameOrigin && !allowedOrigins.includes(origin))return res.status(403).json({message:'This website is not allowed to access FriendForge.'});
  next();
});
// Middleware
app.use(express.json({limit:'32kb'}));
app.use('/api', (req,res,next) => {
  const body=req.body || {};
  if (body.url !== undefined || body.ollamaUrl !== undefined || body.model !== undefined) return res.status(400).json({message:'Client-specified models or Ollama URLs are not allowed.'});
  if ((body.message !== undefined && (typeof body.message !== 'string' || body.message.length > 6000)) || (body.threadId != null && (typeof body.threadId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.threadId))) || (body.hasDocuments !== undefined && typeof body.hasDocuments !== 'boolean')) return res.status(400).json({message:'Please use a message under 6000 characters and a valid study session.'});
  next();
});


require('./access').installAccess(app);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'FriendForge API'
  });
});

app.get('/api/config',(req,res)=>res.json({model:{name:DEFAULT_MODEL,provider:DEFAULT_PROVIDER,openWeight:true}}));
let windowStart=Date.now(), requestCount=0, activeRequests=0;
app.use(['/api/chat','/api/quiz','/api/revise','/api/documents/upload','/api/local-chat','/api/text-to-speech'],(req,res,next)=>{
  if(req.method!=='POST')return next();
  if(Date.now()-windowStart>60000){windowStart=Date.now();requestCount=0;}
  if(requestCount>=20 || activeRequests>=2)return res.status(429).json({message:'Please let the current study request finish, or try again in a minute.'});
  requestCount++;activeRequests++;let finished=false;
  const release=()=>{if(!finished){activeRequests--;finished=true;}};
  res.once('finish',release);res.once('close',release);next();
});

// Document Upload Endpoint (RAG Note Processing)
app.post('/api/documents/upload', (req, res, next) => {
  upload.single('document')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'File size exceeds 10 MB maximum upload limit.'
          });
        }
        return res.status(400).json({ error: 'Upload Error', message: 'Please upload one PDF or TXT file, up to 10 MB.' });
      }
      return res.status(400).json({ error: 'Validation Error', message: 'Upload failed. Choose a PDF or TXT file, up to 10 MB.' });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'No study note file uploaded. Please select a PDF or TXT document.'
      });
    }

    const tempFilePath = req.file.path;

    try {
      const threadId = req.body.threadId || null;
      if (threadId && !/^[a-f0-9-]{36}$/i.test(threadId)) return res.status(400).json({message:'Invalid study session.'});
      const bytes = fs.readFileSync(tempFilePath);
      if (req.file.size === 0 || (path.extname(req.file.originalname).toLowerCase() === '.pdf' ? bytes.subarray(0,5).toString() !== '%PDF-' : bytes.includes(0))) return res.status(400).json({message:'This file is empty or is not a readable PDF/TXT document.'});
      const result = await uploadStudyDocument({
        filePath: tempFilePath,
        originalName: req.file.originalname,
        threadId: threadId
      });

      return res.status(200).json({
        success: true,
        threadId: result.threadId,
        document: {
          id: result.documentId,
          name: result.name,
          status: result.status
        }
      });
    } catch (error) {
      next(error);
    } finally {
      // Guaranteed cleanup of temporary server file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (cleanupErr) {
          console.warn('[Cleanup Warning] Could not remove temp file:', cleanupErr.message);
        }
      }
    }
  });
});

app.get('/api/documents/:id/status', async (req,res,next) => {
  try { res.json({success:true, document:await getStudyDocumentStatus(req.params.id)}); } catch(error) { next(error); }
});
// Chat Endpoint
app.post('/api/chat', async (req, res, next) => {
  try {
    const { message, threadId, hasDocuments, mode = 'chat' } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message property is required and must be a non-empty string.'
      });
    }

    if (!['chat','explain'].includes(mode)) return res.status(400).json({message:'Choose a supported chat mode.'});
    const result = await sendChatMessage({ message, threadId, hasDocuments, mode });
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// Local AI Status Endpoint
app.get('/api/local-ai/status', async (req, res, next) => {
  try {
    const status = await ollamaService.getLocalStatus();
    return res.status(200).json(status);
  } catch (error) {
    return res.status(200).json({
      available: false,
      provider: 'ollama',
      model: ollamaService.getOllamaModel(),
      local: true
    });
  }
});

// Local Chat Endpoint
app.post('/api/local-chat', async (req, res, next) => {
  try {
    const { message, messages } = req.body || {};

    let chatMessages = [];
    if (Array.isArray(messages)) {
      if (messages.length === 0 || messages.length > 15) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Messages list must contain between 1 and 15 entries.'
        });
      }

      let totalChars = 0;
      for (const m of messages) {
        if (!m || typeof m !== 'object' || typeof m.content !== 'string' || !m.content.trim()) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Each message must have non-empty text content.'
          });
        }
        if (!['user', 'assistant', 'system'].includes(m.role)) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Message role must be user, assistant, or system.'
          });
        }
        if (m.content.length > 6000) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'Individual message length cannot exceed 6000 characters.'
          });
        }
        totalChars += m.content.length;
        chatMessages.push({ role: m.role, content: m.content.trim() });
      }

      if (totalChars > 24000) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Total conversation payload exceeds length limit.'
        });
      }
    } else if (typeof message === 'string' && message.trim()) {
      chatMessages = [{ role: 'user', content: message.trim() }];
    } else {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Message property or non-empty messages array is required.'
      });
    }

    const result = await ollamaService.sendLocalChat(chatMessages);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'Local AI is unavailable. Make sure Ollama is running and gemma3:4b is installed.'
    });
  }
});

// Text-to-Speech Endpoint (ElevenLabs isolated voice synthesis)
app.post('/api/text-to-speech', async (req, res, next) => {
  try {
    const body = req.body || {};

    // Security check: Client cannot override API key, endpoint, model, or voice ID
    if (body.apiKey !== undefined || body.voiceId !== undefined || body.model !== undefined || body.url !== undefined || body.endpoint !== undefined || body.xiApiKey !== undefined) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Client-specified credentials or voice parameters are not allowed.'
      });
    }

    const { text } = body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Text property is required and must be a non-empty string.'
      });
    }

    if (text.length > 3000) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Text exceeds maximum length of 3000 characters.'
      });
    }

    if (!elevenLabsService.isConfigured()) {
      return res.status(503).json({
        error: 'Service Unavailable',
        message: 'Audio generation is temporarily unavailable.'
      });
    }

    const audio = await elevenLabsService.generateSpeech(text.trim());
    res.setHeader('Content-Type', audio.contentType || 'audio/mpeg');
    res.setHeader('Content-Length', audio.size);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audio.buffer);
  } catch (error) {
    const status = error.status || 503;
    return res.status(status).json({
      error: 'Service Unavailable',
      message: error.safeMessage || 'Audio generation is temporarily unavailable.'
    });
  }
});

app.post('/api/quiz', async (req,res,next) => {
  if (typeof req.body.message !== 'string' || !req.body.message.trim()) return res.status(400).json({message:'Enter a quiz topic.'});
  try { res.json(await modes.generate(req.body)); } catch(error) { next(error); }
});
app.post('/api/quiz/:id/answer', async (req,res,next) => {
  try { res.json(await modes.answer(req.params.id,req.body.index,req.body.option)); } catch(error) { next(error); }
});
app.post('/api/revise', async (req,res,next) => {
  try { res.json(await modes.revise(req.body)); } catch(error) { next(error); }
});
app.get('/api/memory', async (req, res, next) => {
  try { res.json({ success: true, memories: await getStudyMemory() }); } catch (error) { next(error); }
});
app.delete('/api/memory', async (req, res, next) => {
  if (req.body.confirm !== true) return res.status(400).json({ message: 'Please confirm clearing study memory.' });
  try { await clearStudyMemory(); res.json({ success: true }); } catch (error) { next(error); }
});
// Serve the existing Vite build in production (one origin, one Render service).
const frontendDist=path.join(__dirname,'../../frontend/dist');
app.use(express.static(frontendDist));
app.get('/',(req,res)=>{
  if(fs.existsSync(path.join(frontendDist,'index.html')))return res.sendFile(path.join(frontendDist,'index.html'));
  res.status(503).send('Build the frontend before starting the production app.');
});
// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'This FriendForge endpoint does not exist.'
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[ServerError] Request failed');
  res.status(err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : err.status || 502).json({
    error: 'Internal Server Error',
    message: (err.type === 'entity.parse.failed' ? 'Please send valid JSON.' : err.type === 'entity.too.large' ? 'This request is too large.' : err.safeMessage) || 'The study service could not complete this request. Please try again shortly.'
  });
});

if (require.main === module) {
  if (process.env.NODE_ENV === 'production' && (!process.env.BACKBOARD_API_KEY || !process.env.APP_PASSWORD || process.env.APP_PASSWORD.length < 16)) {
    console.error('Production requires BACKBOARD_API_KEY and an APP_PASSWORD of at least 16 characters.');
    process.exit(1);
  }
  app.listen(PORT,'0.0.0.0',()=>console.log('[FriendForge API] Listening on port '+PORT));
}
module.exports = app;
