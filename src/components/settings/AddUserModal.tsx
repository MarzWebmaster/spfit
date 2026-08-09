import React, { useState } from 'react';
import type { User, Role } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: Omit<User, 'id' | 'status' | 'activityLog'>) => void;
  roles: Role[];
}

export const AddUserModal: React.FC<AddUserModalProps> = ({ isOpen, onClose, onSave, roles }) => {
  // Safety check: ensure roles is an array
  const rolesArray = Array.isArray(roles) ? roles : [];
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<number>(rolesArray[0]?.id || 0);
  const [error, setError] = useState('');

  // Debug: Log roles data
  console.log('🔍 AddUserModal - Roles received:', rolesArray);
  console.log('🔍 AddUserModal - Roles count:', rolesArray.length);
  console.log('🔍 AddUserModal - Role names:', rolesArray.map(r => r.name));

  const resetForm = () => {
    setName('');
    setEmail('');
    setRoleId(rolesArray[0]?.id || 0);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const validateName = (name: string): boolean => {
    const nameRegex = /^[a-zA-Z\s.'-]{2,50}$/;
    return nameRegex.test(name.trim());
  };

  const handleSubmit = () => {
    setError('');
    if (!name || !email) {
      setError('Sila isi semua medan yang diperlukan.');
      return;
    }

    if (!validateName(name)) {
      setError('Nama mestilah antara 2-50 aksara dan hanya mengandungi huruf, ruang, titik, apostrof dan tanda sengkang.');
      return;
    }

    if (!validateEmail(email)) {
      setError('Sila masukkan alamat e-mel yang sah.');
      return;
    }

    if (!roleId || roleId === 0) {
      setError('Sila pilih peranan untuk pengguna.');
      return;
    }

    onSave({ name, email, roleId: Number(roleId) });
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Tambah Pengguna Baru">
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
        <Input label="Nama Penuh" id="name" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Alamat E-mel" id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Select label="Peranan" id="role" value={roleId} onChange={e => setRoleId(Number(e.target.value))}>
          {rolesArray.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </Select>
        <Input label="Kata Laluan Sementara" id="password" type="password" placeholder="Akan dijana & dihantar melalui e-mel" disabled />
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={handleClose}>Batal</Button>
        <Button onClick={handleSubmit}>Simpan Pengguna</Button>
      </div>
    </Modal>
  );
};