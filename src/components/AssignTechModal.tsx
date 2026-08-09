import React, { useState, useMemo, useEffect } from 'react';
import type { Task, Freelancer, Webhook, NotificationTemplate } from '../types';
import { NotificationType } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';

interface AssignTechModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  freelancers: Freelancer[];
  webhooks: Webhook[];
  notificationTemplates: NotificationTemplate[];
  onSendOffers: (
      taskId: number,
      freelancerIds: number[],
            methods: Array<'E-mel' | 'Whatsapp'>,
            emailTemplateId?: number,
            whatsappTemplateId?: number
  ) => void;
}

const Star: React.FC<{ filled: boolean }> = ({ filled }) => (
    <svg className={`w-3 h-3 ${filled ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

export const AssignTechModal: React.FC<AssignTechModalProps> = ({ isOpen, onClose, task, freelancers, webhooks, notificationTemplates, onSendOffers }) => {
    const [selectedFreelancerIds, setSelectedFreelancerIds] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [notificationMethods, setNotificationMethods] = useState({
        email: true,
        whatsapp: false,
    });
    const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<number>(0);
    const [selectedWhatsappTemplateId, setSelectedWhatsappTemplateId] = useState<number>(0);

    const taskOfferEmailTemplates = useMemo(() => 
        notificationTemplates.filter(t => t.type === NotificationType.TASK_OFFER && t.channel === 'E-mel'), 
    [notificationTemplates]);
    
    const taskOfferWhatsappTemplates = useMemo(() => 
        notificationTemplates.filter(t => t.type === NotificationType.TASK_OFFER && t.channel === 'Whatsapp'), 
    [notificationTemplates]);
    
    useEffect(() => {
        if (isOpen) {
            const defaultEmailTemplate = taskOfferEmailTemplates.find(t => t.isDefault);
            setSelectedEmailTemplateId(defaultEmailTemplate?.id || taskOfferEmailTemplates[0]?.id || 0);

            const defaultWhatsappTemplate = taskOfferWhatsappTemplates.find(t => t.isDefault);
            setSelectedWhatsappTemplateId(defaultWhatsappTemplate?.id || taskOfferWhatsappTemplates[0]?.id || 0);
        }
    }, [isOpen, taskOfferEmailTemplates, taskOfferWhatsappTemplates]);

    const suitableCount = useMemo(() => {
        return freelancers.filter(f => f.skills.includes(task.supportType) && f.locations.some(loc => loc.state === task.state)).length;
    }, [freelancers, task]);
    
    const displayedFreelancers = useMemo(() => {
        const lowercasedFilter = searchTerm.toLowerCase();

        const suitableIds = freelancers
            .filter(f => f.skills.includes(task.supportType) && f.locations.some(loc => loc.state === task.state))
            .map(f => f.id);

        return freelancers
            .filter(f => !selectedFreelancerIds.includes(f.id))
            .filter(f => {
                if (!lowercasedFilter) return true;
                const nameMatch = f.name.toLowerCase().includes(lowercasedFilter);
                const locationMatch = f.locations.some(
                    loc => loc.district.toLowerCase().includes(lowercasedFilter) || loc.state.toLowerCase().includes(lowercasedFilter)
                );
                const ratingMatch = f.rating.toString().includes(lowercasedFilter);
                return nameMatch || locationMatch || ratingMatch;
            })
            .sort((a, b) => {
                if (lowercasedFilter) return 0; // Don't re-sort when actively searching
                const aIsSuitable = suitableIds.includes(a.id);
                const bIsSuitable = suitableIds.includes(b.id);
                if (aIsSuitable && !bIsSuitable) return -1;
                if (!aIsSuitable && bIsSuitable) return 1;
                return 0;
            });
    }, [freelancers, task, searchTerm, selectedFreelancerIds]);


    const handleMethodChange = (method: 'email' | 'whatsapp') => {
        setNotificationMethods(prev => ({ ...prev, [method]: !prev[method] }));
    };

    const handleSelectFreelancer = (id: number) => {
        setSelectedFreelancerIds(prev => [...prev, id]);
    };

    const handleRemoveFreelancer = (id: number) => {
        setSelectedFreelancerIds(prev => prev.filter(fid => fid !== id));
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (selectedFreelancerIds.length === 0) {
            alert('Sila pilih sekurang-kurangnya seorang freelancer.');
            return;
        }

        const selectedMethods = (Object.keys(notificationMethods) as Array<keyof typeof notificationMethods>)
            .filter(method => notificationMethods[method])
            .map(method => method === 'email' ? 'E-mel' : 'Whatsapp');

        if (selectedMethods.length === 0) {
            alert('Sila pilih sekurang-kurangnya satu kaedah notifikasi.');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSendOffers(
                task.id,
                selectedFreelancerIds,
                selectedMethods,
                notificationMethods.email ? selectedEmailTemplateId : undefined,
                notificationMethods.whatsapp ? selectedWhatsappTemplateId : undefined,
            );
        } catch (e) {
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setSelectedFreelancerIds([]);
            setSearchTerm('');
            setNotificationMethods({ email: true, whatsapp: false });
            setIsSubmitting(false);
        }
    }, [isOpen, webhooks]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Agihkan Tugasan: ${task.title}`}>
            <div className="space-y-4">
                {/* ... existing content ... */}
                {/* To save space in SearchReplace, assuming content above hasn't changed structure dramatically, but we need to target the end buttons */}
                <div>
                    <h4 className="font-semibold text-gray-800">Pilih Juruteknik</h4>
                     <p className="text-sm text-gray-500 mb-2">
                        {searchTerm ? 'Hasil carian.' : `Terdapat ${suitableCount} juruteknik yang sesuai. Anda boleh memilih lebih daripada satu.`}
                    </p>

                    {selectedFreelancerIds.length > 0 && (
                         <div className="flex flex-wrap gap-2 mb-2 p-2 border rounded-md bg-gray-50">
                            {selectedFreelancerIds.map(id => {
                                const f = freelancers.find(fr => fr.id === id);
                                if (!f) return null;
                                return (
                                    <span key={id} className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                                        {f.name}
                                        <button onClick={() => handleRemoveFreelancer(id)} className="text-indigo-600 hover:text-indigo-800 font-bold">&times;</button>
                                    </span>
                                )
                            })}
                        </div>
                    )}
                   
                    <Input label="" id="search-freelancer" placeholder="Cari juruteknik (nama, lokasi, rating)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    
                    <div className="mt-2 border rounded-md max-h-56 overflow-y-auto">
                        {displayedFreelancers.length > 0 ? (
                            displayedFreelancers.map(f => {
                                const isSuitable = !searchTerm && f.skills.includes(task.supportType) && f.locations.some(loc => loc.state === task.state);
                                return (
                                    <div key={f.id} onClick={() => handleSelectFreelancer(f.id)} className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm">{f.name}</p>
                                                {isSuitable && (
                                                    <span className="px-1.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full">Sesuai</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-0.5">
                                                {[...Array(5)].map((_, i) => <Star key={i} filled={i < f.rating} />)}
                                                <span className="text-xs text-gray-500 ml-1">({f.rating})</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 truncate">{f.locations.map(l => `${l.district}, ${l.state}`).join(' | ')}</p>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="p-3 text-sm text-gray-500">Tiada juruteknik ditemui.</p>
                        )}
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-gray-800 mb-2">Kaedah Notifikasi</h4>
                    <div className="flex gap-4">
                        <label className="flex items-center">
                            <input type="checkbox" name="notificationMethod" value="E-mel" checked={notificationMethods.email} onChange={() => handleMethodChange('email')} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                            <span className="ml-2 text-sm">E-mel</span>
                        </label>
                         <label className="flex items-center">
                            <input type="checkbox" name="notificationMethod" value="Whatsapp" checked={notificationMethods.whatsapp} onChange={() => handleMethodChange('whatsapp')} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
                            <span className="ml-2 text-sm">Whatsapp</span>
                        </label>
                    </div>
                    {notificationMethods.email && taskOfferEmailTemplates.length > 0 && (
                        <div className="mt-2">
                             <Select label="Pilih Templat E-mel" id="email-template" value={selectedEmailTemplateId} onChange={e => setSelectedEmailTemplateId(Number(e.target.value))}>
                                {taskOfferEmailTemplates.map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (Default)' : ''}</option>)}
                            </Select>
                        </div>
                    )}
                    {notificationMethods.whatsapp && taskOfferWhatsappTemplates.length > 0 && (
                        <div className="mt-2 space-y-2">
                            <Select label="Pilih Templat Whatsapp" id="whatsapp-template" value={selectedWhatsappTemplateId} onChange={e => setSelectedWhatsappTemplateId(Number(e.target.value))}>
                                {taskOfferWhatsappTemplates.map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault ? ' (Default)' : ''}</option>)}
                            </Select>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Batal</Button>
                <Button onClick={handleSubmit} disabled={selectedFreelancerIds.length === 0 || Object.values(notificationMethods).every(v => !v) || isSubmitting}>
                    {isSubmitting ? 'Sedang Diproses...' : `Hantar Tawaran (${selectedFreelancerIds.length})`}
                </Button>
            </div>
        </Modal>
    );
};
