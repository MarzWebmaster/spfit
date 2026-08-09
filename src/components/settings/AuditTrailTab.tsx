
import React, { useState, useEffect } from 'react';
import { auditApi, usersApi } from '../../services/api';
import { 
  Search, 
  Filter, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Eye,
  Activity,
  User as UserIcon,
  RefreshCw
} from 'lucide-react';

interface Props {
  initialSearch?: string;
  initialTableName?: string;
}

const AuditTrailTab: React.FC<Props> = ({ initialSearch, initialTableName }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit] = useState(10);
  
  // Filters
  const [search, setSearch] = useState(initialSearch || '');
  const [actionType, setActionType] = useState('');
  const [tableName, setTableName] = useState(initialTableName || '');
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dropdown data
  const [users, setUsers] = useState<any[]>([]);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const startRecord = totalRecords === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = totalRecords === 0 ? 0 : Math.min(page * limit, totalRecords);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, actionType, tableName, userId, startDate, endDate]);
  
  useEffect(() => {
    if (initialSearch || initialTableName) {
      if (initialSearch) setSearch(initialSearch);
      if (initialTableName) setTableName(initialTableName);
      setPage(1);
      // Pass overrides because state updates are not immediate in this scope
      fetchLogs({ 
        search: initialSearch ?? search, 
        tableName: initialTableName ?? tableName 
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSearch, initialTableName]);

  const fetchUsers = async () => {
    try {
        // Fetch all users for filter (simplified)
        const res = await usersApi.getAll(1, 100);
        if (res.success && res.data) {
            // Support both structures just in case
            const usersList = (res.data as any).users || (res.data as any).data || [];
            setUsers(usersList);
        }
    } catch (e) {
        console.error("Failed to load users", e);
    }
  }

  const fetchLogs = async (overrides: any = {}) => {
    setLoading(true);
    try {
      const querySearch = overrides.search !== undefined ? overrides.search : search;
      const queryTableName = overrides.tableName !== undefined ? overrides.tableName : tableName;

      const response = await auditApi.getLogs({
        page,
        limit,
        search: querySearch,
        actionType,
        tableName: queryTableName,
        userId,
        startDate,
        endDate
      });

      if (response.success && response.data) {
        const payload: any = response.data;
        const pagination = payload.pagination || {};
        setLogs(payload.data || []);
        setTotalPages(pagination.totalPages || payload.totalPages || 1);
        setTotalRecords(pagination.total || payload.total || 0);
      } else {
        setLogs([]);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleExport = async () => {
    try {
        const res = await auditApi.exportLogs({
            startDate, endDate, actionType, tableName, userId
        });
        if (res.success && res.data?.url) {
            // Add auth token to url if needed, or rely on cookie/session if API allows
            // Here we assume the export endpoint needs token in header, so direct link might fail if auth is strict
            // For now, we'll try opening it. If it fails, we need to fetch blob.
            const token = localStorage.getItem('authToken');
            const url = `/api${res.data.url}`;
            
            // Fetch as blob to include auth header
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
    } catch (error) {
        console.error("Export failed", error);
        alert("Gagal memuat turun laporan.");
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'CREATE': return 'bg-green-100 text-green-800';
      case 'UPDATE': return 'bg-yellow-100 text-yellow-800';
      case 'DELETE': return 'bg-red-100 text-red-800';
      case 'VIEW': return 'bg-blue-100 text-blue-800';
      case 'SYSTEM': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEmailStatusBadge = (log: any) => {
    if (log?.table_name !== 'email_outbox') return null;
    const status = String(log?.new_values?.status || '').toLowerCase();
    if (!status) return null;

    const style =
      status === 'sent'
        ? 'bg-green-100 text-green-700'
        : status === 'failed'
          ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-700';

    return (
      <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${style}`}>
        {status}
      </span>
    );
  };

  const formatValue = (val: any) => {
      if (val === null || val === undefined) return '-';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Jejak Audit</h2>
          <p className="mt-1 text-sm text-gray-500">
            Lihat semua aktiviti dan perubahan dalam sistem.
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
        >
          <Download className="h-4 w-4 mr-2" />
          Eksport CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border border-gray-200 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTableName('');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tableName === '' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Semua Channel
          </button>
          <button
            type="button"
            onClick={() => {
              setTableName('email_outbox');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tableName === 'email_outbox' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Email Outbox
          </button>
          <button
            type="button"
            onClick={() => {
              setTableName('smtp_test_email');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tableName === 'smtp_test_email' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            SMTP Test
          </button>
          <button
            type="button"
            onClick={() => {
              setTableName('notifications');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tableName === 'notifications' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            Notifikasi App
          </button>
          <button
            type="button"
            onClick={() => {
              setTableName('message_queue');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${tableName === 'message_queue' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            WhatsApp Queue
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1">
             <label className="block text-sm font-medium text-gray-700 mb-1">Carian</label>
             <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Cari deskripsi..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                />
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Tindakan</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
            >
              <option value="">Semua</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="VIEW">View</option>
              <option value="LOGIN">Login</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Pengguna</label>
             <select
               value={userId}
               onChange={(e) => setUserId(e.target.value)}
               className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
             >
               <option value="">Semua Pengguna</option>
               {users.map(u => (
                   <option key={u.id} value={u.id}>{u.name}</option>
               ))}
             </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entiti / Table</label>
            <select
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
            >
              <option value="">Semua Entiti</option>
              <option value="email_outbox">email_outbox</option>
              <option value="smtp_test_email">smtp_test_email</option>
              <option value="notifications">notifications</option>
              <option value="message_queue">message_queue</option>
              <option value="tasks">tasks</option>
              <option value="users">users</option>
              <option value="payments">payments</option>
              <option value="system_settings">system_settings</option>
            </select>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-1">Tarikh Mula</label>
             <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
             />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        {loading ? (
           <div className="p-8 text-center">
             <RefreshCw className="h-8 w-8 animate-spin mx-auto text-purple-500 mb-2" />
             <p className="text-gray-500">Memuatkan data...</p>
           </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tarikh/Masa
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pengguna
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tindakan
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Entiti
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deskripsi
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Perubahan
                </th>
                <th scope="col" className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleString('ms-MY')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                           <UserIcon className="h-4 w-4 text-purple-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{log.user?.name || 'Sistem'}</div>
                          <div className="text-sm text-gray-500">{log.ip_address}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(log.action_type)}`}>
                        {log.action_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span>{log.table_name} #{log.record_id}</span>
                        {getEmailStatusBadge(log)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={log.description}>
                      {log.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                        {log.action_type === 'UPDATE' && log.old_values && log.new_values ? (
                            <details className="cursor-pointer">
                                <summary className="text-purple-600 hover:text-purple-800 text-xs">Lihat Perubahan</summary>
                                <div className="mt-2 text-xs bg-gray-50 p-2 rounded max-h-40 overflow-auto">
                                    {Object.keys(log.new_values).map(key => {
                                        if (log.old_values[key] != log.new_values[key]) {
                                            return (
                                                <div key={key} className="mb-1 border-b border-gray-200 pb-1">
                                                    <span className="font-semibold">{key}:</span> 
                                                    <span className="text-red-500 mx-1">{formatValue(log.old_values[key])}</span>
                                                    <span>→</span>
                                                    <span className="text-green-500 mx-1">{formatValue(log.new_values[key])}</span>
                                                </div>
                                            )
                                        }
                                        return null;
                                    })}
                                </div>
                            </details>
                        ) : (
                            <span className="text-xs text-gray-400">-</span>
                        )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                        onClick={() => setSelectedLog(log)}
                        title="Lihat Butiran"
                      >
                        <Eye className="h-4 w-4 mr-1" /> Lihat
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                    Tiada rekod audit ditemui.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
        
        {selectedLog && (
          <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
              <div className="px-4 py-3 border-b flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-800">Butiran Audit</h3>
                <button className="text-gray-500 hover:text-gray-700" onClick={() => setSelectedLog(null)}>✕</button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <div className="text-sm text-gray-600">Deskripsi</div>
                  <div className="text-sm text-gray-900">{selectedLog.description}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Nilai Baharu (new_values)</div>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">{JSON.stringify(selectedLog.new_values ?? {}, null, 2)}</pre>
                </div>
                <div>
                  <div className="text-sm text-gray-600 mb-1">Nilai Lama (old_values)</div>
                  <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">{JSON.stringify(selectedLog.old_values ?? {}, null, 2)}</pre>
                </div>
              </div>
              <div className="px-4 py-3 border-t flex justify-end">
                <button className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700" onClick={() => setSelectedLog(null)}>Tutup</button>
              </div>
            </div>
          </div>
        )}
        
        {/* Pagination */}
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Menunjukkan <span className="font-medium">{startRecord}</span> hingga <span className="font-medium">{endRecord}</span> daripada <span className="font-medium">{totalRecords}</span> rekod
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Sebelumnya</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // Logic to show window of pages could be improved but simple for now
                    const p = i + 1;
                    return (
                        <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            page === p
                            ? 'z-10 bg-purple-50 border-purple-500 text-purple-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                        >
                        {p}
                        </button>
                    )
                })}
                
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Seterusnya</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditTrailTab;
