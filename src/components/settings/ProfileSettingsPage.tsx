import React, { useState } from 'react';
import type { User, Freelancer, Location } from '../../types';
import { UserRole, Skill, MalaysianState } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

interface ProfileSettingsPageProps {
  onBack: () => void;
  currentUser: User;
  onUpdateProfile: (user: User) => void;
}

export const ProfileSettingsPage: React.FC<ProfileSettingsPageProps> = ({ onBack, currentUser, onUpdateProfile }) => {
    const isFreelancer = currentUser.role === UserRole.FREELANCER;
    const isSupervisor = currentUser.role === 'Supervisor';
    const canEditAvailability = !isFreelancer && !isSupervisor; // Only Admin/Staff can edit
    const [name, setName] = useState(currentUser.name);
    const [email, setEmail] = useState(currentUser.email || '');

    // user_profiles section state
    const freelancer = isFreelancer ? (currentUser as Freelancer) : null;
    const [phone, setPhone] = useState((currentUser as any).phone || freelancer?.phone || '');
    const [icNumber, setIcNumber] = useState((currentUser as any).icNumber || (currentUser as any).ic_number || '');
    const [experience, setExperience] = useState(Number((currentUser as any).experience ?? freelancer?.experience ?? 0));
    const [isAvailable, setIsAvailable] = useState(Boolean((currentUser as any).isAvailable ?? (currentUser as any).is_available ?? freelancer?.isAvailable ?? true));
    const [locations, setLocations] = useState<Location[]>(freelancer?.locations || []);
    const [skills, setSkills] = useState<Skill[]>(freelancer?.skills || []);
    const [currentLocation, setCurrentLocation] = useState<Location>({ district: '', state: MalaysianState.KUALA_LUMPUR });

    const handleSaveChanges = () => {
        const updatedUser = {
            ...currentUser,
            name,
            email,
            ...(isFreelancer && {
                phone,
                ic_number: icNumber,
                experience,
                is_available: isAvailable,
                locations,
                skills,
            }),
            ...(!isFreelancer && {
                phone,
                ic_number: icNumber,
                experience,
                is_available: isAvailable,
            }),
        };
        onUpdateProfile(updatedUser);
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
    
    const handleAddSkill = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const skill = e.target.value as Skill;
        if (skill && !skills.includes(skill)) {
            setSkills([...skills, skill]);
        }
        e.target.value = '';
    };

    const handleRemoveSkill = (skillToRemove: Skill) => {
        setSkills(skills.filter(skill => skill !== skillToRemove));
    };

    const availableSkills = Object.values(Skill).filter(s => !skills.includes(s));

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Tetapan Profil</h2>
                    <p className="mt-1 text-sm text-gray-600">Kemaskini butiran peribadi, kata laluan, dan lokasi perkhidmatan anda.</p>
                </div>
                <Button variant="secondary" onClick={onBack}>Kembali ke Tetapan</Button>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
                <div className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-800">Maklumat Akaun Pengguna</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Nama Penuh" id="name" value={name} onChange={e => setName(e.target.value)} />
                            <Input label="Alamat E-mel" id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <Input label="Kata Laluan Semasa" id="current_password" type="password" placeholder="Biarkan kosong untuk tidak menukar" />
                         <Input label="Kata Laluan Baru" id="new_password" type="password" placeholder="Biarkan kosong untuk tidak menukar" />
                    </div>

                    <div className="space-y-6 pt-6 border-t">
                        <h3 className="text-lg font-semibold text-gray-800">Maklumat Profil Pengguna</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="No. Telefon" id="phone" value={phone} onChange={e => setPhone(e.target.value)} />
                            <Input label="No. Kad Pengenalan" id="ic_number" value={icNumber} onChange={e => setIcNumber(e.target.value)} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input label="Pengalaman (Tahun)" id="experience" type="number" value={experience} onChange={e => setExperience(Number(e.target.value))} />
                            {canEditAvailability && (
                                <Select label="Status Ketersediaan" id="is_available" value={isAvailable ? 'true' : 'false'} onChange={e => setIsAvailable(e.target.value === 'true')}>
                                    <option value="true">Tersedia</option>
                                    <option value="false">Tidak Tersedia</option>
                                </Select>
                            )}
                        </div>
                    </div>

                    {isFreelancer && (
                        <div className="space-y-6 pt-6 border-t">
                             <div>
                                <label className="block text-sm font-medium text-gray-700">Lokasi Perkhidmatan</label>
                                <div className="mt-2 p-4 border rounded-md space-y-4">
                                    {locations.map((loc, index) => (
                                        <div key={index} className="flex justify-between items-center p-2 bg-gray-100 rounded-md text-sm">
                                            <span>{loc.district}, {loc.state}</span>
                                            <button onClick={() => handleRemoveLocation(index)} className="ml-2 text-red-500 hover:text-red-700">&times;</button>
                                        </div>
                                    ))}
                                    <div className="flex items-end gap-4">
                                        <div className="flex-grow"><Input label="" id="district" value={currentLocation.district} onChange={e => setCurrentLocation(p => ({...p, district: e.target.value}))} placeholder="Daerah"/></div>
                                        <div className="flex-grow"><Select label="" id="state" value={currentLocation.state} onChange={e => setCurrentLocation(p => ({...p, state: e.target.value as MalaysianState}))}>{Object.values(MalaysianState).map(s=><option key={s} value={s}>{s}</option>)}</Select></div>
                                        <Button onClick={handleAddLocation} variant="secondary">Tambah</Button>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <Select label="Kemahiran IT" id="skill-select" value="" onChange={handleAddSkill}>
                                    <option value="" disabled>-- Tambah Kemahiran --</option>
                                    {availableSkills.map(s => <option key={s} value={s}>{s}</option>)}
                                </Select>
                                 {skills.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {skills.map(skill => (
                                            <span key={skill} className="flex items-center gap-2 px-2.5 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                                                {skill}
                                                <button onClick={() => handleRemoveSkill(skill)} className="text-indigo-600 hover:text-indigo-800 font-bold">&times;</button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button onClick={handleSaveChanges}>Simpan Perubahan</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};