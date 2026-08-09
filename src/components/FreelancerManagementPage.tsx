import React, { useState, useMemo } from 'react';
import type { Freelancer } from '../types';
import { Skill, MalaysianState } from '../types';
import { Button } from './ui/Button';
import { ICONS } from './ui/icons';

type SortField = 'name' | 'phone' | 'skills' | 'experience' | 'isAvailable';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface FreelancerManagementPageProps {
  freelancers: Freelancer[];
  onAddFreelancer: () => void;
  onViewProfile: (freelancer: Freelancer) => void;
  canManage: boolean;
}

const ITEMS_PER_PAGE = 5;

const SortArrow: React.FC<{ field: SortField; current: SortConfig | null }> = ({ field, current }) => {
  if (!current || current.field !== field) {
    return <span className="ml-1 text-gray-300">{'\u2195'}</span>;
  }
  return <span className="ml-1 text-indigo-600">{current.direction === 'asc' ? '\u2191' : '\u2193'}</span>;
};

const ALL_SKILLS = Object.values(Skill);
const ALL_STATES = Object.values(MalaysianState);

export const FreelancerManagementPage: React.FC<FreelancerManagementPageProps> = ({ freelancers, onAddFreelancer, onViewProfile, canManage }) => {
    const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'busy'>('all');
    const [skillFilter, setSkillFilter] = useState('all');
    const [stateFilter, setStateFilter] = useState('all');

    // Reset page whenever any filter/sort changes
    const resetPage = () => setCurrentPage(1);

    const onSort = (field: SortField) => {
        setSortConfig(prev => {
            if (prev && prev.field === field) {
                return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { field, direction: 'asc' };
        });
        resetPage();
    };

    const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        resetPage();
    };

    const onStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setStatusFilter(e.target.value as 'all' | 'available' | 'busy');
        resetPage();
    };

    const onSkillFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSkillFilter(e.target.value);
        resetPage();
    };

    const onStateFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setStateFilter(e.target.value);
        resetPage();
    };

    const clearFilters = () => {
        setSearchQuery('');
        setStatusFilter('all');
        setSkillFilter('all');
        setStateFilter('all');
        setSortConfig(null);
        resetPage();
    };

    const hasActiveFilters = searchQuery || statusFilter !== 'all' || skillFilter !== 'all' || stateFilter !== 'all';

    const filteredFreelancers = useMemo(() => {
        let result = freelancers;

        // Search filter — match name, email, phone
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            result = result.filter(f =>
                (f.name || '').toLowerCase().includes(q) ||
                (f.email || '').toLowerCase().includes(q) ||
                (f.phone || '').toLowerCase().includes(q)
            );
        }

        // Status filter
        if (statusFilter === 'available') {
            result = result.filter(f => f.isAvailable === true);
        } else if (statusFilter === 'busy') {
            result = result.filter(f => f.isAvailable === false);
        }

        // Skill filter
        if (skillFilter !== 'all') {
            result = result.filter(f => f.skills?.includes(skillFilter as Skill));
        }

        // State filter — check if any location matches
        if (stateFilter !== 'all') {
            result = result.filter(f =>
                f.locations?.some(l => l.state === stateFilter)
            );
        }

        // Sort
        if (sortConfig) {
            result = [...result].sort((a, b) => {
                let cmp = 0;
                switch (sortConfig.field) {
                    case 'name':
                        cmp = (a.name || '').localeCompare(b.name || '');
                        break;
                    case 'phone':
                        cmp = (a.phone || '').localeCompare(b.phone || '');
                        break;
                    case 'skills': {
                        const aCount = a.skills?.length || 0;
                        const bCount = b.skills?.length || 0;
                        cmp = aCount - bCount;
                        break;
                    }
                    case 'experience':
                        cmp = (a.experience || 0) - (b.experience || 0);
                        break;
                    case 'isAvailable':
                        cmp = (a.isAvailable === b.isAvailable) ? 0 : a.isAvailable ? -1 : 1;
                        break;
                }
                return sortConfig.direction === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [freelancers, searchQuery, statusFilter, skillFilter, stateFilter, sortConfig]);

    const totalPages = Math.max(1, Math.ceil(filteredFreelancers.length / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);

    const paginatedFreelancers = useMemo(() => {
        const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
        return filteredFreelancers.slice(start, start + ITEMS_PER_PAGE);
    }, [filteredFreelancers, safeCurrentPage]);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    };

    const getPageNumbers = (): (number | 'ellipsis')[] => {
        const pages: (number | 'ellipsis')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (safeCurrentPage > 3) pages.push('ellipsis');
            const start = Math.max(2, safeCurrentPage - 1);
            const end = Math.min(totalPages - 1, safeCurrentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (safeCurrentPage < totalPages - 2) pages.push('ellipsis');
            pages.push(totalPages);
        }
        return pages;
    };

    const thClass = "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-700 hover:bg-gray-100 transition-colors";

    const pagBtnClass = (disabled: boolean) =>
        `px-3 py-1.5 text-sm rounded-md transition-colors ${
            disabled ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`;

    const pageBtnClass = (active: boolean) =>
        `px-3 py-1.5 text-sm rounded-md transition-colors ${
            active ? 'bg-indigo-600 text-white font-medium' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`;

    const selectClass = "block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white";

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Pengurusan Freelancer</h2>
                    <p className="mt-1 text-sm text-gray-600">Lihat dan urus semua juruteknik dalam sistem.</p>
                </div>
                {canManage && <Button onClick={onAddFreelancer} icon={ICONS.plus}>Tambah Freelancer</Button>}
            </div>

            {/* Search + Filters */}
            <div className="p-4 sm:p-6 border-b bg-gray-50">
                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Search input */}
                    <div className="flex-1 min-w-0">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Carian</label>
                        <input
                            type="text"
                            placeholder="Cari nama, email atau telefon..."
                            value={searchQuery}
                            onChange={onSearchChange}
                            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>

                    {/* Status filter */}
                    <div className="w-full sm:w-40">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Status</label>
                        <select value={statusFilter} onChange={onStatusFilterChange} className={selectClass}>
                            <option value="all">Semua</option>
                            <option value="available">Tersedia</option>
                            <option value="busy">Dalam Tugasan</option>
                        </select>
                    </div>

                    {/* Skill filter */}
                    <div className="w-full sm:w-44">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Kemahiran</label>
                        <select value={skillFilter} onChange={onSkillFilterChange} className={selectClass}>
                            <option value="all">Semua</option>
                            {ALL_SKILLS.map(skill => (
                                <option key={skill} value={skill}>{skill}</option>
                            ))}
                        </select>
                    </div>

                    {/* State filter */}
                    <div className="w-full sm:w-44">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Negeri</label>
                        <select value={stateFilter} onChange={onStateFilterChange} className={selectClass}>
                            <option value="all">Semua</option>
                            {ALL_STATES.map(state => (
                                <option key={state} value={state}>{state}</option>
                            ))}
                        </select>
                    </div>

                    {/* Clear button */}
                    {hasActiveFilters && (
                        <div className="flex items-end">
                            <button
                                onClick={clearFilters}
                                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                                title="Kosongkan semua filter"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className={thClass} onClick={() => onSort('name')}>
                                Nama <SortArrow field="name" current={sortConfig} />
                            </th>
                            <th scope="col" className={thClass} onClick={() => onSort('phone')}>
                                Lokasi & Telefon <SortArrow field="phone" current={sortConfig} />
                            </th>
                            <th scope="col" className={thClass} onClick={() => onSort('skills')}>
                                Kemahiran <SortArrow field="skills" current={sortConfig} />
                            </th>
                            <th scope="col" className={thClass} onClick={() => onSort('experience')}>
                                Pengalaman <SortArrow field="experience" current={sortConfig} />
                            </th>
                            <th scope="col" className={thClass} onClick={() => onSort('isAvailable')}>
                                Status Ketersediaan <SortArrow field="isAvailable" current={sortConfig} />
                            </th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Tindakan</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedFreelancers.map((freelancer) => (
                            <tr
                                key={freelancer.id}
                                className="hover:bg-gray-50 cursor-pointer"
                                onClick={() => onViewProfile(freelancer)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">{freelancer.name}</div>
                                    <div className="text-sm text-gray-500">{freelancer.email}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-normal">
                                    <div className="text-sm text-gray-900 max-w-xs">{freelancer.locations.map(l => `${l.district}, ${l.state}`).join('; ')}</div>
                                    <div className="text-sm text-gray-500">{freelancer.phone}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                        {freelancer.skills.map(skill => (
                                            <span key={skill} className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                                                {skill.substring(0, 20)}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{freelancer.experience} tahun</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    {freelancer.isAvailable ? (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Tersedia</span>
                                    ) : (
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Dalam Tugasan</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onViewProfile(freelancer);
                                        }}
                                    >
                                        Profil
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Empty state */}
            {filteredFreelancers.length === 0 && (
                <div className="text-center p-6">
                    <p className="text-gray-500">
                        {hasActiveFilters ? 'Tiada freelancer sepadan dengan carian anda.' : 'Tiada freelancer ditemui.'}
                    </p>
                </div>
            )}

            {/* Pagination */}
            {filteredFreelancers.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
                    <span className="text-sm text-gray-600">
                        {filteredFreelancers.length} freelancer — Page {safeCurrentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => goToPage(safeCurrentPage - 1)}
                            disabled={safeCurrentPage === 1}
                            className={pagBtnClass(safeCurrentPage === 1)}
                        >
                            &laquo; Prev
                        </button>
                        {getPageNumbers().map((page, idx) =>
                            page === 'ellipsis' ? (
                                <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-gray-400">...</span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => goToPage(page)}
                                    className={pageBtnClass(page === safeCurrentPage)}
                                >
                                    {page}
                                </button>
                            )
                        )}
                        <button
                            onClick={() => goToPage(safeCurrentPage + 1)}
                            disabled={safeCurrentPage === totalPages}
                            className={pagBtnClass(safeCurrentPage === totalPages)}
                        >
                            Next &raquo;
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
