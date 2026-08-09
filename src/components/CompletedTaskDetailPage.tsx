import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { paymentsApi, taskDoneApi } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { getApiBaseUrl } from '../utils/apiUrl';
import type { TaskDone } from '../types';
import { TaskStatus } from '../types';

interface CompletedTaskDetailPageProps {
  canEditCompletedTaskForm?: boolean;
  canReviewCompletedTaskForm?: boolean;
}

interface PaymentPrefillData {
  recipient: {
    name: string;
    accountNumber: string;
    bankName: string;
    email: string;
  };
  task: {
    taskDoneId: number;
    taskId: number;
    logNumber: string;
    mainCon: string;
    title: string;
    deadline: string | null;
    amount: number;
    status: string;
  };
  existingPayment?: {
    id: number;
    status: string;
  } | null;
}

export const CompletedTaskDetailPage: React.FC<CompletedTaskDetailPageProps> = ({
  canEditCompletedTaskForm = false,
  canReviewCompletedTaskForm = false,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [taskDone, setTaskDone] = useState<TaskDone | null>(null);

  const [serviceStartDate, setServiceStartDate] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [remarks, setRemarks] = useState('');
  const [supportPdfFiles, setSupportPdfFiles] = useState<File[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [loadingPaymentPrefill, setLoadingPaymentPrefill] = useState(false);
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [paymentPrefill, setPaymentPrefill] = useState<PaymentPrefillData | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [recipientAccountNumber, setRecipientAccountNumber] = useState('');
  const [recipientBankName, setRecipientBankName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');

  const currentTaskStatus = String((taskDone as any)?.task?.status || (taskDone as any)?.task?.statusSetting?.name || '');
  const isReviewedOrBeyond = [
    TaskStatus.BORANG_DISEMAK,
    TaskStatus.TELAH_DIBAYAR,
    TaskStatus.SELESAI_PENUH
  ].includes(currentTaskStatus as TaskStatus);

  const canEditForm = canEditCompletedTaskForm && !isReviewedOrBeyond;
  const canReviewForm = canReviewCompletedTaskForm;
  const canDeleteFile = canEditForm;

  const resolveUploadUrl = (rawUrl?: string) => {
    if (!rawUrl) return '';
    if (/^https?:\/\//i.test(rawUrl)) return rawUrl;

    if (rawUrl.startsWith('/uploads/')) {
      const apiUrl = getApiBaseUrl();
      if (apiUrl && /^https?:\/\//i.test(apiUrl)) {
        return `${new URL(apiUrl).origin}${rawUrl}`;
      }

      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${rawUrl}`;
      }

      return rawUrl;
    }

    return rawUrl;
  };

  const supportFiles = useMemo(() => {
    const filesFromApi = Array.isArray(taskDone?.files) ? taskDone.files : [];
    if (filesFromApi.length > 0) {
      return filesFromApi.map((file) => ({
        id: Number(file.id),
        fileUrl: resolveUploadUrl(file.file_url),
        originalName: file.original_name || 'Fail PDF'
      }));
    }

    const legacyUrl = taskDone?.support_pdf_url;
    if (!legacyUrl) return [];

    const resolved = resolveUploadUrl(legacyUrl);
    const parts = resolved.split('/').filter(Boolean);
    const fallbackName = decodeURIComponent(parts[parts.length - 1] || 'Fail PDF');
    return [{ id: -1, fileUrl: resolved, originalName: fallbackName }];
  }, [taskDone]);

  const isSubmittedForm = useMemo(() => isReviewedOrBeyond, [isReviewedOrBeyond]);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await taskDoneApi.getById(Number(id));
      if (!response.success || !response.data) {
        setError((response as any).error || 'Gagal memuatkan butiran tugasan siap');
        return;
      }

      const data = response.data as TaskDone;
      setTaskDone(data);
      setServiceStartDate(data?.service_start_date ? String(data.service_start_date).slice(0, 10) : '');
      setActionTaken(data?.action_taken || '');
      setRemarks(data?.remarks || '');
    } catch (e) {
      console.error(e);
      setError('Gagal memuatkan butiran tugasan siap');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const taskInfo = useMemo(() => {
    const task: any = taskDone?.task || {};
    return {
      title: task.title || '-',
      logNumber: task.log_number || '-',
      description: task.description || '-',
      location: task.client_location || '-',
      districtAddress: task.bandar_daerah || task.district_address || '-',
      supportType: task.support_type || '-',
      offerPrice: Number(task.offer_price || 0),
      status: task.status || '-',
      deadline: task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB') : '-',
    };
  }, [taskDone]);

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      if (serviceStartDate) formData.append('service_start_date', serviceStartDate);
      formData.append('action_taken', actionTaken);
      formData.append('remarks', remarks);
      supportPdfFiles.forEach((file) => formData.append('support_pdf', file));

      const response = await taskDoneApi.update(Number(id), formData);
      if (!response.success) {
        setError((response as any).error || 'Gagal menyimpan maklumat tugasan siap');
        return;
      }

      const updated = response.data as TaskDone;
      if (updated) {
        setTaskDone(updated);
      }
      setSuccess('Maklumat hantar tugasan berjaya dikemaskini.');
      setSupportPdfFiles([]);
    } catch (e) {
      console.error(e);
      setError('Gagal menyimpan maklumat tugasan siap');
    } finally {
      setSaving(false);
    }
  };

  const handleReviewed = async () => {
    if (!id) return;
    try {
      setReviewing(true);
      setError(null);
      setSuccess(null);

      const formData = new FormData();
      if (serviceStartDate) formData.append('service_start_date', serviceStartDate);
      formData.append('action_taken', actionTaken);
      formData.append('remarks', remarks);
      supportPdfFiles.forEach((file) => formData.append('support_pdf', file));

      const response = await taskDoneApi.markReviewed(Number(id), formData);
      if (!response.success) {
        setError((response as any).error || 'Gagal menanda borang sebagai telah disemak');
        return;
      }

      const updated = response.data as TaskDone;
      if (updated) {
        setTaskDone(updated);
      }
      setSuccess('Borang telah disemak. Form ini kini dikunci dan anda boleh teruskan dengan Cipta Bayaran.');
      setSupportPdfFiles([]);
    } catch (e) {
      console.error(e);
      setError('Gagal menanda borang sebagai telah disemak');
    } finally {
      setReviewing(false);
    }
  };

  const handleOpenPaymentForm = async () => {
    if (!id) return;
    try {
      setLoadingPaymentPrefill(true);
      setError(null);
      setSuccess(null);

      const response = await paymentsApi.getPrefillByTaskDone(Number(id));
      if (!response.success || !response.data) {
        setError((response as any).error || 'Gagal mendapatkan maklumat pra-isi bayaran');
        return;
      }

      const prefill = response.data as PaymentPrefillData;
      setPaymentPrefill(prefill);
      setRecipientName(prefill.recipient?.name || '');
      setRecipientAccountNumber(prefill.recipient?.accountNumber || '');
      setRecipientBankName(prefill.recipient?.bankName || '');
      setRecipientEmail(prefill.recipient?.email || '');
      setPaymentRemarks('');
      setShowPaymentForm(true);
    } catch (e) {
      console.error(e);
      setError('Gagal membuka borang cipta bayaran');
    } finally {
      setLoadingPaymentPrefill(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!id || !paymentPrefill) return;
    try {
      setCreatingPayment(true);
      setError(null);
      setSuccess(null);

      const response = await paymentsApi.create({
        task_done_id: Number(id),
        recipient_name: recipientName,
        recipient_account_number: recipientAccountNumber,
        recipient_bank_name: recipientBankName,
        recipient_email: recipientEmail,
        remarks: paymentRemarks,
      });

      if (!response.success) {
        setError((response as any).error || 'Gagal mencipta rekod pembayaran');
        return;
      }

      setSuccess('Bayaran berjaya dijana dengan status Menunggu Kelulusan.');
      setShowPaymentForm(false);
      navigate('/payment-approvals');
    } catch (e) {
      console.error(e);
      setError('Gagal mencipta rekod pembayaran');
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleDeleteFile = async (fileId: number) => {
    if (!id || fileId < 0 || isSubmittedForm) return;
    try {
      setDeletingFileId(fileId);
      setError(null);
      setSuccess(null);

      const response = await taskDoneApi.deleteFile(Number(id), fileId);
      if (!response.success) {
        setError((response as any).error || 'Gagal memadam fail');
        return;
      }

      const updated = response.data as TaskDone;
      if (updated) {
        setTaskDone(updated as TaskDone);
      }
      setSuccess('Fail berjaya dipadam.');
    } catch (e) {
      console.error(e);
      setError('Gagal memadam fail');
    } finally {
      setDeletingFileId(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-600">Memuatkan butiran tugasan siap...</div>;
  }

  if (!taskDone) {
    return (
      <div className="p-6">
        <p className="text-red-600 mb-4">{error || 'Data tidak dijumpai'}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(-1)}>Kembali</Button>
          <Button onClick={loadDetail} disabled={loading}>Cuba Lagi</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Butiran Tugasan Siap</h1>
        <Button variant="secondary" onClick={() => navigate(-1)}>Kembali</Button>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-5 space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">Maklumat Tugasan</h2>
        <div><span className="font-semibold text-gray-700">Tajuk:</span> <span className="text-gray-900">{taskInfo.title}</span></div>
        <div><span className="font-semibold text-gray-700">No. Log:</span> <span className="text-gray-900">{taskInfo.logNumber}</span></div>
        <div><span className="font-semibold text-gray-700">Lokasi:</span> <span className="text-gray-900">{taskInfo.location}</span></div>
        <div><span className="font-semibold text-gray-700">Jenis Sokongan:</span> <span className="text-gray-900">{taskInfo.supportType}</span></div>
        <div><span className="font-semibold text-gray-700">Tarikh Akhir:</span> <span className="text-gray-900">{taskInfo.deadline}</span></div>
        <div><span className="font-semibold text-gray-700">Status:</span> <span className="text-gray-900">{taskInfo.status}</span></div>
        <div><span className="font-semibold text-gray-700">Nilai (RM):</span> <span className="text-gray-900">RM {taskInfo.offerPrice.toFixed(2)}</span></div>
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-1">Deskripsi Tugasan</p>
          <p className="text-sm text-gray-900 whitespace-pre-wrap">{taskInfo.description}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
        {isSubmittedForm && (
          <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
            <h2 className="text-lg font-semibold text-green-800">Borang Telah Disemak</h2>
            <p className="text-sm text-green-700 mt-1">Form ini tidak boleh diedit selepas status Borang Disemak.</p>
          </div>
        )}
        <h2 className="text-lg font-semibold text-gray-800">Maklumat Hantar Tugasan</h2>

        <Input
          label="Tarikh Mula Servis"
          id="service_start_date"
          type="date"
          value={serviceStartDate}
          onChange={(e) => setServiceStartDate(e.target.value)}
          disabled={!canEditForm}
        />

        <div>
          <label htmlFor="action_taken" className="block text-sm font-medium text-gray-700 mb-1">Tindakan Diambil</label>
          <textarea
            id="action_taken"
            rows={5}
            value={actionTaken}
            onChange={(e) => setActionTaken(e.target.value)}
            disabled={!canEditForm}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
          <textarea
            id="remarks"
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            disabled={!canEditForm}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="support_pdf" className="block text-sm font-medium text-gray-700 mb-1">PDF Sokongan (boleh upload lebih dari 1 fail)</label>
          <input
            id="support_pdf"
            type="file"
            accept="application/pdf,.pdf"
            multiple
            onChange={(e) => setSupportPdfFiles(Array.from(e.target.files || []))}
            disabled={!canEditForm}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {supportPdfFiles.length > 0 && (
            <p className="mt-2 text-xs text-gray-600">
              {supportPdfFiles.length} fail baru dipilih untuk dimuat naik.
            </p>
          )}
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-700 mb-2">Fail yang telah diupload</p>
          {supportFiles.length === 0 ? (
            <p className="text-sm text-gray-500">Tiada fail.</p>
          ) : (
            <div className="space-y-2">
              {supportFiles.map((file) => (
                <div key={`${file.id}-${file.fileUrl}`} className="rounded border border-gray-200 bg-white px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a
                        className="text-sm font-medium text-indigo-600 hover:underline break-all"
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {file.originalName}
                      </a>
                      <p className="mt-1 text-xs text-gray-500 break-all">{file.fileUrl}</p>
                    </div>
                    {canDeleteFile && file.id > 0 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(file.id)}
                        disabled={isSubmittedForm || deletingFileId === file.id || saving || reviewing}
                        className="text-sm font-bold text-red-500 hover:text-red-700 disabled:text-gray-300 disabled:cursor-not-allowed"
                        aria-label="Padam fail"
                        title={isSubmittedForm ? 'Tidak boleh padam selepas submit/disemak' : 'Padam fail'}
                      >
                        {deletingFileId === file.id ? '...' : 'x'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {isSubmittedForm && (
            <p className="mt-2 text-xs text-amber-700">
              Fail tidak boleh dipadam kerana borang telah submit/disemak.
            </p>
          )}
        </div>

        {(canEditForm || canReviewForm) && !isSubmittedForm ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={handleSave} disabled={!canEditForm || saving || reviewing}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
            <Button onClick={handleReviewed} disabled={!canReviewForm || saving || reviewing}>
              {reviewing ? 'Memproses...' : 'Borang Telah Disemak'}
            </Button>
          </div>
        ) : canReviewForm && isSubmittedForm ? (
          <div className="flex justify-end gap-2">
            <Button onClick={handleOpenPaymentForm} disabled={loadingPaymentPrefill || creatingPayment}>
              {loadingPaymentPrefill ? 'Memuatkan...' : 'Cipta Bayaran'}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Anda tidak mempunyai kebenaran untuk mengemaskini borang ini.</p>
        )}
      </div>

      {showPaymentForm && paymentPrefill && (
        <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Cipta Bayaran</h2>
          {paymentPrefill.existingPayment?.id ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Rekod bayaran sudah wujud dengan status: {paymentPrefill.existingPayment.status}
            </div>
          ) : null}

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Maklumat Penerima Bayaran</h3>
            <Input label="Nama" id="recipient_name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            <Input label="No Akaun" id="recipient_account_number" value={recipientAccountNumber} onChange={(e) => setRecipientAccountNumber(e.target.value)} />
            <Input label="Nama Bank" id="recipient_bank_name" value={recipientBankName} onChange={(e) => setRecipientBankName(e.target.value)} />
            <Input label="Email" id="recipient_email" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
          </div>

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
            <h3 className="font-semibold text-gray-800">Maklumat Tugasan</h3>
            <Input label="No Log" id="payment_task_log" value={paymentPrefill.task.logNumber || '-'} disabled />
            <Input label="Main-Con" id="payment_task_maincon" value={paymentPrefill.task.mainCon || '-'} disabled />
            <Input label="Tajuk Tugasan" id="payment_task_title" value={paymentPrefill.task.title || '-'} disabled />
            <Input
              label="Tarikh Keperluan (Deadline)"
              id="payment_task_deadline"
              value={paymentPrefill.task.deadline ? new Date(paymentPrefill.task.deadline).toLocaleDateString('en-GB') : '-'}
              disabled
            />
          </div>

          <div>
            <label htmlFor="payment_remarks" className="block text-sm font-medium text-gray-700 mb-1">Catatan Bayaran</label>
            <textarea
              id="payment_remarks"
              rows={3}
              value={paymentRemarks}
              onChange={(e) => setPaymentRemarks(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            Status rekod bayaran selepas submit: <span className="font-semibold">Menunggu Kelulusan</span>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowPaymentForm(false)} disabled={creatingPayment}>
              Batal
            </Button>
            <Button
              onClick={handleCreatePayment}
              disabled={Boolean(paymentPrefill.existingPayment?.id) || creatingPayment}
            >
              {creatingPayment ? 'Menyimpan...' : 'Submit Cipta Bayaran'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
