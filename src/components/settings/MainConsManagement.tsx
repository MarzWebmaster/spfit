import React, { useState, useEffect } from 'react';
import { MainCon } from '../../types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ICONS } from '../ui/icons';
import { mainConsApi } from '../../services/api';
import { Modal } from '../ui/Modal';

interface MainConsManagementProps {
  // onBack: () => void; // Optional if we want a back button
}

export const MainConsManagement: React.FC<MainConsManagementProps> = () => {
  const [mainCons, setMainCons] = useState<MainCon[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMainCon, setEditingMainCon] = useState<MainCon | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  const fetchMainCons = async () => {
    setLoading(true);
    try {
      const response = await mainConsApi.getAll();
      if (response.success && response.data) {
        const normalizedMainCons = (response.data as any[]).map((item) => ({
          id: item.id,
          name: item.name,
          contactPerson: item.contactPerson ?? item.contact_person ?? '',
          contactNumber: item.contactNumber ?? item.contact_number ?? '',
          email: item.email ?? '',
          address: item.address ?? '',
          isActive: item.isActive ?? item.is_active ?? false,
        }));
        setMainCons(normalizedMainCons);
      }
    } catch (err) {
      console.error('Error fetching Main Cons:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMainCons();
  }, []);

  const handleOpenModal = (mainCon?: MainCon) => {
    if (mainCon) {
      setEditingMainCon(mainCon);
      setName(mainCon.name);
      setContactPerson(mainCon.contactPerson || '');
      setContactNumber(mainCon.contactNumber || '');
      setEmail(mainCon.email || '');
      setAddress(mainCon.address || '');
      setIsActive(mainCon.isActive);
    } else {
      setEditingMainCon(null);
      setName('');
      setContactPerson('');
      setContactNumber('');
      setEmail('');
      setAddress('');
      setIsActive(true);
    }
    setError('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nama Main-Con diperlukan');
      return;
    }

    try {
      const payload = {
        name,
        contact_person: contactPerson,
        contact_number: contactNumber,
        email,
        address,
        is_active: isActive,
      };

      if (editingMainCon) {
        await mainConsApi.update(editingMainCon.id, payload);
      } else {
        await mainConsApi.create(payload);
      }

      setIsModalOpen(false);
      fetchMainCons();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan Main-Con');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Adakah anda pasti mahu memadam Main-Con ini?')) {
      try {
        await mainConsApi.delete(id);
        fetchMainCons();
      } catch (err: any) {
        alert(err.message || 'Gagal memadam Main-Con');
      }
    }
  };

  const handleToggleActive = async (mainCon: MainCon) => {
    try {
      await mainConsApi.update(mainCon.id, {
        is_active: !mainCon.isActive,
      });
      fetchMainCons();
    } catch (err: any) {
      alert(err.message || 'Gagal mengemaskini status Main-Con');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Pengurusan Main-Con</h2>
          <p className="mt-1 text-sm text-gray-600">Urus senarai kontraktor utama.</p>
        </div>
        <Button onClick={() => handleOpenModal()} icon={ICONS.plus}>Tambah Main-Con</Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nama</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hubungan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tindakan</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                    <tr><td colSpan={5} className="px-6 py-4 text-center">Memuatkan...</td></tr>
                ) : mainCons.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Tiada Main-Con dijumpai.</td></tr>
                ) : (
                    mainCons.map((mc) => (
                        <tr key={mc.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{mc.name}</div>
                                <div className="text-xs text-gray-500">{mc.address}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{mc.contactPerson}</div>
                                <div className="text-xs text-gray-500">{mc.contactNumber}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{mc.email}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${mc.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {mc.isActive ? 'Aktif' : 'Tidak Aktif'}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                      onClick={() => handleOpenModal(mc)}
                                      className="text-indigo-600 hover:text-indigo-900"
                                      title="Edit"
                                      aria-label="Edit"
                                    >
                                      {ICONS.pencil}
                                    </button>
                                    <button
                                      onClick={() => handleDelete(mc.id)}
                                      className="text-red-600 hover:text-red-900"
                                      title="Padam"
                                      aria-label="Padam"
                                    >
                                      {ICONS.trash}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleActive(mc)}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${mc.isActive ? 'bg-indigo-600' : 'bg-gray-300'}`}
                                      title={mc.isActive ? 'Set Tidak Aktif' : 'Set Aktif'}
                                      aria-label={mc.isActive ? 'Set Tidak Aktif' : 'Set Aktif'}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mc.isActive ? 'translate-x-6' : 'translate-x-1'}`}
                                      />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMainCon ? 'Edit Main-Con' : 'Tambah Main-Con'}
        footer={
            <div className="flex flex-wrap justify-end gap-2 w-full">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Batal</Button>
                <Button onClick={handleSave}>Simpan</Button>
            </div>
        }
      >
          <div className="space-y-4">
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Input label="Nama Syarikat (Main-Con)" value={name} onChange={e => setName(e.target.value)} required />
              <Input label="Orang Hubungan (PIC)" value={contactPerson} onChange={e => setContactPerson(e.target.value)} />
              <Input label="No. Telefon" value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
              <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <Input label="Alamat" value={address} onChange={e => setAddress(e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <button
                  type="button"
                  onClick={() => setIsActive(prev => !prev)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  aria-label="Toggle status Main-Con"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
                <span className={`ml-3 text-sm font-medium ${isActive ? 'text-green-700' : 'text-red-700'}`}>
                  {isActive ? 'Aktif' : 'Tidak Aktif'}
                </span>
              </div>
          </div>
      </Modal>
    </div>
  );
};
