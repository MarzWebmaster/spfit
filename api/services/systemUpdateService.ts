import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { AppDataSource } from '../config/database.ts';
import { Notification, NotificationType } from '../models/Notification.ts';
import { User, UserStatus } from '../models/User.ts';

const execFileAsync = promisify(execFile);

/** Read a single key from the root .env file (no external dep needed). */
function readEnvKey(key: string): string | null {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (trimmed.slice(0, eqIdx).trim() === key) {
        return trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch { /* .env not found — ignore */ }
  return null;
}

export interface SystemUpdateStatus {
  repoPath: string;
  branch: string;
  currentCommit: string | null;
  latestCommit: string | null;
  hasUpdate: boolean;
  isUpdating: boolean;
  scriptConfigured: boolean;
  scriptPath: string | null;
  logPath: string;
  lastCheckedAt: string | null;
  lastRunAt: string | null;
  lastFinishedAt: string | null;
  lastResult: 'idle' | 'success' | 'failed' | 'running';
  lastError: string | null;
  lastOutput: string[];
  versionHistoryPath?: string;
}

export interface VersionHistory {
  version: string; // ISO timestamp
  branch: string;
  fromCommit: string;
  toCommit: string;
  result: 'success' | 'failed';
  errorMessage?: string;
  backupPath?: string;
  timestamp: string;
  logs: string[];
}

export interface LogPage {
  logs: string[];
  totalLines: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

interface UpdateBackupInfo {
  backupTag: string;
  dbBackupPath: string | null;
  systemBackupDir: string;
  commitBeforeUpdate: string;
}

interface GetStatusOptions {
  resetLastOutput?: boolean;
}

class SystemUpdateService {
  private status: SystemUpdateStatus;
  private maxLogLines = 80;
  private notificationRepository = AppDataSource.getRepository(Notification);
  private userRepository = AppDataSource.getRepository(User);

  constructor() {
    const repoPath = process.env.SYSTEM_UPDATE_REPO_PATH || process.cwd();
    const branch = process.env.SYSTEM_UPDATE_BRANCH || 'main';
    const scriptPath = process.env.SYSTEM_UPDATE_SCRIPT_PATH || 'internal-workflow';
    const logPath = process.env.SYSTEM_UPDATE_LOG_PATH || path.join(repoPath, 'temp', 'logs', 'system-update.log');
    const versionHistoryPath = path.join(path.dirname(logPath), 'version-history.json');

    this.status = {
      repoPath,
      branch,
      currentCommit: null,
      latestCommit: null,
      hasUpdate: false,
      isUpdating: false,
      scriptConfigured: true,
      scriptPath,
      logPath,
      versionHistoryPath,
      lastCheckedAt: null,
      lastRunAt: null,
      lastFinishedAt: null,
      lastResult: 'idle',
      lastError: null,
      lastOutput: []
    };
  }

  private sanitizeBranch(branch: string): string {
    const normalized = String(branch || '').trim();
    if (!normalized) return this.status.branch;

    if (!/^[A-Za-z0-9._/-]{1,80}$/.test(normalized)) {
      throw new Error('Nama branch tidak sah.');
    }

    return normalized;
  }

  private getTokenOrThrow(): string {
    const token = process.env.GITHUB_TOKEN || readEnvKey('GITHUB_TOKEN');
    if (!token) {
      throw new Error('GITHUB_TOKEN tidak ditemui dalam .env. Update guna PAT sahaja.');
    }
    return token;
  }

  private pushOutput(line: string) {
    const text = String(line || '').trim();
    if (!text) return;

    this.status.lastOutput.push(`${new Date().toISOString()} ${text}`);
    if (this.status.lastOutput.length > this.maxLogLines) {
      this.status.lastOutput = this.status.lastOutput.slice(this.status.lastOutput.length - this.maxLogLines);
    }
  }

  private resetLastOutput(seedMessage?: string) {
    this.status.lastOutput = [];
    if (seedMessage) {
      this.pushOutput(seedMessage);
    }
  }

  private getSafeGitEnv() {
    return {
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_ASKPASS: 'echo',
      SSH_ASKPASS: 'echo'
    };
  }

  private async runProgram(command: string, args: string[], timeout = 60000): Promise<string> {
    const { stdout } = await execFileAsync(command, args, {
      cwd: this.status.repoPath,
      env: this.getSafeGitEnv(),
      timeout
    });
    return String(stdout || '').trim();
  }

  private gitArgs(extraArgs: string[]): string[] {
    const token = this.getTokenOrThrow();
    const basicAuth = Buffer.from(`x-access-token:${token}`).toString('base64');
    return ['-c', `http.extraheader=Authorization: Basic ${basicAuth}`, ...extraArgs];
  }

  private async runGit(extraArgs: string[], timeout = 60000): Promise<string> {
    return this.runProgram('git', this.gitArgs(extraArgs), timeout);
  }

  private async runNodeScript(scriptRelativePath: string, scriptArgs: string[] = [], timeout = 300000): Promise<string> {
    const scriptAbs = path.join(this.status.repoPath, scriptRelativePath);
    return this.runProgram(process.execPath, [scriptAbs, ...scriptArgs], timeout);
  }

  private async runNpm(args: string[], timeout = 600000): Promise<string> {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    return this.runProgram(npmCmd, args, timeout);
  }

  private async getCurrentCommit(): Promise<string> {
    return this.runGit(['rev-parse', 'HEAD']);
  }

  private async getLatestCommit(branch: string): Promise<string> {
    const stdout = await this.runGit(['ls-remote', 'origin', `refs/heads/${branch}`], 15000);
    const output = String(stdout || '').trim();
    const commit = output.split(/\s+/)[0] || '';

    if (!commit) {
      throw new Error(`Gagal dapatkan commit terkini untuk branch ${branch}.`);
    }

    return commit;
  }

  private async ensureCleanWorkingTree(): Promise<void> {
    const porcelain = await this.runGit(['status', '--porcelain']);
    if (porcelain.trim()) {
      throw new Error('Working tree tidak bersih. Commit/stash perubahan sebelum update.');
    }
  }

  private createBackupTag(): string {
    return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  }

  private getBackupRoot(): string {
    // BACKUP_PATH must be set outside synced folders (NextCloud etc).
    // Falls back to temp/ inside project only if not configured.
    const envBackupPath = process.env.BACKUP_PATH || readEnvKey('BACKUP_PATH');
    return envBackupPath
      ? path.join(path.resolve(envBackupPath), 'system-backups')
      : path.join(this.status.repoPath, 'temp', 'system-backups');
  }

  private async backupSystemFiles(backupTag: string, commitBeforeUpdate: string): Promise<string> {
    const backupRoot = this.getBackupRoot();
    const backupDir = path.join(backupRoot, backupTag);
    const systemDir = path.join(backupDir, 'system');
    await fsp.mkdir(systemDir, { recursive: true });

    const envPath = path.join(this.status.repoPath, '.env');
    if (fs.existsSync(envPath)) {
      await fsp.copyFile(envPath, path.join(systemDir, '.env'));
    }

    const uploadsPath = path.join(this.status.repoPath, 'uploads');
    if (fs.existsSync(uploadsPath)) {
      await fsp.cp(uploadsPath, path.join(systemDir, 'uploads'), { recursive: true, force: true });
    }

    await this.runGit(['archive', '--format=tar', '-o', path.join(backupDir, 'source.tar'), 'HEAD']);

    await fsp.writeFile(
      path.join(backupDir, 'metadata.json'),
      JSON.stringify({
        backupTag,
        branch: this.status.branch,
        commitBeforeUpdate,
        createdAt: new Date().toISOString(),
      }, null, 2),
      'utf8'
    );

    return backupDir;
  }

  private async backupDatabase(): Promise<string | null> {
    try {
      const stdout = await this.runNodeScript(path.join('scripts', 'backup-mysql-database.mjs'), [], 600000);
      const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      const backupPath = lines[lines.length - 1] || '';
      if (!backupPath) return null;
      return path.isAbsolute(backupPath) ? backupPath : path.join(this.status.repoPath, backupPath);
    } catch (error) {
      this.pushOutput('[ERR] Backup DB gagal dibuat.');
      throw error;
    }
  }

  private async restoreSystemFiles(systemBackupDir: string): Promise<void> {
    const systemDir = path.join(systemBackupDir, 'system');
    const backupEnv = path.join(systemDir, '.env');
    const backupUploads = path.join(systemDir, 'uploads');

    if (fs.existsSync(backupEnv)) {
      await fsp.copyFile(backupEnv, path.join(this.status.repoPath, '.env'));
    }

    if (fs.existsSync(backupUploads)) {
      await fsp.rm(path.join(this.status.repoPath, 'uploads'), { recursive: true, force: true });
      await fsp.cp(backupUploads, path.join(this.status.repoPath, 'uploads'), { recursive: true, force: true });
    }
  }

  private async restoreDatabase(backupSqlPath: string | null): Promise<void> {
    if (!backupSqlPath || !fs.existsSync(backupSqlPath)) {
      throw new Error('Fail backup DB untuk rollback tidak ditemui.');
    }

    await this.runNodeScript(
      path.join('scripts', 'import-sql-dump.mjs'),
      [backupSqlPath],
      600000
    );
  }

  private async notifyAdmins(title: string, message: string, actorUserId?: number): Promise<void> {
    if (!AppDataSource.isInitialized) return;

    const admins = await this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.status = :status', { status: UserStatus.AKTIF })
      .andWhere('LOWER(role.name) LIKE :adminName', { adminName: '%admin%' })
      .getMany();

    const recipientIds = new Set<number>(admins.map((user) => user.id));
    if (actorUserId) recipientIds.add(actorUserId);

    const records = Array.from(recipientIds).map((userId) => this.notificationRepository.create({
      user_id: userId,
      type: NotificationType.SYSTEM_ANNOUNCEMENT,
      title,
      message,
      is_read: false,
    }));

    if (records.length > 0) {
      await this.notificationRepository.save(records);
    }
  }

  private async performUpdateWorkflow(branch: string, actorUserId?: number): Promise<void> {
    let backupInfo: UpdateBackupInfo | null = null;

    try {
      this.getTokenOrThrow();
      await this.ensureCleanWorkingTree();

      const commitBeforeUpdate = await this.getCurrentCommit();
      this.status.currentCommit = commitBeforeUpdate;
      this.pushOutput(`[1/7] Commit semasa: ${commitBeforeUpdate.slice(0, 8)}`);

      const backupTag = this.createBackupTag();
      this.pushOutput('[2/7] Backup database sedang dibuat...');
      const dbBackupPath = await this.backupDatabase();
      this.pushOutput(dbBackupPath ? `Backup DB: ${dbBackupPath}` : 'Backup DB tidak dipulangkan path.');

      this.pushOutput('[3/7] Backup fail sistem sedang dibuat...');
      const systemBackupDir = await this.backupSystemFiles(backupTag, commitBeforeUpdate);
      this.pushOutput(`Backup sistem: ${systemBackupDir}`);

      backupInfo = {
        backupTag,
        dbBackupPath,
        systemBackupDir,
        commitBeforeUpdate,
      };

      this.pushOutput(`[4/7] Fetch update branch ${branch}...`);
      await this.runGit(['fetch', 'origin', branch], 120000);
      const latestCommit = await this.runGit(['rev-parse', `origin/${branch}`]);
      this.status.latestCommit = latestCommit;

      if (latestCommit === commitBeforeUpdate) {
        this.status.hasUpdate = false;
        this.status.lastResult = 'success';
        this.status.lastError = null;
        this.status.lastFinishedAt = new Date().toISOString();
        this.status.isUpdating = false;
        this.pushOutput('Tiada update baharu. Sistem sudah terkini.');
        await this.notifyAdmins('Semakan Update Sistem', `Semakan update branch ${branch}: tiada update baharu.`, actorUserId);
        return;
      }

      this.status.hasUpdate = true;
      this.pushOutput(`[5/7] Apply update ke commit ${latestCommit.slice(0, 8)}...`);
      await this.runGit(['checkout', branch], 30000);
      await this.runGit(['merge', '--ff-only', `origin/${branch}`], 120000);

      this.pushOutput('[6/7] Verify update: npm ci + build + check...');
      await this.runNpm(['ci'], 600000);
      await this.runNpm(['run', 'build:update-safe'], 600000);

      const currentCommitAfterUpdate = await this.getCurrentCommit();
      this.status.currentCommit = currentCommitAfterUpdate;
      this.status.lastCheckedAt = new Date().toISOString();
      this.status.lastResult = 'success';
      this.status.lastError = null;
      this.status.lastFinishedAt = new Date().toISOString();
      this.status.isUpdating = false;

      this.pushOutput('[7/7] Update berjaya disahkan.');
      
      // Save version history
      await this.saveVersionHistory(
        commitBeforeUpdate,
        currentCommitAfterUpdate,
        'success',
        undefined,
        backupInfo?.systemBackupDir
      );

      await this.notifyAdmins(
        'Update Sistem Berjaya',
        `Update branch ${branch} berjaya. ${commitBeforeUpdate.slice(0, 8)} -> ${currentCommitAfterUpdate.slice(0, 8)}`,
        actorUserId
      );
    } catch (error: any) {
      const baseError = error?.message || 'Unknown update error';
      this.pushOutput(`[ERR] Update gagal: ${baseError}`);

      let rollbackMessage = 'Rollback tidak dijalankan.';

      if (backupInfo) {
        try {
          this.pushOutput('Rollback dimulakan...');
          await this.runGit(['reset', '--hard', backupInfo.commitBeforeUpdate], 120000);
          await this.restoreSystemFiles(backupInfo.systemBackupDir);
          await this.restoreDatabase(backupInfo.dbBackupPath);
          rollbackMessage = `Rollback berjaya ke commit ${backupInfo.commitBeforeUpdate.slice(0, 8)}.`;
          this.pushOutput(rollbackMessage);
          this.status.currentCommit = backupInfo.commitBeforeUpdate;
          this.status.hasUpdate = true;
        } catch (rollbackError: any) {
          rollbackMessage = `Rollback gagal: ${rollbackError?.message || 'Unknown rollback error'}`;
          this.pushOutput(`[ERR] ${rollbackMessage}`);
        }
      }

      this.status.lastResult = 'failed';
      this.status.lastError = `${baseError} | ${rollbackMessage}`;
      this.status.lastFinishedAt = new Date().toISOString();
      this.status.isUpdating = false;

      // Save failed version history
      await this.saveVersionHistory(
        backupInfo?.commitBeforeUpdate || (await this.getCurrentCommit()),
        (await this.getCurrentCommit()),
        'failed',
        this.status.lastError,
        backupInfo?.systemBackupDir
      );

      await this.notifyAdmins(
        'Update Sistem Gagal',
        `Update branch ${branch} gagal. ${baseError}. ${rollbackMessage}`,
        actorUserId
      );
    }
  }

  getStatus(options?: GetStatusOptions): SystemUpdateStatus {
    if (options?.resetLastOutput) {
      this.resetLastOutput('Status disegar semula.');
    }
    return { ...this.status, lastOutput: [...this.status.lastOutput] };
  }

  async checkForUpdate(branchInput?: string): Promise<SystemUpdateStatus> {
    const branch = this.sanitizeBranch(branchInput || this.status.branch);

    this.status.branch = branch;
    this.status.lastError = null;
    this.resetLastOutput(`Semakan update dimulakan untuk branch ${branch}.`);

    const currentCommit = await this.getCurrentCommit();
    const latestCommit = await this.getLatestCommit(branch);

    this.status.currentCommit = currentCommit;
    this.status.latestCommit = latestCommit;
    this.status.hasUpdate = currentCommit !== latestCommit;
    this.status.lastCheckedAt = new Date().toISOString();
    this.pushOutput(`Check update selesai. hasUpdate=${this.status.hasUpdate}`);

    return this.getStatus();
  }

  async startUpdate(branchInput?: string, actorUserId?: number): Promise<SystemUpdateStatus> {
    if (this.status.isUpdating) {
      throw new Error('Proses update sedang berjalan.');
    }

    const branch = this.sanitizeBranch(branchInput || this.status.branch);
    this.status.branch = branch;

    fs.mkdirSync(path.dirname(this.status.logPath), { recursive: true });

    this.status.isUpdating = true;
    this.status.lastResult = 'running';
    this.status.lastError = null;
    this.status.lastRunAt = new Date().toISOString();
    this.resetLastOutput();
    this.pushOutput(`Update dimulakan (PAT auth). branch=${branch}`);

    void this.performUpdateWorkflow(branch, actorUserId);

    return this.getStatus();
  }

  /**
   * Save version history after update completes
   */
  async saveVersionHistory(
    fromCommit: string,
    toCommit: string,
    result: 'success' | 'failed',
    errorMessage?: string,
    backupPath?: string
  ): Promise<void> {
    try {
      const historyDir = path.dirname(this.status.versionHistoryPath || '');
      fs.mkdirSync(historyDir, { recursive: true });

      let history: VersionHistory[] = [];
      const historyPath = this.status.versionHistoryPath!;

      // Load existing history
      if (fs.existsSync(historyPath)) {
        try {
          const content = fs.readFileSync(historyPath, 'utf-8');
          history = JSON.parse(content);
        } catch {
          // If file is corrupt, start fresh
          history = [];
        }
      }

      // Add new entry at the beginning (latest first)
      const newEntry: VersionHistory = {
        version: new Date().toISOString(),
        branch: this.status.branch,
        fromCommit,
        toCommit,
        result,
        errorMessage,
        backupPath,
        timestamp: new Date().toISOString(),
        logs: [...this.status.lastOutput]
      };

      history.unshift(newEntry);

      // Keep only last 100 versions
      if (history.length > 100) {
        history = history.slice(0, 100);
      }

      // Save history
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');

      // Archive old logs
      await this.archiveCurrentLogs();
    } catch (error) {
      console.error('Error saving version history:', error);
    }
  }

  /**
   * Archive current logs to separate file
   */
  private async archiveCurrentLogs(): Promise<void> {
    try {
      const logPath = this.status.logPath;
      if (!fs.existsSync(logPath)) return;

      const logsDir = path.dirname(logPath);
      const archiveDir = path.join(logsDir, 'archive');
      fs.mkdirSync(archiveDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
      const archiveName = `system-update-${timestamp}.log`;
      const archivePath = path.join(archiveDir, archiveName);

      // Move current log to archive
      if (fs.existsSync(logPath)) {
        fs.copyFileSync(logPath, archivePath);
        fs.writeFileSync(logPath, '', 'utf-8');
      }
    } catch (error) {
      console.error('Error archiving logs:', error);
    }
  }

  /**
   * Get version history with latest versions first
   */
  getVersionHistory(): VersionHistory[] {
    try {
      const historyPath = this.status.versionHistoryPath;
      if (!historyPath || !fs.existsSync(historyPath)) {
        return [];
      }

      const content = fs.readFileSync(historyPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading version history:', error);
      return [];
    }
  }

  /**
   * Get paginated logs from history or current logs
   */
  getSystemUpdateLogs(page: number = 1, pageSize: number = 50): LogPage {
    try {
      const allLogs: string[] = [];

      // Get current logs
      allLogs.push(...this.status.lastOutput);

      // Get archived logs
      const archiveDir = path.join(path.dirname(this.status.logPath), 'archive');
      if (fs.existsSync(archiveDir)) {
        const files = fs.readdirSync(archiveDir)
          .sort()
          .reverse(); // Most recent first

        for (const file of files) {
          const filePath = path.join(archiveDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n').filter(line => line.trim());
          allLogs.push(...lines);
        }
      }

      const totalLines = allLogs.length;
      const startIdx = Math.max(0, totalLines - page * pageSize);
      const endIdx = totalLines - (page - 1) * pageSize;
      const paginatedLogs = allLogs.slice(startIdx, endIdx);

      return {
        logs: paginatedLogs,
        totalLines,
        page,
        pageSize,
        hasMore: startIdx > 0
      };
    } catch (error) {
      console.error('Error getting system update logs:', error);
      return {
        logs: [],
        totalLines: 0,
        page,
        pageSize,
        hasMore: false
      };
    }
  }
}

export const systemUpdateService = new SystemUpdateService();
