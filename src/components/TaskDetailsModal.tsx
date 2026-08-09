import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, User, Freelancer, Permission } from '../types';
import { TaskStatus } from '../types';
import { taskRemindersApi } from '../services/api';
import { Modal } from './ui/Modal';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { TaskOffersList } from './TaskOffersList';

interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  currentUser: User;
  allUsers: (User | Freelancer)[];
  onAssignClick: (task: Task) => void;
  onEditClick?: (task: Task) => void;
  onUploadReportClick: (task: Task) => void;
  onVerifyReport: (taskId: number) => void;
  onMarkAsPaid: (taskId: number) => void;
  onRateFreelancerClick: (task: Task) => void;
  onCompleteTask: (taskId: number) => void;
  onManualArrivalMarked?: (task: Task) => void;
  hasPermission: (permission: Permission) => boolean;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = (props) => {
  const navigate = useNavigate();
  const { 
    isOpen, onClose, task, currentUser, allUsers, onAssignClick, onEditClick,
    onUploadReportClick, onVerifyReport, onMarkAsPaid, onRateFreelancerClick, 
    onCompleteTask, onManualArrivalMarked, hasPermission 
  } = props;

  if (!task) return null;

  const getUsername = (id?: number) => allUsers.find(u => u.id === id)?.name || 'N/A';
  
  const assignedFreelancer = getUsername(task.assignedTo);
  const createdByStaff = getUsername(task.createdBy);
  const normalizedCurrentUserRole = String(
    currentUser.role ||
    (currentUser as any).roleName ||
    (currentUser as any).role_name ||
    ''
  ).toLowerCase();
  const isAdminOrStaffTaskEditor = normalizedCurrentUserRole.includes('admin') || normalizedCurrentUserRole.includes('staff');

  const handleManualArrival = async () => {
    const confirmMarkArrival = window.confirm('Tandakan freelancer atau technician ini sebagai sudah hadir ke lokasi? Ini akan menghentikan reminder kehadiran.');
    if (!confirmMarkArrival) return;

    const response = await taskRemindersApi.manuallyConfirmArrival(task.id);
    if (!response.success) {
      window.alert(response.error || response.message || 'Gagal menandakan kehadiran.');
      return;
    }

    const updatedTask = (response.data as any)?.task;
    onManualArrivalMarked?.({
      ...task,
      ...updatedTask,
      arrivalConfirmedAt: updatedTask?.arrivalConfirmedAt ?? updatedTask?.arrival_confirmed_at ?? new Date().toISOString(),
      arrivalLatitude: updatedTask?.arrivalLatitude ?? updatedTask?.arrival_latitude ?? task.arrivalLatitude,
      arrivalLongitude: updatedTask?.arrivalLongitude ?? updatedTask?.arrival_longitude ?? task.arrivalLongitude,
      arrivalAccuracyMeters: updatedTask?.arrivalAccuracyMeters ?? updatedTask?.arrival_accuracy_meters ?? task.arrivalAccuracyMeters,
    });
    window.alert('Kehadiran berjaya ditandakan. Reminder kehadiran akan dihentikan.');
  };

  const renderActions = () => {
    const isCompletable = [TaskStatus.SELESAI, TaskStatus.BORANG_DISEMAK, TaskStatus.TELAH_DIBAYAR, TaskStatus.SELESAI_PENUH].includes(task.status);
    const canRate = (hasPermission('tasks:verify_report') || hasPermission('payments:approve')) && isCompletable && !task.feedback;
    
    const rateButton = canRate
        ? <Button variant="secondary" onClick={() => onRateFreelancerClick(task)}>Beri Penilaian</Button>
        : null;

    let mainActions: React.ReactNode[] = [];

    // Freelancer actions
    if (hasPermission('tasks:submit_report') && task.status === TaskStatus.TELAH_DIAMBIL && task.assignedTo === currentUser.id) {
      mainActions.push(<Button key="upload" onClick={() => onUploadReportClick(task)}>Muat Naik Laporan</Button>);
    }

    // Admin/Staff actions
    if (isAdminOrStaffTaskEditor && hasPermission('tasks:assign') && task.status === TaskStatus.BARU) {
      mainActions.push(<Button key="assign" onClick={() => onAssignClick(task)}>Agihkan Tugasan</Button>);
    }
    if (isAdminOrStaffTaskEditor && hasPermission('tasks:edit:all') && task.assignedTo && !task.arrivalConfirmedAt) {
      mainActions.push(<Button key="arrival" variant="secondary" onClick={handleManualArrival}>Hadir</Button>);
    }
    if (isAdminOrStaffTaskEditor && hasPermission('tasks:verify_report') && task.status === TaskStatus.SELESAI) {
      mainActions.push(<Button key="verify" onClick={() => onVerifyReport(task.id)}>Sahkan Laporan</Button>);
    }
    if (isAdminOrStaffTaskEditor && hasPermission('payments:approve') && task.status === TaskStatus.BORANG_DISEMAK) {
      mainActions.push(<Button key="pay" onClick={() => onMarkAsPaid(task.id)}>Luluskan & Tandakan Telah Dibayar</Button>);
    }
    if (isAdminOrStaffTaskEditor && hasPermission('payments:mark_paid') && !hasPermission('payments:approve') && task.status === TaskStatus.BORANG_DISEMAK) {
      mainActions.push(<p key="pending" className="text-sm text-yellow-700 bg-yellow-100 p-2 rounded-md">Menunggu kelulusan bayaran.</p>);
    }
    if (isAdminOrStaffTaskEditor && hasPermission('payments:mark_paid') && task.status === TaskStatus.TELAH_DIBAYAR) {
      mainActions.push(<Button key="complete" onClick={() => onCompleteTask(task.id)}>Selesai</Button>);
    }
    
    return <>{mainActions}{rateButton}</>;
  };


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Butiran Tugasan">
      <div className="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-2">
        <div className="flex justify-between items-center">
          <h4 className="text-xl font-bold text-gray-900">{task.title}</h4>
          <div className="flex items-center gap-2">
            {onEditClick && isAdminOrStaffTaskEditor && hasPermission('tasks:edit:all') && task.status === TaskStatus.BARU && (
              <button
                onClick={() => onEditClick(task)}
                className="px-3 py-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                title="Edit Tugasan"
              >
                ✏️ Edit
              </button>
            )}
            <Badge status={task.status} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-2 bg-gray-50 rounded-md">
          <div className="font-semibold text-gray-600">ID Tugasan:</div>
          <div className="text-gray-800">{task.id}</div>

          <div className="font-semibold text-gray-600">No. Log:</div>
          <div className="text-gray-800">{task.logNumber}</div>
          
          <div className="font-semibold text-gray-600">Jenis Sokongan:</div>
          <div className="text-gray-800">{task.supportType}</div>

          <div className="font-semibold text-gray-600">Lokasi Klien:</div>
          <div className="text-gray-800">{task.clientLocation}</div>

          <div className="font-semibold text-gray-600">Bandar / Daerah:</div>
          <div className="text-gray-800">{task.districtAddress || (task as any).bandar_daerah || (task as any).district_address || '-'}</div>
          
          <div className="font-semibold text-gray-600">Negeri:</div>
          <div className="text-gray-800">{task.state}</div>

          <div className="font-semibold text-gray-600">Tarikh Keperluan:</div>
          <div className="text-gray-800">{task.deadline}</div>
          
          <div className="font-semibold text-gray-600">Harga Tawaran:</div>
          <div className="text-gray-800 font-bold text-indigo-700">RM {typeof task.offerPrice === 'number' ? task.offerPrice.toFixed(2) : parseFloat(String(task.offerPrice || 0)).toFixed(2)}</div>

          <div className="font-semibold text-gray-600">Dicipta Oleh:</div>
          <div className="text-gray-800">{createdByStaff}</div>

          <div className="font-semibold text-gray-600">Diagihkan Kepada:</div>
          <div className="text-gray-800">{assignedFreelancer}</div>

          <div className="font-semibold text-gray-600">Status Kehadiran:</div>
          <div className="text-gray-800">{task.arrivalConfirmedAt ? `Hadir pada ${new Date(task.arrivalConfirmedAt).toLocaleString('ms-MY')}` : 'Belum disahkan hadir'}</div>
        </div>
        
        <div>
          <h5 className="font-semibold text-gray-600">Deskripsi:</h5>
          <p className="text-gray-800 whitespace-pre-wrap">{task.description}</p>
        </div>

        {task.remarks && (
            <div>
                <h5 className="font-semibold text-gray-600">Catatan / Remarks:</h5>
                <p className="text-gray-800 whitespace-pre-wrap p-2 border rounded-md bg-gray-50">{task.remarks}</p>
            </div>
        )}

        {task.links && task.links.length > 0 && (
             <div>
                <h5 className="font-semibold text-gray-600">Pautan Berkaitan:</h5>
                <ul className="list-disc list-inside space-y-1">
                    {task.links.map((link, index) => (
                        <li key={index}>
                           <a href={link} className="text-indigo-600 hover:underline truncate" target="_blank" rel="noopener noreferrer">{link}</a>
                        </li>
                    ))}
                </ul>
            </div>
        )}
        
        {task.attachments && task.attachments.length > 0 && (
             <div>
                <h5 className="font-semibold text-gray-600">Lampiran:</h5>
                <ul className="list-disc list-inside space-y-1">
                    {task.attachments.map((file, index) => (
                        <li key={index}>
                            <a href="#" className="text-indigo-600 hover:underline">{file}</a>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {task.report && (
            <div>
                <h5 className="font-semibold text-gray-600">Laporan Penyelesaian:</h5>
                <div className="mt-1 p-2 border rounded-md bg-gray-50">
                    <p className="text-gray-800">{task.report.notes}</p>
                    <a href={task.report.fileUrl} className="text-indigo-600 hover:underline text-xs" target="_blank" rel="noopener noreferrer">Lihat Fail</a>
                    <p className="text-xs text-gray-500 mt-1">Dihantar pada: {task.report.submittedAt}</p>
                </div>
            </div>
        )}
        
        {task.feedback && (
            <div>
                <h5 className="font-semibold text-gray-600">Maklum Balas & Penilaian (Keseluruhan):</h5>
                <div className="mt-1 p-2 border rounded-md bg-gray-50">
                    <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                            <svg key={i} className={`w-4 h-4 ${i < task.feedback!.overall ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        ))}
                        <span className="ml-2 text-xs font-semibold">{task.feedback.overall}/5</span>
                    </div>
                    {task.feedback.comment && <p className="text-gray-800 mt-2 italic">"{task.feedback.comment}"</p>}
                </div>
            </div>
        )}

        <TaskOffersList taskId={task.id} />

      </div>
      <div className="mt-6 flex justify-end items-center space-x-2">
        <Button variant="secondary" onClick={() => navigate(`/tasks/${task.id}/view`)}>Paparan Cetakan</Button>
        {renderActions()}
        <Button variant="secondary" onClick={onClose}>Tutup</Button>
      </div>
    </Modal>
  );
};