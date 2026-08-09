import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task } from '../types';
import { TaskStatus, Skill } from '../types';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { ICONS } from './ui/icons';
import { tasksApi } from '../services/api';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { TASK_COLUMN_KEYS, TASK_DEFAULT_ORDER, TASK_DEFAULT_VISIBLE, type TaskColumnKey } from '../utils/columnViewDefaults';

interface TaskManagementPageProps {
  tasks?: Task[]; // Made optional as we fetch internally
  onViewTask: (task: Task) => void;
  onCreateTask: () => void;
  onDeleteTask: (taskId: number) => void;
  canCreate: boolean;
  canDelete: boolean;
  onOpenAudit?: (task: Task) => void;
}

export const TaskManagementPage: React.FC<TaskManagementPageProps> = ({ onViewTask, onCreateTask, onDeleteTask, canCreate, canDelete, onOpenAudit }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [total, setTotal] = useState(0);
    const [duplicatingTaskId, setDuplicatingTaskId] = useState<number | null>(null);
    const [columnsOpen, setColumnsOpen] = useState(false);
    const [taskColumns, setTaskColumns] = useState<Record<TaskColumnKey, boolean>>(() => ({ ...TASK_DEFAULT_VISIBLE }));
    const [taskColumnOrder, setTaskColumnOrder] = useState<TaskColumnKey[]>(() => [...TASK_DEFAULT_ORDER]);
    const [draggingColumn, setDraggingColumn] = useState<TaskColumnKey | null>(null);

    const currentUserId = useMemo(() => {
        try {
            const raw = localStorage.getItem('spfit_current_user');
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed?.id ? String(parsed.id) : 'guest';
        } catch {
            return 'guest';
        }
    }, []);

    useEffect(() => {
        const key = `spfit_task_columns_${currentUserId}`;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') {
                    setTaskColumns((prev) => {
                        const next = { ...prev };
                        TASK_COLUMN_KEYS.forEach((k) => {
                            if (Object.prototype.hasOwnProperty.call(parsed, k)) next[k] = Boolean((parsed as any)[k]);
                        });
                        return next;
                    });
                }
            }
        } catch {}
    }, [currentUserId]);

    useEffect(() => {
        const key = `spfit_task_columns_order_${currentUserId}`;
        try {
            const raw = localStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed) && parsed.length) {
                    const allowed = new Set<TaskColumnKey>(TASK_COLUMN_KEYS);
                    const next = parsed.filter((k: any) => typeof k === 'string' && allowed.has(k as TaskColumnKey)) as TaskColumnKey[];
                    if (next.length) {
                        setTaskColumnOrder((prev) => {
                            const dedup = Array.from(new Set(next));
                            const missing = prev.filter((k) => !dedup.includes(k));
                            return [...dedup, ...missing];
                        });
                    }
                }
            }
        } catch {}
    }, [currentUserId]);

    useEffect(() => {
        const key = `spfit_task_columns_${currentUserId}`;
        try {
            localStorage.setItem(key, JSON.stringify(taskColumns));
        } catch {}
    }, [currentUserId, taskColumns]);

    useEffect(() => {
        const key = `spfit_task_columns_order_${currentUserId}`;
        try {
            localStorage.setItem(key, JSON.stringify(taskColumnOrder));
        } catch {}
    }, [currentUserId, taskColumnOrder]);

    const columnLabels = useMemo<Record<TaskColumnKey, string>>(() => ({
        created_at: 'Tarikh Buka',
        title: 'Tajuk Tugasan',
        location: 'Lokasi',
        district: 'Daerah',
        state: 'Negeri',
        offer_price: 'Harga (RM)',
        freelancer: 'Freelancer',
        status: 'Status'
    }), []);

    const visibleColumnKeys = useMemo(() => taskColumnOrder.filter((k) => taskColumns[k]), [taskColumnOrder, taskColumns]);

    const moveColumn = (from: TaskColumnKey, to: TaskColumnKey) => {
        if (from === to) return;
        setTaskColumnOrder((prev) => {
            const fromIndex = prev.indexOf(from);
            const toIndex = prev.indexOf(to);
            if (fromIndex < 0 || toIndex < 0) return prev;
            const next = [...prev];
            next.splice(fromIndex, 1);
            next.splice(toIndex, 0, from);
            return next;
        });
    };

    // Filter State
    const [query, setQuery] = useState('');
    const [filters, setFilters] = useState<{
        status: TaskStatus[];
        category: Skill[];
        startDate: string;
        endDate: string;
    }>({
        status: [],
        category: [],
        startDate: '',
        endDate: ''
    });
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sort, setSort] = useState('created_at_desc'); // Not fully implemented in UI but ready

    // Debounce logic
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchTasks();
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [query, filters, page, limit, sort]);

    // Initial load
    useEffect(() => {
        // This is handled by the debounce effect above, which runs on mount
        // But if we want to ensure it runs immediately or if filters are empty:
        // fetchTasks(); 
        // The dependency array above includes initial values, so it will run.
    }, []);

    const fetchTasks = async () => {
        setLoading(true);
        setError(null);
        try {
            // Parse sort string (e.g. "created_at_desc" -> sortBy="created_at", sort="desc")
            const lastUnderscoreIndex = sort.lastIndexOf('_');
            const sortByParam = sort.substring(0, lastUnderscoreIndex);
            const sortParam = sort.substring(lastUnderscoreIndex + 1);

            const params = {
                q: query || undefined,
                status: filters.status.length > 0 ? filters.status.join(',') : undefined,
                category: filters.category.length > 0 ? filters.category.join(',') : undefined,
                dateFrom: filters.startDate || undefined,
                dateTo: filters.endDate || undefined,
                limit,
                sort: sortParam,
                sortBy: sortByParam
            };

            const response = await tasksApi.getAll(page, limit, params);
            if (response.success && response.data) {
                 // Handle different response structures if necessary, assuming standard PaginatedResponse
                 const data = response.data as any;
                 if (Array.isArray(data)) {
                     const normalizedTasks = data.map((task: any) => ({
                         ...task,
                         logNumber: task.logNumber ?? task.log_number ?? '',
                         supportType: task.supportType ?? task.support_type,
                         clientLocation: task.clientLocation ?? task.client_location ?? '',
                         districtAddress: task.districtAddress ?? task.bandar_daerah ?? task.district_address ?? '',
                         offerPrice: task.offerPrice !== undefined ? Number(task.offerPrice) : Number(task.offer_price ?? 0),
                         assignedTo: task.assignedTo ?? task.assigned_to,
                         createdBy: task.createdBy ?? task.created_by,
                     }));
                     setTasks(normalizedTasks);
                     setTotal(normalizedTasks.length);
                 } else {
                     const taskRows = Array.isArray(data.tasks) ? data.tasks : [];
                     const normalizedTasks = taskRows.map((task: any) => ({
                         ...task,
                         logNumber: task.logNumber ?? task.log_number ?? '',
                         supportType: task.supportType ?? task.support_type,
                         clientLocation: task.clientLocation ?? task.client_location ?? '',
                         districtAddress: task.districtAddress ?? task.bandar_daerah ?? task.district_address ?? '',
                         offerPrice: task.offerPrice !== undefined ? Number(task.offerPrice) : Number(task.offer_price ?? 0),
                         assignedTo: task.assignedTo ?? task.assigned_to,
                         createdBy: task.createdBy ?? task.created_by,
                     }));
                     setTasks(normalizedTasks);
                     setTotal(data.pagination?.total || 0);
                 }
            } else {
                setError('Gagal memuatkan tugasan.');
            }
        } catch (err) {
            console.error(err);
            setError('Ralat semasa memuatkan tugasan.');
        } finally {
            setLoading(false);
        }
    };

    const handleDuplicate = async (task: Task) => {
        const confirmed = window.confirm(`Duplikasi tugasan "${task.title}" sebagai draf baru?`);
        if (!confirmed) return;

        try {
            setDuplicatingTaskId(task.id);
            setSuccess(null);
            const res = await tasksApi.duplicate(task.id);
            if (!res.success || !res.data) {
                setError(res.error || 'Gagal menduplikasi tugasan.');
                return;
            }
            const created = (res.data as any).task || (res.data as any).data?.task || (res.data as any);
            await fetchTasks();
            setSuccess('Tugasan berjaya diduplikasi.');
            if (created?.id) {
                onViewTask(created as Task);
            }
        } catch (err) {
            console.error(err);
            setError('Ralat semasa menduplikasi tugasan.');
        } finally {
            setDuplicatingTaskId(null);
        }
    };

    const handleFilterChange = (key: keyof typeof filters, value: any) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1); // Reset to first page on filter change
    };

    const removeFilter = (key: keyof typeof filters, value?: any) => {
        if (key === 'status' || key === 'category') {
             setFilters(prev => ({
                 ...prev,
                 [key]: (prev[key] as any[]).filter((item: any) => item !== value)
             }));
        } else {
            setFilters(prev => ({ ...prev, [key]: '' }));
        }
        setPage(1);
    };
    
    const clearAllFilters = () => {
        setQuery('');
        setFilters({
            status: [],
            category: [],
            startDate: '',
            endDate: ''
        });
        setPage(1);
    }

    const getUsername = (task: Task) => {
        const assignedId = (task as any).assignedTo ?? (task as any).assigned_to ?? (task as any).assignee?.id;
        if (!assignedId) return 'Belum Diagihkan';
        return (task as any).assignee?.name || 'Freelancer Ditetapkan';
    };

    const handleSort = (field: string) => {
        setSort(prevSort => {
            const isSameField = prevSort.startsWith(field);
            if (isSameField && prevSort.endsWith('desc')) {
                return `${field}_asc`;
            }
            return `${field}_desc`;
        });
    };

    const getSortIcon = (field: string) => {
        if (!sort.startsWith(field)) return <span className="text-gray-300">{ICONS.sort}</span>;
        return sort.endsWith('desc') ? <span className="text-indigo-600">{ICONS.arrowDown}</span> : <span className="text-indigo-600">{ICONS.arrowUp}</span>;
    };

    // UI Helpers
    const statusOptions = Object.values(TaskStatus).map(s => ({ label: s, value: s }));
    const categoryOptions = Object.values(Skill).map(s => ({ label: s, value: s }));

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-4 sm:p-6 border-b">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Pengurusan Tugasan</h2>
                        <p className="mt-1 text-sm text-gray-600">Lihat dan urus semua tugasan dalam sistem.</p>
                    </div>
                    {canCreate && <Button onClick={onCreateTask} icon={ICONS.plus}>Cipta Tugasan Baru</Button>}
                </div>

                {/* Search and Filters */}
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1">
                            <Input
                                type="search"
                                placeholder="Cari tugasan (Tajuk, ID, Lokasi)..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="w-full"
                            />
                        </div>
                         <div className="w-full md:w-48">
                            <Select
                                options={[{ label: 'Semua Status', value: '' }, ...statusOptions]}
                                value=""
                                onChange={(e) => {
                                    if (e.target.value && !filters.status.includes(e.target.value as TaskStatus)) {
                                        handleFilterChange('status', [...filters.status, e.target.value]);
                                    }
                                }}
                                label="Tambah Filter Status"
                            />
                        </div>
                        <div className="w-full md:w-48">
                            <Select
                                options={[{ label: 'Semua Kategori', value: '' }, ...categoryOptions]}
                                value=""
                                onChange={(e) => {
                                    if (e.target.value && !filters.category.includes(e.target.value as Skill)) {
                                        handleFilterChange('category', [...filters.category, e.target.value]);
                                    }
                                }}
                                label="Tambah Filter Kategori"
                            />
                        </div>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                         <div className="w-full md:w-auto">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tarikh Mula</label>
                            <Input 
                                type="date" 
                                value={filters.startDate} 
                                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                            />
                        </div>
                        <div className="w-full md:w-auto">
                             <label className="block text-sm font-medium text-gray-700 mb-1">Tarikh Tamat</label>
                             <Input 
                                type="date" 
                                value={filters.endDate} 
                                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                            />
                        </div>
                         {(query || filters.status.length > 0 || filters.category.length > 0 || filters.startDate || filters.endDate) && (
                            <Button variant="secondary" onClick={clearAllFilters} size="sm" className="mb-[2px]">
                                Padam Semua Filter
                            </Button>
                        )}
                    </div>

                    {/* Active Filters */}
                    <div className="flex flex-wrap gap-2 mt-2">
                        {filters.status.map(s => (
                            <span key={s} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {s}
                                <button type="button" onClick={() => removeFilter('status', s)} className="ml-1 text-blue-600 hover:text-blue-800 focus:outline-none">
                                    &times;
                                </button>
                            </span>
                        ))}
                        {filters.category.map(c => (
                            <span key={c} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {c}
                                <button type="button" onClick={() => removeFilter('category', c)} className="ml-1 text-green-600 hover:text-green-800 focus:outline-none">
                                    &times;
                                </button>
                            </span>
                        ))}
                         {filters.startDate && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Mula: {filters.startDate}
                                <button type="button" onClick={() => removeFilter('startDate')} className="ml-1 text-gray-600 hover:text-gray-800 focus:outline-none">
                                    &times;
                                </button>
                            </span>
                        )}
                        {filters.endDate && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Tamat: {filters.endDate}
                                <button type="button" onClick={() => removeFilter('endDate')} className="ml-1 text-gray-600 hover:text-gray-800 focus:outline-none">
                                    &times;
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto relative min-h-[200px]">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                )}
                
                {error && (
                    <div className="p-4 text-center text-red-600 bg-red-50 m-4 rounded-md">
                        {error}
                        <Button variant="secondary" size="sm" onClick={fetchTasks} className="ml-2">Cuba Lagi</Button>
                    </div>
                )}
                {success && (
                    <div className="p-4 text-center text-green-700 bg-green-50 m-4 rounded-md">
                        {success}
                    </div>
                )}

                <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-700">Paparan</div>
                    <Button variant="secondary" size="sm" onClick={() => setColumnsOpen((v) => !v)}>Kolum</Button>
                </div>
                {columnsOpen && (
                    <div className="px-4 py-4 border-b bg-gray-50">
                        <div className="text-xs text-gray-600 mb-3">Seret untuk susun semula urutan kolum.</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                            {taskColumnOrder.map((key) => (
                                <div
                                    key={key}
                                    className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2"
                                    draggable
                                    onDragStart={() => setDraggingColumn(key)}
                                    onDragEnd={() => setDraggingColumn(null)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => {
                                        if (draggingColumn) moveColumn(draggingColumn, key);
                                        setDraggingColumn(null);
                                    }}
                                >
                                    <span className="cursor-move select-none text-gray-400">⋮⋮</span>
                                    <input
                                        type="checkbox"
                                        checked={!!taskColumns[key]}
                                        onChange={(e) => setTaskColumns((prev) => ({ ...prev, [key]: e.target.checked }))}
                                    />
                                    <span className="text-gray-700">{columnLabels[key] || key}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {visibleColumnKeys.map((key) => {
                                if (key === 'created_at') {
                                    return (
                                        <th
                                            key={key}
                                            scope="col"
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none group"
                                            onClick={() => handleSort('created_at')}
                                        >
                                            <div className="flex items-center gap-1">
                                                {columnLabels[key]}
                                                {getSortIcon('created_at')}
                                            </div>
                                        </th>
                                    );
                                }
                                if (key === 'title') {
                                    return (
                                        <th
                                            key={key}
                                            scope="col"
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none group"
                                            onClick={() => handleSort('title')}
                                        >
                                            <div className="flex items-center gap-1">
                                                {columnLabels[key]}
                                                {getSortIcon('title')}
                                            </div>
                                        </th>
                                    );
                                }
                                if (key === 'offer_price') {
                                    return (
                                        <th
                                            key={key}
                                            scope="col"
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none group"
                                            onClick={() => handleSort('offerPrice')}
                                        >
                                            <div className="flex items-center gap-1">
                                                {columnLabels[key]}
                                                {getSortIcon('offerPrice')}
                                            </div>
                                        </th>
                                    );
                                }
                                if (key === 'status') {
                                    return (
                                        <th
                                            key={key}
                                            scope="col"
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none group"
                                            onClick={() => handleSort('status')}
                                        >
                                            <div className="flex items-center gap-1">
                                                {columnLabels[key]}
                                                {getSortIcon('status')}
                                            </div>
                                        </th>
                                    );
                                }
                                return <th key={key} scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{columnLabels[key]}</th>;
                            })}
                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tindakan</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {tasks.map((task) => (
                            <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                                {visibleColumnKeys.map((key) => {
                                    if (key === 'created_at') {
                                        return (
                                            <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {task.created_at ? new Date(task.created_at).toLocaleDateString('ms-MY', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                                            </td>
                                        );
                                    }
                                    if (key === 'title') {
                                        return (
                                            <td key={key} className="px-6 py-4 whitespace-nowrap">
                                                <button onClick={() => onViewTask(task)} className="text-sm font-medium text-indigo-600 hover:text-indigo-900 text-left">
                                                    {task.title}
                                                </button>
                                                <div className="text-sm text-gray-500">{task.logNumber}</div>
                                            </td>
                                        );
                                    }
                                    if (key === 'location') {
                                        return (
                                            <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <div>{task.clientLocation}</div>
                                            </td>
                                        );
                                    }
                                    if (key === 'district') {
                                        return (
                                            <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {task.districtAddress || '-'}
                                            </td>
                                        );
                                    }
                                    if (key === 'state') {
                                        return (
                                            <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {task.state || '-'}
                                            </td>
                                        );
                                    }
                                    if (key === 'offer_price') {
                                        return (
                                            <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                                {typeof task.offerPrice === 'number' ? task.offerPrice.toFixed(2) : parseFloat(String(task.offerPrice || 0)).toFixed(2)}
                                            </td>
                                        );
                                    }
                                    if (key === 'freelancer') {
                                        return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getUsername(task)}</td>;
                                    }
                                    if (key === 'status') {
                                        return <td key={key} className="px-6 py-4 whitespace-nowrap"><Badge status={task.status} /></td>;
                                    }
                                    return <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>;
                                })}
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <div className="flex gap-2 justify-end">
                                        <Button size="sm" variant="secondary" onClick={() => onViewTask(task)}>Lihat</Button>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleDuplicate(task)}
                                            disabled={duplicatingTaskId === task.id}
                                        >
                                            {duplicatingTaskId === task.id ? 'Menduplikasi...' : 'Duplicate'}
                                        </Button>
                                        {canDelete && (
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => {
                                                    if (window.confirm(`Adakah anda pasti mahu memadam tugasan "${task.title}"? Tindakan ini tidak boleh diundur.`)) {
                                                        onDeleteTask(task.id);
                                                    }
                                                }}
                                                icon={ICONS.trash}
                                            >
                                                Padam
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {!loading && tasks.length === 0 && !error && (
                <div className="text-center text-gray-500 p-8 flex flex-col items-center">
                    <span className="text-4xl mb-2">🔍</span>
                    <p>Tiada tugasan ditemui dengan kriteria carian anda.</p>
                    <Button variant="secondary" size="sm" onClick={clearAllFilters} className="mt-4">
                        Padam Semua Filter
                    </Button>
                </div>
            )}

            {/* Pagination Controls */}
            {total > 0 && (
                 <div className="px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-gray-600">
                            Menunjukkan {((page - 1) * limit) + 1} hingga {Math.min(page * limit, total)} daripada {total} tugasan
                        </div>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                            className="text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value={10}>10 / halaman</option>
                            <option value={20}>20 / halaman</option>
                            <option value={50}>50 / halaman</option>
                            <option value={100}>100 / halaman</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            disabled={page === 1} 
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                        >
                            Sebelumnya
                        </Button>
                        <Button 
                            size="sm" 
                            variant="secondary" 
                            disabled={page * limit >= total} 
                            onClick={() => setPage(p => p + 1)}
                        >
                            Seterusnya
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
