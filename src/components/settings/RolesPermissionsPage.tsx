import React from 'react';
import type { Role } from '../../types';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { ICONS } from '../ui/icons';

// Protected roles that cannot be deleted
const PROTECTED_ROLES = ['Freelancer', 'Staff', 'Admin', 'Supervisor'];

interface RolesPermissionsPageProps {
  onBack: () => void;
  roles: Role[];
  onOpenRoleEditor: (role: Role | null) => void;
  onDeleteRole: (roleId: number) => void;
  defaultFreelancerRoleId: number;
  onSetDefaultFreelancerRole: (roleId: number) => void;
}

export const RolesPermissionsPage: React.FC<RolesPermissionsPageProps> = (props) => {
    const { 
        onBack, roles, onOpenRoleEditor, onDeleteRole, 
        defaultFreelancerRoleId, onSetDefaultFreelancerRole 
    } = props;

    // Safety check: ensure roles is an array
    const rolesArray = Array.isArray(roles) ? roles : [];
    // Allow any role to be selected as default, not just specific ones
    const freelancerRoles = rolesArray;
    
    // Check if the currently selected default role exists in the available roles
    const selectedRoleExists = freelancerRoles.some(r => r.id === defaultFreelancerRoleId);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Peranan & Kebenaran</h2>
                    <p className="mt-1 text-sm text-gray-600">Urus peranan dan kebenaran untuk setiap jenis pengguna.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => onOpenRoleEditor(null)} icon={ICONS.plus}>Tambah Peranan</Button>
                    <Button variant="secondary" onClick={onBack}>Kembali ke Tetapan</Button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Peranan Default Pendaftaran Awam</h3>
                <div className="max-w-md space-y-2">
                   <Select 
                        label="Pilih peranan yang akan diberikan kepada freelancer baru yang mendaftar." 
                        id="default-role" 
                        value={defaultFreelancerRoleId} 
                        onChange={e => onSetDefaultFreelancerRole(Number(e.target.value))}
                        error={!selectedRoleExists ? "Peranan yang dipilih sebelum ini tidak lagi wujud atau tidak aktif. Sila pilih peranan baru." : undefined}
                    >
                        {freelancerRoles.map(role => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                    </Select>
                    {!selectedRoleExists && (
                        <p className="text-sm text-red-600 bg-red-50 p-2 rounded">
                            Amaran: Peranan default semasa (ID: {defaultFreelancerRoleId}) tidak ditemui dalam senarai peranan aktif. Sila pilih peranan lain untuk memastikan pendaftaran pengguna baru berfungsi dengan betul.
                        </p>
                    )}
                    <p className="text-xs text-gray-500">
                        Tetapan ini disimpan secara automatik.
                    </p>
                </div>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Peranan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jenis Peranan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deskripsi</th>
                                <th className="relative px-6 py-3"><span className="sr-only">Tindakan</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {rolesArray.map(role => (
                                <tr key={role.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{role.name}</div>
                                        {role.isSystemRole && <div className="text-xs text-gray-500">Peranan Sistem</div>}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                            ${role.roleType?.name === 'Pentadbiran' ? 'bg-purple-100 text-purple-800' : 
                                              role.roleType?.name === 'Pengurusan' ? 'bg-blue-100 text-blue-800' : 
                                              role.roleType?.name === 'Luaran' ? 'bg-green-100 text-green-800' : 
                                              'bg-gray-100 text-gray-800'}`}>
                                            {role.roleType?.name || 'Operasi'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-normal text-sm text-gray-500">{role.description}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => onOpenRoleEditor(role)}>Edit</Button>
                                            {!role.isSystemRole && !PROTECTED_ROLES.includes(role.name) && (
                                                <Button size="sm" variant="danger" onClick={() => onDeleteRole(role.id)}>Padam</Button>
                                            )}
                                            {(role.isSystemRole || PROTECTED_ROLES.includes(role.name)) && (
                                                <div className="text-xs text-gray-400">Tidak boleh dipadam</div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
