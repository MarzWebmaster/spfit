import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { offersApi } from '../services/api';

type ActionType = 'accept' | 'reject';

export const OfferResponsePage: React.FC = () => {
  const { action, token } = useParams<{ action: ActionType; token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [taskInfo, setTaskInfo] = useState<any>(null);

  useEffect(() => {
    const handleOfferResponse = async () => {
      if (!token || !action) {
        setStatus('error');
        setMessage('Pautan tidak sah.');
        return;
      }

      try {
        let response;
        if (action === 'accept') {
          response = await offersApi.accept(token);
        } else if (action === 'reject') {
          response = await offersApi.reject(token);
        } else {
          setStatus('error');
          setMessage('Tindakan tidak sah.');
          return;
        }

        if ((response as any).success) {
          setStatus('success');
          setMessage((response as any).message || `Tawaran berjaya ${action === 'accept' ? 'diterima' : 'ditolak'}`);
          setTaskInfo((response as any).data);
        } else {
          setStatus('error');
          setMessage((response as any).message || 'Tindakan gagal. Sila cuba lagi.');
        }
      } catch (error: any) {
        setStatus('error');
        setMessage(error.response?.data?.message || error.message || 'Ralat berlaku. Sila cuba lagi.');
      }
    };

    handleOfferResponse();
  }, [token, action]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-800">Memproses...</h2>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {action === 'accept' ? 'Tahniah! 🎉' : 'Tawaran Ditolak'}
              </h2>
              <p className="text-gray-600 mb-4">{message}</p>

              {taskInfo?.assigned && taskInfo?.task && (
                <div className="mt-6 p-4 bg-indigo-50 rounded-md text-left">
                  <h3 className="font-semibold text-indigo-900 mb-2">Maklumat Tugasan:</h3>
                  <p className="text-sm text-gray-700"><strong>Tajuk:</strong> {taskInfo.task.title}</p>
                  <p className="text-sm text-gray-700"><strong>No. Log:</strong> {taskInfo.task.logNumber}</p>
                  <p className="text-sm text-gray-700"><strong>Status:</strong> {taskInfo.task.status}</p>
                </div>
              )}

              {taskInfo?.waitingList && (
                <div className="mt-6 p-4 bg-yellow-50 rounded-md">
                  <p className="text-sm text-gray-700">
                    Anda berada di kedudukan <strong>#{taskInfo.position}</strong> dalam senarai menunggu.
                    Kami akan maklumkan jika tugasan ini tersedia semula.
                  </p>
                </div>
              )}

              <button
                onClick={() => window.location.href = '/'}
                className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
              >
                Kembali ke Halaman Utama
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Ralat</h2>
              <p className="text-gray-600 mb-4">{message}</p>
              <button
                onClick={() => window.location.href = '/'}
                className="mt-6 px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Kembali ke Halaman Utama
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
