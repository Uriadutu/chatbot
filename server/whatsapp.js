const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const db = require('./db');

// State tracking
let client = null;
let connectionStatus = 'DISCONNECTED'; // DISCONNECTED, CONNECTING, QR_RECEIVED, CONNECTED, FAILED
let qrCodeBase64 = null;
let botInfo = null;
let sseClients = [];

// Helper function to check for Google Chrome installation paths on Windows
function getSystemChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const defaultPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.USERPROFILE || '', 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe')
  ];
  for (const p of defaultPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
}

// Broadcast updates to all SSE clients (Dashboard UI)
function broadcastState() {
  const payload = {
    status: connectionStatus,
    qrCode: qrCodeBase64,
    botInfo: botInfo,
    timestamp: new Date().toISOString()
  };
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach(res => {
    try {
      res.write(message);
    } catch (e) {
      console.error('Error writing to client:', e);
    }
  });
}

// Phone number formatting utility (Indonesian format handler)
function formatPhone(phone) {
  // Remove non-numeric characters
  let clean = phone.replace(/\D/g, '');
  
  // If starts with 0 (e.g. 08123456789), replace with 62
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  }
  // If starts with 8, prepend 62
  else if (clean.startsWith('8')) {
    clean = '62' + clean;
  }
  
  // Append WhatsApp suffix if not already present
  if (!clean.endsWith('@c.us')) {
    clean = clean + '@c.us';
  }
  
  return clean;
}

// Initialize WhatsApp Client
function initWhatsapp() {
  if (client) {
    return;
  }

  connectionStatus = 'CONNECTING';
  qrCodeBase64 = null;
  botInfo = null;
  broadcastState();

  db.addLog('system', 'Memulai inisialisasi WhatsApp Client...', 'info');

  const puppeteerOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  };

  // Check if system Chrome is available to use as fallback
  const chromePath = getSystemChromePath();
  if (chromePath) {
    console.log('Using system Chrome path:', chromePath);
    puppeteerOptions.executablePath = chromePath;
    db.addLog('system', `Menggunakan browser Google Chrome sistem: ${chromePath}`, 'info');
  } else {
    console.log('No system Chrome found, utilizing default puppeteer bundle.');
  }

  // Create Client Instance
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: path.join(__dirname, 'data', 'auth_sessions')
    }),
    puppeteer: puppeteerOptions,
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wwebjs/web-files/main/html/2.2412.54.html'
    }
  });

  // Event: QR Received
  client.on('qr', async (qr) => {
    connectionStatus = 'QR_RECEIVED';
    try {
      // Generate QR base64
      qrCodeBase64 = await qrcode.toDataURL(qr);
      broadcastState();
      console.log('QR Code generated and status set to QR_RECEIVED.');
    } catch (err) {
      console.error('Failed to generate QR Code image:', err);
    }
  });

  // Event: Authenticated
  client.on('authenticated', () => {
    console.log('WhatsApp Bot authenticated successfully.');
    db.addLog('system', 'Autentikasi WhatsApp berhasil.', 'success');
  });

  // Event: Auth Failure
  client.on('auth_failure', (msg) => {
    connectionStatus = 'FAILED';
    qrCodeBase64 = null;
    broadcastState();
    db.addLog('system', `Autentikasi gagal: ${msg}`, 'error');
    console.error('Authentication failure:', msg);
  });

  // Event: Ready
  client.on('ready', () => {
    connectionStatus = 'CONNECTED';
    qrCodeBase64 = null;
    
    botInfo = {
      phone: client.info.wid.user,
      name: client.info.pushname || 'Bot Bengkel'
    };

    broadcastState();
    db.addLog('system', `Bot WhatsApp siap dan aktif sebagai ${botInfo.name} (${botInfo.phone})`, 'success');
    console.log('WhatsApp Client is Ready!');
  });

  // Event: Disconnected
  client.on('disconnected', (reason) => {
    connectionStatus = 'DISCONNECTED';
    qrCodeBase64 = null;
    botInfo = null;
    client = null;
    broadcastState();
    db.addLog('system', `WhatsApp terputus: ${reason}. Silakan hubungkan ulang.`, 'warning');
    console.log('WhatsApp Client disconnected:', reason);
  });

  // Event: Message Received
  client.on('message', async (message) => {
    // Avoid reading group messages, status messages, or messages from the bot itself
    if (message.from.endsWith('@g.us') || message.isStatus || message.fromMe) {
      return;
    }

    const settings = db.getSettings();
    if (!settings.botActive) {
      return;
    }

    const incomingText = (message.body || '').trim().toLowerCase();
    if (!incomingText) return;

    console.log(`Received message from ${message.from}: ${message.body}`);

    // Check FAQ Matching
    const faqs = db.getFAQs();
    let matchedFaq = null;

    for (const faq of faqs) {
      if (faq.matchType === 'exact') {
        if (incomingText === faq.keyword.toLowerCase()) {
          matchedFaq = faq;
          break;
        }
      } else { // contains
        if (incomingText.includes(faq.keyword.toLowerCase())) {
          matchedFaq = faq;
          break;
        }
      }
    }

    if (matchedFaq) {
      try {
        await client.sendMessage(message.from, matchedFaq.reply);
        await db.addLog(
          'bot_reply',
          `Auto-reply ke ${message.from.split('@')[0]} untuk keyword "${matchedFaq.keyword}"`,
          'success'
        );
        console.log(`Auto-replied to ${message.from} with keyword "${matchedFaq.keyword}"`);
      } catch (err) {
        await db.addLog(
          'error',
          `Gagal mengirim auto-reply ke ${message.from.split('@')[0]}: ${err.message}`,
          'error'
        );
        console.error('Failed to send auto-reply message:', err);
      }
    }
  });

  // Start initialization
  client.initialize().catch(async (err) => {
    connectionStatus = 'FAILED';
    qrCodeBase64 = null;
    client = null;
    broadcastState();
    db.addLog('error', `Gagal inisialisasi klien: ${err.message}`, 'error');
    console.error('Client initialization crashed:', err);

    // Self-healing session cleanup
    try {
      const authPath = path.join(__dirname, 'data', 'auth_sessions');
      if (fs.existsSync(authPath)) {
        await fs.rm(authPath, { recursive: true, force: true });
        db.addLog('system', 'Pembersihan otomatis: Sesi yang rusak telah dihapus. Silakan coba hubungkan kembali.', 'warning');
        console.log('Cleaned up corrupted auth session folder due to init failure.');
      }
    } catch (cleanErr) {
      console.error('Failed to clear corrupted session folder:', cleanErr);
    }
  });
}

// Disconnect and Destroy Client
async function disconnectWhatsapp() {
  if (!client) return;
  db.addLog('system', 'Memutuskan koneksi WhatsApp...', 'info');
  try {
    await client.logout();
  } catch (err) {
    console.log('Error logging out client, proceeding to destroy:', err.message);
  }
  try {
    await client.destroy();
  } catch (err) {
    console.log('Error destroying client:', err.message);
  }
  client = null;
  connectionStatus = 'DISCONNECTED';
  qrCodeBase64 = null;
  botInfo = null;
  broadcastState();
  db.addLog('system', 'Koneksi WhatsApp diputus.', 'info');
}

// Send Message API
async function sendWhatsAppMessage(phone, text) {
  if (connectionStatus !== 'CONNECTED' || !client) {
    throw new Error('WhatsApp Bot tidak terhubung. Silakan hubungkan bot terlebih dahulu.');
  }

  const formattedNum = formatPhone(phone);
  
  // Verify if number is registered on WhatsApp
  // client.isRegisteredUser is a built-in method in whatsapp-web.js
  const isRegistered = await client.isRegisteredUser(formattedNum);
  if (!isRegistered) {
    throw new Error(`Nomor ${phone} tidak terdaftar di WhatsApp.`);
  }

  const msg = await client.sendMessage(formattedNum, text);
  return msg;
}

// Register SSE client
function registerSseClient(res) {
  sseClients.push(res);
  
  // Send current state immediately on connect
  const payload = {
    status: connectionStatus,
    qrCode: qrCodeBase64,
    botInfo: botInfo,
    timestamp: new Date().toISOString()
  };
  res.write(`data: ${JSON.stringify(payload)}\n\n`);

  // Connection closed by client
  res.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
}

module.exports = {
  initWhatsapp,
  disconnectWhatsapp,
  sendWhatsAppMessage,
  registerSseClient,
  getConnectionStatus: () => connectionStatus,
  getBotInfo: () => botInfo,
  getQrCode: () => qrCodeBase64
};
