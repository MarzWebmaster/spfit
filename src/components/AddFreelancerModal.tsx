import React, { useState } from 'react';
import type { Freelancer, Location } from '../types';
import { Skill, MalaysianState } from '../types';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface AddFreelancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (freelancerData: Omit<Freelancer, 'id' | 'isAvailable' | 'roleId' | 'rating' | 'status' | 'activityLog'>) => void;
}

export const AddFreelancerModal: React.FC<AddFreelancerModalProps> = ({ isOpen, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        name: '',
        icNumber: '',
        email: '',
        phone: '',
        experience: 0,
        address: '',
        city: '',
        postcode: '',
        state: '',
    });
    const [locations, setLocations] = useState<Location[]>([]);
    const [currentLocation, setCurrentLocation] = useState<Location>({ district: '', state: MalaysianState.KUALA_LUMPUR });
    const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
    const [error, setError] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: id === 'experience' ? parseInt(value) || 0 : value }));
    };

    const handleAddSkill = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const skill = e.target.value as Skill;
        if (skill && !selectedSkills.includes(skill)) {
            setSelectedSkills([...selectedSkills, skill]);
        }
        e.target.value = ''; // Reset select after selection
    };

    const handleRemoveSkill = (skillToRemove: Skill) => {
        setSelectedSkills(selectedSkills.filter(skill => skill !== skillToRemove));
    };

    const handleAddLocation = () => {
        if (currentLocation.district) {
            setLocations([...locations, currentLocation]);
            setCurrentLocation({ district: '', state: MalaysianState.KUALA_LUMPUR });
        }
    };

    const handleRemoveLocation = (index: number) => {
        setLocations(locations.filter((_, i) => i !== index));
    };

    const availableSkills = Object.values(Skill).filter(s => !selectedSkills.includes(s));

    const resetForm = () => {
        setFormData({
            name: '',
            icNumber: '',
            email: '',
            phone: '',
            experience: 0,
            address: '',
            city: '',
            postcode: '',
            state: '',
        });
        setLocations([]);
        setCurrentLocation({ district: '', state: MalaysianState.KUALA_LUMPUR });
        setSelectedSkills([]);
        setError('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = () => {
        setError('');
        const { name, icNumber, email, phone, experience, address } = formData;
        if (!name || !icNumber || !email || !phone || !address || experience < 0 || selectedSkills.length === 0 || locations.length === 0) {
            setError('Sila isi semua medan wajib dan tambah sekurang-kurangnya satu lokasi.');
            return;
        }
        onSave({ ...formData, skills: selectedSkills, locations });
        handleClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Tambah Freelancer Baru">
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
                {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Nama Penuh" id="name" value={formData.name} onChange={handleInputChange} required />
                    <Input label="No. IC / Pasport" id="icNumber" value={formData.icNumber} onChange={handleInputChange} required />
                    <Input label="Alamat E-mel" id="email" type="email" value={formData.email} onChange={handleInputChange} required />
                    <Input label="No. Telefon" id="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
                </div>
                
                {/* Alamat Rumah Section */}
                <div className="border rounded-md p-4 space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Alamat Rumah <span className="text-red-500">*</span></label>
                    <textarea
                        id="address"
                        value={formData.address}
                        onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Alamat lengkap rumah"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        required
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <Input label="Daerah / Bandar" id="city" value={formData.city} onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))} placeholder="Cth: Kuala Lumpur" />
                        <Input label="Poskod" id="postcode" value={formData.postcode} onChange={e => setFormData(prev => ({ ...prev, postcode: e.target.value }))} placeholder="Cth: 50300" />
                        <Input label="Negeri" id="state" value={formData.state} onChange={e => setFormData(prev => ({ ...prev, state: e.target.value }))} placeholder="Cth: Wilayah Persekutuan" />
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700">Lokasi Perkhidmatan</label>
                    <div className="mt-1 p-3 border rounded-md space-y-3">
                        {locations.map((loc, index) => (
                            <div key={index} className="flex justify-between items-center p-2 bg-gray-100 rounded-md text-sm">
                                <span>{loc.district}, {loc.state}</span>
                                <button onClick={() => handleRemoveLocation(index)} className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0 text-lg leading-none font-bold p-1">&times;</button>
                            </div>
                        ))}
                         <div className="flex items-end gap-2">
                            <div className="flex-grow">
                                <Input label="" id="district-add" value={currentLocation.district} onChange={e => setCurrentLocation(p => ({...p, district: e.target.value}))} placeholder="Daerah"/>
                            </div>
                            <div className="flex-grow">
                                <Select label="" id="state-add" value={currentLocation.state} onChange={e => setCurrentLocation(p => ({...p, state: e.target.value as MalaysianState}))}>
                                    {Object.values(MalaysianState).map(s => <option key={s} value={s}>{s}</option>)}
                                </Select>
                            </div>
                            <Button onClick={handleAddLocation} variant="secondary" size="sm" className="py-2.5">Tambah</Button>
                        </div>
                    </div>
                </div>

                <Input label="Pengalaman Bekerja (Tahun)" id="experience" type="number" value={formData.experience} onChange={handleInputChange} required />
                <div>
                    <Select
                        label="Kemahiran IT (Pilih satu atau lebih)"
                        id="skill-select"
                        value=""
                        onChange={handleAddSkill}
                        disabled={availableSkills.length === 0}
                    >
                        <option value="" disabled>-- Tambah Kemahiran --</option>
                        {availableSkills.map(skill => (
                            <option key={skill} value={skill}>{skill}</option>
                        ))}
                    </Select>
                    {selectedSkills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {selectedSkills.map(skill => (
                                <span
                                    key={skill}
                                    className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full"
                                >
                                    {skill}
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSkill(skill)}
                                        className="text-indigo-600 hover:text-indigo-800 font-bold"
                                        aria-label={`Remove ${skill}`}
                                    >
                                        &times;
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" onClick={handleClose}>Batal</Button>
                <Button onClick={handleSubmit}>Simpan Freelancer</Button>
            </div>
        </Modal>
    );
};