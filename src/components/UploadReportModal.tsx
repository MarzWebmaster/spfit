
import React, { useState } from 'react';
import type { Task } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';
import { Input } from './ui/Input';

interface UploadReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onUpload: (taskId: number, notes: string) => void;
}

export const UploadReportModal: React.FC<UploadReportModalProps> = ({ isOpen, onClose, task, onUpload }) => {
  const [notes, setNotes] = useState('');

  const handleUpload = () => {
    if (!notes) {
      alert('Sila masukkan nota laporan.');
      return;
    }
    // File upload logic would go here. We'll just simulate it.
    alert('Laporan berjaya dimuat naik!');
    onUpload(task.id, notes);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Muat Naik Laporan: ${task.title}`}>
      <div className="space-y-4">
        <Input label="Fail Laporan" id="reportFile" type="file" />
        <Textarea label="Nota Laporan" id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Terangkan kerja yang telah dilakukan..." />
      </div>
      <div className="mt-6 flex justify-end space-x-2">
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button onClick={handleUpload}>Muat Naik</Button>
      </div>
    </Modal>
  );
};
