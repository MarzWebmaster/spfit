import React from 'react';
import type { Task, Freelancer } from '../types';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
// Data diambil dari API; nama pencipta disediakan melalui relasi task.creator

interface MyTasksPageProps {
  tasks: Task[];
  currentUser: Freelancer;
  onViewTask: (task: Task) => void;
}

export const MyTasksPage: React.FC<MyTasksPageProps> = ({ tasks, currentUser, onViewTask }) => {
    const myTasks = tasks.filter(task => (task.assignedTo || (task.assignee as any)?.id) === currentUser.id);
    const getCreatorName = (task: Task) => (task.creator as any)?.name || 'N/A';

    return (
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-4 sm:p-6 border-b">
                <h2 className="text-2xl font-bold text-gray-800">Tugasan Saya</h2>
                <p className="mt-1 text-sm text-gray-600">Senarai semua tugasan yang diberikan kepada anda.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tajuk Tugasan</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lokasi</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga (RM)</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dicipta Oleh</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Tindakan</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {myTasks.map((task) => (
                            <tr key={task.id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <button onClick={() => onViewTask(task)} className="text-sm font-medium text-indigo-600 hover:text-indigo-900 text-left">
                                        {task.title}
                                    </button>
                                    <div className="text-sm text-gray-500">{task.supportType}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.clientLocation}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">{task.offerPrice.toFixed(2)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCreatorName(task)}</td>
                                <td className="px-6 py-4 whitespace-nowrap"><Badge status={task.status} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Button size="sm" variant="secondary" onClick={() => onViewTask(task)}>Lihat</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {myTasks.length === 0 && <p className="text-center text-gray-500 p-6">Anda tiada tugasan buat masa ini.</p>}
        </div>
    );
};
