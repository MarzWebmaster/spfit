import React, { useState, useMemo } from 'react';
import type { Task, Freelancer } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { StatCard } from '../ui/StatCard';
import { ICONS } from '../ui/icons';

interface FinanceReportPageProps {
  tasks: Task[];
  freelancers: Freelancer[];
  onBack: () => void;
}

const MonthlyBarChart: React.FC<{ data: { month: string; amount: number }[] }> = ({ data }) => {
  const maxAmount = Math.max(...data.map(d => d.amount), 0);
  return (
    <div className="flex items-end h-64 p-4 space-x-2 bg-gray-50 rounded-lg">
      {data.map(({ month, amount }) => (
        <div key={month} className="flex flex-col items-center flex-grow">
          <div
            className="w-full bg-green-500 rounded-t-md"
            style={{ height: `${maxAmount > 0 ? (amount / maxAmount) * 100 : 0}%` }}
            title={`RM ${amount.toFixed(2)}`}
          ></div>
          <div className="text-xs text-center mt-2 text-gray-600 font-medium">{month}</div>
        </div>
      ))}
    </div>
  );
};


export const FinanceReportPage: React.FC<FinanceReportPageProps> = ({ tasks, freelancers, onBack }) => {
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        freelancerId: '',
    });

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters({ ...filters, [e.target.id]: e.target.value });
    };

    const financialTasks = useMemo(() => {
        return tasks.filter(task => {
            const isPaid = task.status === 'Telah Dibayar' && task.paymentDate;
            if (!isPaid) return false;

            const paymentDate = new Date(task.paymentDate!);
            const startDate = filters.startDate ? new Date(filters.startDate) : null;
            const endDate = filters.endDate ? new Date(filters.endDate) : null;

            if (startDate && paymentDate < startDate) return false;
            if (endDate && paymentDate > endDate) return false;
            if (filters.freelancerId && task.assignedTo !== parseInt(filters.freelancerId)) return false;

            return true;
        });
    }, [tasks, filters]);
    
    const stats = useMemo(() => {
        const totalPaid = financialTasks.reduce((sum, task) => sum + task.offerPrice, 0);
        const pendingPayment = tasks.filter(t => t.status === 'Borang Disemak & Pembayaran Tertunggak').reduce((sum, task) => sum + task.offerPrice, 0);
        const avgTaskPrice = financialTasks.length > 0 ? totalPaid / financialTasks.length : 0;
        return { totalPaid, pendingPayment, avgTaskPrice };
    }, [financialTasks, tasks]);

    const monthlyData = useMemo(() => {
        const months: Record<string, number> = {};
        financialTasks.forEach(task => {
            const month = new Date(task.paymentDate!).toLocaleString('ms-MY', { month: 'short', year: '2-digit' });
            if (!months[month]) {
                months[month] = 0;
            }
            months[month] += task.offerPrice;
        });

        return Object.entries(months)
            .map(([month, amount]) => ({ month, amount }))
            .sort((a,b) => new Date(`1 ${a.month}`) < new Date(`1 ${b.month}`) ? -1 : 1); // Not perfect but good enough for demo
    }, [financialTasks]);


    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                <h2 className="text-2xl font-bold text-gray-800">Laporan Kewangan</h2>
                <p className="mt-1 text-sm text-gray-600">Jejaki pembayaran dan pendapatan.</p>
                </div>
                <Button variant="secondary" onClick={onBack}>Kembali ke Hab Laporan</Button>
            </div>
            
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard icon={ICONS.currencyDollar} title="Jumlah Dibayar" value={`RM ${stats.totalPaid.toFixed(2)}`} colorClassName="bg-green-500" />
                <StatCard icon={ICONS.checkCircle} title="Menunggu Pembayaran" value={`RM ${stats.pendingPayment.toFixed(2)}`} colorClassName="bg-yellow-500" />
                <StatCard icon={ICONS.chartBar} title="Purata Harga Tugasan" value={`RM ${stats.avgTaskPrice.toFixed(2)}`} colorClassName="bg-indigo-500" />
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Tarikh Bayaran Mula" id="startDate" type="date" value={filters.startDate} onChange={handleFilterChange} />
                    <Input label="Tarikh Bayaran Akhir" id="endDate" type="date" value={filters.endDate} onChange={handleFilterChange} />
                    <Select label="Freelancer" id="freelancerId" value={filters.freelancerId} onChange={handleFilterChange}>
                        <option value="">Semua Freelancer</option>
                        {freelancers.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </Select>
                </div>
            </div>

             <div className="bg-white p-4 rounded-lg shadow-md">
                <h3 className="font-semibold mb-4">Graf Pembayaran Bulanan</h3>
                {monthlyData.length > 0 ? <MonthlyBarChart data={monthlyData} /> : <p className="text-center text-gray-500 p-6">Tiada data untuk dipaparkan.</p>}
            </div>

             <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Tugasan</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Freelancer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh Dibayar</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah (RM)</th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {financialTasks.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{freelancers.find(f => f.id === t.assignedTo)?.name || 'N/A'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.paymentDate}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-700">{t.offerPrice.toFixed(2)}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                </div>
                {financialTasks.length === 0 && <p className="text-center text-gray-500 p-6">Tiada transaksi ditemui untuk tapisan semasa.</p>}
            </div>
        </div>
    );
};
