import React, { useState } from 'react';
import type { User, Freelancer } from '../../types';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';

interface BanUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | Freelancer | null;
  onConfirm: (userId: number, reason: string) => void;
}

export const BanUserModal: React.FC<BanUserModalProps> = ({ isOpen, onClose, user, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    setError('');
    if (!user) return;
    if (!reason.trim()) {
      setError('Sila masukkan sebab untuk menyekat pengguna.');
      return;
    }
    onConfirm(user.id, reason);
  };
  
  React.useEffect(() => {
    if (!isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen]);

  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Sekat Pengguna: ${user.name}`}>
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
        <p className="text-sm text-gray-700">
          Tindakan ini akan menukar status pengguna kepada 'Disekat' dan menghalang mereka daripada mengakses sistem. Sila nyatakan sebab untuk tindakan ini.
        </p>
        <Textarea 
          label="Sebab Disekat" 
          id="ban-reason" 
          value={reason} 
          onChange={(e) => setReason(e.target.value)} 
          placeholder="cth: Melanggar terma perkhidmatan..."
          required 
        />
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button variant="danger" onClick={handleConfirm}>Sahkan & Sekat Pengguna</Button>
      </div>
    </Modal>
  );
};