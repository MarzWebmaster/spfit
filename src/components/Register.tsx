import React, { useState } from 'react';
import type { Freelancer, Location } from '../types';
import { Skill, MalaysianState } from '../types';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Select } from './ui/Select';

interface RegisterProps {
  onRegister: (freelancerData: Omit<Freelancer, 'id' | 'isAvailable' | 'roleId' | 'rating' | 'status' | 'activityLog'>) => void;
  onNavigateToLogin: () => void;
}

export const Register: React.FC<RegisterProps> = ({ onRegister, onNavigateToLogin }) => {
    const [formData, setFormData] = useState({
        name: '',
        icNumber: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        experience: 0,
    });
    const [locations, setLocations] = useState<Location[]>([]);
    const [currentLocation, setCurrentLocation] = useState<Location>({ district: '', state: MalaysianState.KUALA_LUMPUR });
    const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
    const [error, setError] = useState('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: id === 'experience' ? parseInt(value) || 0 : value }));
    };

    const handleSkillChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const skill = value as Skill;
        setSelectedSkills(prev => 
            checked ? [...prev, skill] : prev.filter(s => s !== skill)
        );
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

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string): boolean => {
        const phoneRegex = /^(\+?60|0)?1[0-9]{8,9}$/;
        return phoneRegex.test(phone.replace(/[\s-]/g, ''));
    };

    const validateIC = (ic: string): boolean => {
        const icRegex = /^[0-9]{12}$/;
        return icRegex.test(ic.replace(/[\s-]/g, ''));
    };

    const validateName = (name: string): boolean => {
        const nameRegex = /^[a-zA-Z\s.'-]{2,50}$/;
        return nameRegex.test(name.trim());
    };

    const handleSubmit = () => {
        setError('');
        const { name, icNumber, email, phone, password, confirmPassword, experience } = formData;
        
        if (!name || !icNumber || !email || !phone || !password || !confirmPassword || experience <= 0 || selectedSkills.length === 0 || locations.length === 0) {
            setError('Sila isi semua medan dan tambah sekurang-kurangnya satu lokasi perkhidmatan.');
            return;
        }

        if (!validateName(name)) {
            setError('Nama mestilah antara 2-50 aksara dan hanya mengandungi huruf, ruang, titik, apostrof dan tanda sengkang.');
            return;
        }

        if (!validateIC(icNumber)) {
            setError('No. IC mestilah 12 digit nombor tanpa tanda sengkang atau ruang.');
            return;
        }

        if (!validateEmail(email)) {
            setError('Sila masukkan alamat e-mel yang sah.');
            return;
        }

        if (!validatePhone(phone)) {
            setError('No. telefon mestilah dalam format Malaysia yang sah (cth: 0123456789 atau +60123456789).');
            return;
        }

        if (password !== confirmPassword) {
            setError('Kata laluan dan pengesahan kata laluan tidak sepadan.');
            return;
        }

        if (password.length < 6) {
            setError('Kata laluan mestilah sekurang-kurangnya 6 aksara.');
            return;
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
        if (!passwordRegex.test(password)) {
            setError('Kata laluan mestilah sekurang-kurangnya 6 aksara dengan sekurang-kurangnya satu huruf kecil, satu huruf besar dan satu nombor.');
            return;
        }

        onRegister({ ...formData, skills: selectedSkills, locations });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="max-w-3xl w-full bg-white p-8 rounded-xl shadow-lg">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-indigo-600">Pendaftaran Freelancer</h1>
                    <p className="mt-2 text-sm text-gray-600">Sertai rangkaian juruteknik IT kami.</p>
                </div>
                <div className="mt-8 space-y-6">
                    {error && <p className="text-sm text-red-600 bg-red-100 p-3 rounded-md">{error}</p>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Nama Penuh" id="name" value={formData.name} onChange={handleInputChange} required />
                        <Input label="No. IC / Pasport" id="icNumber" value={formData.icNumber} onChange={handleInputChange} required />
                        <Input label="Alamat E-mel" id="email" type="email" value={formData.email} onChange={handleInputChange} required />
                        <Input label="No. Telefon (WhatsApp)" id="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
                        <Input label="Kata Laluan" id="password" type="password" value={formData.password} onChange={handleInputChange} required />
                        <Input label="Sahkan Kata Laluan" id="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleInputChange} required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Lokasi Perkhidmatan</label>
                        <div className="mt-2 p-4 border rounded-md space-y-4">
                            {locations.length > 0 && (
                                <div className="space-y-2">
                                    {locations.map((loc, index) => (
                                        <div key={index} className="flex justify-between items-center p-2 bg-gray-100 rounded-md text-sm">
                                            <span>{loc.district}, {loc.state}</span>
                                            <button onClick={() => handleRemoveLocation(index)} className="ml-2 text-red-500 hover:text-red-700 flex-shrink-0 text-lg leading-none font-bold p-1">&times;</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                             <div className="flex items-end gap-4">
                                <div className="flex-grow">
                                    <Input 
                                        label="Daerah" 
                                        id="district" 
                                        value={currentLocation.district} 
                                        onChange={e => setCurrentLocation(prev => ({ ...prev, district: e.target.value }))}
                                        placeholder="cth: Petaling Jaya"
                                    />
                                </div>
                                <div className="flex-grow">
                                     <Select 
                                        label="Negeri" 
                                        id="state" 
                                        value={currentLocation.state}
                                        onChange={e => setCurrentLocation(prev => ({...prev, state: e.target.value as MalaysianState}))}
                                     >
                                        {Object.values(MalaysianState).map(s => <option key={s} value={s}>{s}</option>)}
                                    </Select>
                                </div>
                                <Button onClick={handleAddLocation} variant="secondary">Tambah Lokasi</Button>
                            </div>
                        </div>
                    </div>

                    <Input label="Pengalaman Bekerja (Tahun)" id="experience" type="number" value={formData.experience} onChange={handleInputChange} required />
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Kemahiran IT</label>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-4">
                            {Object.values(Skill).map(skill => (
                                <label key={skill} className="flex items-center space-x-2 text-sm">
                                    <input
                                        type="checkbox"
                                        value={skill}
                                        onChange={handleSkillChange}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <span>{skill}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleSubmit} className="w-full">
                        Daftar Akaun
                    </Button>
                     <div className="text-center text-sm">
                        <p className="text-gray-600">
                            Sudah mempunyai akaun?{' '}
                            <button onClick={onNavigateToLogin} className="font-medium text-indigo-600 hover:text-indigo-500">
                                Log Masuk
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};