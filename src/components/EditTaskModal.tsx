import React, { useState, useEffect } from 'react';
import type { Task, User } from '../types';
import { Skill, TaskStatus, MalaysianState } from '../types';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { authService } from '../services/authService';

interface EditTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: number, updates: any) => void;
  task: Task | null;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({ isOpen, onClose, onSave, task }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [supportType, setSupportType] = useState<Skill>(Skill.HARDWARE);
  const [clientLocation, setClientLocation] = useState('');
  const [state, setState] = useState<string>(MalaysianState.KUALA_LUMPUR);
  const [deadline, setDeadline] = useState('');
  const [requirementDate, setRequirementDate] = useState('');
  const [requirementTime, setRequirementTime] = useState('');
  const [offerPrice, setOfferPrice] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && task) {
      setTitle(task.title);
      setDescription(task.description);
      setSupportType(task.supportType);
      setClientLocation(task.clientLocation);
      setState(task.state);
      const normalizedRequirementDate = task.requirementDate || task.deadline || '';
      const normalizedRequirementTime = task.requirementTime || task.deadlineTime || '';
      setRequirementDate(normalizedRequirementDate ? String(normalizedRequirementDate).slice(0, 10) : '');
      setRequirementTime(normalizedRequirementTime ? String(normalizedRequirementTime).slice(0, 5) : '');
      setDeadline(normalizedRequirementDate ? String(normalizedRequirementDate).slice(0, 10) : '');
      setOfferPrice(task.offerPrice);
      setRemarks(task.remarks || '');
      setError('');
    }
  }, [isOpen, task]);

  const validateForm = () => {
    const errors: string[] = [];

    const sanitizedTitle = authService.sanitizeInput(title.trim());
    if (!sanitizedTitle) {
      errors.push('Tajuk diperlukan');
    }

    const sanitizedDescription = authService.sanitizeInput(description.trim());
    if (!sanitizedDescription) {
      errors.push('Deskripsi diperlukan');
    }

    const sanitizedLocation = authService.sanitizeInput(clientLocation.trim());
    if (!sanitizedLocation || sanitizedLocation.length < 3) {
      errors.push('Lokasi klien diperlukan');
    }

    if (!requirementDate) {
      errors.push('Tarikh keperluan diperlukan');
    }

    if (!requirementTime) {
      errors.push('Masa keperluan diperlukan');
    }

    if (!offerPrice || offerPrice <= 0 || offerPrice > 100000) {
      errors.push('Harga tawaran mestilah antara RM1 hingga RM100,000');
    }

    if (errors.length > 0) {
      setError(errors.join('\n'));
      return null;
    }

    return {
      title: sanitizedTitle,
      description: sanitizedDescription,
      supportType,
      clientLocation: sanitizedLocation,
      state,
      deadline: requirementDate,
      deadlineTime: requirementTime,
      requirementDate,
      requirementTime,
      offerPrice,
      remarks: authService.sanitizeInput(remarks.trim()),
    };
  };

  const handleSubmit = () => {
    if (!task) return;

    const validatedData = validateForm();
    if (!validatedData) {
      return;
    }

    onSave(task.id, validatedData);
    onClose();
  };

  if (!task) return null;

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Edit Tugasan: ${task.title}`}
      footer={
        <div className="flex flex-wrap justify-end gap-2 w-full">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit}>Simpan Perubahan</Button>
        </div>
      }
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
        
        <Input label="Tajuk Tugasan" id="title" value={title} onChange={e => setTitle(e.target.value)} required />
        
        <Textarea label="Deskripsi Masalah" id="description" value={description} onChange={e => setDescription(e.target.value)} required />
        
        <Select label="Jenis Sokongan" id="supportType" value={supportType} onChange={e => setSupportType(e.target.value as Skill)}>
          {Object.values(Skill).map(skill => <option key={skill} value={skill}>{skill}</option>)}
        </Select>
        
        <Input label="Lokasi Klien" id="location" value={clientLocation} onChange={e => setClientLocation(e.target.value)} required placeholder="cth: Menara TM, Bangsar South" />
        
        <Select label="Negeri" id="state" value={state} onChange={e => setState(e.target.value)}>
          {Object.values(MalaysianState).map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        

        <Input label="Tarikh Keperluan" id="requirementDate" type="date" value={requirementDate} onChange={e => setRequirementDate(e.target.value)} required />
        <Input label="Masa Keperluan" id="requirementTime" type="time" value={requirementTime} onChange={e => setRequirementTime(e.target.value)} placeholder="HH:MM" required />
        <Input label="Harga Tawaran (RM)" id="price" type="number" value={offerPrice} onChange={e => setOfferPrice(parseFloat(e.target.value))} required />
        <Textarea label="Catatan / Remarks" id="remarks" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="cth: Sila hubungi pengurus cawangan sebelum hadir." />
        
        <div className="mt-4 p-3 bg-gray-50 rounded-md">
          <p className="text-xs text-gray-500">
            <strong>Nota:</strong> No Log tidak boleh diubah selepas tugasan dicipta. Untuk mengubah lampiran atau pautan, sila hubungi pentadbir.
          </p>
        </div>
      </div>
    </Modal>
  );
};
