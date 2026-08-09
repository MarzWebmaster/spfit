import React, { useState, useEffect, useMemo } from 'react';
import type { Role, Permission, RoleType } from '../../types';
import { roleTypesApi } from '../../services/api';
import { PERMISSION_DEFINITIONS } from '../../constants/permissions';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select as UISelect } from '../ui/Select';
import { Button } from '../ui/Button';

interface RoleEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (role: Role) => void;
  roleToEdit: Role | null;
}

const DEFAULT_ROLE_TYPES: RoleType[] = [
  { id: 1, name: 'Admin', description: 'Administrative' },
  { id: 2, name: 'Management', description: 'Management' },
  { id: 3, name: 'Associate Partner', description: 'Operational' },
  { id: 4, name: 'Freelancer', description: 'External' }
];

const mergeRoleTypes = (apiRoleTypes: RoleType[]): RoleType[] => {
  const apiById = new Map(apiRoleTypes.map(rt => [rt.id, rt]));

  // Keep role type list stable: always exactly these 4 canonical entries.
  return DEFAULT_ROLE_TYPES.map(defaultType => {
    const fromApi = apiById.get(defaultType.id);
    return fromApi
      ? {
          ...fromApi,
          id: defaultType.id,
          name: defaultType.name,
          description: defaultType.description,
        }
      : defaultType;
  });
};

export const RoleEditorModal: React.FC<RoleEditorModalProps> = ({ isOpen, onClose, onSave, roleToEdit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roleTypeId, setRoleTypeId] = useState<number>(3); // Default 3 (Operasi)
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());
  const [availableRoleTypes, setAvailableRoleTypes] = useState<RoleType[]>(DEFAULT_ROLE_TYPES);

  useEffect(() => {
    const fetchRoleTypes = async () => {
        try {
            const response = await roleTypesApi.getAll();
            if (response.success && Array.isArray(response.data)) {
              setAvailableRoleTypes(mergeRoleTypes(response.data as RoleType[]));
            }
        } catch (error) {
            console.error('Failed to fetch role types', error);
        }
    };
    fetchRoleTypes();
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (roleToEdit) {
        setName(roleToEdit.name);
        setDescription(roleToEdit.description);
        // Handle legacy string roleType or object roleType or roleTypeId
        const typeId = roleToEdit.roleTypeId || roleToEdit.roleType?.id || 3;
        setRoleTypeId(typeId);
        setSelectedPermissions(new Set(roleToEdit.permissions));
      } else {
        setName('');
        setDescription('');
        setRoleTypeId(3);
        setSelectedPermissions(new Set());
      }
    }
  }, [isOpen, roleToEdit]);
  
  const handlePermissionChange = (permission: Permission, isChecked: boolean) => {
    setSelectedPermissions(prev => {
        const newSet = new Set(prev);
        if (isChecked) {
            newSet.add(permission);
        } else {
            newSet.delete(permission);
        }
        return newSet;
    });
  };

  const handleSave = () => {
    if (!name || !description) {
      alert('Sila masukkan nama dan deskripsi peranan.');
      return;
    }
    const roleData = {
      id: roleToEdit?.id || 0, // ID will be generated in App.tsx for new roles
      name,
      description,
      roleTypeId,
      permissions: Array.from(selectedPermissions),
      isSystemRole: roleToEdit?.isSystemRole || false,
    } as Role; // Type assertion needed because roleType object is missing here but backend handles it via roleTypeId
    onSave(roleData);
  };
  
  const groupedPermissions = useMemo(() => {
    return PERMISSION_DEFINITIONS.reduce((acc, permission) => {
        (acc[permission.category] = acc[permission.category] || []).push(permission);
        return acc;
    }, {} as Record<string, typeof PERMISSION_DEFINITIONS>);
  }, []);

  const roleTypeOptions = availableRoleTypes.map(rt => ({
      label: `${rt.name} (${rt.description || ''})`,
      value: rt.id
  }));

  return (
    <Modal 
        isOpen={isOpen} 
        onClose={onClose} 
        title={roleToEdit ? `Edit Peranan: ${roleToEdit.name}` : "Cipta Peranan Baru"}
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <Input 
            label="Nama Peranan" 
            id="role-name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            disabled={!!roleToEdit?.isSystemRole}
            required 
        />
        <Textarea 
            label="Deskripsi" 
            id="role-description" 
            value={description} 
            onChange={e => setDescription(e.target.value)} 
            rows={2}
            required 
        />

        <UISelect
            label="Jenis Peranan"
            id="role-type"
            value={roleTypeId}
            onChange={e => setRoleTypeId(Number(e.target.value))}
            options={roleTypeOptions}
        />

        <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Kebenaran</h3>
            <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([category, permissions]) => (
                    <div key={category} className="p-3 border rounded-md">
                        <h4 className="font-semibold text-gray-800 text-sm mb-2">{category}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {permissions.map(perm => (
                                <label key={perm.id} className="flex items-center space-x-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={selectedPermissions.has(perm.id)}
                                        onChange={(e) => handlePermissionChange(perm.id, e.target.checked)}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span>{perm.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button onClick={handleSave}>Simpan Peranan</Button>
      </div>
    </Modal>
  );
};
