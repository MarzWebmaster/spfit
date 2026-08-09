export enum UserRole {
  ADMIN = 'Admin',
  STAFF = 'Staff',
  FREELANCER = 'Freelancer',
  SUPERVISOR = 'Supervisor',
}

export type Permission = 
  // Tasks
  | 'tasks:create'
  | 'tasks:view:all'
  | 'tasks:view:assigned'
  | 'tasks:assign'
  | 'tasks:edit:all'
  | 'tasks:delete'
  | 'tasks:submit_report'
  | 'tasks:verify_report'
  // Payments
  | 'payments:approve'
  | 'payments:mark_paid'
  | 'payments:view_own_earnings'
  // Freelancers
  | 'freelancers:manage'
  | 'freelancers:view:all'
  // Reports
  | 'reports:view:all'
  // Notifications
  | 'notifications:view'
  // Settings
  | 'settings:view'
  | 'settings:manage:profile'
  | 'settings:manage:users'
  | 'settings:manage:roles'
  | 'settings:manage:mail'
  | 'settings:manage:templates'
  | 'settings:manage:api';


export interface Role {
    id: number;
    name: string;
    description: string;
    permissions: Permission[];
    isSystemRole?: boolean;
}

export enum TaskStatus {
  BARU = 'Baru',
  TAWARAN_DIHANTAR = 'Tawaran Dihantar',
  TELAH_DIAMBIL = 'Telah Diambil',
  SELESAI = 'Selesai',
  BORANG_DISEMAK = 'Borang Disemak & Pembayaran Tertunggak',
  TELAH_DIBAYAR = 'Telah Dibayar',
  DIBATALKAN = 'Dibatalkan',
  SELESAI_PENUH = 'Selesai Penuh',
}

export enum Skill {
  NETWORK = 'Rangkaian (LAN/WAN)',
  HARDWARE = 'Perkakasan Komputer',
  SOFTWARE = 'Perisian (OS Windows/Linux)',
  CCTV = 'Sistem CCTV',
  POS = 'Sistem POS',
  WIRING = 'Pendawaian',
}

export enum MalaysianState {
  JOHOR = 'Johor',
  KEDAH = 'Kedah',
  KELANTAN = 'Kelantan',
  MELAKA = 'Melaka',
  NEGERI_SEMBILAN = 'Negeri Sembilan',
  PAHANG = 'Pahang',
  PERAK = 'Perak',
  PERLIS = 'Perlis',
  PULAU_PINANG = 'Pulau Pinang',
  SABAH = 'Sabah',
  SARAWAK = 'Sarawak',
  SELANGOR = 'Selangor',
  TERENGGANU = 'Terengganu',
  KUALA_LUMPUR = 'W.P. Kuala Lumpur',
  LABUAN = 'W.P. Labuan',
  PUTRAJAYA = 'W.P. Putrajaya',
}

export enum UserStatus {
  ACTIVE = 'Aktif',
  INACTIVE = 'Tidak Aktif',
  BANNED = 'Disekat',
}

export interface ActivityLogEntry {
  timestamp: string;
  action: string;
  details?: string;
  performedBy: string;
}


export interface User {
  id: number;
  name: string;
  roleId: number;
  email?: string;
  status: UserStatus;
  activityLog: ActivityLogEntry[];
  banReason?: string;
  // This is for display purposes and will be populated at runtime.
  role?: UserRole; 
}

export interface Location {
    district: string;
    state: MalaysianState;
}

export interface Freelancer extends User {
  email: string;
  phone: string;
  locations: Location[];
  experience: number;
  skills: Skill[];
  isAvailable: boolean;
  roleId: number;
  icNumber: string;
  rating: number;
  status: UserStatus;
  banReason?: string;
}

export interface DetailedRating {
    skill: number;
    communication: number;
    timePunctuality: number;
    responseTime: number;
    overall: number;
    comment: string;
}

export interface Task {
  id: number;
  title: string;
  logNumber: string;
  description: string;
  supportType: Skill;
  clientLocation: string;
  districtAddress?: string;
  state: string;
  deadline: string;
  offerPrice: number;
  status: TaskStatus;
  createdBy: number; // Staff ID
  assignedTo?: number; // Freelancer ID
  report?: {
    fileUrl: string;
    notes: string;
    submittedAt: string;
  };
  attachments?: string[];
  paymentDate?: string;
  remarks?: string;
  links?: string[];
  feedback?: DetailedRating;
}

export type DashboardView = 
  | 'dashboard' 
  | 'tasks' 
  | 'freelancers' 
  | 'reports' 
  | 'settings' 
  | 'my-tasks' 
  | 'earnings' 
  | 'payment-approvals'
  | 'freelancer-profile'
  | 'notifications';

export interface Webhook {
  id: number;
  name: string;
  url: string;
}

export interface Notification {
  id: number;
  taskId: number;
  taskTitle: string;
  recipients: number;
  method: string;
  webhookName?: string;
  timestamp: string;
}

export interface SmtpSettings {
  server: string;
  port: number;
  username: string;
  password: string;
  fromAddress: string;
  security: 'TLS' | 'SSL' | 'None';
}

export type SettingsView = 'hub' | 'profile' | 'mail' | 'templates' | 'api' | 'users' | 'roles';

export enum NotificationType {
    TASK_OFFER = 'Tawaran Tugasan',
}

export interface NotificationTemplate {
    id: number;
    type: NotificationType;
    channel: 'E-mel' | 'Webhook';
    name: string;
    subjectOrTitle: string;
    body: string;
    isDefault: boolean;
}