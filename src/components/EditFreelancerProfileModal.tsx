import React, { useState } from 'react';
import type { Freelancer, Location } from '../types';
import { MalaysianState } from '../types';
import { Button } from './ui/Button';
import { X } from 'lucide-react';

interface EditFreelancerProfileModalProps {
  freelancer: Freelancer;
  onClose: () => void;
  onSave: (updatedFreelancer: Freelancer) => Promise<void>;
}

export const EditFreelancerProfileModal: React.FC<EditFreelancerProfileModalProps> = ({
  freelancer,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Freelancer>(freelancer);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locations, setLocations] = useState<Location[]>(freelancer.locations || []);
  const [newLocation, setNewLocation] = useState<Location>({
    district: '',
    state: MalaysianState.KUALA_LUMPUR,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'experience') {
      setFormData({ ...formData, [name]: parseInt(value) || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleAddLocation = () => {
    if (newLocation.district.trim()) {
      setLocations([...locations, newLocation]);
      setNewLocation({ district: '', state: MalaysianState.KUALA_LUMPUR });
    }
  };

  const handleRemoveLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const updatedFreelancer = {
        ...formData,
        locations,
      };
      await onSave(updatedFreelancer);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengemas kini profil');
    } finally {
      setLoading(false);
    }
  };

  const malaysianStates = Object.values(MalaysianState);

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Edit Profil Freelancer</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Maklumat Peribadi */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Maklumat Peribadi</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Penuh</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Kad Pengenalan</label>
                <input
                  type="text"
                  name="icNumber"
                  value={formData.icNumber}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombor Telefon</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Pengalaman dan Ketersediaan */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Pengalaman & Ketersediaan</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tahun Pengalaman</label>
                <input
                  type="number"
                  name="experience"
                  value={formData.experience}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status Ketersediaan</label>
                <select
                  name="isAvailable"
                  value={formData.isAvailable ? 'available' : 'unavailable'}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.value === 'available' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="available">Tersedia</option>
                  <option value="unavailable">Tidak Tersedia</option>
                </select>
              </div>
            </div>
          </div>

          {/* Lokasi Perkhidmatan */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lokasi Perkhidmatan</h3>
            <div className="space-y-3 mb-4">
              {locations.map((loc, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                  <span className="text-sm text-gray-700">
                    {loc.district}, {loc.state}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveLocation(index)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                  >
                    Buang
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Daerah/Nama Lokasi</label>
                <input
                  type="text"
                  value={newLocation.district}
                  onChange={(e) => setNewLocation({ ...newLocation, district: e.target.value })}
                  placeholder="Cth: Kuala Lumpur, Shah Alam"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Negeri</label>
                <select
                  value={newLocation.state}
                  onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value as MalaysianState })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {malaysianStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleAddLocation}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium text-sm"
              >
                Tambah
              </button>
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="flex gap-3 justify-end border-t pt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
