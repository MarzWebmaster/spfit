import type { Permission } from '../types'

export const PERMISSION_DEFINITIONS: { id: Permission, label: string, category: string }[] = [
  { id: 'tasks:create', label: 'Cipta Tugasan', category: 'Tugasan' },
  { id: 'tasks:view:all', label: 'Lihat Semua Tugasan', category: 'Tugasan' },
  { id: 'tasks:view:own', label: 'Lihat Tugasan Sendiri (Assigned)', category: 'Tugasan' },
  { id: 'tasks:view:assigned', label: 'Lihat Tugasan Sendiri (Freelancer)', category: 'Tugasan' },
  { id: 'tasks:assign', label: 'Agihkan Tugasan kepada Freelancer', category: 'Tugasan' },
  { id: 'tasks:edit:all', label: 'Edit Semua Tugasan', category: 'Tugasan' },
  { id: 'tasks:delete', label: 'Padam Tugasan', category: 'Tugasan' },
  { id: 'tasks:submit_report', label: 'Akses & Hantar Tugasan (Form)', category: 'Tugasan' },
  { id: 'tasks:manage_completed_form', label: 'Akses Borang Tugasan Siap (Completed Task)', category: 'Tugasan' },
  { id: 'tasks:verify_report', label: 'Sahkan Laporan Tugasan', category: 'Tugasan' },

  { id: 'ai:task:view', label: 'Lihat Modul AI Task', category: 'AI' },
  { id: 'ai:masterlist:view', label: 'Lihat Modul AI Masterlist', category: 'AI' },

  { id: 'projects:view:all', label: 'Lihat Semua Projek', category: 'Projek' },
  { id: 'projects:view:own', label: 'Lihat Projek Sendiri (Assigned/Created)', category: 'Projek' },

  { id: 'masterlists:view:all', label: 'Lihat Semua Masterlist', category: 'Masterlist' },
  { id: 'masterlists:view:own', label: 'Lihat Masterlist Sendiri (Assigned/Created)', category: 'Masterlist' },

  { id: 'assets:view:all', label: 'Lihat Semua Aset', category: 'Aset' },
  { id: 'assets:view:own', label: 'Lihat Aset Sendiri (Assigned/Created)', category: 'Aset' },

  { id: 'payments:view:all', label: 'Lihat Semua Pembayaran', category: 'Pembayaran' },
  { id: 'payments:view:own', label: 'Lihat Pembayaran Sendiri', category: 'Pembayaran' },
  { id: 'payments:approve', label: 'Luluskan Pembayaran', category: 'Pembayaran' },
  { id: 'payments:mark_paid', label: 'Tandakan Telah Dibayar', category: 'Pembayaran' },

  { id: 'freelancers:manage', label: 'Urus Profil Freelancer (Tambah/Edit)', category: 'Freelancer' },
  { id: 'freelancers:view:all', label: 'Lihat Semua Freelancer', category: 'Freelancer' },
  { id: 'freelancers:view:own', label: 'Lihat Profil Freelancer Sendiri', category: 'Freelancer' },

  { id: 'reports:view:all', label: 'Lihat Semua Laporan', category: 'Laporan' },
  { id: 'reports:view:own', label: 'Lihat Laporan Sendiri', category: 'Laporan' },

  { id: 'notifications:view', label: 'Lihat Sejarah Notifikasi', category: 'Notifikasi' },
  { id: 'notifications:view:all', label: 'Lihat Semua Notifikasi', category: 'Notifikasi' },
  { id: 'notifications:view:own', label: 'Lihat Notifikasi Sendiri', category: 'Notifikasi' },

  { id: 'maincons:view:all', label: 'Lihat Semua Main-Con', category: 'Main-Con' },
  { id: 'maincons:view:own', label: 'Lihat Main-Con Sendiri', category: 'Main-Con' },

  { id: 'settings:view', label: 'Akses Halaman Tetapan', category: 'Tetapan' },
  { id: 'settings:manage:profile', label: 'Urus Profil Sendiri', category: 'Tetapan' },
  { id: 'settings:manage:users', label: 'Urus Pengguna & Staf', category: 'Tetapan' },
  { id: 'settings:manage:roles', label: 'Urus Peranan & Kebenaran', category: 'Tetapan' },
  { id: 'settings:manage:mail', label: 'Urus Tetapan Mel (SMTP)', category: 'Tetapan' },
  { id: 'settings:manage:templates', label: 'Urus Templat Notifikasi', category: 'Tetapan' },
  { id: 'settings:manage:api', label: 'Urus API & Webhook', category: 'Tetapan' }
]

export default PERMISSION_DEFINITIONS
