"use client";

import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  Brain, 
  Bell, 
  History, 
  QrCode, 
  Wifi, 
  WifiOff, 
  Plus, 
  Edit, 
  Trash2, 
  Send, 
  RefreshCw, 
  Power, 
  Search, 
  Info, 
  MessageSquare, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Smartphone,
  ChevronRight
} from 'lucide-react';

export default function Home() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');

  // Server-Sent Events State
  const [botStatus, setBotStatus] = useState('DISCONNECTED'); // DISCONNECTED, CONNECTING, QR_RECEIVED, CONNECTED, FAILED
  const [qrCode, setQrCode] = useState(null);
  const [botInfo, setBotInfo] = useState(null);

  // Data Tables
  const [faqs, setFaqs] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({ botActive: true, defaultTemplate: '' });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState(null);
  const [faqForm, setFaqForm] = useState({ keyword: '', reply: '', matchType: 'contains' });

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [reminderForm, setReminderForm] = useState({
    customerName: '',
    customerPhone: '',
    serviceType: 'Ganti Oli',
    serviceDate: new Date().toLocaleDateString('sv-SE'),
    intervalMonths: '2',
    nextReminderDate: '',
    messageTemplate: ''
  });

  // Connect to SSE for real-time status updates
  useEffect(() => {
    console.log('Establishing connection to /api/status-sse...');
    const eventSource = new EventSource('/api/status-sse');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('SSE update received:', data);
        setBotStatus(data.status);
        setQrCode(data.qrCode);
        setBotInfo(data.botInfo);
      } catch (err) {
        console.error('Failed to parse SSE payload:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Error:', err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Fetch all database tables
  const fetchData = async () => {
    try {
      const [faqsRes, remindersRes, logsRes, settingsRes] = await Promise.all([
        fetch('/api/faqs'),
        fetch('/api/reminders'),
        fetch('/api/logs'),
        fetch('/api/settings')
      ]);

      const [faqsData, remindersData, logsData, settingsData] = await Promise.all([
        faqsRes.json(),
        remindersRes.json(),
        logsRes.json(),
        settingsRes.json()
      ]);

      setFaqs(faqsData);
      setReminders(remindersData);
      setLogs(logsData);
      setSettings(settingsData);
    } catch (err) {
      console.error('Failed to fetch data tables:', err);
      setErrorMessage('Gagal memuat data dari server.');
    }
  };

  useEffect(() => {
    fetchData();
    const poll = setInterval(fetchData, 15000);
    return () => clearInterval(poll);
  }, []);

  // Calculate Next Reminder Date helper
  const calculateNextDate = (dateStr, intervalMonths) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    
    const months = parseInt(intervalMonths);
    if (months > 0) {
      date.setMonth(date.getMonth() + months);
    }
    return date.toLocaleDateString('sv-SE'); // returns YYYY-MM-DD
  };

  // Keep nextReminderDate synced in form
  useEffect(() => {
    if (isReminderModalOpen) {
      const nextDate = calculateNextDate(reminderForm.serviceDate, reminderForm.intervalMonths);
      setReminderForm(prev => ({ ...prev, nextReminderDate: nextDate }));
    }
  }, [reminderForm.serviceDate, reminderForm.intervalMonths, isReminderModalOpen]);

  // Connect Bot Action
  const handleConnectBot = async () => {
    try {
      setErrorMessage('');
      const res = await fetch('/api/whatsapp/connect', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.error || 'Gagal memulai koneksi WhatsApp.');
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan jaringan.');
    }
  };

  // Disconnect Bot Action
  const handleDisconnectBot = async () => {
    try {
      setErrorMessage('');
      const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage(data.error || 'Gagal memutus koneksi WhatsApp.');
      }
    } catch (err) {
      setErrorMessage('Terjadi kesalahan jaringan.');
    }
  };

  // Toggle Bot Auto-Reply Active Settings
  const handleToggleBotActive = async () => {
    try {
      const updatedStatus = !settings.botActive;
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botActive: updatedStatus })
      });
      const data = await res.json();
      setSettings(data);
      fetchData();
    } catch (err) {
      console.error('Failed to toggle bot settings:', err);
    }
  };

  // Save Default Message Template
  const handleSaveTemplate = async (templateText) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultTemplate: templateText })
      });
      const data = await res.json();
      setSettings(data);
      setIsLoading(false);
      alert('Template bawaan berhasil disimpan!');
    } catch (err) {
      setIsLoading(false);
      alert('Gagal menyimpan template.');
    }
  };

  // FAQ CRUD Actions
  const handleOpenFaqModal = (faq = null) => {
    if (faq) {
      setEditingFaq(faq);
      setFaqForm({ keyword: faq.keyword, reply: faq.reply, matchType: faq.matchType });
    } else {
      setEditingFaq(null);
      setFaqForm({ keyword: '', reply: '', matchType: 'contains' });
    }
    setIsFaqModalOpen(true);
  };

  const handleSaveFaq = async (e) => {
    e.preventDefault();
    try {
      const method = editingFaq ? 'PUT' : 'POST';
      const endpoint = editingFaq ? `/api/faqs/${editingFaq.id}` : '/api/faqs';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(faqForm)
      });

      if (res.ok) {
        setIsFaqModalOpen(false);
        fetchData();
      } else {
        alert('Gagal menyimpan aturan chatbot.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteFaq = async (id) => {
    if (!confirm('Apakah Anda yakin ingin menghapus aturan chatbot ini?')) return;
    try {
      const res = await fetch(`/api/faqs/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Reminder CRUD Actions
  const handleOpenReminderModal = (rem = null) => {
    if (rem) {
      setEditingReminder(rem);
      setReminderForm({
        customerName: rem.customerName,
        customerPhone: rem.customerPhone,
        serviceType: rem.serviceType,
        serviceDate: rem.serviceDate,
        intervalMonths: String(rem.intervalMonths),
        nextReminderDate: rem.nextReminderDate,
        messageTemplate: rem.messageTemplate || ''
      });
    } else {
      setEditingReminder(null);
      setReminderForm({
        customerName: '',
        customerPhone: '',
        serviceType: 'Ganti Oli',
        serviceDate: new Date().toLocaleDateString('sv-SE'),
        intervalMonths: '2',
        nextReminderDate: '',
        messageTemplate: ''
      });
    }
    setIsReminderModalOpen(true);
  };

  const handleSaveReminder = async (e) => {
    e.preventDefault();
    try {
      const method = editingReminder ? 'PUT' : 'POST';
      const endpoint = editingReminder ? `/api/reminders/${editingReminder.id}` : '/api/reminders';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderForm)
      });

      if (res.ok) {
        setIsReminderModalOpen(false);
        fetchData();
      } else {
        alert('Gagal menyimpan pengingat.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReminder = async (id) => {
    if (!confirm('Hapus data pengingat ini?')) return;
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger manual reminder checking
  const handleTriggerReminders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reminders/trigger', { method: 'POST' });
      const data = await res.json();
      setIsLoading(false);
      fetchData();
      if (data.success) {
        alert(`Pengecekan selesai! Berhasil mengirim ${data.sentCount} pengingat.`);
      } else {
        alert(`Gagal memproses pengingat: ${data.reason}`);
      }
    } catch (err) {
      setIsLoading(false);
      alert('Gagal memicu pengiriman pengingat.');
    }
  };

  // Send single reminder manual override
  const handleSendSingleReminder = async (id) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reminders/${id}/send`, { method: 'POST' });
      const data = await res.json();
      setIsLoading(false);
      fetchData();
      if (data.success) {
        alert('Pengingat WhatsApp berhasil dikirim ke pelanggan!');
      } else {
        alert(`Gagal mengirim: ${data.error}`);
      }
    } catch (err) {
      setIsLoading(false);
      alert('Terjadi kesalahan saat mengirim pengingat.');
    }
  };

  // Clear activity logs
  const handleClearLogs = async () => {
    if (!confirm('Apakah Anda yakin ingin membersihkan semua log aktivitas?')) return;
    try {
      const res = await fetch('/api/logs', { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Utility: Format Date to local Indonesian string
  const formatDateIndo = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    return `${parseInt(parts[2])} ${months[parseInt(parts[1]) - 1]} ${parts[0]}`;
  };

  // Filter FAQs based on query
  const filteredFaqs = faqs.filter(faq => 
    faq.keyword.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.reply.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter Reminders
  const filteredReminders = reminders.filter(r => 
    r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    r.customerPhone.includes(searchQuery) ||
    r.serviceType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Generate dynamic message preview for reminder form
  const getMessagePreviewText = () => {
    const template = reminderForm.messageTemplate || settings.defaultTemplate;
    return template
      .replace(/\[Nama\]/g, reminderForm.customerName || '[Nama Pelanggan]')
      .replace(/\[Servis\]/g, reminderForm.serviceType || '[Jenis Servis]')
      .replace(/\[TanggalTerakhir\]/g, formatDateIndo(reminderForm.serviceDate) || '[Tanggal Servis Terakhir]')
      .replace(/\[TanggalBerikutnya\]/g, formatDateIndo(reminderForm.nextReminderDate) || '[Tanggal Servis Berikutnya]');
  };

  return (
    <div className="app-container">
      {/* --- Sidebar Navigation --- */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <MessageSquare className="logo-icon" size={28} />
          <span className="sidebar-brand">OtoBot Admin</span>
        </div>
        <ul className="sidebar-menu">
          <li className="menu-item">
            <a 
              className={`menu-link ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => { setActiveTab('overview'); setSearchQuery(''); }}
            >
              <Gauge size={18} />
              <span>Overview</span>
            </a>
          </li>
          <li className="menu-item">
            <a 
              className={`menu-link ${activeTab === 'whatsapp' ? 'active' : ''}`}
              onClick={() => { setActiveTab('whatsapp'); setSearchQuery(''); }}
            >
              <QrCode size={18} />
              <span>WhatsApp Bot</span>
            </a>
          </li>
          <li className="menu-item">
            <a 
              className={`menu-link ${activeTab === 'training' ? 'active' : ''}`}
              onClick={() => { setActiveTab('training'); setSearchQuery(''); }}
            >
              <Brain size={18} />
              <span>Latih Chatbot</span>
            </a>
          </li>
          <li className="menu-item">
            <a 
              className={`menu-link ${activeTab === 'reminders' ? 'active' : ''}`}
              onClick={() => { setActiveTab('reminders'); setSearchQuery(''); }}
            >
              <Bell size={18} />
              <span>Pengingat Servis</span>
            </a>
          </li>
          <li className="menu-item">
            <a 
              className={`menu-link ${activeTab === 'logs' ? 'active' : ''}`}
              onClick={() => { setActiveTab('logs'); setSearchQuery(''); }}
            >
              <History size={18} />
              <span>Log Aktivitas</span>
            </a>
          </li>
        </ul>
        <div className="sidebar-footer">
          <p>OtoBot Bengkel v1.0.0</p>
          <p style={{ marginTop: '4px', fontSize: '10px' }}>Running in Next.js Mode</p>
        </div>
      </aside>

      {/* --- Main Dashboard Wrapper --- */}
      <div className="main-wrapper">
        <header className="main-header">
          <div className="header-title-container">
            <h2>
              {activeTab === 'overview' && 'Overview Dashboard'}
              {activeTab === 'whatsapp' && 'Koneksi WhatsApp'}
              {activeTab === 'training' && 'Latih Bot (Auto-Reply)'}
              {activeTab === 'reminders' && 'Manajemen Pengingat Servis'}
              {activeTab === 'logs' && 'Log Riwayat Chat & Pengingat'}
            </h2>
          </div>
          
          <div className="header-actions">
            {/* Real-time Status Badge */}
            <div className={`badge ${botStatus === 'CONNECTED' ? 'badge-sent' : botStatus === 'CONNECTING' || botStatus === 'QR_RECEIVED' ? 'badge-pending' : 'badge-failed'}`}>
              <span className={`status-indicator-dot ${botStatus === 'CONNECTED' ? 'connected' : botStatus === 'CONNECTING' || botStatus === 'QR_RECEIVED' ? 'connecting' : 'disconnected'}`}></span>
              <span style={{ fontSize: '12px' }}>
                {botStatus === 'CONNECTED' && 'Bot Aktif'}
                {botStatus === 'CONNECTING' && 'Menghubungkan...'}
                {botStatus === 'QR_RECEIVED' && 'Scan QR Diperlukan'}
                {botStatus === 'DISCONNECTED' && 'Bot Offline'}
                {botStatus === 'FAILED' && 'Error Klien'}
              </span>
            </div>
          </div>
        </header>

        <main className="content-body">
          {errorMessage && (
            <div className="alert-banner info">
              <AlertCircle size={20} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* OVERVIEW TAB */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <>
              {/* Widgets Stats Grid */}
              <div className="stats-grid">
                <div className="card stat-card">
                  <div className="stat-icon-wrapper primary">
                    <Smartphone size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Bot WhatsApp</span>
                    <span className="stat-value" style={{ fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {botStatus === 'CONNECTED' && botInfo ? `${botInfo.name} (${botInfo.phone})` : 'Offline'}
                    </span>
                  </div>
                </div>
                <div className="card stat-card">
                  <div className="stat-icon-wrapper cyan">
                    <Brain size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Aturan Chatbot</span>
                    <span className="stat-value">{faqs.length} Kata Kunci</span>
                  </div>
                </div>
                <div className="card stat-card">
                  <div className="stat-icon-wrapper green">
                    <CheckCircle2 size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Pengingat Terkirim</span>
                    <span className="stat-value">{reminders.filter(r => r.status === 'sent').length} Pesan</span>
                  </div>
                </div>
                <div className="card stat-card">
                  <div className="stat-icon-wrapper red">
                    <Bell size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Menunggu Jadwal</span>
                    <span className="stat-value">{reminders.filter(r => r.status === 'pending').length} Pelanggan</span>
                  </div>
                </div>
              </div>

              {/* Bot Control Card */}
              <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                  <h3>Status Respon Otomatis Chatbot</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
                    Ketika aktif, bot akan membalas otomatis setiap chat WA masuk yang cocok dengan kata kunci pelatihan.
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: '600' }}>{settings.botActive ? 'AKTIF' : 'NONAKTIF'}</span>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={settings.botActive} 
                      onChange={handleToggleBotActive}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
                {/* Due Reminders list */}
                <div className="card">
                  <div className="card-header-row">
                    <h3 className="card-title"><Calendar size={20} className="logo-icon" /> Pengingat Mendatang</h3>
                    <button className="btn btn-secondary btn-small" onClick={() => setActiveTab('reminders')}>
                      Lihat Semua <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>Pelanggan</th>
                          <th>Servis</th>
                          <th>Tgl Pengingat</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reminders.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                              Belum ada data pengingat.
                            </td>
                          </tr>
                        ) : (
                          reminders.slice(0, 5).map(rem => (
                            <tr key={rem.id}>
                              <td>
                                <div style={{ fontWeight: '600' }}>{rem.customerName}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rem.customerPhone}</div>
                              </td>
                              <td>{rem.serviceType}</td>
                              <td>{formatDateIndo(rem.nextReminderDate)}</td>
                              <td>
                                <span className={`badge ${rem.status === 'sent' ? 'badge-sent' : rem.status === 'failed' ? 'badge-failed' : 'badge-pending'}`}>
                                  {rem.status === 'sent' ? 'Terkirim' : rem.status === 'failed' ? 'Gagal' : 'Menunggu'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quick Logs list */}
                <div className="card">
                  <div className="card-header-row">
                    <h3 className="card-title"><History size={20} className="logo-icon" /> Aktivitas Bot</h3>
                    <button className="btn btn-secondary btn-small" onClick={() => setActiveTab('logs')}>
                      Semua Log
                    </button>
                  </div>
                  <div className="log-container" style={{ maxHeight: '260px' }}>
                    {logs.length === 0 ? (
                      <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>Belum ada log aktivitas.</p>
                    ) : (
                      logs.slice(0, 8).map(log => (
                        <div key={log.id} style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span className={`log-badge ${log.type}`} style={{ fontSize: '9px' }}>{log.type}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString()}</span>
                          </div>
                          <span style={{ color: '#fff' }}>{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ======================================================== */}
          {/* WHATSAPP CONNECTION TAB */}
          {/* ======================================================== */}
          {activeTab === 'whatsapp' && (
            <div className="bot-connection-panel">
              {/* Connection Status Panel */}
              <div className="card">
                <div className="card-header-row">
                  <h3 className="card-title"><Smartphone size={20} className="logo-icon" /> Kontrol Koneksi Klien</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <p style={{ color: 'var(--text-muted)' }}>
                    Gunakan panel ini untuk mengaktifkan sesi browser WhatsApp Web. 
                    Anda harus menyambungkan akun WhatsApp yang akan ditugaskan sebagai robot auto-reply dan pengirim pengingat.
                  </p>

                  <div style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Status Koneksi:</span>
                      <span style={{ fontWeight: '700' }}>
                        {botStatus === 'DISCONNECTED' && 'OFFLINE (Terputus)'}
                        {botStatus === 'CONNECTING' && 'SEDANG MEMBUAT SESI...'}
                        {botStatus === 'QR_RECEIVED' && 'MENUNGGU SCAN QR CODE'}
                        {botStatus === 'CONNECTED' && 'CONNECTED (Terhubung)'}
                        {botStatus === 'FAILED' && 'PROSES GAGAL'}
                      </span>
                    </div>
                    {botInfo && (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Nama Bot:</span>
                          <span style={{ fontWeight: '600' }}>{botInfo.name}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Nomor HP Bot:</span>
                          <span style={{ fontWeight: '600' }}>{botInfo.phone}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    {botStatus === 'DISCONNECTED' || botStatus === 'FAILED' ? (
                      <button className="btn btn-primary" onClick={handleConnectBot} style={{ flexGrow: 1 }}>
                        <Power size={18} /> Hubungkan Bot (Buka Sesi)
                      </button>
                    ) : (
                      <button className="btn btn-danger" onClick={handleDisconnectBot} style={{ flexGrow: 1 }}>
                        <Power size={18} /> Putus Koneksi / Logout
                      </button>
                    )}
                    <button className="btn btn-secondary" onClick={fetchData} title="Muat Ulang Status">
                      <RefreshCw size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* QR Scanner Container */}
              <div className="card">
                <div className="card-header-row">
                  <h3 className="card-title"><QrCode size={20} className="logo-icon" /> Pemindai QR Code</h3>
                </div>

                <div className="qr-section">
                  {botStatus === 'CONNECTING' && !qrCode && (
                    <div className="qr-placeholder">
                      <RefreshCw size={40} className="logo-icon" style={{ animation: 'spin 1.5s linear infinite' }} />
                      <p>Membuka browser server...<br/>Mohon tunggu sebentar.</p>
                    </div>
                  )}

                  {botStatus === 'QR_RECEIVED' && qrCode && (
                    <div className="connected-badge-large">
                      <img src={qrCode} alt="WhatsApp QR Code" className="qr-code-img" />
                      <div style={{ fontSize: '13px' }}>
                        <p style={{ fontWeight: '600', color: '#fff' }}>Pindai Kode QR ini dengan WhatsApp Anda:</p>
                        <ol style={{ textAlign: 'left', marginTop: '10px', paddingLeft: '20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <li>Buka WhatsApp di ponsel Anda.</li>
                          <li>Ketuk Menu (titik tiga) atau Pengaturan &gt; Perangkat Tertaut.</li>
                          <li>Ketuk Tautkan Perangkat.</li>
                          <li>Arahkan kamera ponsel Anda ke layar ini.</li>
                        </ol>
                      </div>
                    </div>
                  )}

                  {botStatus === 'CONNECTED' && (
                    <div className="connected-badge-large">
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'var(--success-glow)', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                        <CheckCircle2 size={42} style={{ color: 'var(--success)', alignSelf: 'center' }} />
                      </div>
                      <h3>WhatsApp Berhasil Terhubung!</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '300px' }}>
                        Bot Anda siap merespon pertanyaan pelanggan secara otomatis dan mengirim pengingat servis.
                      </p>
                    </div>
                  )}

                  {botStatus === 'DISCONNECTED' && (
                    <div className="qr-placeholder">
                      <WifiOff size={44} style={{ color: 'var(--text-muted)' }} />
                      <p>Klien WhatsApp belum aktif.<br/>Klik tombol "Hubungkan Bot" untuk memunculkan QR Code.</p>
                    </div>
                  )}
                  
                  {botStatus === 'FAILED' && (
                    <div className="qr-placeholder" style={{ color: 'var(--danger)' }}>
                      <AlertCircle size={44} />
                      <p>Gagal memuat sesi WhatsApp.<br/>Pastikan tidak ada sesi ganda dan coba sambungkan ulang.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* FAQ TRAINING TAB */}
          {/* ======================================================== */}
          {activeTab === 'training' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Header actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ position: 'relative', minWidth: '280px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Cari kata kunci atau jawaban..." 
                    className="input-field" 
                    style={{ paddingLeft: '38px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" onClick={() => handleOpenFaqModal()}>
                  <Plus size={18} /> Tambah Aturan Chatbot
                </button>
              </div>

              {/* Rules List Table */}
              <div className="card">
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Kata Kunci (Keyword)</th>
                        <th>Metode Pencocokan</th>
                        <th>Format Balasan Otomatis (Reply)</th>
                        <th style={{ width: '100px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFaqs.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            Tidak ada aturan chatbot yang cocok.
                          </td>
                        </tr>
                      ) : (
                        filteredFaqs.map(faq => (
                          <tr key={faq.id}>
                            <td style={{ fontWeight: '700', color: 'var(--primary)' }}>
                              "{faq.keyword}"
                            </td>
                            <td>
                              <span className={`badge ${faq.matchType === 'exact' ? 'badge-failed' : 'badge-pending'}`}>
                                {faq.matchType === 'exact' ? 'Sama Persis' : 'Mengandung Kata'}
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'pre-wrap', maxWidth: '350px' }}>{faq.reply}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                <button 
                                  className="btn btn-secondary btn-icon btn-small"
                                  onClick={() => handleOpenFaqModal(faq)}
                                  title="Edit Rule"
                                >
                                  <Edit size={14} />
                                </button>
                                <button 
                                  className="btn btn-danger btn-icon btn-small"
                                  onClick={() => handleDeleteFaq(faq.id)}
                                  title="Hapus Rule"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* CUSTOMER REMINDERS TAB */}
          {/* ======================================================== */}
          {activeTab === 'reminders' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Settings default template card */}
              <div className="card">
                <div className="card-header-row">
                  <h3 className="card-title"><FileText size={20} className="logo-icon" /> Template Pesan Pengingat Default</h3>
                </div>
                <div>
                  <textarea 
                    rows="3" 
                    className="input-field"
                    value={settings.defaultTemplate}
                    onChange={(e) => setSettings({ ...settings, defaultTemplate: e.target.value })}
                    placeholder="Tulis pesan pengingat bawaan..."
                    style={{ resize: 'vertical' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Variabel dinamis: <strong>[Nama]</strong> (Nama Pelanggan), <strong>[Servis]</strong> (Tindakan/Tipe Servis), <strong>[TanggalTerakhir]</strong> (Tanggal Servis Sebelumnya), <strong>[TanggalBerikutnya]</strong> (Jadwal Servis Baru)
                    </div>
                    <button 
                      className="btn btn-secondary btn-small"
                      disabled={isLoading}
                      onClick={() => handleSaveTemplate(settings.defaultTemplate)}
                    >
                      Simpan Template Default
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ position: 'relative', minWidth: '280px' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    placeholder="Cari pelanggan, no hp, atau servis..." 
                    className="input-field" 
                    style={{ paddingLeft: '38px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleTriggerReminders} 
                    disabled={isLoading || botStatus !== 'CONNECTED'}
                    title="Periksa semua jadwal servis hari ini dan kirim jika ada yang jatuh tempo"
                  >
                    <RefreshCw size={16} className={isLoading ? 'spin' : ''} /> Proses Jatuh Tempo Hari Ini
                  </button>
                  <button className="btn btn-primary" onClick={() => handleOpenReminderModal()}>
                    <Plus size={16} /> Tambah Jadwal Pengingat
                  </button>
                </div>
              </div>

              {/* Reminders List Table */}
              <div className="card">
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Pelanggan</th>
                        <th>Detail Servis</th>
                        <th>Jadwal Servis Terakhir</th>
                        <th>Interval</th>
                        <th>Tanggal Pengingat</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th style={{ width: '130px', textAlign: 'center' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReminders.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            Tidak ada data pengingat servis.
                          </td>
                        </tr>
                      ) : (
                        filteredReminders.map(rem => (
                          <tr key={rem.id}>
                            <td>
                              <div style={{ fontWeight: '700' }}>{rem.customerName}</div>
                              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Smartphone size={12} /> {rem.customerPhone}
                              </div>
                            </td>
                            <td style={{ fontWeight: '500' }}>
                              {rem.serviceType}
                            </td>
                            <td>
                              {formatDateIndo(rem.serviceDate)}
                            </td>
                            <td>
                              {rem.intervalMonths} Bulan
                            </td>
                            <td style={{ fontWeight: '600', color: rem.status === 'pending' && rem.nextReminderDate <= new Date().toLocaleDateString('sv-SE') ? 'var(--danger)' : 'inherit' }}>
                              {formatDateIndo(rem.nextReminderDate)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${rem.status === 'sent' ? 'badge-sent' : rem.status === 'failed' ? 'badge-failed' : 'badge-pending'}`}>
                                {rem.status === 'sent' && 'Terkirim'}
                                {rem.status === 'failed' && 'Gagal'}
                                {rem.status === 'pending' && 'Menunggu'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button 
                                  className="btn btn-primary btn-icon btn-small"
                                  onClick={() => handleSendSingleReminder(rem.id)}
                                  disabled={isLoading || botStatus !== 'CONNECTED'}
                                  title="Kirim Pesan Pengingat Sekarang Secara Manual"
                                >
                                  <Send size={12} />
                                </button>
                                <button 
                                  className="btn btn-secondary btn-icon btn-small"
                                  onClick={() => handleOpenReminderModal(rem)}
                                  title="Edit"
                                >
                                  <Edit size={12} />
                                </button>
                                <button 
                                  className="btn btn-danger btn-icon btn-small"
                                  onClick={() => handleDeleteReminder(rem.id)}
                                  title="Hapus"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* ACTIVITY LOGS TAB */}
          {/* ======================================================== */}
          {activeTab === 'logs' && (
            <div className="card">
              <div className="card-header-row">
                <h3 className="card-title"><History size={20} className="logo-icon" /> Log Aktivitas Sistem</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary btn-small" onClick={fetchData}>
                    <RefreshCw size={14} /> Refresh Log
                  </button>
                  <button className="btn btn-danger btn-small" onClick={handleClearLogs}>
                    Bersihkan Semua Log
                  </button>
                </div>
              </div>

              <div className="log-container" style={{ maxHeight: '600px' }}>
                {logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <Info size={36} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p>Log riwayat aktivitas masih kosong.</p>
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="log-item">
                      <span className="log-timestamp">{new Date(log.timestamp).toLocaleString('id-ID')}</span>
                      <span className={`log-badge ${log.type}`}>{log.type}</span>
                      <div className="log-message" style={{ color: log.status === 'error' ? 'var(--danger)' : log.status === 'success' ? 'var(--success)' : '#ffffff' }}>
                        {log.message}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* FAQ MODAL FORM */}
      {/* ======================================================== */}
      {isFaqModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <form onSubmit={handleSaveFaq}>
              <div className="modal-header">
                <h3>{editingFaq ? 'Edit Aturan Chatbot' : 'Tambah Aturan Chatbot'}</h3>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Kata Kunci Chat (Keyword Trigger)</label>
                  <input 
                    type="text"
                    required
                    className="input-field"
                    placeholder="Contoh: harga oli, alamat, jam buka"
                    value={faqForm.keyword}
                    onChange={(e) => setFaqForm({ ...faqForm, keyword: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Chat pelanggan yang mendeteksi kata ini akan otomatis dibalas oleh bot.
                  </span>
                </div>

                <div className="form-group">
                  <label>Metode Pencocokan Kata</label>
                  <select 
                    className="input-field"
                    value={faqForm.matchType}
                    onChange={(e) => setFaqForm({ ...faqForm, matchType: e.target.value })}
                  >
                    <option value="contains">Mengandung Kata (Lebih Fleksibel)</option>
                    <option value="exact">Sama Persis (Strict Match)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Jawaban Otomatis (Reply Text)</label>
                  <textarea 
                    required
                    rows="4"
                    className="input-field"
                    placeholder="Tulis pesan balasan otomatis di sini..."
                    value={faqForm.reply}
                    onChange={(e) => setFaqForm({ ...faqForm, reply: e.target.value })}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFaqModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Aturan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SERVICE REMINDER MODAL FORM */}
      {/* ======================================================== */}
      {isReminderModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <form onSubmit={handleSaveReminder}>
              <div className="modal-header">
                <h3>{editingReminder ? 'Edit Jadwal Servis' : 'Tambah Jadwal Servis Baru'}</h3>
              </div>
              <div className="modal-body">
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Nama Pelanggan</label>
                    <input 
                      type="text"
                      required
                      className="input-field"
                      placeholder="Contoh: Budi Santoso"
                      value={reminderForm.customerName}
                      onChange={(e) => setReminderForm({ ...reminderForm, customerName: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Nomor WhatsApp Pelanggan</label>
                    <input 
                      type="text"
                      required
                      className="input-field"
                      placeholder="Contoh: 081234567890"
                      value={reminderForm.customerPhone}
                      onChange={(e) => setReminderForm({ ...reminderForm, customerPhone: e.target.value })}
                    />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Masukkan nomor HP dengan awalan 0 atau 62.
                    </span>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tindakan / Jenis Servis</label>
                    <select 
                      className="input-field"
                      value={reminderForm.serviceType}
                      onChange={(e) => setReminderForm({ ...reminderForm, serviceType: e.target.value })}
                    >
                      <option value="Ganti Oli">Ganti Oli</option>
                      <option value="Servis Ringan Berkala">Servis Ringan Berkala</option>
                      <option value="Servis Rem Belakang & Depan">Servis Rem Belakang/Depan</option>
                      <option value="Ganti Aki Motor">Ganti Aki Motor</option>
                      <option value="Ganti Ban Luar">Ganti Ban Luar</option>
                      <option value="Tune Up & Bersihkan Injector">Tune Up & Injector</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Interval Pengingat (Bulan)</label>
                    <select 
                      className="input-field"
                      value={reminderForm.intervalMonths}
                      onChange={(e) => setReminderForm({ ...reminderForm, intervalMonths: e.target.value })}
                    >
                      <option value="1">1 Bulan</option>
                      <option value="2">2 Bulan (Sangat Direkomendasikan)</option>
                      <option value="3">3 Bulan</option>
                      <option value="4">4 Bulan</option>
                      <option value="6">6 Bulan</option>
                      <option value="12">12 Bulan (1 Tahun)</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Tanggal Servis Terakhir</label>
                    <input 
                      type="date"
                      required
                      className="input-field"
                      value={reminderForm.serviceDate}
                      onChange={(e) => setReminderForm({ ...reminderForm, serviceDate: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Tanggal Pengingat Baru (Auto)</label>
                    <input 
                      type="date"
                      required
                      readOnly
                      className="input-field"
                      style={{ opacity: 0.85, cursor: 'not-allowed', backgroundColor: 'rgba(255,255,255,0.03)' }}
                      value={reminderForm.nextReminderDate}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '6px' }}>
                  <label>Pesan Kustomisasi (Opsional)</label>
                  <textarea 
                    rows="2"
                    className="input-field"
                    placeholder="Kosongkan untuk menggunakan template pesan default bengkel..."
                    value={reminderForm.messageTemplate}
                    onChange={(e) => setReminderForm({ ...reminderForm, messageTemplate: e.target.value })}
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Message Template Live Preview */}
                <div className="preview-box">
                  <div className="preview-box-header">Pratinjau Pesan WhatsApp Pelanggan</div>
                  <div className="preview-text">{getMessagePreviewText()}</div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsReminderModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary">
                  Simpan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
