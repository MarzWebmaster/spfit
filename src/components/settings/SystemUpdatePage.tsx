import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Terminal } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { systemApi } from '../../services/api';

interface SystemUpdatePageProps {
  onBack: () => void;
}

interface UpdateStatus {
  branch: string;
  currentCommit?: string | null;
  latestCommit?: string | null;
  hasUpdate?: boolean;
  isUpdating?: boolean;
  scriptConfigured?: boolean;
  scriptPath?: string | null;
  logPath?: string;
  lastCheckedAt?: string | null;
  lastRunAt?: string | null;
  lastFinishedAt?: string | null;
  lastResult?: 'idle' | 'success' | 'failed' | 'running';
  lastError?: string | null;
  lastOutput?: string[];
}

const shortCommit = (commit?: string | null) => {
  if (!commit) return '-';
  return commit.length > 10 ? commit.slice(0, 10) : commit;
};

type LogLevel = 'error' | 'warn' | 'success' | 'step' | 'info' | 'plain';

interface LogEntry {
  timestamp: string | null;
  tag: string | null;
  message: string;
  level: LogLevel;
}

const parseLogLine = (line: string): LogEntry => {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s+(\[[^\]]+\])\s+([\s\S]*)$/);
  if (match) {
    const [, timestamp, tag, message] = match;
    let level: LogLevel = 'info';
    if (tag === '[ERR]') level = 'error';
    else if (/^\[\d+\/\d+\]$/.test(tag)) level = 'step';
    else if (/berjaya|success|selesai/i.test(message) && tag !== '[ERR]') level = 'success';
    return { timestamp, tag, message, level };
  }
  let level: LogLevel = 'plain';
  if (/^npm warn/i.test(line)) level = 'warn';
  else if (/^npm error|error/i.test(line)) level = 'error';
  return { timestamp: null, tag: null, message: line, level };
};

const formatLogTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return iso.slice(11, 19);
  }
};

const formatLogDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso.slice(0, 10);
  }
};

const getLevelBg = (level: LogLevel) => {
  if (level === 'error') return 'bg-red-950/40';
  if (level === 'warn') return 'bg-amber-950/30';
  if (level === 'success') return 'bg-green-950/30';
  if (level === 'step') return 'bg-sky-950/20';
  return '';
};

const getTagColor = (level: LogLevel, tag: string) => {
  if (level === 'error') return 'text-red-400';
  if (level === 'success') return 'text-green-400';
  if (level === 'step') return 'text-sky-400';
  return 'text-gray-400';
};

const getTextColor = (level: LogLevel) => {
  if (level === 'error') return 'text-red-300';
  if (level === 'warn') return 'text-amber-300';
  if (level === 'success') return 'text-green-300';
  if (level === 'step') return 'text-gray-100';
  if (level === 'plain') return 'text-gray-400';
  return 'text-gray-200';
};

const getLatestSession = (lines: string[]): string[] => {
  let lastIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('Update dimulakan')) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx === -1) return lines;
  // include up to 2 lines before (e.g. "Check update selesai")
  return lines.slice(Math.max(0, lastIdx - 2));
};

export const SystemUpdatePage: React.FC<SystemUpdatePageProps> = ({ onBack }) => {
  const [branch, setBranch] = useState('main');
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const statusBadge = useMemo(() => {
    const value = status?.lastResult || 'idle';
    if (value === 'running') return 'bg-blue-100 text-blue-700';
    if (value === 'success') return 'bg-green-100 text-green-700';
    if (value === 'failed') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  }, [status?.lastResult]);

  const statusLabel = useMemo(() => {
    if (status?.lastResult === 'running') return 'Sedang dikemaskini';
    if (status?.lastResult === 'success') return 'Berjaya';
    if (status?.lastResult === 'failed') return 'Gagal';
    return 'Idle';
  }, [status?.lastResult]);

  const statusInfoMessage = useMemo(() => {
    if (!status) return null;
    if (status.isUpdating) return 'Update sedang dijalankan. Sila tunggu sehingga selesai.';
    if (status.lastResult === 'success') {
      return status.hasUpdate
        ? 'Update sebelumnya berjaya. Terdapat update baru lagi.'
        : 'Update berjaya. Sistem kini sudah berada pada versi terkini.';
    }
    if (status.lastResult === 'failed') return 'Update gagal. Sila semak log dan cuba lagi.';
    return null;
  }, [status]);

  const latestSessionEntries = useMemo(() => {
    const raw = status?.lastOutput ?? [];
    const session = getLatestSession(raw);
    return session.map(parseLogLine).reverse();
  }, [status?.lastOutput]);

  const sessionStartTime = useMemo(() => {
    for (const e of latestSessionEntries) {
      if (e.timestamp && e.message.includes('Update dimulakan')) return e.timestamp;
    }
    return latestSessionEntries.find(e => e.timestamp)?.timestamp ?? null;
  }, [latestSessionEntries]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [latestSessionEntries]);

  const loadStatus = async (clearLogs = false) => {
    try {
      const response = await systemApi.getUpdateStatus(clearLogs);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Gagal memuat status update');
      }

      const data = response.data as UpdateStatus;
      setStatus(data);
      if (data.branch) {
        setBranch(data.branch);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal memuat status updater.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    await loadStatus(true);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!status || !message) return;

    if (message.text === 'Proses update telah dimulakan. Sila tunggu sehingga status selesai.' && !status.isUpdating) {
      if (status.lastResult === 'success') {
        setMessage({ type: 'success', text: status.hasUpdate ? 'Update selesai. Terdapat update baru lagi.' : 'Update selesai. Sistem kini sudah berada pada versi terkini.' });
      } else if (status.lastResult === 'failed') {
        setMessage({ type: 'error', text: 'Update selesai tetapi gagal. Sila semak log dan cuba lagi.' });
      } else {
        setMessage(null);
      }
    }
  }, [status, message]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadStatus();
    }, status?.isUpdating ? 4000 : 10000);

    return () => clearInterval(timer);
  }, [status?.isUpdating]);

  const handleCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const response = await systemApi.checkUpdate(branch.trim() || undefined);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Gagal semak update');
      }

      const data = response.data as UpdateStatus;
      setStatus(data);
      setMessage({
        type: 'success',
        text: data.hasUpdate ? 'Update baru ditemui.' : 'Sistem sudah guna versi terkini.'
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal semak update.' });
    } finally {
      setChecking(false);
    }
  };

  const handleApply = async () => {
    const confirmed = window.confirm('Sistem akan trigger skrip update server. Pastikan backup script telah dikonfigurasi. Teruskan?');
    if (!confirmed) return;

    setApplying(true);
    setMessage(null);
    try {
      const response = await systemApi.applyUpdate(branch.trim() || undefined);
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Gagal mula update');
      }

      setStatus(response.data as UpdateStatus);
      setMessage({ type: 'success', text: 'Proses update telah dimulakan. Sila tunggu sehingga status selesai.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.message || 'Gagal mula update.' });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-600">Memuatkan modul update sistem...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ChevronLeft className="h-6 w-6 text-gray-600" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Kemaskini Sistem</h1>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {statusInfoMessage && (
        <div className={`p-3 rounded-md text-sm ${status?.lastResult === 'success' ? 'bg-green-100 text-green-700' : status?.lastResult === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
          {statusInfoMessage}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            id="update-branch"
            label="Branch"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
          />
          <div className="md:col-span-2 flex flex-wrap items-end gap-2">
            <Button onClick={handleCheck} disabled={checking || Boolean(status?.isUpdating)}>
              {checking ? 'Menyemak...' : 'Check Update'}
            </Button>
            <Button onClick={handleApply} disabled={applying || Boolean(status?.isUpdating) || !status?.scriptConfigured}>
              {applying ? 'Memulakan...' : 'Apply Update'}
            </Button>
            <Button variant="secondary" onClick={handleRefreshStatus}>Refresh Status</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div><span className="font-semibold text-gray-700">Current Commit:</span> {shortCommit(status?.currentCommit)}</div>
          <div><span className="font-semibold text-gray-700">Latest Commit:</span> {shortCommit(status?.latestCommit)}</div>
          <div><span className="font-semibold text-gray-700">Has Update:</span> {status?.hasUpdate ? 'Ya' : 'Tidak'}</div>
          <div><span className="font-semibold text-gray-700">Is Updating:</span> {status?.isUpdating ? 'Ya' : 'Tidak'}</div>
          <div><span className="font-semibold text-gray-700">Script Configured:</span> {status?.scriptConfigured ? 'Ya' : 'Tidak'}</div>
          <div><span className="font-semibold text-gray-700">Result:</span> <span className={`px-2 py-1 rounded text-xs ${statusBadge}`}>{status?.lastResult || 'idle'}</span></div>
          <div className="md:col-span-2"><span className="font-semibold text-gray-700">Script Path:</span> {status?.scriptPath || '-'}</div>
          <div className="md:col-span-2"><span className="font-semibold text-gray-700">Log Path:</span> {status?.logPath || '-'}</div>
          <div><span className="font-semibold text-gray-700">Last Checked:</span> {status?.lastCheckedAt || '-'}</div>
          <div><span className="font-semibold text-gray-700">Last Finished:</span> {status?.lastFinishedAt || '-'}</div>
        </div>

        {status?.lastError && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {status.lastError}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Log Sesi Terkini</h2>
            {sessionStartTime && (
              <span className="text-xs text-gray-400">
                — {formatLogDate(sessionStartTime)}, {formatLogTime(sessionStartTime)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {latestSessionEntries.length > 0 && (
              <span className="text-xs text-gray-400">{latestSessionEntries.length} baris</span>
            )}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div
          ref={logRef}
          className="bg-gray-950 font-mono text-xs max-h-96 overflow-y-auto"
        >
          {latestSessionEntries.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-gray-500">
              Tiada log sesi setakat ini.
            </div>
          ) : (
            latestSessionEntries.map((entry, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 px-4 py-1.5 border-b border-gray-800/20 last:border-0 ${getLevelBg(entry.level)}`}
              >
                {entry.timestamp ? (
                  <span className="shrink-0 text-gray-500 w-16 pt-px">{formatLogTime(entry.timestamp)}</span>
                ) : (
                  <span className="shrink-0 w-16" />
                )}
                {entry.tag ? (
                  <span className={`shrink-0 font-bold w-14 ${getTagColor(entry.level, entry.tag)}`}>{entry.tag}</span>
                ) : (
                  <span className="shrink-0 w-14" />
                )}
                <span className={`break-all leading-relaxed ${getTextColor(entry.level)}`}>{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
