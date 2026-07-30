const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const next = require('next');
const db = require('./db');
const whatsapp = require('./whatsapp');
const scheduler = require('./scheduler');

// Global error handlers to prevent Puppeteer navigation errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('Caught uncaughtException:', err);
  try {
    db.addLog('error', `Uncaught Exception: ${err.message}`, 'error');
  } catch (e) {
    console.error('Failed to log uncaughtException to DB:', e);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  try {
    db.addLog('error', `Unhandled Rejection: ${reason ? reason.message || reason : 'Unknown'}`, 'error');
  } catch (e) {
    console.error('Failed to log unhandledRejection to DB:', e);
  }
});

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;
const dev = process.env.NODE_ENV !== 'production';

// Initialize Next.js app instance
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

async function initializeApp() {
  console.log('Initializing database file...');
  await db.init();
  db.addLog('system', 'Database berhasil diinisialisasi.', 'info');
  
  // Start background cron scheduler
  scheduler.startScheduler();
  
  // Initialize WhatsApp Bot
  setTimeout(() => {
    whatsapp.initWhatsapp();
  }, 2000);
}

// Boot Express + Next.js integration
nextApp.prepare().then(() => {
  const app = express();
  
  // Enable CORS & JSON parsing
  app.use(cors());
  app.use(express.json());

  // ----------------------------------------------------
  // API Routes (Express)
  // ----------------------------------------------------
  
  // SSE Real-Time Status Endpoint
  app.get('/api/status-sse', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    whatsapp.registerSseClient(res);
  });

  // WhatsApp bot action triggers
  app.post('/api/whatsapp/connect', (req, res) => {
    try {
      whatsapp.initWhatsapp();
      res.json({ success: true, message: 'Menghubungkan bot...' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
      await whatsapp.disconnectWhatsapp();
      res.json({ success: true, message: 'Bot berhasil diputus.' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/whatsapp/status', (req, res) => {
    res.json({
      status: whatsapp.getConnectionStatus(),
      botInfo: whatsapp.getBotInfo(),
      qrCode: whatsapp.getQrCode()
    });
  });

  // Chatbot Training (FAQ) API
  app.get('/api/faqs', (req, res) => {
    res.json(db.getFAQs());
  });

  app.post('/api/faqs', async (req, res) => {
    try {
      const { keyword, reply, matchType } = req.body;
      if (!keyword || !reply) {
        return res.status(400).json({ error: 'Keyword dan jawaban harus diisi.' });
      }
      const newFaq = await db.addFAQ({ keyword, reply, matchType });
      res.json(newFaq);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/faqs/:id', async (req, res) => {
    try {
      const updated = await db.updateFAQ(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Data tidak ditemukan.' });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/faqs/:id', async (req, res) => {
    try {
      await db.deleteFAQ(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settings API
  app.get('/api/settings', (req, res) => {
    res.json(db.getSettings());
  });

  app.post('/api/settings', async (req, res) => {
    try {
      const { botActive, defaultTemplate } = req.body;
      const newSettings = {};
      if (botActive !== undefined) newSettings.botActive = botActive;
      if (defaultTemplate !== undefined) newSettings.defaultTemplate = defaultTemplate;
      
      const updated = await db.updateSettings(newSettings);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Service Reminders API
  app.get('/api/reminders', (req, res) => {
    res.json(db.getReminders());
  });

  app.post('/api/reminders', async (req, res) => {
    try {
      const { customerName, customerPhone, serviceType, serviceDate, intervalMonths, nextReminderDate, messageTemplate } = req.body;
      if (!customerName || !customerPhone || !serviceType || !serviceDate || !nextReminderDate) {
        return res.status(400).json({ error: 'Semua kolom wajib diisi.' });
      }
      const newReminder = await db.addReminder({
        customerName,
        customerPhone,
        serviceType,
        serviceDate,
        intervalMonths,
        nextReminderDate,
        messageTemplate
      });
      res.json(newReminder);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/reminders/:id', async (req, res) => {
    try {
      const updated = await db.updateReminder(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: 'Pengingat tidak ditemukan.' });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/reminders/:id', async (req, res) => {
    try {
      await db.deleteReminder(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Trigger reminders manually
  app.post('/api/reminders/trigger', async (req, res) => {
    try {
      const result = await scheduler.runReminderCheck();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Send single reminder manual check
  app.post('/api/reminders/:id/send', async (req, res) => {
    try {
      const reminders = db.getReminders();
      const reminder = reminders.find(r => r.id === req.params.id);
      if (!reminder) {
        return res.status(404).json({ error: 'Pengingat tidak ditemukan.' });
      }

      const connectionStatus = whatsapp.getConnectionStatus();
      if (connectionStatus !== 'CONNECTED') {
        return res.status(400).json({ error: 'WhatsApp tidak terhubung. Hubungkan bot terlebih dahulu.' });
      }

      const settings = db.getSettings();
      const template = reminder.messageTemplate || settings.defaultTemplate;
      
      let formattedMsg = template
        .replace(/\[Nama\]/g, reminder.customerName)
        .replace(/\[Servis\]/g, reminder.serviceType)
        .replace(/\[TanggalTerakhir\]/g, scheduler.formatDateIndonesian(reminder.serviceDate))
        .replace(/\[TanggalBerikutnya\]/g, scheduler.formatDateIndonesian(reminder.nextReminderDate));

      await whatsapp.sendWhatsAppMessage(reminder.customerPhone, formattedMsg);

      await db.updateReminder(reminder.id, { status: 'sent' });
      
      await db.addLog(
        'reminder_sent',
        `[Manual Send] Pengingat [${reminder.serviceType}] terkirim ke ${reminder.customerName} (${reminder.customerPhone})`,
        'success'
      );

      res.json({ success: true, message: 'Pesan berhasil terkirim.' });
    } catch (err) {
      await db.updateReminder(req.params.id, { status: 'failed' });
      await db.addLog(
        'error',
        `[Manual Send] Gagal mengirim ke penerima: ${err.message}`,
        'error'
      );
      res.status(500).json({ error: err.message });
    }
  });

  // History logs
  app.get('/api/logs', (req, res) => {
    res.json(db.getLogs());
  });

  app.delete('/api/logs', async (req, res) => {
    try {
      await db.clearLogs();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ----------------------------------------------------
  // Catch-all: Hand over standard routes to Next.js Page Renderer
  // ----------------------------------------------------
  app.all('*', (req, res) => {
    return handle(req, res);
  });

  // Start Server
  app.listen(PORT, async () => {
    console.log(`> Server is running on http://localhost:${PORT}`);
    try {
      await initializeApp();
    } catch (err) {
      console.error('Failed to initialize server background hooks:', err);
    }
  });
}).catch(err => {
  console.error('Failed to bootstrap Next.js Custom Server:', err);
  process.exit(1);
});
