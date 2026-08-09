export enum UserRole {
  ADMIN = 'Admin',
  STAFF = 'Staff',
  SUPERVISOR = 'Supervisor',
  FREELANCER = 'Freelancer',
}

export type Permission = 
  // Tasks
  | 'tasks:create'
  | 'tasks:view:all'
  | 'tasks:view:own'
  | 'tasks:view:assigned'
  | 'tasks:assign'
  | 'tasks:edit:all'
  | 'tasks:delete'
  | 'tasks:submit_report'
  | 'tasks:verify_report'
  // AI
  | 'ai:task:view'
  | 'ai:masterlist:view'
  // Projects
  | 'projects:view:all'
  | 'projects:view:own'
  // Masterlists
  | 'masterlists:view:all'
  | 'masterlists:view:own'
  // Assets
  | 'assets:view:all'
  | 'assets:view:own'
  // Payments
  | 'payments:view:all'
  | 'payments:view:own'
  | 'payments:approve'
  | 'payments:mark_paid'
  // Freelancers
  | 'freelancers:manage'
  | 'freelancers:view:all'
  | 'freelancers:view:own'
  | 'tasks:manage_completed_form'
  // Reports
  | 'reports:view:all'
  | 'reports:view:own'
  // Notifications
  | 'notifications:view'
  | 'notifications:view:all'
  | 'notifications:view:own'
  // Main-Con
  | 'maincons:view:all'
  | 'maincons:view:own'
  // Settings
  | 'settings:view'
  | 'settings:manage:profile'
  | 'settings:manage:users'
  | 'settings:manage:roles'
  | 'settings:manage:mail'
  | 'settings:manage:templates'
  | 'settings:manage:api'
  | 'system.admin';


export interface RoleType {
  id: number;
  name: string;
  description?: string;
}

export interface Role {
    id: number;
    name: string;
    description: string;
    roleType?: RoleType;
    roleTypeId?: number;
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
  permissions?: Permission[];
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postcode?: string;
  state?: string;
  status: UserStatus;
  activityLog?: ActivityLogEntry[];
  banReason?: string;
  bank_name?: string;
  bank_account_number?: string;
  payment_email?: string;
  // This is for display purposes and will be populated at runtime.
  role?: UserRole; 
}

export interface Location {
    district: string;
    state: MalaysianState;
}

export interface BankAccount {
  id: number;
  user_id: number;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Freelancer extends User {
  email: string;
  phone: string;
  locations: Location[];
  bankAccounts?: BankAccount[];
  experience: number;
  skills: Skill[];
  isAvailable: boolean;
  roleId: number;
  icNumber: string;
  rating: number;
  status: UserStatus;
  banReason?: string;
  ic_number?: string;
  bank_name?: string;
  bank_account_number?: string;
  payment_email?: string;
}

export interface DetailedRating {
    skill: number;
    communication: number;
    timePunctuality: number;
    responseTime: number;
    overall: number;
    comment: string;
}

export interface MainCon {
  id: number;
  name: string;
  contactPerson?: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  isActive: boolean;
}

export enum ProjectStatus {
  AKTIF = 'Aktif',
  SELESAI = 'Selesai',
  DIBATALKAN = 'Dibatalkan'
}

export interface Project {
  id: number;
  code: string;
  name: string;
  client_name?: string;
  description?: string;
  status: ProjectStatus;
  start_date?: string;
  end_date?: string;
  budget?: number;
  main_con_id?: number;
  mainCon?: {
    id: number;
    name: string;
  };
  created_by?: number;
  created_at: string;
  updated_at: string;
  creator?: {
    id: number;
    name?: string;
    email?: string;
  };
}

export enum MasterlistStatus {
  AKTIF = 'Aktif',
  TIDAK_AKTIF = 'Tidak Aktif'
}

export interface Masterlist {
  id: number;
  project_id: number;
  code: string;
  name: string;
  description?: string;
  status: MasterlistStatus;
  work_links?: Array<{ title: string; url: string }>;
  work_documents?: Array<{
    title: string;
    file_name: string;
    file_path: string;
    file_type?: string;
    file_size?: number;
    uploaded_at: string;
  }>;
  created_by?: number;
  created_at: string;
  updated_at: string;
  asset_count?: number;
  project?: {
    id: number;
    code: string;
    name: string;
    client_name?: string;
    main_con_id?: number;
    mainCon?: {
      id: number;
      name: string;
    };
  };
  creator?: {
    id: number;
    name?: string;
  };
}

export enum AssetStatus {
  AKTIF = 'Aktif',
  TIDAK_AKTIF = 'Tidak Aktif',
  ROSAK = 'Rosak',
  LUPUS = 'Lupus'
}

export interface AssetUser {
  id: number;
  asset_id: number;
  user_name: string;
  position?: string;
  department?: string;
  floor?: string;
  building?: string;
  location?: string;
  branch?: string;
  state?: string;
  created_at: string;
  updated_at: string;
}

export interface AssetAccessory {
  id: number;
  type: 'monitor' | 'keyboard' | 'mouse' | 'other';
  notes?: string | null;
  asset_id: number;
  asset_tag?: string | null;
  name?: string | null;
  category?: string | null;
}

export interface AssetParent {
  id: number;
  type: 'monitor' | 'keyboard' | 'mouse' | 'other';
  parent_asset_id: number;
  parent_asset_tag?: string;
  parent_name: string;
  parent_category?: string;
}

export interface AssetAttachment {
  id: number;
  file_name: string;
  display_name?: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  created_at: string;
}

export interface Asset {
  id: number;
  masterlist_id: number;
  asset_tag?: string;
  name: string;
  category_id?: number | null;
  brand_id?: number | null;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  group?: string;
  status: AssetStatus;
  notes?: string;
  custom_fields_values?: Record<string, any>;
  created_by?: number;
  updated_by?: number | null;
  created_at: string;
  updated_at: string;
  masterlist?: {
    id: number;
    project_id?: number;
    code: string;
    name: string;
    project?: {
      id: number;
      code: string;
      name: string;
    };
  };
  creator?: {
    id: number;
    name?: string;
  };
  updater?: {
    id: number;
    name?: string;
  };
  categoryOption?: {
    id: number;
    name: string;
  };
  brandOption?: {
    id: number;
    name: string;
  };
  attachments?: AssetAttachment[];
  accessories?: AssetAccessory[];
  parentAsset?: AssetParent;
  assetUsers?: AssetUser[];
}

export interface AssetUpdater {
  user_id: number;
  user_name: string;
  update_count: number;
  last_update: string;
}

export interface AssetUpdateLogEntry {
  id: number;
  asset_id: number;
  action_type: string;
  field_changes?: Record<string, { old: any; new: any }> | null;
  ip_address?: string;
  created_at: string;
  user?: { id: number; name: string } | null;
  asset?: {
    id: number;
    name: string;
    asset_tag?: string;
    status: string;
    serial_number?: string;
    masterlist?: {
      id: number;
      code: string;
      name: string;
      project?: { id: number; code: string; name: string } | null;
    } | null;
  } | null;
}

export interface Task {
  id: number;
  title: string;
  logNumber: string;
  description: string;
  supportType: Skill;
  supportTypeSettingId?: number;
  clientLocation: string;
  districtAddress?: string;
  state: string;
  deadline: string;
  deadlineTime?: string;
  requirementDate?: string;
  requirementTime?: string;
  offerPrice: number;
  status: TaskStatus;
  statusSettingId?: number;
  createdBy: number; // Staff ID
  assignedTo?: number; // Freelancer ID
  assignee?: { id: number; name?: string };
  creator?: { id: number; name?: string };
  created_at: string; // Creation timestamp
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
  waitingList?: Array<{
    id: number;
    freelancerId: number;
    freelancerName: string;
    position: number;
    createdAt: string;
  }>;
  // New Fields
  projectId?: number;
  project?: {
    id: number;
    code: string;
    name: string;
  };
  mainConId?: number;
  mainCon?: MainCon;
  picName?: string;
  picPhone?: string;
  clientName?: string;
  assetTagId?: string;
  assetBrand?: string;
  assetModel?: string;
  assetSerialNumber?: string;
  branchName?: string;
  equipmentTypes?: string[];
  receivedDate?: string;
  receivedTime?: string;
  irtDate?: string;
  irtTime?: string;
  serviceStartDate?: string;
  serviceStartTime?: string;
  serviceStopDate?: string;
  serviceStopTime?: string;
  arrivalConfirmedAt?: string;
  arrivalLatitude?: number;
  arrivalLongitude?: number;
  arrivalAccuracyMeters?: number;
  parts?: Array<{
    id?: number;
    partNumber: string;
    description: string;
    quantity: number;
  }>;
}

export interface TaskDone {
  id: number;
  task_id: number;
  freelancer_id: number;
  service_start_date?: string;
  action_taken?: string;
  remarks?: string;
  support_pdf_url?: string;
  files?: Array<{
    id: number;
    file_url: string;
    original_name: string;
    created_at: string;
  }>;
  submitted_at: string;
  created_at: string;
  updated_at: string;
  task?: Task;
  freelancer?: User;
}

export enum PaymentStatus {
  MENUNGGU_KELULUSAN = 'Menunggu Kelulusan',
  DILULUSKAN = 'Diluluskan',
  TELAH_DIBAYAR = 'Telah Dibayar'
}

export interface Payment {
  id: number;
  task_id: number;
  task_done_id: number;
  freelancer_id: number;
  amount: number;
  status: PaymentStatus;
  remarks?: string;
  recipient_name?: string;
  recipient_account_number?: string;
  recipient_bank_name?: string;
  recipient_email?: string;
  payment_reference?: string;
  payment_slip_url?: string;
  approved_by?: number;
  approved_at?: string;
  paid_by?: number;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  task?: {
    id: number;
    title: string;
    log_number?: string;
    deadline?: string;
    status?: TaskStatus | string;
    mainCon?: {
      id: number;
      name: string;
    };
  };
  taskDone?: {
    id: number;
    support_pdf_url?: string;
    submitted_at?: string;
  };
  freelancer?: {
    id: number;
    name: string;
    email?: string;
  };
  approver?: {
    id: number;
    name: string;
  };
  payer?: {
    id: number;
    name: string;
  };
}

export type DashboardView = 
  | 'dashboard' | 'tasks' | 'ai-instruction' | 'projects' 
  | 'masterlists' | 'assets' | 'freelancers' | 'reports' 
  | 'settings' | 'my-tasks' | 'payment-approvals' 
  | 'freelancer-profile' | 'notifications' | 'main-cons' 
  | 'completed-tasks' | 'doc';

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

export type SettingsView = 'hub' | 'profile' | 'mail' | 'templates' | 'api' | 'ai-integrations' | 'users' | 'roles' | 'audit' | 'task-settings' | 'asset-settings' | 'system-update';

export enum NotificationType {
    TASK_OFFER = 'Tawaran Tugasan',
    TASK_REMINDER = 'Peringatan Tugasan',
    REGISTRATION_FREELANCER = 'Pendaftaran Freelancer',
}

export interface NotificationTemplate {
    id: number;
    type: NotificationType;
    channel: 'E-mel' | 'Webhook' | 'Whatsapp' | 'Web Notification';
    name: string;
    subjectOrTitle: string;
    body: string;
    isDefault: boolean;
}

export type ReminderUnit = 'minutes' | 'hours' | 'days';

export interface ReminderOffsetConfig {
  value: number;
  unit: ReminderUnit;
}

export interface GlobalTaskReminderConfig {
  reminderType: 'attendance' | 'document_submission';
  offsets: ReminderOffsetConfig[];
  autoSendAtScheduledTime: boolean;
  channels: string[];
  templateId?: number;
  customMessage?: string;
  isActive: boolean;
}

export enum OfferStatus {
  PENDING = 'Pending',
  ACCEPTED = 'Accepted',
  REJECTED = 'Rejected',
  EXPIRED = 'Expired'
}

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  key?: string;
  status: 'active' | 'revoked';
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
  created_by?: number;
  creator?: { id: number; name?: string } | null;
}

export interface TaskOffer {
  id: number;
  taskId: number;
  freelancerId: number;
  status: OfferStatus;
  sentAt: string;
  respondedAt?: string;
  expiresAt: string;
  freelancer?: Freelancer;
}
