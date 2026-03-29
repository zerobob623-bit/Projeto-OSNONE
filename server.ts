import express from "express";
import { createServer as createViteServer } from "vite";
import fs from 'fs/promises';
import path from "path";
import dotenv from "dotenv";
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

import axios from "axios";
import { convert } from "html-to-text";
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

// --- WhatsApp & Alexa Imports ---
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import AlexaRemote from 'alexa-remote2';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// --- WhatsApp State ---
let sock: any = null;
let qrCode: string | null = null;
let whatsappStatus: 'disconnected' | 'connecting' | 'connected' | 'qr' = 'disconnected';

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  const { version, isLatest } = await fetchLatestBaileysVersion();
  
  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    browser: Browsers.macOS('Desktop'),
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      qrCode = qr;
      whatsappStatus = 'qr';
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      whatsappStatus = 'disconnected';
      qrCode = null;
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      whatsappStatus = 'connected';
      qrCode = null;
      console.log('✅ WhatsApp conectado');
    }
  });
}

// Initialize WhatsApp on start
connectToWhatsApp().catch(err => console.error('Erro ao iniciar WhatsApp:', err));

// --- Alexa State ---
let alexa: any = null;
let alexaStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';

function initAlexa(email: string, pass: string) {
  alexaStatus = 'connecting';
  alexa = new AlexaRemote();
  
  alexa.init({
    cookie: '', // Let it handle login
    email,
    password: pass,
    proxyOnly: true,
    proxyOwnIp: 'localhost',
    proxyPort: 3001,
    useHerokuProxy: false,
    amazonPage: 'amazon.com',
    alexaServiceHost: 'alexa.amazon.com',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    acceptLanguage: 'en-US',
    onRefresh: () => console.log('Alexa cookie refreshed'),
  }, (err: any) => {
    if (err) {
      console.error('Erro ao iniciar Alexa:', err);
      alexaStatus = 'error';
      return;
    }
    alexaStatus = 'connected';
    console.log('✅ Alexa conectada');
  });
}

// API routes go here
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// --- WhatsApp Endpoints ---
app.get("/api/whatsapp/status", (req, res) => {
  res.json({ status: whatsappStatus });
});

app.get("/api/whatsapp/qr", async (req, res) => {
  if (qrCode) {
    const dataUrl = await QRCode.toDataURL(qrCode);
    res.json({ qr: dataUrl });
  } else {
    res.status(404).json({ error: "QR Code not available" });
  }
});

app.post("/api/whatsapp/send", async (req, res) => {
  const { to, text, image, audio } = req.body;
  if (!sock || whatsappStatus !== 'connected') {
    return res.status(400).json({ error: "WhatsApp not connected" });
  }

  try {
    const jid = to.includes('@s.whatsapp.net') ? to : `${to}@s.whatsapp.net`;
    
    if (image) {
      const buffer = Buffer.from(image.split(',')[1], 'base64');
      await sock.sendMessage(jid, { image: buffer, caption: text });
    } else if (audio) {
      const buffer = Buffer.from(audio.split(',')[1], 'base64');
      await sock.sendMessage(jid, { audio: buffer, mimetype: 'audio/mp4', ptt: true });
    } else {
      await sock.sendMessage(jid, { text });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- Alexa Endpoints ---
app.get("/api/alexa/status", (req, res) => {
  res.json({ status: alexaStatus });
});

app.post("/api/alexa/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  initAlexa(email, password);
  res.json({ success: true });
});

app.post("/api/alexa/command", (req, res) => {
  const { command, deviceId, type } = req.body;
  if (!alexa || alexaStatus !== 'connected') {
    return res.status(400).json({ error: "Alexa not connected" });
  }

  // type can be 'speak', 'routine', 'device'
  if (type === 'speak') {
    alexa.executeSequenceCommand(deviceId, 'speak', command, (err: any) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  } else if (type === 'routine') {
    alexa.executeSequenceCommand(deviceId, 'automation', command, (err: any) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  } else {
    res.status(400).json({ error: "Invalid command type" });
  }
});

app.get("/api/alexa/devices", (req, res) => {
  if (!alexa || alexaStatus !== 'connected') {
    return res.status(400).json({ error: "Alexa not connected" });
  }
  alexa.getDevices((err: any, devices: any) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ devices });
  });
});

// --- File System Endpoints for Self-Evolution ---
const PROJECT_ROOT = process.cwd();

const resolveSafePath = (reqPath: string) => {
  const safePath = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, '');
  return path.join(PROJECT_ROOT, safePath);
};

app.post("/api/fs/read", async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: "filePath is required" });
    const fullPath = resolveSafePath(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/fs/write", async (req, res) => {
  try {
    const { filePath, content } = req.body;
    if (!filePath || content === undefined) return res.status(400).json({ error: "filePath and content are required" });
    const fullPath = resolveSafePath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/fs/list", async (req, res) => {
  try {
    const { dirPath } = req.body;
    const targetPath = dirPath ? resolveSafePath(dirPath) : PROJECT_ROOT;
    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const files = entries.map(e => ({
      name: e.name,
      isDirectory: e.isDirectory()
    }));
    res.json({ files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/fs/exec", async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: "command is required" });
    const { stdout, stderr } = await execPromise(command, { cwd: PROJECT_ROOT });
    res.json({ stdout, stderr });
  } catch (error: any) {
    res.status(500).json({ error: error.message, stdout: error.stdout, stderr: error.stderr });
  }
});
// ------------------------------------------------

app.post("/api/email/search", async (req, res) => {
  const { imapConfig, query } = req.body;
  if (!imapConfig || !imapConfig.host || !imapConfig.user || !imapConfig.pass) {
    return res.status(400).json({ error: "IMAP configuration is required" });
  }

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port || 993,
    secure: imapConfig.secure !== false,
    auth: {
      user: imapConfig.user,
      pass: imapConfig.pass
    },
    logger: false
  });

  try {
    await client.connect();
    let lock = await client.getMailboxLock('INBOX');
    try {
      // If query is provided, search for it, otherwise get the latest 5 emails
      let searchCriteria: any = query ? { or: [{ subject: query }, { body: query }] } : { all: true };
      
      // Get UIDs matching the search
      let uids = await client.search(searchCriteria);
      
      const results = [];
      if (Array.isArray(uids) && uids.length > 0) {
        // Take the last 5 UIDs (most recent)
        if (uids.length > 5) {
          uids = uids.slice(-5);
        }

        // Fetch the messages
        for await (let message of client.fetch(uids, { source: true, envelope: true })) {
          if (message.source) {
            const parsed = await simpleParser(message.source);
            results.push({
              id: message.uid.toString(),
              subject: parsed.subject,
              from: parsed.from?.text,
              date: parsed.date?.toISOString(),
              snippet: parsed.text ? parsed.text.substring(0, 200) : ''
            });
          }
        }
      }
      
      res.json({ results: results.reverse() }); // Return newest first
    } finally {
      lock.release();
    }
  } catch (error: any) {
    console.error("Error searching IMAP email:", error.message);
    res.status(500).json({ error: "Failed to search email" });
  } finally {
    client.logout().catch(() => {});
  }
});

app.post("/api/read-url", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 10000
    });

    const text = convert(response.data, {
      wordwrap: 130,
      selectors: [
        { selector: 'a', options: { ignoreHref: true } },
        { selector: 'img', format: 'skip' },
        { selector: 'nav', format: 'skip' },
        { selector: 'footer', format: 'skip' },
        { selector: 'script', format: 'skip' },
        { selector: 'style', format: 'skip' }
      ]
    });

    res.json({ text: text.substring(0, 15000) }); // Limit to 15k chars
  } catch (error: any) {
    console.error("Error reading URL:", error.message);
    res.status(500).json({ error: "Failed to read URL content" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { messages, systemInstruction, groqApiKey, openaiApiKey, textModelProvider } = req.body;
  
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Messages array is required" });
  }

  let apiKey = groqApiKey || process.env.GROQ_API_KEY;
  let apiUrl = "https://api.groq.com/openai/v1/chat/completions";
  let model = "llama-3.3-70b-versatile";

  if (textModelProvider === 'openai' && openaiApiKey) {
    apiKey = openaiApiKey;
    apiUrl = "https://api.openai.com/v1/chat/completions";
    model = "gpt-4o";
  } else if (textModelProvider === 'groq' && groqApiKey) {
    apiKey = groqApiKey;
    apiUrl = "https://api.groq.com/openai/v1/chat/completions";
    model = "llama-3.3-70b-versatile";
  } else if (openaiApiKey) {
    // Fallback if provider is not set but key is present
    apiKey = openaiApiKey;
    apiUrl = "https://api.openai.com/v1/chat/completions";
    model = "gpt-4o";
  }

  if (!apiKey) {
    return res.status(500).json({ error: "API Key not configured" });
  }

  try {
    const formattedMessages = [
      { role: "system", content: systemInstruction || "You are a helpful assistant." },
      ...messages.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content
      }))
    ];

    const response = await axios.post(
      apiUrl,
      {
        model: model,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 1024,
      },
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json({ 
      text: response.data.choices[0].message.content,
      usage: response.data.usage
    });
  } catch (error: any) {
    console.error("Error calling Chat API:", error.response?.data || error.message);
    res.status(500).json({ error: `Failed to generate response from ${openaiApiKey ? 'OpenAI' : 'Groq'}` });
  }
});

// Vite Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
