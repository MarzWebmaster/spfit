import React, { useState, useEffect } from 'react';
import type { NotificationTemplate } from '../../types';
import { NotificationType } from '../../types';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: NotificationTemplate | Omit<NotificationTemplate, 'id' | 'isDefault'>[]) => void;
  templateToEdit: NotificationTemplate | null;
}

export const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({ isOpen, onClose, onSave, templateToEdit }) => {
    const isEditing = !!templateToEdit;

    // State for create mode
    const [name, setName] = useState('');
    const [templateType, setTemplateType] = useState<string>(NotificationType.TASK_OFFER);
    const [channels, setChannels] = useState({ email: true, whatsapp: false, webNotification: false });
    const [emailSubject, setEmailSubject] = useState('');
    const [emailBody, setEmailBody] = useState('');
    const [whatsappBody, setWhatsappBody] = useState('');
    const [webNotificationBody, setWebNotificationBody] = useState('');

    // State for edit mode
    const [editData, setEditData] = useState({ subjectOrTitle: '', body: '' });

    useEffect(() => {
        if (isOpen) {
            if (isEditing && templateToEdit) {
                // Populate state for editing
                setEditData({
                    subjectOrTitle: templateToEdit.subjectOrTitle,
                    body: templateToEdit.body,
                });
            } else {
                // Reset state for creating
                setName('');
                setTemplateType(NotificationType.TASK_OFFER);
                setChannels({ email: true, whatsapp: false, webNotification: false });
                setEmailSubject('Tawaran Tugasan Baru: {{taskTitle}}');
                setEmailBody('Salam {{freelancerName}},\n\nAnda menerima tawaran baru untuk tugasan "{{taskTitle}}" di {{taskLocation}} dengan tawaran sebanyak RM{{taskPrice}}.\n\nSila maklum balas segera.\n\nTerima kasih,\nSistem SPFIT');
                setWhatsappBody('Salam {{freelancerName}}, anda menerima tawaran tugasan: {{taskTitle}} di {{taskLocation}} dengan bayaran RM{{taskPrice}}.\n\nTerima: {{acceptLink}}\nTolak: {{rejectLink}}\n\nSila maklum balas segera.');
                setWebNotificationBody('');
            }
        }
    }, [isOpen, templateToEdit, isEditing]);

    const getVariablesByType = (type: string) => {
        switch(type) {
            case NotificationType.TASK_OFFER:
                return ['freelancerName', 'taskTitle', 'taskLocation', 'taskPrice', 'acceptLink', 'rejectLink'];
            case NotificationType.TASK_REMINDER:
                return ['freelancerName', 'taskTitle', 'taskLocation', 'reminderTime', 'referenceNumber', 'arrivalConfirmationLink'];
            case NotificationType.REGISTRATION_FREELANCER:
                return ['freelancerName', 'verificationLink', 'email'];
            default:
                return [];
        }
    };

    const handleChannelChange = (channel: 'email' | 'whatsapp' | 'webNotification') => {
        setChannels(prev => ({ ...prev, [channel]: !prev[channel] }));
    };

    const handleTemplateTypeChange = (type: string) => {
        setTemplateType(type);
    };

    const handleSubmit = () => {
        if (isEditing && templateToEdit) {
            // Handle saving an existing template
            onSave({
                ...templateToEdit,
                ...editData,
            });
        } else {
            // Handle creating new template(s)
            if (!name) {
                alert('Sila masukkan Nama Templat.');
                return;
            }
            if (!channels.email && !channels.whatsapp && !channels.webNotification) {
                alert('Sila pilih sekurang-kurangnya satu saluran.');
                return;
            }

            const newTemplates: Omit<NotificationTemplate, 'id' | 'isDefault'>[] = [];

            if (channels.email) {
                if (!emailBody || !emailSubject) {
                    alert('Sila isi subjek dan kandungan untuk templat E-mel.');
                    return;
                }
                newTemplates.push({
                    type: templateType as NotificationType,
                    channel: 'E-mel',
                    name: `${name} (E-mel)`,
                    subjectOrTitle: emailSubject,
                    body: emailBody,
                });
            }
            if (channels.whatsapp) {
                if (!whatsappBody) {
                    alert('Sila isi kandungan untuk templat Whatsapp.');
                    return;
                }
                newTemplates.push({
                    type: templateType as NotificationType,
                    channel: 'Whatsapp',
                    name: `${name} (Whatsapp)`,
                    subjectOrTitle: name,
                    body: whatsappBody,
                });
            }
            if (channels.webNotification) {
                if (!webNotificationBody) {
                    alert('Sila isi kandungan untuk templat Web Notification.');
                    return;
                }
                newTemplates.push({
                    type: templateType as NotificationType,
                    channel: 'Web Notification',
                    name: `${name} (Web Notification)`,
                    subjectOrTitle: name,
                    body: webNotificationBody,
                });
            }
            
            if (newTemplates.length > 0) {
                onSave(newTemplates);
            }
        }
        onClose(); // Close modal after saving
    };

    const renderCreateForm = () => (
        <div className="space-y-4">
            <Select
                label="Jenis Templat"
                id="templateType"
                value={templateType}
                onChange={(e) => handleTemplateTypeChange(e.target.value)}
            >
                <option value={NotificationType.TASK_OFFER}>{NotificationType.TASK_OFFER}</option>
                <option value={NotificationType.TASK_REMINDER}>{NotificationType.TASK_REMINDER}</option>
                <option value={NotificationType.REGISTRATION_FREELANCER}>{NotificationType.REGISTRATION_FREELANCER}</option>
            </Select>
            
            <Input label="Nama Templat" id="name" value={name} onChange={e => setName(e.target.value)} placeholder="cth: Tawaran Standard" required />
            <div>
                <label className="block text-sm font-medium text-gray-700">Saluran</label>
                <div className="mt-2 space-y-2">
                    <label className="flex items-center">
                        <input type="checkbox" checked={channels.email} onChange={() => handleChannelChange('email')} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                        <span className="ml-2 text-sm">E-mel</span>
                    </label>
                     <label className="flex items-center">
                        <input type="checkbox" checked={channels.whatsapp} onChange={() => handleChannelChange('whatsapp')} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                        <span className="ml-2 text-sm">Whatsapp</span>
                    </label>
                    <label className="flex items-center">
                        <input type="checkbox" checked={channels.webNotification} onChange={() => handleChannelChange('webNotification')} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                        <span className="ml-2 text-sm">Web Notification</span>
                    </label>
                </div>
            </div>
            
            {channels.email && (
                <div className="p-4 border rounded-md space-y-3 bg-gray-50">
                    <h4 className="font-semibold text-gray-700">Konfigurasi E-mel</h4>
                    <Input label="Subjek E-mel" id="emailSubject" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                    <Textarea label="Kandungan E-mel" id="emailBody" value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6} required />
                </div>
            )}
            
            {channels.whatsapp && (
                <div className="p-4 border rounded-md space-y-3 bg-gray-50">
                    <h4 className="font-semibold text-gray-700">Konfigurasi Whatsapp</h4>
                    <Textarea label="Kandungan Whatsapp" id="whatsappBody" value={whatsappBody} onChange={e => setWhatsappBody(e.target.value)} rows={6} required />
                </div>
            )}

            {channels.webNotification && (
                <div className="p-4 border rounded-md space-y-3 bg-gray-50">
                    <h4 className="font-semibold text-gray-700">Konfigurasi Web Notification</h4>
                    <Textarea label="Kandungan" id="webNotificationBody" value={webNotificationBody} onChange={e => setWebNotificationBody(e.target.value)} rows={6} required />
                </div>
            )}
        </div>
    );
    
    const renderEditForm = () => templateToEdit && (
        <div className="space-y-4">
            <Input label="Nama Templat" id="name_edit" value={templateToEdit.name} disabled />
            <Input label="Jenis" id="type_edit" value={templateToEdit.type} disabled />
            <Input label="Saluran" id="channel_edit" value={templateToEdit.channel} disabled />
            {templateToEdit.channel === 'E-mel' && (
                <Input label="Subjek E-mel" id="subjectOrTitle" value={editData.subjectOrTitle} onChange={e => setEditData(p => ({...p, subjectOrTitle: e.target.value}))} />
            )}
            <Textarea label="Kandungan" id="body" value={editData.body} onChange={e => setEditData(p => ({...p, body: e.target.value}))} rows={8} required />
        </div>
    );

    const variables = getVariablesByType(templateType);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? `Edit Templat: ${templateToEdit?.name}` : "Tambah Templat Baru"}>
            {isEditing ? renderEditForm() : renderCreateForm()}
            <div className="mt-4 bg-gray-50 p-3 rounded-md">
                <h4 className="text-sm font-semibold mb-2">Pembolehubah Boleh Guna:</h4>
                <p className="text-xs text-gray-600">
                    {variables.map(v => `{{${v}}}`).join(', ')}
                </p>
                {templateType === NotificationType.TASK_OFFER && (
                    <p className="text-xs text-gray-500 mt-1">
                        <strong>Whatsapp sahaja:</strong> <code>{'{{acceptLink}}, {{rejectLink}}'}</code>
                    </p>
                )}
                {templateType === NotificationType.TASK_REMINDER && (
                    <p className="text-xs text-gray-500 mt-1">
                        <strong>Hadir ke lokasi:</strong> <code>{'{{arrivalConfirmationLink}}'}</code>
                    </p>
                )}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={onClose}>Batal</Button>
                <Button onClick={handleSubmit}>Simpan Templat</Button>
            </div>
        </Modal>
    );
};
