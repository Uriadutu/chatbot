const db = require('./db');
const whatsapp = require('./whatsapp');

// Runs service reminders check
async function runReminderCheck() {
  const connectionStatus = whatsapp.getConnectionStatus();
  if (connectionStatus !== 'CONNECTED') {
    console.log('Reminder check skipped: WhatsApp is not connected.');
    return { success: false, reason: 'WhatsApp tidak terhubung. Pengingat tidak dapat dikirim.' };
  }

  const todayStr = new Date().toLocaleDateString('sv-SE');
  console.log(`Running reminder scheduler check for date: ${todayStr}`);

  const reminders = db.getReminders();
  const dueReminders = reminders.filter(r => r.status === 'pending' && r.nextReminderDate <= todayStr);

  if (dueReminders.length === 0) {
    console.log('No due reminders found today.');
    return { success: true, sentCount: 0 };
  }

  db.addLog('system', `Menemukan ${dueReminders.length} pengingat servis yang jatuh tempo. Memulai proses pengiriman...`, 'info');

  let sentCount = 0;
  let failedCount = 0;

  for (const reminder of dueReminders) {
    try {
      const settings = db.getSettings();
      const template = reminder.messageTemplate || settings.defaultTemplate;

      let formattedMsg = template
        .replace(/\[Nama\]/g, reminder.customerName)
        .replace(/\[Servis\]/g, reminder.serviceType)
        .replace(/\[TanggalTerakhir\]/g, formatDateIndonesian(reminder.serviceDate))
        .replace(/\[TanggalBerikutnya\]/g, formatDateIndonesian(reminder.nextReminderDate));

      await whatsapp.sendWhatsAppMessage(reminder.customerPhone, formattedMsg);

      await db.updateReminder(reminder.id, { status: 'sent' });
      
      await db.addLog(
        'reminder_sent',
        `Pengingat [${reminder.serviceType}] berhasil dikirim ke ${reminder.customerName} (${reminder.customerPhone})`,
        'success'
      );
      
      sentCount++;
    } catch (err) {
      console.error(`Failed to send reminder for ID ${reminder.id}:`, err.message);
      
      await db.updateReminder(reminder.id, { status: 'failed' });
      
      await db.addLog(
        'error',
        `Gagal mengirim pengingat ke ${reminder.customerName} (${reminder.customerPhone}): ${err.message}`,
        'error'
      );
      
      failedCount++;
    }
  }

  db.addLog(
    'system',
    `Pengiriman pengingat selesai. Berhasil: ${sentCount}, Gagal: ${failedCount}`,
    sentCount > 0 ? 'success' : 'warning'
  );

  return {
    success: true,
    sentCount,
    failedCount
  };
}

function formatDateIndonesian(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  
  const year = parts[0];
  const monthIdx = parseInt(parts[1]) - 1;
  const day = parseInt(parts[2]);
  
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  return `${day} ${months[monthIdx]} ${year}`;
}

let schedulerInterval = null;

function startScheduler() {
  if (schedulerInterval) return;

  setTimeout(() => {
    runReminderCheck().catch(err => console.error('Error running initial scheduler check:', err));
  }, 15000);

  schedulerInterval = setInterval(() => {
    runReminderCheck().catch(err => console.error('Error in background scheduler:', err));
  }, 60 * 60 * 1000);

  console.log('Background reminder scheduler successfully started (interval: 1 hour).');
}

module.exports = {
  runReminderCheck,
  startScheduler,
  formatDateIndonesian
};
