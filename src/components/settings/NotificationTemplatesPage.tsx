import React, { useState, useMemo } from 'react';
import type { NotificationTemplate } from '../../types';
import { Button } from '../ui/Button';
import { ICONS } from '../ui/icons';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface NotificationTemplatesPageProps {
  onBack: () => void;
  templates: NotificationTemplate[];
  onOpenTemplateModal: (template: NotificationTemplate | null) => void;
  onDeleteTemplate: (templateId: number) => void;
  onSetDefaultTemplate: (templateId: number) => void;
}

export const NotificationTemplatesPage: React.FC<NotificationTemplatesPageProps> = ({ onBack, templates, onOpenTemplateModal, onDeleteTemplate, onSetDefaultTemplate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterChannel, setFilterChannel] = useState<'E-mel' | 'Webhook' | ''>('');

    const filteredTemplates = useMemo(() => {
        return templates.filter(template => {
            const searchMatch = !searchTerm || template.name.toLowerCase().includes(searchTerm.toLowerCase());
            const channelMatch = !filterChannel || template.channel === filterChannel;
            return searchMatch && channelMatch;
        });
    }, [templates, searchTerm, filterChannel]);

    const handleDelete = (template: NotificationTemplate) => {
        if (window.confirm(`Adakah anda pasti mahu memadam templat "${template.name}"?`)) {
            onDeleteTemplate(template.id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Templat Notifikasi</h2>
                    <p className="mt-1 text-sm text-gray-600">Cipta dan urus templat mesej untuk e-mel dan webhook.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => onOpenTemplateModal(null)} icon={ICONS.plus}>Tambah Templat Baru</Button>
                    <Button variant="secondary" onClick={onBack}>Kembali ke Tetapan</Button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <Input
                        label="Cari Nama Templat"
                        id="search-template"
                        placeholder="Taip untuk mencari..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Select
                        label="Tapis Mengikut Saluran"
                        id="filter-channel"
                        value={filterChannel}
                        onChange={(e) => setFilterChannel(e.target.value as any)}
                    >
                        <option value="">Semua Saluran</option>
                        <option value="E-mel">E-mel</option>
                        <option value="Webhook">Webhook</option>
                    </Select>
                </div>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama Templat</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jenis</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saluran</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Default</th>
                                <th className="relative px-6 py-3"><span className="sr-only">Tindakan</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredTemplates.map(template => (
                                <tr key={template.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">{template.name}</div>
                                        <div className="text-sm text-gray-500 truncate max-w-xs">{template.subjectOrTitle}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{template.channel}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {template.isDefault ? (
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Ya</span>
                                        ) : (
                                            <Button size="sm" variant="secondary" onClick={() => onSetDefaultTemplate(template.id)}>
                                                Jadikan Default
                                            </Button>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => onOpenTemplateModal(template)}>Edit</Button>
                                            <Button size="sm" variant="danger" onClick={() => handleDelete(template)}>Padam</Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredTemplates.length === 0 && <p className="text-center text-gray-500 p-6">Tiada templat ditemui.</p>}
            </div>
             <div className="bg-white p-4 rounded-lg shadow-md mt-4">
                <h4 className="text-md font-semibold">Pembolehubah Boleh Guna:</h4>
                <p className="text-sm text-gray-600">
                    <code>&#123;&#123;freelancerName&#125;&#125;</code>, <code>&#123;&#123;taskTitle&#125;&#125;</code>, <code>&#123;&#123;taskLocation&#125;&#125;</code>, <code>&#123;&#123;taskPrice&#125;&#125;</code>
                </p>
            </div>
        </div>
    );
};
