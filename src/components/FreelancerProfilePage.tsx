import React, { useState, useEffect } from 'react';
import type { Freelancer, Task, Location, BankAccount } from '../types';
import { TaskStatus, MalaysianState } from '../types';
import { Badge } from './ui/Badge';
import { freelancersApi, tasksApi } from '../services/api';
import { X, Edit2 } from 'lucide-react';

interface FreelancerProfilePageProps {
    freelancer: Freelancer;
    tasks?: Task[];
    onBack: () => void;
    onViewTask: (task: Task) => void;
    onFreelancerUpdate?: (updatedFreelancer: Freelancer) => void;
}

type ActiveTab = 'tasks' | 'bankAccounts' | 'payments' | 'feedback';

type BankAccountFormState = {
    bank_name: string;
    account_holder_name: string;
    account_number: string;
    is_default: boolean;
};

const OverallStarRating: React.FC<{ rating: number }> = ({ rating }) => {
    return (
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
                <svg key={`full-${i}`} className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            ))}
        </div>
    );
};

const TaskStarRating: React.FC<{ rating: number }> = ({ rating }) => {
    return (
        <div className="flex items-center">
            {[...Array(5)].map((_, i) => (
                <svg key={i} className={`w-4 h-4 ${i < rating ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
            ))}
        </div>
    );
};

export const FreelancerProfilePage: React.FC<FreelancerProfilePageProps> = ({ freelancer, onBack, onViewTask, onFreelancerUpdate }) => {
    // Normalize to avoid undefined values (prevents uncontrolled input warnings)
    const normalizeFreelancer = (f: Freelancer): Freelancer => ({
        ...f,
        email: f.email || '',
        phone: f.phone || '',
        icNumber: (f as any).icNumber || (f as any).ic_number || '',
        experience: f.experience ?? 0,
        // Ensure rating is always a number to avoid toFixed crashes
        rating: Number.isFinite(Number((f as any).rating)) ? Number((f as any).rating) : 0,
        address: (f as any).address || '',
        city: (f as any).city || '',
        postcode: (f as any).postcode || '',
        state: (f as any).state || '',
        locations: f.locations || [],
        bankAccounts: (f as any).bankAccounts || [],
        skills: f.skills || [],
        isAvailable: f.isAvailable ?? true,
    });

    const initialFreelancer = normalizeFreelancer(freelancer);

    const [activeTab, setActiveTab] = useState<ActiveTab>('tasks');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [currentFreelancer, setCurrentFreelancer] = useState<Freelancer>(initialFreelancer);
    const [editFormData, setEditFormData] = useState<Freelancer>(initialFreelancer);
    const [newLocation, setNewLocation] = useState<Location>({ district: '', state: MalaysianState.KUALA_LUMPUR });
    const [editLocations, setEditLocations] = useState<Location[]>(initialFreelancer.locations || []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(initialFreelancer.bankAccounts || []);
    const [bankLoading, setBankLoading] = useState(false);
    const [bankError, setBankError] = useState('');
    const [editingBankAccountId, setEditingBankAccountId] = useState<number | null>(null);
    const [selectedBankAccountId, setSelectedBankAccountId] = useState<number | null>(null);
    const [freelancerTasks, setFreelancerTasks] = useState<Task[]>([]);
    const [tasksLoading, setTasksLoading] = useState(false);
    const [tasksError, setTasksError] = useState('');
    const [bankForm, setBankForm] = useState<BankAccountFormState>({
        bank_name: '',
        account_holder_name: '',
        account_number: '',
        is_default: false,
    });

    // Keep local state in sync when parent prop changes
    useEffect(() => {
        const normalized = normalizeFreelancer(freelancer);
        setCurrentFreelancer(normalized);
        setEditFormData(normalized);
        setEditLocations(normalized.locations || []);
        setBankAccounts(normalized.bankAccounts || []);
    }, [freelancer]);

    const resetBankForm = () => {
        setEditingBankAccountId(null);
        setBankForm({
            bank_name: '',
            account_holder_name: '',
            account_number: '',
            is_default: false,
        });
    };

    const loadBankAccounts = async () => {
        if (!currentFreelancer?.id) return;

        setBankLoading(true);
        setBankError('');

        try {
            const response = await freelancersApi.getBankAccounts(currentFreelancer.id);
            if (!response.success) {
                throw new Error(response.error || 'Gagal mendapatkan akaun bank');
            }

            const payload = response.data as any;
            const fetchedAccounts: BankAccount[] = Array.isArray(payload?.bankAccounts)
                ? payload.bankAccounts
                : [];

            setBankAccounts(fetchedAccounts);
            setSelectedBankAccountId((prev) => {
                if (fetchedAccounts.length === 0) return null;
                if (prev && fetchedAccounts.some((account) => account.id === prev)) return prev;
                return fetchedAccounts[0].id;
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Gagal mendapatkan akaun bank';
            setBankError(errorMessage);
        } finally {
            setBankLoading(false);
        }
    };

    useEffect(() => {
        loadBankAccounts();
    }, [currentFreelancer.id]);
    
    const loadFreelancerTasks = async () => {
        if (!currentFreelancer?.id) return;
        setTasksLoading(true);
        setTasksError('');
        try {
            const response = await tasksApi.getAll(1, 100, { assigned_to: currentFreelancer.id });
            if (response.success) {
                const data = response.data as any;
                const rawTasks = data?.tasks || data?.data || [];
                const mapped = Array.isArray(rawTasks) ? rawTasks.map((task: any) => ({
                    ...task,
                    logNumber: task.log_number || task.logNumber,
                    assignedTo: task.assigned_to || task.assignedTo,
                    offerPrice: task.offer_price !== undefined ? Number(task.offer_price) : (task.offerPrice || 0),
                    status: task.status || task.statusSetting?.name,
                })) : [];
                setFreelancerTasks(mapped);
            }
        } catch (err) {
            setTasksError(err instanceof Error ? err.message : 'Gagal memuatkan tugasan');
        } finally {
            setTasksLoading(false);
        }
    };

    useEffect(() => {
        loadFreelancerTasks();
    }, [currentFreelancer.id]);
    
    const paymentHistory = freelancerTasks.filter(task => task.status === TaskStatus.TELAH_DIBAYAR || task.status === TaskStatus.SELESAI_PENUH);
    const tasksWithFeedback = freelancerTasks.filter(task => !!task.feedback);

    const handleEditClick = () => {
        const normalized = normalizeFreelancer(currentFreelancer);
        setIsEditingProfile(true);
        setEditFormData(normalized);
        setEditLocations(normalized.locations || []);
        setError('');
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'experience') {
            setEditFormData({ ...editFormData, [name]: parseInt(value) || 0 });
        } else {
            setEditFormData({ ...editFormData, [name]: value });
        }
    };

    const handleAddLocation = () => {
        if (newLocation.district.trim()) {
            setEditLocations([...editLocations, newLocation]);
            setNewLocation({ district: '', state: MalaysianState.KUALA_LUMPUR });
        }
    };

    const handleRemoveLocation = (index: number) => {
        setEditLocations(editLocations.filter((_, i) => i !== index));
    };

    const handleSaveProfile = async () => {
        setError('');
        setLoading(true);
        try {
            console.log('🔍 Debug - editLocations state:', editLocations);
            console.log('🔍 Debug - editFormData:', editFormData);
            
            // Validate that at least one location is added
            if (!editLocations || editLocations.length === 0) {
                setError('Sila tambah sekurang-kurangnya satu lokasi perkhidmatan');
                setLoading(false);
                return;
            }

            // Format data untuk API endpoint
            const payloadData = {
                name: editFormData.name,
                phone: editFormData.phone,
                ic_number: editFormData.icNumber || editFormData.ic_number,
                experience: Number(editFormData.experience) || 0,
                address: editFormData.address,
                city: editFormData.city,
                postcode: editFormData.postcode,
                state: editFormData.state,
                locations: editLocations,
                skills: editFormData.skills || []
            };
            
            console.log('📝 Saving profile with data:', payloadData);
            console.log('📍 Locations being sent:', JSON.stringify(payloadData.locations));

            // Optimistic update: set UI immediately with local data
            const optimisticFreelancer = normalizeFreelancer({
                ...currentFreelancer,
                ...editFormData,
                locations: editLocations,
                icNumber: payloadData.ic_number
            });
            setCurrentFreelancer(optimisticFreelancer);
            if (onFreelancerUpdate) {
                onFreelancerUpdate(optimisticFreelancer);
            }

            // Timeout guard so UI won't hang if request stalls
            const timeoutMs = 10000;
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Permintaan mengambil masa terlalu lama')), timeoutMs));
            const response = await Promise.race([
                freelancersApi.updateProfile(editFormData.id, payloadData),
                timeoutPromise
            ]) as any;

            console.log('✅ Profile save response:', response);
            
            if (!response.success) {
                throw new Error(response.error || 'Gagal mengemas kini profil');
            }

            // Check if response contains updated freelancer data
            if (response.data) {
                const serverData = response.data.freelancer || response.data.user || response.data;
                console.log('📦 Server returned data:', serverData);
                
                // Merge server data with local changes
                const updatedFreelancer = normalizeFreelancer({ 
                    ...optimisticFreelancer,
                    ...serverData,
                    locations: editLocations, // Use local locations as they're the source of truth
                    icNumber: payloadData.ic_number
                });
                
                console.log('🔄 Updated freelancer state:', updatedFreelancer);
                setCurrentFreelancer(updatedFreelancer);
                
                if (onFreelancerUpdate) {
                    onFreelancerUpdate(updatedFreelancer);
                }
            }
            
            setIsEditingProfile(false);
        } catch (err) {
            console.error('❌ Save error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Gagal mengemas kini profil';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const handleBankFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setBankForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleEditBankAccount = (account: BankAccount) => {
        setBankError('');
        setSelectedBankAccountId(account.id);
        setEditingBankAccountId(account.id);
        setBankForm({
            bank_name: account.bank_name,
            account_holder_name: account.account_holder_name,
            account_number: account.account_number,
            is_default: account.is_default,
        });
    };

    const handleSaveBankAccount = async () => {
        if (!bankForm.bank_name.trim() || !bankForm.account_holder_name.trim() || !bankForm.account_number.trim()) {
            setBankError('Sila lengkapkan semua maklumat akaun bank.');
            return;
        }

        setBankLoading(true);
        setBankError('');

        try {
            const payload = {
                bank_name: bankForm.bank_name.trim(),
                account_holder_name: bankForm.account_holder_name.trim(),
                account_number: bankForm.account_number.trim(),
                is_default: bankForm.is_default,
            };

            const response = editingBankAccountId
                ? await freelancersApi.updateBankAccount(currentFreelancer.id, editingBankAccountId, payload)
                : await freelancersApi.createBankAccount(currentFreelancer.id, payload);

            if (!response.success) {
                throw new Error(response.error || 'Gagal menyimpan akaun bank');
            }

            resetBankForm();
            await loadBankAccounts();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Gagal menyimpan akaun bank';
            setBankError(errorMessage);
        } finally {
            setBankLoading(false);
        }
    };

    const handleDeleteBankAccount = async (accountId: number) => {
        const confirmed = window.confirm('Padam akaun bank ini?');
        if (!confirmed) return;

        setBankLoading(true);
        setBankError('');

        try {
            const response = await freelancersApi.deleteBankAccount(currentFreelancer.id, accountId);
            if (!response.success) {
                throw new Error(response.error || 'Gagal memadam akaun bank');
            }

            if (editingBankAccountId === accountId) {
                resetBankForm();
            }
            await loadBankAccounts();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Gagal memadam akaun bank';
            setBankError(errorMessage);
        } finally {
            setBankLoading(false);
        }
    };

    const handleSetDefaultBankAccount = async (account: BankAccount) => {
        if (account.is_default) return;

        setBankLoading(true);
        setBankError('');

        try {
            const response = await freelancersApi.updateBankAccount(currentFreelancer.id, account.id, {
                is_default: true,
            });

            if (!response.success) {
                throw new Error(response.error || 'Gagal menetapkan akaun utama');
            }

            await loadBankAccounts();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Gagal menetapkan akaun utama';
            setBankError(errorMessage);
        } finally {
            setBankLoading(false);
        }
    };

    const maskAccountNumber = (value: string) => {
        if (!value) return '-';
        if (value.length <= 4) return value;
        return `****${value.slice(-4)}`;
    };

    const selectedBankAccount = bankAccounts.find((account) => account.id === selectedBankAccountId) || null;

    const malaysianStates = Object.values(MalaysianState);

    return (
        <div className="flex flex-col gap-6 lg:flex-row">
            {/* Profile Sidebar */}
            <div className="w-full flex-shrink-0 lg:w-72">
                <div className="bg-white shadow-md rounded-lg overflow-hidden lg:sticky lg:top-6">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
                        <div className="flex justify-between items-start">
                            <h2 className="text-xl font-bold">{currentFreelancer.name}</h2>
                            {!isEditingProfile && (
                                <button
                                    onClick={handleEditClick}
                                    className="p-1 hover:bg-indigo-800 rounded transition"
                                    title="Edit profil"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Profile Content */}
                    <div className="p-6">
                        {isEditingProfile ? (
                            <div className="space-y-4">
                                {error && (
                                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                        <p className="text-sm text-red-600">{error}</p>
                                    </div>
                                )}

                                {/* Edit Form */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penuh</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={editFormData.name}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Kad Pengenalan</label>
                                    <input
                                        type="text"
                                        name="icNumber"
                                        value={editFormData.icNumber || (editFormData as any).ic_number || ''}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={editFormData.email}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                </div>

                                <div className="border rounded-md p-3 space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Alamat Rumah</label>
                                    <textarea
                                        name="address"
                                        value={editFormData.address}
                                        onChange={handleInputChange}
                                        placeholder="Alamat lengkap"
                                        rows={2}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <input
                                            type="text"
                                            name="city"
                                            value={editFormData.city}
                                            onChange={handleInputChange}
                                            placeholder="Daerah / Bandar"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                        <input
                                            type="text"
                                            name="postcode"
                                            value={editFormData.postcode}
                                            onChange={handleInputChange}
                                            placeholder="Poskod"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                        <input
                                            type="text"
                                            name="state"
                                            value={editFormData.state}
                                            onChange={handleInputChange}
                                            placeholder="Negeri"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={editFormData.phone}
                                        onChange={handleInputChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Pengalaman</label>
                                    <input
                                        type="number"
                                        name="experience"
                                        value={editFormData.experience}
                                        onChange={handleInputChange}
                                        min="0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Status Ketersediaan</label>
                                    <select
                                        value={editFormData.isAvailable ? 'available' : 'unavailable'}
                                        onChange={(e) => setEditFormData({ ...editFormData, isAvailable: e.target.value === 'available' })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    >
                                        <option value="available">Tersedia</option>
                                        <option value="unavailable">Tidak Tersedia</option>
                                    </select>
                                </div>

                                {/* Lokasi */}
                                <div className="border-t pt-4">
                                    <h3 className="font-semibold text-gray-700 mb-3 text-sm">Lokasi Perkhidmatan</h3>
                                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                        {editLocations.map((loc, index) => (
                                            <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                                                <span>{loc.district}, {loc.state}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveLocation(index)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            value={newLocation.district}
                                            onChange={(e) => setNewLocation({ ...newLocation, district: e.target.value })}
                                            placeholder="Daerah"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        />
                                        <select
                                            value={newLocation.state}
                                            onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value as MalaysianState })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                        >
                                            {malaysianStates.map((state) => (
                                                <option key={state} value={state}>{state}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={handleAddLocation}
                                            className="w-full px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm"
                                        >
                                            Tambah Lokasi
                                        </button>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-2 pt-4 border-t">
                                    <button
                                        onClick={() => setIsEditingProfile(false)}
                                        className="flex-1 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 text-sm font-medium"
                                    >
                                        Batal
                                    </button>
                                    <button
                                        onClick={handleSaveProfile}
                                        disabled={loading}
                                        className="flex-1 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                                    >
                                        {loading ? 'Simpan...' : 'Simpan'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-gray-500 font-semibold mb-1">EMAIL</p>
                                    <p className="text-sm text-gray-700">{currentFreelancer.email}</p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 font-semibold mb-1">TELEFON</p>
                                    <p className="text-sm text-gray-700">{currentFreelancer.phone}</p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 font-semibold mb-1">ALAMAT RUMAH</p>
                                    <p className="text-sm text-gray-700">{currentFreelancer.address || '-'}</p>
                                    {(currentFreelancer.city || currentFreelancer.postcode || currentFreelancer.state) && (
                                        <p className="text-sm text-gray-500">{currentFreelancer.city}{currentFreelancer.city && currentFreelancer.postcode ? ', ' : ''}{currentFreelancer.postcode}{currentFreelancer.postcode && currentFreelancer.state ? ' ' : ''}{currentFreelancer.state}</p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 font-semibold mb-1">NO. KAD PENGENALAN</p>
                                    <p className="text-sm text-gray-700">{currentFreelancer.icNumber || (currentFreelancer as any).ic_number || '-'}</p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 font-semibold mb-1">PENGALAMAN</p>
                                    <p className="text-sm text-gray-700">{currentFreelancer.experience} tahun</p>
                                </div>

                                <div>
                                    <p className="text-xs text-gray-500 font-semibold mb-1">KETERSEDIAAN</p>
                                    <p className="text-sm text-gray-700">{currentFreelancer.isAvailable ? '✓ Tersedia' : '✗ Tidak Tersedia'}</p>
                                </div>

                                <div className="border-t pt-4">
                                    <p className="text-xs text-gray-500 font-semibold mb-2">PENILAIAN</p>
                                    <div className="flex items-center gap-2">
                                        <OverallStarRating rating={currentFreelancer.rating} />
                                        <span className="text-sm font-semibold text-gray-700">{currentFreelancer.rating.toFixed(1)} / 5.0</span>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <p className="text-xs text-gray-500 font-semibold mb-2">LOKASI PERKHIDMATAN</p>
                                    <ul className="space-y-1">
                                        {currentFreelancer.locations.map((loc, index) => (
                                            <li key={index} className="text-sm text-gray-700 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                                                {loc.district}, {loc.state}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <button
                                    onClick={onBack}
                                    className="w-full px-4 py-2 mt-4 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 text-sm font-medium"
                                >
                                    Kembali ke Senarai
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content - Tabs */}
            <div className="flex-1 bg-white shadow-md rounded-lg overflow-hidden">
                <div className="border-b border-gray-200">
                    <div className="px-4 sm:px-6 py-4 overflow-x-auto">
                        <nav className="-mb-px flex min-w-max gap-6 sm:gap-8" aria-label="Tabs">
                            <button
                                onClick={() => setActiveTab('tasks')}
                                className={`${activeTab === 'tasks' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Tugasan ({freelancerTasks.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('bankAccounts')}
                                className={`${activeTab === 'bankAccounts' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Akaun Bank ({bankAccounts.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('payments')}
                                className={`${activeTab === 'payments' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Sejarah Pembayaran ({paymentHistory.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('feedback')}
                                className={`${activeTab === 'feedback' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                            >
                                Maklum Balas ({tasksWithFeedback.length})
                            </button>
                        </nav>
                    </div>
                </div>

                <div className="p-4 sm:p-6">
                    {activeTab === 'tasks' && (
                        <div className="overflow-x-auto">
                           <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Tugasan</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Log</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tajuk</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lokasi Klien</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Harga (RM)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Penilaian</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {freelancerTasks.map((task) => (
                                        <tr
                                            key={task.id}
                                            onClick={() => onViewTask(task)}
                                            className="cursor-pointer hover:bg-gray-50"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.logNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.title}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.clientLocation}, {task.state}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">{task.offerPrice.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap"><Badge status={task.status} /></td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {task.feedback ? <TaskStarRating rating={task.feedback.overall} /> : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                             {freelancerTasks.length === 0 && <p className="text-center text-gray-500 p-6">Tiada tugasan ditemui untuk freelancer ini.</p>}
                        </div>
                    )}

                    {activeTab === 'payments' && (
                         <div className="overflow-x-auto">
                           <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Tugasan</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Log</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tajuk</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh Laporan</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh Dibayar</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jumlah (RM)</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Penilaian</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {paymentHistory.map((task) => (
                                        <tr
                                            key={task.id}
                                            onClick={() => onViewTask(task)}
                                            className="cursor-pointer hover:bg-gray-50"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.id}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.logNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{task.title}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.report?.submittedAt || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.paymentDate || 'N/A'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-green-700 font-bold">{task.offerPrice.toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {task.feedback ? <TaskStarRating rating={task.feedback.overall} /> : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {paymentHistory.length === 0 && <p className="text-center text-gray-500 p-6">Tiada sejarah pembayaran ditemui.</p>}
                        </div>
                    )}

                    {activeTab === 'bankAccounts' && (
                        <div className="space-y-6">
                            {bankError && (
                                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                    <p className="text-sm text-red-600">{bankError}</p>
                                </div>
                            )}

                            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                <h3 className="text-sm font-semibold text-gray-800 mb-4">
                                    {editingBankAccountId ? 'Kemaskini Akaun Bank' : 'Tambah Akaun Bank Baru'}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Bank</label>
                                        <input
                                            name="bank_name"
                                            value={bankForm.bank_name}
                                            onChange={handleBankFormChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            placeholder="Contoh: Maybank"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemegang Akaun</label>
                                        <input
                                            name="account_holder_name"
                                            value={bankForm.account_holder_name}
                                            onChange={handleBankFormChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            placeholder="Seperti dalam bank"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">No Akaun</label>
                                        <input
                                            name="account_number"
                                            value={bankForm.account_number}
                                            onChange={handleBankFormChange}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                            placeholder="Nombor akaun"
                                        />
                                    </div>
                                    <div className="flex items-end">
                                        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                name="is_default"
                                                checked={bankForm.is_default}
                                                onChange={handleBankFormChange}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            Jadikan akaun utama
                                        </label>
                                    </div>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                        onClick={handleSaveBankAccount}
                                        disabled={bankLoading}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-50"
                                    >
                                        {bankLoading ? 'Menyimpan...' : editingBankAccountId ? 'Kemaskini Akaun' : 'Tambah Akaun'}
                                    </button>
                                    {editingBankAccountId && (
                                        <button
                                            onClick={resetBankForm}
                                            type="button"
                                            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
                                        >
                                            Batal Edit
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bank</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pemegang Akaun</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Akaun</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tindakan</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {bankAccounts.map((account) => (
                                            <tr
                                                key={account.id}
                                                className={`cursor-pointer hover:bg-gray-50 ${selectedBankAccountId === account.id ? 'bg-indigo-50' : ''}`}
                                                onClick={() => setSelectedBankAccountId(account.id)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">{account.bank_name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{account.account_holder_name}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{maskAccountNumber(account.account_number)}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    {account.is_default ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Utama</span>
                                                    ) : (
                                                        <span className="text-gray-400">Sekunder</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                    <div className="flex items-center gap-3">
                                                        {!account.is_default && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSetDefaultBankAccount(account);
                                                                }}
                                                                className="text-indigo-600 hover:text-indigo-800 font-medium"
                                                            >
                                                                Jadikan Utama
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditBankAccount(account);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteBankAccount(account.id);
                                                            }}
                                                            className="text-red-600 hover:text-red-800 font-medium"
                                                        >
                                                            Padam
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {!bankLoading && bankAccounts.length === 0 && (
                                    <p className="text-center text-gray-500 p-6">Tiada akaun bank direkodkan.</p>
                                )}
                            </div>

                            {selectedBankAccount && (
                                <div className="border border-indigo-100 rounded-lg bg-indigo-50 p-4">
                                    <h4 className="text-sm font-semibold text-indigo-800 mb-3">Butiran Akaun Dipilih</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-xs text-indigo-500 font-semibold">NAMA BANK</p>
                                            <p className="text-gray-800">{selectedBankAccount.bank_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-indigo-500 font-semibold">NAMA PEMEGANG AKAUN</p>
                                            <p className="text-gray-800">{selectedBankAccount.account_holder_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-indigo-500 font-semibold">NO AKAUN (PENUH)</p>
                                            <p className="text-gray-800">{selectedBankAccount.account_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-indigo-500 font-semibold">STATUS</p>
                                            <p className="text-gray-800">{selectedBankAccount.is_default ? 'Akaun Utama' : 'Akaun Sekunder'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'feedback' && (
                        <div className="space-y-4">
                            {tasksWithFeedback.length > 0 ? (
                                tasksWithFeedback.map((task) => (
                                    <div key={task.id} className="p-4 border rounded-md bg-gray-50">
                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start">
                                            <div>
                                                <p className="font-semibold text-gray-800">{task.title}</p>
                                                <p className="text-xs text-gray-500">Selesai pada: {task.report?.submittedAt || 'N/A'}</p>
                                            </div>
                                            <div className="text-right flex-shrink-0 ml-4">
                                                <span className="text-sm font-medium text-gray-600">Keseluruhan</span>
                                                <TaskStarRating rating={task.feedback!.overall} />
                                            </div>
                                        </div>

                                        {/* Per-criteria hidden — only overall shown to freelancer */}

                                        {/* Komen disembunyikan — hanya overall ditunjukkan */}
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 p-6">Tiada maklum balas ditemui untuk freelancer ini.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};