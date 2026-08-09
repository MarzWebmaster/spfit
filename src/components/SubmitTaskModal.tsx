import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Textarea } from './ui/Textarea';
import { taskDoneApi } from '../services/api';

interface SubmitTaskModalProps {
  isOpen: boolean;
  taskId: number;
  onSubmit: (success: boolean) => void;
  onCancel: () => void;
}

export const SubmitTaskModal: React.FC<SubmitTaskModalProps> = ({
  isOpen,
  taskId,
  onSubmit,
  onCancel,
}) => {
  const [serviceStartDate, setServiceStartDate] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [remarks, setRemarks] = useState('');
  const [supportPdf, setSupportPdf] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!serviceStartDate.trim()) {
      setError('Tarikh Mula Perkhidmatan wajib diisi');
      return;
    }
    if (!actionTaken.trim()) {
      setError('Tindakan Diambil wajib diisi');
      return;
    }
    if (!supportPdf) {
      setError('Fail sokongan PDF wajib dimuat naik');
      return;
    }
    if (!supportPdf.name.toLowerCase().endsWith('.pdf')) {
      setError('Hanya fail PDF dibenarkan');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('task_id', String(taskId));
      formData.append('service_start_date', serviceStartDate);
      formData.append('action_taken', actionTaken);
      if (remarks.trim()) {
        formData.append('remarks', remarks.trim());
      }
      formData.append('support_pdf', supportPdf);

      const response = await taskDoneApi.create(formData);

      if (response.success) {
        onSubmit(true);
      } else {
        setError((response as any).error || 'Gagal menghantar tugasan');
      }
    } catch (err) {
      console.error('Error submitting task:', err);
      setError('Gagal menghantar tugasan. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Maklumat Hantar Tugasan</h3>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tarikh Mula Perkhidmatan <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={serviceStartDate}
              onChange={(e) => setServiceStartDate(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Format: Pilih tarikh dari kalendar</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tindakan Diambil / Penyelesaian <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={actionTaken}
              onChange={(e) => setActionTaken(e.target.value)}
              placeholder="Contoh: Ganti harddisk, install Windows 11, update driver..."
              rows={4}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Butiran lengkap tindakan yang diambil untuk menyelesaikan tugasan</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Catatan Tambahan / Keterangan
            </label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Opsional: Catatan tambahan jika ada..."
              rows={3}
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Muat Naik Fail Sokongan (PDF) <span className="text-red-500">*</span>
            </label>
            <Input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSupportPdf(file);
              }}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Hanya fail PDF dibenarkan. Medan ini wajib diisi.</p>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Menghantar...' : 'Hantar Tugasan'}
          </Button>
        </div>
      </div>
    </div>
  );
};
