import React, { useEffect, useState } from 'react';
import { UserRole } from '../types';
import { storage } from '../utils/storage';
import { getApiBaseUrl } from '../utils/apiUrl';

type ManualTab = 'admin' | 'supervisor' | 'freelancer';

interface AuthState {
  isLoggedIn: boolean;
  role?: string;
  name?: string;
}

const TABS: { key: ManualTab; label: string; icon: string; requiresAuth: boolean }[] = [
  { key: 'admin', label: 'Pentadbir (Admin)', icon: '🛡️', requiresAuth: true },
  { key: 'supervisor', label: 'Penyelia (Supervisor)', icon: '👁️', requiresAuth: false },
  { key: 'freelancer', label: 'Freelancer', icon: '💼', requiresAuth: false },
];

const ADMIN_SECTIONS = [
  {
    id: 'dashboard',
    title: 'Papan Pemuka (Dashboard)',
    content: `Papan Pemuka Pentadbiran memberikan ringkasan menyeluruh tentang sistem. Ia memaparkan:
• **Statistik Utama**: Jumlah tugasan, tugasan aktif, jumlah pengguna, freelancer aktif, pembayaran tertunggak, dan jumlah hasil.
• **Tugasan Terkini**: Senarai tugasan terkini dengan status, harga, dan freelancer yang diagihkan.
• **Pengguna Staff**: Senarai pengguna staff aktif dalam sistem.
• **Freelancer**: Senarai freelancer berdaftar dengan penarafan dan status ketersediaan.

Setiap jadual menyokong paparan 5, 10, 20, 50, atau 100 rekod per halaman.`,
  },
  {
    id: 'users',
    title: 'Pengurusan Pengguna',
    content: `### Senarai Pengguna
• **Lihat Semua Pengguna**: Akses senarai lengkap semua pengguna (Staff, Supervisor, Freelancer).
• **Tapis & Cari**: Tapis mengikut peranan, status, atau cari mengikut nama/email.
• **Butiran Pengguna**: Klik pada pengguna untuk lihat profil lengkap termasuk tugasan, penarafan, dan kemahiran.

### Tambah/Kemaskini Pengguna
• **Pendaftaran**: Daftar pengguna baru dengan nama, email, kata laluan, peranan.
• **Kemaskini Profil**: Ubah suai maklumat pengguna, status (Aktif/Tidak Aktif/Disekat).
• **Penetapan Peranan**: Tentukan peranan dan kebenaran akses pengguna.

### Peranan & Kebenaran
• **Peranan Standard**: Admin, Staff, Supervisor, Freelancer.
• **Peranan Tersuai**: Cipta peranan baru dengan set kebenaran khusus.
• **Kebenaran Terperinci**: Kawalan akses granular untuk setiap modul (tugasan, aset, masterlist, pembayaran, dll.).`,
  },
  {
    id: 'roles',
    title: 'Pengurusan Peranan (Roles)',
    content: `Sistem menyediakan 4 peranan standard yang tidak boleh dipadam:
1. **Admin** — Akses penuh ke semua modul dan tetapan sistem.
2. **Staff** — Akses terhad kepada tugasan, projek, masterlist, aset.
3. **Supervisor** — Kelulusan pembayaran, laporan, penyeliaan.
4. **Freelancer** — Akses kepada tugasan yang diagihkan sahaja.

### Cipta Peranan Tersuai
1. Navigasi ke **Tetapan → Peranan & Kebenaran**.
2. Klik **Tambah Peranan**.
3. Isi nama peranan (mestilah unik) dan keterangan.
4. Pilih kebenaran yang sesuai.
5. Klik **Simpan**.

### Kebenaran Yang Tersedia
• **tasks:create/view/assign/edit/delete** — Pengurusan tugasan
• **payments:approve/mark_paid** — Pengurusan pembayaran
• **freelancers:manage/view** — Pengurusan freelancer
• **settings:manage:users/roles/mail/templates** — Pentadbiran sistem
• **projects:view/manage** — Pengurusan projek
• **masterlists:view/manage** — Pengurusan masterlist`,
  },
  {
    id: 'settings',
    title: 'Tetapan Sistem',
    content: `### Integrasi AI & Messaging
• **OpenAI/Gemini API**: Konfigurasi kunci API untuk ciri AI (AI Task, AI Masterlist).
• **WhatsApp (Marz Wasap / Wasapmatic)**: Aktifkan dan konfigurasi provider WhatsApp untuk penghantaran notifikasi automatik.

### Tetapan Email
• **SMTP Configuration**: Tetapkan pelayan SMTP untuk penghantaran emel notifikasi.
• **Template Emel**: Sesuaikan template emel untuk pelbagai jenis notifikasi.

### Notifikasi
• **Jenis Notifikasi**: Tugasan baru, kemaskini status, pembayaran, peringatan tarikh akhir.
• **Saluran**: Dalam aplikasi, emel, WhatsApp.
• **Pemantauan WhatsApp**: Tab untuk memantau status penghantaran mesej WhatsApp (queue, sent, delivered, failed).

### Tetapan Tugasan
• **Status Tugasan**: Tentukan status tersuai untuk aliran kerja tugasan.
• **Jenis Sokongan**: Konfigurasi jenis sokongan yang tersedia (NETWORK, HARDWARE, dll.).`,
  },
  {
    id: 'maincons',
    title: 'Main-Con (Kontraktor Utama)',
    content: `Modul Main-Con membolehkan pengurusan kontraktor utama yang terlibat dalam projek.
• **Senarai Main-Con**: Paparan semua kontraktor utama berdaftar.
• **Tambah Main-Con**: Daftar kontraktor baru dengan maklumat syarikat dan hubungan.
• **Kaitan Projek**: Main-Con dikaitkan dengan projek tertentu untuk pengurusan tugasan.`,
  },
  {
    id: 'import-export',
    title: 'Import & Eksport Data',
    content: `### Import Aset
Sistem menyokong import aset secara pukal melalui fail:
• **Format Disokong**: CSV, XLSX, PDF, DOCX, TXT
• **Auto-Mapping**: Sistem mengesan header lajur secara automatik dan memadankan dengan field sistem.
• **Manual Mapping**: Pengguna boleh menyesuaikan pemetaan lajur jika auto-mapping tidak tepat.

### Import Masterlist
• **Format Disokong**: CSV, XLSX, PDF, DOCX, TXT
• **Field**: Kod Projek, Kod Masterlist, Nama, Keterangan, Status

### Eksport Data
• **Eksport Masterlist**: Eksport semua aset dalam masterlist ke format CSV/XLSX.
• **Eksport Tugasan**: Eksport senarai tugasan dengan penapis.

### Template CSV
• Muat turun template CSV untuk format yang betul sebelum import.`,
  },
  {
    id: 'api-docs',
    title: 'Dokumentasi API',
    content: `## Gambaran Keseluruhan API

SPFIT menyediakan RESTful API untuk integrasi dengan sistem luaran. Semua endpoint menggunakan JSON sebagai format data.

### Base URL
\`\`\`
http://localhost:3005/api
\`\`\`

### Format Respons Standard
\`\`\`json
{
  "success": true,
  "message": "Penerangan",
  "data": { ... }
}
\`\`\`

### Autentikasi
API menyokong dua kaedah autentikasi:

**1. JWT Bearer Token (untuk pengguna sistem)**
\`\`\`
Authorization: Bearer <token>
\`\`\`
Diperoleh melalui \`POST /api/auth/login\`.

**2. API Key (untuk integrasi luaran)**
\`\`\`
x-api-key: spfit_<random-string>
\`\`\`
Dijana di **Tetapan → API & Webhook → Pengurusan Kunci API**.

---

## Pengurusan Kunci API

### Senarai Semua Kunci
\`\`\`
GET /api/api-keys
\`\`\`
**Auth:** JWT Admin / Staff dengan permission \`settings:manage:api\`
**Respons:** Senarai kunci dengan prefix, nama, status, tarikh cipta (tanpa full key).

### Jana Kunci Baru
\`\`\`
POST /api/api-keys
Content-Type: application/json

{
  "name": "Integrasi POS"
}
\`\`\`
**Auth:** JWT Admin / Staff dengan permission \`settings:manage:api\`
**Respons:** Kunci penuh dipaparkan sekali sahaja. Salin dan simpan di tempat selamat.

### Batalkan Kunci
\`\`\`
PATCH /api/api-keys/:id/revoke
\`\`\`
**Auth:** JWT dengan permission \`settings:manage:api\`
**Kesan:** Kunci tidak boleh digunakan lagi untuk autentikasi.

### Padam Kunci (Kekal)
\`\`\`
DELETE /api/api-keys/:id
\`\`\`
**Auth:** JWT dengan permission \`settings:manage:api\`

---

## Endpoint Awam (Guna x-api-key)

### Semak Status API
\`\`\`
GET /api/health
\`\`\`

**Respons:**
\`\`\`json
{
  "success": true,
  "message": "SPFIT API is running",
  "timestamp": "2026-05-04T12:00:00.000Z",
  "version": "1.0.0"
}
\`\`\`

---

## Authentication (JWT)

### Log Masuk
\`\`\`
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "••••••••"
}
\`\`\`

**Respons:**
\`\`\`json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "expiresIn": 86400,
    "user": { "id": 1, "name": "Admin", "email": "admin@example.com", "role": "Admin", "status": "Aktif" }
  }
}
\`\`\`

### Log Keluar
\`\`\`
POST /api/auth/logout
Authorization: Bearer <token>
\`\`\`

### Profil Pengguna
\`\`\`
GET /api/auth/profile
Authorization: Bearer <token>
\`\`\`

### Tukar Kata Laluan
\`\`\`
POST /api/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "lama",
  "newPassword": "baru"
}
\`\`\`

---

## Pengurusan Pengguna

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/users | Senarai semua pengguna |
| GET | /api/users/:id | Butiran pengguna |
| POST | /api/users | Cipta pengguna baru |
| PUT | /api/users/:id | Kemaskini pengguna |
| DELETE | /api/users/:id | Padam pengguna |

---

## Pengurusan Tugasan

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/tasks | Senarai semua tugasan |
| GET | /api/tasks/:id | Butiran tugasan |
| POST | /api/tasks | Cipta tugasan baru |
| PUT | /api/tasks/:id | Kemaskini tugasan |
| DELETE | /api/tasks/:id | Padam tugasan |
| PATCH | /api/tasks/:id/assign | Agihkan kepada freelancer |
| POST | /api/tasks/:id/report | Hantar laporan selesai |
| POST | /api/tasks/:id/feedback | Hantar maklum balas |

---

## Projek

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/projects | Senarai projek |
| GET | /api/projects/:id | Butiran projek |
| POST | /api/projects | Cipta projek |

---

## Masterlist

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/masterlists | Senarai masterlist |
| GET | /api/masterlists/:id | Butiran masterlist (+ aset) |
| POST | /api/masterlists | Cipta masterlist |
| PUT | /api/masterlists/:id | Kemaskini masterlist |
| DELETE | /api/masterlists/:id | Padam masterlist |
| POST | /api/masterlists/import | Import masterlist dari fail |

---

## Aset

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/assets | Senarai aset |
| GET | /api/assets/:id | Butiran aset (+ aksesori, lampiran) |
| POST | /api/assets | Cipta aset |
| PUT | /api/assets/:id | Kemaskini aset |
| DELETE | /api/assets/:id | Padam aset |
| POST | /api/assets/import | Import aset pukal dari fail |

---

## Pembayaran

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/payments | Senarai pembayaran |
| GET | /api/payments/:id | Butiran pembayaran |
| POST | /api/payments | Cipta pembayaran |
| PUT | /api/payments/:id/approve | Luluskan pembayaran |
| PUT | /api/payments/:id/pay | Tandakan telah dibayar |

---

## Freelancer

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/freelancers | Senarai freelancer |
| GET | /api/freelancers/:id | Profil freelancer |
| GET | /api/freelancers/:id/tasks | Tugasan freelancer |
| PUT | /api/freelancers/:id | Kemaskini freelancer |

---

## Notifikasi

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/notifications | Senarai notifikasi |
| PATCH | /api/notifications/:id/read | Tandakan telah dibaca |

---

## WhatsApp

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| POST | /api/wasapmatic/send | Hantar mesej WhatsApp |
| GET | /api/wasapmatic/providers/status | Status provider WhatsApp |
| POST | /api/wasapmatic/providers/active | Tukar provider aktif |

---

## AI

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| POST | /api/openai/test | Uji sambungan OpenAI |
| GET | /api/openai/models | Senarai model OpenAI |
| POST | /api/openai/chat | Chat completion |
| POST | /api/gemini/test | Uji sambungan Gemini |
| GET | /api/gemini/models | Senarai model Gemini |
| POST | /api/gemini/generate | Generate kandungan |

---

## Jejak Audit

| Method | Endpoint | Penerangan |
|--------|----------|------------|
| GET | /api/audit | Log audit (dengan penapis) |

---

## Ralat Biasa

| Kod HTTP | Maksud |
|----------|--------|
| 200 | Berjaya |
| 201 | Dicipta |
| 400 | Data tidak sah / Parameter hilang |
| 401 | Tidak disahkan (token / API key tidak sah) |
| 403 | Tiada kebenaran |
| 404 | Rekod tidak ditemui |
| 409 | Konflik (duplikasi) |
| 500 | Ralat pelayan dalaman |

---

## Contoh Permintaan (cURL)

### Login
\`\`\`bash
curl -X POST http://localhost:3005/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@example.com","password":"password123"}'
\`\`\`

### Jana API Key
\`\`\`bash
curl -X POST http://localhost:3005/api/api-keys \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Integrasi POS"}'
\`\`\`

### Guna API Key untuk Akses
\`\`\`bash
curl http://localhost:3005/api/health \\
  -H "x-api-key: spfit_abc123..."
\`\`\`

### Import Aset dari CSV
\`\`\`bash
curl -X POST http://localhost:3005/api/assets/import \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@aset.csv" \\
  -F "masterlist_id=1"
\`\`\``,
  },
  {
    id: 'audit',
    title: 'Jejak Audit (Audit Trail)',
    content: `Setiap transaksi penting direkodkan dalam jejak audit untuk tujuan pemantauan dan pematuhan.

**Operasi Yang Direkodkan:**
• CREATE, UPDATE, DELETE untuk Aset, Masterlist, Tugasan
• Perubahan status tugasan
• Muat naik dan pemadaman lampiran
• Konfigurasi sistem
• Penghantaran WhatsApp

**Maklumat Yang Disimpan:**
• Pengguna yang melakukan tindakan
• Jenis tindakan
• Jadual yang terlibat
• Data lama dan baru (untuk kemaskini)
• Alamat IP dan User Agent
• Cap masa

**Pengekalan Data**: Log audit disimpan selama 90 hari sebelum dipadam secara automatik.`,
  },
];

const SUPERVISOR_SECTIONS = [
  {
    id: 'dashboard',
    title: 'Papan Pemuka Penyelia',
    content: `Papan Pemuka Penyelia memberikan pandangan menyeluruh tentang prestasi sistem:
• **Statistik Tugasan**: Jumlah tugasan, tugasan aktif, pembayaran tertunggak.
• **Senarai Freelancer**: Status ketersediaan dan penarafan freelancer.
• **Tugasan Terkini**: Tugasan yang memerlukan perhatian.

Gunakan penapis dan carian untuk mengecilkan paparan mengikut keperluan.`,
  },
  {
    id: 'payments',
    title: 'Kelulusan Pembayaran',
    content: `Modul Kelulusan Pembayaran adalah fungsi utama Penyelia:

### Proses Kelulusan
1. **Semak Tugasan Selesai**: Lihat tugasan yang telah selesai dan menunggu pembayaran.
2. **Pengesahan Laporan**: Semak laporan yang dihantar oleh freelancer.
3. **Luluskan Pembayaran**: Klik "Lulus" untuk meluluskan pembayaran.
4. **Tandakan Dibayar**: Selepas pembayaran dibuat, tandakan sebagai "Telah Dibayar".

### Maklumat Pembayaran
• Harga tawaran (offer_price)
• Tarikh pembayaran
• Maklumat bank freelancer
• Resit pembayaran (boleh dimuat naik)

### Laporan Kewangan
• Ringkasan pembayaran mengikut tempoh
• Jumlah pembayaran yang telah diluluskan`,
  },
  {
    id: 'tasks',
    title: 'Penyeliaan Tugasan',
    content: `Sebagai Penyelia, anda boleh:
• **Lihat Semua Tugasan**: Akses kepada semua tugasan dalam sistem.
• **Pantau Status**: Jejaki kemajuan tugasan dari BARU hingga SELESAI PENUH.
• **Agihan Semula**: Agihkan semula tugasan kepada freelancer lain jika perlu.
• **Laporan**: Jana laporan prestasi tugasan dan freelancer.`,
  },
];

const FREELANCER_SECTIONS = [
  {
    id: 'dashboard',
    title: 'Papan Pemuka Freelancer',
    content: `Papan Pemuka Freelancer memaparkan:
• **Tugasan Anda**: Senarai tugasan yang diagihkan kepada anda.
• **Statistik**: Jumlah tugasan aktif, tugasan selesai, pendapatan.
• **Penarafan**: Penarafan semasa anda berdasarkan maklum balas.

Gunakan tab untuk menapis tugasan mengikut status.`,
  },
  {
    id: 'tasks',
    title: 'Pengurusan Tugasan',
    content: `### Menerima Tugasan
Apabila tugasan baru diagihkan kepada anda:
1. Anda akan menerima notifikasi (dalam aplikasi, emel, atau WhatsApp).
2. Buka tugasan untuk melihat butiran penuh.
3. Terima atau tolak tawaran tugasan.

### Melaksanakan Tugasan
1. **Mulakan Kerja**: Selepas menerima, anda boleh mula melaksanakan tugasan.
2. **Kemaskini Status**: Tukar status tugasan mengikut kemajuan.
3. **Hubungi**: Gunakan maklumat hubungan yang disediakan jika perlu.

### Melaporkan Penyelesaian
1. **Hantar Laporan**: Selepas selesai, hantar laporan penyelesaian.
2. **Muat Naik Bukti**: Lampirkan gambar atau dokumen sebagai bukti kerja.
3. **Tunggu Pengesahan**: Staff akan menyemak dan mengesahkan laporan anda.

### Status Tugasan
| Status | Penerangan |
|--------|------------|
| **BARU** | Tugasan baru dicipta |
| **TAWARAN DIHANTAR** | Tawaran dihantar kepada freelancer |
| **TELAH DIAMBIL** | Freelancer menerima tugasan |
| **SELESAI** | Freelancer melaporkan selesai |
| **BORANG DISEMAK** | Laporan disemak, menunggu pembayaran |
| **TELAH DIBAYAR** | Pembayaran telah dibuat |
| **SELESAI PENUH** | Tugasan selesai sepenuhnya |
| **DIBATALKAN** | Tugasan dibatalkan |`,
  },
  {
    id: 'profile',
    title: 'Pengurusan Profil',
    content: `### Profil Freelancer
• **Maklumat Peribadi**: Nama, emel, nombor telefon, gambar profil.
• **Kemahiran**: Tambah kemahiran yang anda miliki (NETWORK, HARDWARE, SOFTWARE, dll.).
• **Lokasi**: Tetapkan lokasi perkhidmatan anda (daerah, negeri).
• **Ketersediaan**: Tandakan sama ada anda tersedia untuk tugasan baru.

### Maklumat Bank
• Daftar maklumat bank untuk penerimaan pembayaran.
• Nama bank, nombor akaun, nama pemegang akaun.

### Penarafan & Maklum Balas
• Lihat penarafan dan maklum balas daripada tugasan terdahulu.
• Penarafan berdasarkan: kemahiran, komunikasi, ketepatan masa, dan respons.`,
  },
  {
    id: 'payments',
    title: 'Pembayaran & Pendapatan',
    content: `### Pendapatan Anda
• Lihat senarai pembayaran yang telah diterima.
• Jumlah pendapatan terkumpul.
• Status pembayaran (diluluskan, telah dibayar).

### Proses Pembayaran
1. Selepas tugasan disemak, status menjadi "Borang Disemak".
2. Penyelia meluluskan pembayaran.
3. Pembayaran diproses dan status menjadi "Telah Dibayar".
4. Anda menerima notifikasi pembayaran.`,
  },
];

export const UserManualPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ManualTab>('freelancer');
  const [auth, setAuth] = useState<AuthState>({ isLoggedIn: false });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const token = storage.getToken();
    if (token) {
      const user = storage.getUser();
      setAuth({
        isLoggedIn: true,
        role: user?.role || '',
        name: user?.name || '',
      });
    }
  }, []);

  const handleLogin = async () => {
    setLoginError('');
    setLoggingIn(true);
    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setLoginError(data.message || 'Log masuk gagal');
        return;
      }
      const user = data.data?.user || {};
      if (user.role !== UserRole.ADMIN && user.role !== 'Admin') {
        setLoginError('Hanya Admin dibenarkan mengakses manual ini.');
        return;
      }
      storage.setToken(data.data.accessToken);
      storage.setUser(user);
      setAuth({ isLoggedIn: true, role: user.role, name: user.name });
    } catch {
      setLoginError('Ralat sambungan. Sila cuba lagi.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    storage.clearAll();
    setAuth({ isLoggedIn: false });
  };

  const sections = activeTab === 'admin'
    ? ADMIN_SECTIONS
    : activeTab === 'supervisor'
    ? SUPERVISOR_SECTIONS
    : FREELANCER_SECTIONS;

  const tab = TABS.find(t => t.key === activeTab)!;
  const needsAuth = tab.requiresAuth && !auth.isLoggedIn;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-700 to-indigo-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-indigo-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <div>
                <h1 className="text-xl font-bold">Manual Pengguna SPFIT</h1>
                <p className="text-xs text-indigo-300">Sistem Pengurusan Freelance IT Tech</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {auth.isLoggedIn && (
                <span className="text-sm text-indigo-200 hidden sm:block">
                  {auth.name} ({auth.role})
                </span>
              )}
              {auth.isLoggedIn && (
                <button onClick={handleLogout} className="text-xs text-indigo-300 hover:text-white px-3 py-1 rounded border border-indigo-500 hover:border-indigo-300 transition">
                  Log Keluar
                </button>
              )}
              {/* Mobile hamburger */}
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="sm:hidden text-white p-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sidebarOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto gap-1 pb-1">
            {TABS.map(t => {
              const isActive = activeTab === t.key;
              const isLocked = t.requiresAuth && !auth.isLoggedIn;
              return (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); setSidebarOpen(false); }}
                  className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap ${
                    isActive
                      ? 'bg-white text-indigo-700'
                      : 'text-indigo-200 hover:text-white hover:bg-indigo-800'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.label.split('(')[0].trim()}</span>
                  {isLocked && <span className="text-xs">🔒</span>}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 sm:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute right-0 top-16 w-64 h-[calc(100vh-4rem)] bg-white shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <nav className="p-4 space-y-1">
              {sections.map(s => (
                <a key={s.id} href={`#${s.id}`} onClick={() => setSidebarOpen(false)} className="block px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition">
                  {s.title}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {needsAuth ? (
          /* Login prompt for Admin section */
          <div className="max-w-md mx-auto mt-12">
            <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
              <div className="text-center mb-6">
                <span className="text-5xl">🛡️</span>
                <h2 className="text-xl font-bold text-gray-800 mt-3">Manual Pentadbir</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Bahagian ini memerlukan pengesahan Admin. Sila log masuk dengan akaun Admin anda.
                </p>
              </div>

              {loginError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {loginError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="admin@example.com"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kata Laluan</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    placeholder="••••••••"
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <button
                  onClick={handleLogin}
                  disabled={loggingIn}
                  className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loggingIn ? 'Log Masuk...' : 'Log Masuk'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Manual content */
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <nav className="sticky top-24 bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">
                  {tab.label}
                </p>
                {sections.map(s => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block px-3 py-2 text-sm text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition"
                  >
                    {s.title}
                  </a>
                ))}
              </nav>
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
              <div className="space-y-8">
                {sections.map(s => (
                  <section key={s.id} id={s.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 scroll-mt-24">
                    <h2 className="text-lg font-bold text-gray-800 mb-4">{s.title}</h2>
                    <div className="prose prose-sm max-w-none text-gray-600">
                      {s.content.split('\n').map((line, i) => {
                        const trimmed = line.trim();
                        if (!trimmed) return <br key={i} />;
                        if (trimmed.startsWith('### ')) {
                          return <h3 key={i} className="text-base font-semibold text-gray-800 mt-4 mb-2">{trimmed.replace('### ', '')}</h3>;
                        }
                        if (trimmed.startsWith('|')) {
                          const cells = trimmed.split('|').filter(c => c.trim()).map((c, j) => {
                            const clean = c.trim();
                            return <td key={j} className={`border px-3 py-1.5 text-sm ${i === 0 ? 'font-semibold bg-gray-50' : ''}`}>{clean}</td>;
                          });
                          return <tr key={i}>{cells}</tr>;
                        }
                        if (trimmed.startsWith('• **')) {
                          const match = trimmed.match(/• \*\*(.+?)\*\*(.*)/);
                          if (match) {
                            return (
                              <p key={i} className="ml-2 mb-1 leading-relaxed">
                                • <strong>{match[1]}</strong>{match[2]}
                              </p>
                            );
                          }
                        }
                        if (trimmed.startsWith('• ') || trimmed.match(/^\d+\. /)) {
                          return <p key={i} className="ml-2 mb-1 leading-relaxed">{trimmed}</p>;
                        }
                        return <p key={i} className="mb-1 leading-relaxed">{trimmed}</p>;
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </main>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-500">
          SPFIT — Sistem Pengurusan Freelance IT Tech &copy; {new Date().getFullYear()}. Semua hak terpelihara.
        </div>
      </footer>
    </div>
  );
};

export default UserManualPage;
