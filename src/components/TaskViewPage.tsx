import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { tasksApi } from '../services/api';
import { Task, TaskStatus } from '../types';
import { Button } from './ui/Button';
import { ICONS } from './ui/icons';

export const TaskViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTask = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await tasksApi.getById(Number(id));
        if (response.success && response.data) {
          setTask((response.data as any).task || response.data);
        } else {
          setError('Task not found');
        }
      } catch (err) {
        console.error('Error fetching task:', err);
        setError('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-red-600">
        <p className="text-xl font-bold mb-4">{error || 'Task not found'}</p>
        <Button onClick={() => navigate(-1)}>Kembali</Button>
      </div>
    );
  }

  // Helper to format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  const formatTime = (timeString?: string) => {
      if (!timeString) return '';
      // Assuming timeString is HH:MM:SS or HH:MM
      const [hours, minutes] = timeString.split(':');
      const h = parseInt(hours, 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedHours = h % 12 || 12;
      return `${formattedHours}:${minutes}${ampm}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8 print:p-0 print:bg-white">
      {/* Action Buttons (Hidden in Print) */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-wrap justify-between items-center gap-3 print:hidden">
        <Button variant="secondary" onClick={() => navigate(-1)} icon={ICONS.arrowLeft}>
          Kembali
        </Button>
        <Button onClick={handlePrint} icon={ICONS.printer}>
          Cetak
        </Button>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto overflow-x-auto">
      <div className="bg-white shadow-lg print:shadow-none print:w-full min-w-[600px]">
        {/* Header */}
        <div className="border-b-2 border-black p-2 flex justify-between text-xs font-bold font-sans">
            <div>SUPPORT : +603-42801178</div>
            <div>EMAIL : care@juricco.com</div>
            <div>http://www.juricco.com</div>
        </div>

        {/* Section Titles */}
        <div className="grid grid-cols-12 border-b-2 border-black text-center font-bold bg-gray-200 print:bg-transparent">
            <div className="col-span-4 border-r border-black p-1">USER INFORMATION</div>
            <div className="col-span-4 border-r border-black p-1">OTHER INFORMATION</div>
            <div className="col-span-4 p-1">ASSET</div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-12 border-b-2 border-black text-sm">
            {/* User Info Column */}
            <div className="col-span-4 border-r border-black p-2 space-y-2">
                <div className="grid grid-cols-3">
                    <span className="font-bold">Log Number</span>
                    <span className="col-span-2">: {task.logNumber}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-bold">Username</span>
                    <span className="col-span-2">: {task.picName || '-'}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-bold">Contact Number</span>
                    <span className="col-span-2">: {task.picPhone || '-'}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-bold">Client Name</span>
                    <span className="col-span-2">: {task.clientName || '-'}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-bold">Location</span>
                    <span className="col-span-2">: {task.clientLocation}</span>
                </div>
                <div className="grid grid-cols-3">
                  <span className="font-bold">Bandar / Daerah</span>
                  <span className="col-span-2">: {task.districtAddress || (task as any).bandar_daerah || (task as any).district_address || '-'}</span>
                </div>
            </div>

            {/* Other Info Column */}
            <div className="col-span-4 border-r border-black p-2 space-y-2">
                <div className="grid grid-cols-3">
                    <span className="font-bold">Tag ID</span>
                    <span className="col-span-2">: {task.assetTagId || '-'}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-bold">Brand</span>
                    <span className="col-span-2">: {task.assetBrand || '-'}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-bold">Model</span>
                    <span className="col-span-2">: {task.assetModel || '-'}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-bold">Serial Number</span>
                    <span className="col-span-2">: {task.assetSerialNumber || '-'}</span>
                </div>
                <div className="grid grid-cols-3">
                    <span className="font-bold">Branch Name</span>
                    <span className="col-span-2">: {task.branchName || '-'}</span>
                </div>
            </div>

            {/* Asset Column */}
            <div className="col-span-4 p-2">
              <div className="text-sm font-medium">{task.equipmentTypes?.[0] || '-'}</div>
            </div>
        </div>

        {/* Dates Table */}
        <div className="border-b-2 border-black">
            <div className="grid grid-cols-4 font-bold text-center border-b border-black bg-gray-100 print:bg-transparent text-sm">
                <div className="p-1 border-r border-black">Description</div>
                <div className="p-1 border-r border-black">Date</div>
                <div className="p-1 border-r border-black">Time</div>
                <div className="p-1">Duration</div>
            </div>
            {/* Rows */}
            {[
                { label: 'Received Report', date: task.receivedDate, time: task.receivedTime },
                { label: 'IRT', date: task.irtDate, time: task.irtTime },
                { label: 'Service Start (ORT)', date: task.serviceStartDate, time: task.serviceStartTime },
                { label: 'Service Stop (ORT)', date: task.serviceStopDate, time: task.serviceStopTime },
            ].map((row, idx) => (
                <div key={idx} className="grid grid-cols-4 text-sm border-b border-gray-300 last:border-b-0">
                    <div className="p-1 border-r border-black pl-2 font-medium">{row.label}</div>
                    <div className="p-1 border-r border-black text-center">{formatDate(row.date)}</div>
                    <div className="p-1 border-r border-black text-center">{formatTime(row.time)}</div>
                    <div className="p-1 text-center"></div>
                </div>
            ))}
        </div>

        {/* Problem Description */}
        <div className="border-b-2 border-black p-2 min-h-[100px]">
            <h3 className="font-bold text-center border-b border-black mb-2 pb-1 bg-gray-200 print:bg-transparent">PROBLEM DESCRIPTION / TASK</h3>
            <p className="whitespace-pre-wrap text-sm">{task.description}</p>
        </div>

        {/* Hardware Replacement */}
        <div>
            <h3 className="font-bold text-center border-b border-black p-1 bg-gray-200 print:bg-transparent">HARDWARE / PART REPLACEMENT</h3>
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-black">
                        <th className="border-r border-black w-12 p-1">No.</th>
                        <th className="border-r border-black p-1">Part Number</th>
                        <th className="border-r border-black p-1">Description</th>
                        <th className="p-1 w-20">Quantity</th>
                    </tr>
                </thead>
                <tbody>
                    {[1, 2, 3].map((num) => {
                        const part = task.parts && task.parts[num - 1];
                        return (
                            <tr key={num} className="border-b border-gray-300 last:border-b-0 h-8">
                                <td className="border-r border-black text-center">{num}.</td>
                                <td className="border-r border-black px-2">{part?.partNumber || ''}</td>
                                <td className="border-r border-black px-2">{part?.description || ''}</td>
                                <td className="text-center">{part?.quantity || ''}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
        
        {/* Footer Signatures */}
        <div className="mt-8 grid grid-cols-2 gap-8 p-4 text-sm">
            <div className="text-center">
                <div className="h-20 border-b border-black mb-2"></div>
                <p className="font-bold">Customer Signature & Stamp</p>
                <p>Name:</p>
                <p>Date:</p>
            </div>
            <div className="text-center">
                <div className="h-20 border-b border-black mb-2"></div>
                <p className="font-bold">Engineer Signature</p>
                <p>Name: {task.assignee?.name || ''}</p>
                <p>Date:</p>
            </div>
        </div>

      </div>
      </div>
    </div>
  );
};