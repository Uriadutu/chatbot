const fs = require('fs').promises;
const path = require('path');

class JSONDb {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = {
      settings: {
        botActive: true,
        defaultTemplate: "Halo [Nama], kami dari Bengkel Motor ingin mengingatkan bahwa kendaraan Anda sudah waktunya untuk melakukan [Servis] kembali (terakhir tanggal [TanggalTerakhir]). Silakan kunjungi bengkel kami untuk menjaga performa kendaraan Anda. Terima kasih!"
      },
      faqs: [
        {
          id: "default-1",
          keyword: "lokasi",
          reply: "Bengkel kami berlokasi di Jl. Raya Otomotif No. 123. Silakan cari 'Bengkel Kita' di Google Maps untuk navigasi langsung!",
          matchType: "contains"
        },
        {
          id: "default-2",
          keyword: "jam buka",
          reply: "Kami buka setiap hari Senin - Sabtu mulai pukul 08:00 WIB hingga 17:00 WIB. Hari Minggu libur.",
          matchType: "contains"
        },
        {
          id: "default-3",
          keyword: "harga oli",
          reply: "Harga ganti oli berkisar antara Rp 45.000 s/d Rp 150.000 tergantung jenis motor dan merk oli yang dipilih. Gratis biaya jasa pasang!",
          matchType: "contains"
        }
      ],
      reminders: [],
      logs: []
    };
  }

  async init() {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const content = await fs.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(content);
      // Ensure all fields exist
      if (!this.data.settings) this.data.settings = {};
      if (!this.data.faqs) this.data.faqs = [];
      if (!this.data.reminders) this.data.reminders = [];
      if (!this.data.logs) this.data.logs = [];
    } catch (err) {
      // If file doesn't exist, write default data
      await this.save();
    }
  }

  async save() {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to write database file:', error);
    }
  }

  // FAQs / Chatbot Training
  getFAQs() {
    return this.data.faqs;
  }

  async addFAQ(faq) {
    const newFaq = {
      id: Date.now().toString(),
      keyword: faq.keyword.trim().toLowerCase(),
      reply: faq.reply.trim(),
      matchType: faq.matchType || 'contains'
    };
    this.data.faqs.push(newFaq);
    await this.save();
    return newFaq;
  }

  async updateFAQ(id, updatedFaq) {
    const idx = this.data.faqs.findIndex(f => f.id === id);
    if (idx !== -1) {
      this.data.faqs[idx] = {
        ...this.data.faqs[idx],
        keyword: updatedFaq.keyword ? updatedFaq.keyword.trim().toLowerCase() : this.data.faqs[idx].keyword,
        reply: updatedFaq.reply ? updatedFaq.reply.trim() : this.data.faqs[idx].reply,
        matchType: updatedFaq.matchType || this.data.faqs[idx].matchType
      };
      await this.save();
      return this.data.faqs[idx];
    }
    return null;
  }

  async deleteFAQ(id) {
    this.data.faqs = this.data.faqs.filter(f => f.id !== id);
    await this.save();
  }

  // Customer Reminders
  getReminders() {
    return this.data.reminders;
  }

  async addReminder(reminder) {
    const newReminder = {
      id: Date.now().toString(),
      customerName: reminder.customerName.trim(),
      customerPhone: reminder.customerPhone.trim(),
      serviceType: reminder.serviceType.trim(),
      serviceDate: reminder.serviceDate, // YYYY-MM-DD
      intervalMonths: parseInt(reminder.intervalMonths) || 2,
      nextReminderDate: reminder.nextReminderDate, // YYYY-MM-DD
      status: 'pending', // pending, sent, failed
      messageTemplate: reminder.messageTemplate || null,
      createdAt: new Date().toISOString()
    };
    this.data.reminders.push(newReminder);
    await this.save();
    return newReminder;
  }

  async updateReminder(id, updatedReminder) {
    const idx = this.data.reminders.findIndex(r => r.id === id);
    if (idx !== -1) {
      this.data.reminders[idx] = {
        ...this.data.reminders[idx],
        customerName: updatedReminder.customerName ? updatedReminder.customerName.trim() : this.data.reminders[idx].customerName,
        customerPhone: updatedReminder.customerPhone ? updatedReminder.customerPhone.trim() : this.data.reminders[idx].customerPhone,
        serviceType: updatedReminder.serviceType ? updatedReminder.serviceType.trim() : this.data.reminders[idx].serviceType,
        serviceDate: updatedReminder.serviceDate || this.data.reminders[idx].serviceDate,
        intervalMonths: updatedReminder.intervalMonths !== undefined ? parseInt(updatedReminder.intervalMonths) : this.data.reminders[idx].intervalMonths,
        nextReminderDate: updatedReminder.nextReminderDate || this.data.reminders[idx].nextReminderDate,
        status: updatedReminder.status || this.data.reminders[idx].status,
        messageTemplate: updatedReminder.messageTemplate !== undefined ? updatedReminder.messageTemplate : this.data.reminders[idx].messageTemplate
      };
      await this.save();
      return this.data.reminders[idx];
    }
    return null;
  }

  async deleteReminder(id) {
    this.data.reminders = this.data.reminders.filter(r => r.id !== id);
    await this.save();
  }

  // System Settings
  getSettings() {
    return this.data.settings;
  }

  async updateSettings(newSettings) {
    this.data.settings = {
      ...this.data.settings,
      ...newSettings
    };
    await this.save();
    return this.data.settings;
  }

  // Activity Logs
  getLogs() {
    return this.data.logs;
  }

  async addLog(type, message, status = 'info') {
    const log = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      type, // 'bot_reply', 'reminder_sent', 'system', 'error'
      message,
      status // 'success', 'warning', 'error', 'info'
    };
    this.data.logs.unshift(log);
    if (this.data.logs.length > 500) {
      this.data.logs = this.data.logs.slice(0, 500);
    }
    await this.save();
    return log;
  }

  async clearLogs() {
    this.data.logs = [];
    await this.save();
  }
}

// Instantiate and export database
const dbPath = path.join(__dirname, 'data', 'db.json');
const db = new JSONDb(dbPath);

module.exports = db;
