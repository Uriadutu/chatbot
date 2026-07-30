const db = require('./db');
const whatsapp = require('./whatsapp');

// Runs service reminders check
async function runReminderCheck() {
  const connectionStatus = whatsapp.getConnectionStatus();
  if (connectionStatus !== 'CONNECTED') {
    console.log('Reminder check skipped: WhatsApp is not connected.');
    return { success: false, reason: 'WhatsApp tidak terhubung. Pengingat tidak dapat dikirim.' };
  }

  // Get local date in YYYY-MM-DD format using Sweden locale (sv-SE)
  const todayStr = new Date().toLocaleDateString('sv-SE');
  console.log(`Running reminder scheduler check for date: ${todayStr}`);

  const reminders = db.getReminders();
  // Filter pending reminders due today or in the past
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
      // Determine message template (use custom template if set, otherwise fallback to default)
      const settings = db.getSettings();
      const template = reminder.messageTemplate || settings.defaultTemplate;

      // Replace placeholders
      let formattedMsg = template
        .replace(/\[Nama\]/g, reminder.customerName)
        .replace(/\[Servis\]/g, reminder.serviceType)
        .replace(/\[TanggalTerakhir\]/g, formatDateIndonesian(reminder.serviceDate))
        .replace(/\[TanggalBerikutnya\]/g, formatDateIndonesian(reminder.nextReminderDate));

      // Send via WhatsApp
      await whatsapp.sendWhatsAppMessage(reminder.customerPhone, formattedMsg);

      // Update reminder state
      await db.updateReminder(reminder.id, { status: 'sent' });
      
      // Save log
      await db.addLog(
        'reminder_sent',
        `Pengingat [${reminder.serviceType}] berhasil dikirim ke ${reminder.customerName} (${reminder.customerPhone})`,
        'success'
      );
      
      sentCount++;
    } catch (err) {
      console.error(`Failed to send reminder for ID ${reminder.id}:`, err.message);
      
      // Update reminder state to failed so admin can review and retry
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

// Utility to format Date from YYYY-MM-DD to Indonesian human-readable date
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

// Start scheduler background loop (runs check every 1 hour)
let schedulerInterval = null;

function startScheduler() {
  if (schedulerInterval) return;

  // Run immediate check on server startup after a small delay (allowing WhatsApp client to initialize)
  setTimeout(() => {
    runReminderCheck().catch(err => console.error('Error running initial scheduler check:', err));
  }, 15000);

  // Run check every 1 hour (3600000 ms)
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
