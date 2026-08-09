import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { runMigrations as runMigrationsFromFile } from '../migrations/runMigrations.ts';
import {
  User,
  UserProfile,
  FreelancerBankAccount,
  Role,
  RoleType,
  RolePermission,
  Task,
  FreelancerLocation,
  FreelancerSkill,
  TaskAttachment,
  TaskLink,
  TaskReport,
  TaskFeedback,
  ActivityLog,
  Notification,
  SystemSettings,
  UserSession,
  TaskOffer,
  TaskWaitingList,
  TaskDone,
  TaskDoneFile,
  Payment,
  WhatsAppMessage,
  AuditTrail,
  MainCon,
  TaskPart,
  TaskReminder,
  TaskStatusOption,
  SupportTypeOption,
  EquipmentCode,
  Project,
  Masterlist,
  MasterlistAsset,
  Asset,
  AssetCategoryOption,
  AssetBrandOption,
  AssetUser,
  AssetAccessory,
  AssetAttachment,
  AssetPairingHistory,
  AssetModelIntel,
  AssetUpdateLog,
  ApiKey
} from '../models/index.ts';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [
    User,
    UserProfile,
    FreelancerBankAccount,
    Role,
    RoleType,
    RolePermission,
    Task,
    FreelancerLocation,
    FreelancerSkill,
    TaskAttachment,
    TaskLink,
    TaskReport,
    TaskFeedback,
    ActivityLog,
    Notification,
    SystemSettings,
    UserSession,
    TaskOffer,
    TaskWaitingList,
    TaskDone,
    TaskDoneFile,
    Payment,
    WhatsAppMessage,
    AuditTrail,
    MainCon,
    TaskPart,
    TaskReminder,
    TaskStatusOption,
    SupportTypeOption,
    EquipmentCode,
    Project,
    Masterlist,
    MasterlistAsset,
    Asset,
    AssetCategoryOption,
    AssetBrandOption,
    AssetUser,
    AssetAccessory,
    AssetAttachment,
    AssetPairingHistory,
    AssetModelIntel,
    AssetUpdateLog,
    ApiKey
  ],
  connectTimeout: 30000,
  acquireTimeout: 60000,
  supportBigNumbers: true,
  bigNumberStrings: true,
  multipleStatements: false,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : undefined,
});

export const initializeDatabase = async (): Promise<void> => {
  if (AppDataSource.isInitialized) return;
  await AppDataSource.initialize();
  await runMigrationsFromFile(AppDataSource);
};

export const getDatabaseHealth = async () => {
  try {
    if (!AppDataSource.isInitialized) {
      return { connected: false, poolSize: 0, activeConnections: 0, idleConnections: 0 };
    }

    await AppDataSource.query('SELECT 1');

    const result = await AppDataSource.query(
      "SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Max_used_connections')"
    );

    const stats = result.reduce((acc: any, row: any) => {
      acc[row.Variable_name] = parseInt(row.Value);
      return acc;
    }, {});

    return {
      connected: true,
      poolSize: stats.Threads_connected || 0,
      activeConnections: stats.Threads_running || 0,
      idleConnections: (stats.Threads_connected || 0) - (stats.Threads_running || 0)
    };
  } catch (error) {
    console.error('Database health check failed:', error);
    return { connected: false, poolSize: 0, activeConnections: 0, idleConnections: 0 };
  }
};

export const buildSecureConnectionString = (): string => {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;
  return `mysql://${host}:${port}/${database}`;
};

export async function runMigrations() {
  return runMigrationsFromFile(AppDataSource);
}
