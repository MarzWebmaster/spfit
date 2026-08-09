import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from './ui/Button';
import { taskRemindersApi } from '../services/api';

export const ArrivalConfirmationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const isTokenMissing = useMemo(() => token.trim().length === 0, [token]);

  const handleConfirm = async () => {
    if (isTokenMissing || submitting) return;

    setSubmitting(true);
    setResult(null);

    try {
      const coords = await new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Peranti ini tidak menyokong GPS browser.'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
          () => reject(new Error('Lokasi tidak dapat diperoleh. Sila benarkan akses GPS.')),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });

      const response = await taskRemindersApi.confirmArrival(token, coords);
      if (!(response as any)?.success) {
        throw new Error((response as any)?.error || 'Gagal merekodkan kehadiran.');
      }

      setResult({ type: 'success', text: 'Kehadiran anda berjaya direkodkan. Reminder hadir ke lokasi akan dihentikan.' });
    } catch (error: any) {
      setResult({ type: 'error', text: error?.message || 'Gagal merekodkan kehadiran.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-slate-200 p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Telah Tiba Di Lokasi</h1>
          <p className="text-sm text-slate-600 mt-2">
            Tekan butang di bawah untuk sahkan anda sudah tiba. Sistem akan ambil GPS semasa sebagai bukti kehadiran dan menghentikan reminder hadir ke lokasi.
          </p>
        </div>

        {result && (
          <div className={`rounded-md px-4 py-3 text-sm ${result.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {result.text}
          </div>
        )}

        {isTokenMissing ? (
          <div className="rounded-md bg-red-100 px-4 py-3 text-sm text-red-700">
            Pautan tidak lengkap atau token tiada.
          </div>
        ) : (
          <Button onClick={handleConfirm} disabled={submitting} className="w-full">
            {submitting ? 'Merekodkan Kehadiran...' : 'Sahkan Kehadiran & Hantar GPS'}
          </Button>
        )}
      </div>
    </div>
  );
};