import React, { useState, useEffect } from 'react';
import type { User, Freelancer, Role } from '../../types';
import { UserRole } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { Eye, EyeOff } from 'lucide-react';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | Freelancer | null;
  onSave: (userData: (User | Freelancer) & { password?: string }) => void;
  roles: Role[];
}

export const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, user, onSave, roles }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState<number>(0);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email || '');
      setRoleId(user.roleId);
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setError('');
    }
  }, [user]);

  const handleSubmit = () => {
    setError('');
    if (!user || !name || !email) {
      setError('Sila isi semua medan yang diperlukan.');
      return;
    }

    const trimmedPassword = password.trim();
    if (trimmedPassword) {
      if (trimmedPassword.length < 8) {
        setError('Kata laluan mesti sekurang-kurangnya 8 aksara.');
        return;
      }
      if (trimmedPassword !== confirmPassword.trim()) {
        setError('Pengesahan kata laluan tidak sepadan.');
        return;
      }
    }

    onSave({
      ...user,
      name,
      email,
      roleId: Number(roleId),
      ...(trimmedPassword ? { password: trimmedPassword } : {})
    });
  };

  // Safety check: ensure roles is an array
  const rolesArray = Array.isArray(roles) ? roles : [];
  const isFreelancer = rolesArray.find(r => r.id === user?.roleId)?.name === UserRole.FREELANCER;
  const assignableRoles = rolesArray; // Allow all roles including Freelance Tech


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Butiran Pengguna">
      <div className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
        <Input label="Nama Penuh" id="edit-name" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Alamat E-mel" id="edit-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        <Select label="Peranan" id="edit-role" value={roleId} onChange={e => setRoleId(Number(e.target.value))} disabled={isFreelancer}>
            {isFreelancer ? (
                <option value={user?.roleId}>{rolesArray.find(r => r.id === user?.roleId)?.name}</option>
            ) : (
                assignableRoles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)
            )}
        </Select>
        {isFreelancer && <p className="text-xs text-gray-500">Peranan untuk Freelancer tidak boleh ditukar.</p>}
        <div>
          <label htmlFor="edit-password" className="block text-sm font-medium text-gray-700">Kata Laluan Baru (Opsyenal)</label>
          <div className="relative mt-1">
            <input
              id="edit-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Biarkan kosong jika tidak mahu tukar"
              className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
              title={showPassword ? 'Sorok kata laluan' : 'Tunjuk kata laluan'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="edit-confirm-password" className="block text-sm font-medium text-gray-700">Sahkan Kata Laluan Baru</label>
          <div className="relative mt-1">
            <input
              id="edit-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Ulang kata laluan baru"
              disabled={!password.trim()}
              className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm disabled:bg-gray-100"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(prev => !prev)}
              disabled={!password.trim()}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 disabled:opacity-40"
              title={showConfirmPassword ? 'Sorok kata laluan' : 'Tunjuk kata laluan'}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button onClick={handleSubmit}>Simpan Perubahan</Button>
      </div>
    </Modal>
  );
};