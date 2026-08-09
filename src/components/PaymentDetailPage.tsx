import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { paymentsApi } from '../services/api';
import type { Payment } from '../types';
import { PaymentStatus } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { getApiBaseUrl } from '../utils/apiUrl';

interface PaymentDetailPageProps {
  canApprove: boolean;
  canMarkPaid: boolean;
}

export const PaymentDetailPage: React.FC<PaymentDetailPageProps> = ({ canApprove, canMarkPaid }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentSlip, setPaymentSlip] = useState<File | null>(null);

  const resolveUploadUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
    if (rawUrl.startsWith('/uploads/')) {
      const apiUrl = getApiBaseUrl();
      if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
        return `${new URL(apiUrl).origin}${rawUrl}`;
      }
      return rawUrl;
    }
    return rawUrl;
  };

  const loadPayment = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await paymentsApi.getById(Number(id));
      if (!response.success || !response.data) {
        setError((response as any).error || 'Gagal memuatkan butiran bayaran');
        return;
      }

      const payload = response.data as any;
      const loadedPayment = (payload.payment || payload) as Payment;
      setPayment(loadedPayment);
      setPaymentReference(loadedPayment.payment_reference || '');
      setPaymentSlip(null);
    } catch (e) {
      console.error(e);
      setError('Gagal memuatkan butiran bayaran');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayment();
  }, [id]);

  const handleApprove = async () => {
    if (!payment) return;
    try {
      setProcessing(true);
      setError(null);
      const response = await paymentsApi.approve(payment.id);
      if (!response.success) {
        setError((response as any).error || 'Gagal meluluskan pembayaran');
        return;
      }
      await loadPayment();
    } catch (e) {
      console.error(e);
      setError('Gagal meluluskan pembayaran');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!payment) return;
    const reference = paymentReference.trim();
    if (!reference) {
      setError('Rujukan pembayaran diperlukan');
      return;
    }

    if (!paymentSlip) {
      setError('Slip pembayaran diperlukan');
      return;
    }

    if (paymentSlip.size > 2 * 1024 * 1024) {
      setError('Saiz slip pembayaran melebihi 2MB');
      return;
    }

    try {
      setProcessing(true);
      setError(null);
      const formData = new FormData();
      formData.append('payment_reference', reference);
      formData.append('payment_slip', paymentSlip);

      const response = await paymentsApi.markPaid(payment.id, formData);
      if (!response.success) {
        setError((response as any).error || 'Gagal menanda pembayaran sebagai telah dibayar');
        return;
      }
      await loadPayment();
    } catch (e) {
      console.error(e);
      setError('Gagal menanda pembayaran sebagai telah dibayar');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-600">Memuatkan butiran bayaran...</div>;
  }

  if (!payment) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-red-600">{error || 'Rekod bayaran tidak dijumpai'}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/payment-approvals')}>Kembali</Button>
          <Button onClick={loadPayment}>Cuba Lagi</Button>
        </div>
      </div>
    );
  }

  const isPaid = payment.status === PaymentStatus.TELAH_DIBAYAR;
  const canFillPaymentInfo = canMarkPaid && payment.status === PaymentStatus.DILULUSKAN && !isPaid;
  const paidDateValue = (isPaid && payment.paid_at ? new Date(payment.paid_at) : new Date()).toLocaleDateString('en-GB');

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Butiran Bayaran</h1>
        <div className="flex flex-wrap items-center gap-2">
          {canApprove && payment.status === PaymentStatus.MENUNGGU_KELULUSAN && (
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? 'Memproses...' : 'Luluskan'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => navigate('/payment-approvals')}>Kembali</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Maklumat Penerima Bayaran</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Nama" id="recipient_name" value={payment.recipient_name || '-'} disabled />
          <Input label="No Akaun" id="recipient_account_number" value={payment.recipient_account_number || '-'} disabled />
          <Input label="Nama Bank" id="recipient_bank_name" value={payment.recipient_bank_name || '-'} disabled />
          <Input label="Email" id="recipient_email" value={payment.recipient_email || '-'} disabled />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Maklumat Tugasan</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="No Log" id="task_log_number" value={payment.task?.log_number || '-'} disabled />
          <Input label="Main-Con" id="task_main_con" value={payment.task?.mainCon?.name || '-'} disabled />
          <Input label="Tajuk Tugasan" id="task_title" value={payment.task?.title || '-'} disabled />
          <Input
            label="Tarikh Keperluan (Deadline)"
            id="task_deadline"
            value={payment.task?.deadline ? new Date(payment.task.deadline).toLocaleDateString('en-GB') : '-'}
            disabled
          />
          <Input label="Amaun (RM)" id="payment_amount" value={`RM ${Number(payment.amount || 0).toFixed(2)}`} disabled />
          <Input label="Status Bayaran" id="payment_status" value={payment.status || '-'} disabled />
        </div>

        <div>
          <label htmlFor="payment_remarks" className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
          <textarea
            id="payment_remarks"
            rows={3}
            value={payment.remarks || '-'}
            disabled
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-100"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Maklumat Pembayaran</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Tarikh Bayaran"
            id="payment_paid_date"
            value={paidDateValue}
            disabled
          />
          <Input
            label="Rujukan Pembayaran"
            id="payment_reference"
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder="Masukkan rujukan pembayaran"
            disabled={!canFillPaymentInfo || processing}
          />
        </div>

        <div>
          <label htmlFor="payment_slip" className="block text-sm font-medium text-gray-700 mb-1">Slip Pembayaran (Maks 2MB)</label>
          <input
            id="payment_slip"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setPaymentSlip(e.target.files?.[0] || null)}
            disabled={!canFillPaymentInfo || processing}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {paymentSlip && <p className="mt-1 text-xs text-gray-600">Fail dipilih: {paymentSlip.name}</p>}
        </div>

        {resolveUploadUrl(payment.payment_slip_url) && (
          <div className="text-sm">
            <a
              href={resolveUploadUrl(payment.payment_slip_url)}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-600 hover:underline"
            >
              Lihat Slip Pembayaran
            </a>
          </div>
        )}

        {canFillPaymentInfo && (
          <div className="flex justify-end">
            <Button onClick={handleMarkPaid} disabled={processing}>
              {processing ? 'Memproses...' : 'Tandakan Dibayar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
