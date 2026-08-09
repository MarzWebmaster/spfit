import React, { useEffect, useState } from 'react';
import { offersApi } from '../services/api';
import { TaskOffer, OfferStatus } from '../types';

interface TaskOffersListProps {
  taskId: number;
}

export const TaskOffersList: React.FC<TaskOffersListProps> = ({ taskId }) => {
  const [offers, setOffers] = useState<TaskOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchOffers = async () => {
      try {
        const response = await offersApi.getTaskOffers(taskId);
        if (isMounted) {
            // response.data is { offers: [...] } based on api/routes/offers.ts
            const offersData = (response.data as any)?.offers || response.data;
            
            if (response.success && Array.isArray(offersData)) {
                setOffers(offersData);
                setError(null);
            } else {
                // If data is null or not an array, set empty array
                setOffers([]); 
                if (!response.success) {
                    setError(response.message || 'Gagal memuat senarai tawaran.');
                }
            }
        }
      } catch (err) {
        console.error('Failed to fetch offers:', err);
        if (isMounted) {
            setError('Gagal memuat senarai tawaran.');
        }
      } finally {
        if (isMounted) {
            setLoading(false);
        }
      }
    };

    fetchOffers();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchOffers, 5000);
    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [taskId]);

  if (loading && offers.length === 0) {
    return <div className="text-gray-500 text-sm mt-4">Memuatkan senarai agihan...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-sm mt-4">{error}</div>;
  }

  if (offers.length === 0) {
    return null; // Don't show anything if no offers
  }

  const getStatusColor = (status: OfferStatus) => {
    switch (status) {
      case OfferStatus.ACCEPTED:
        return 'bg-green-100 text-green-800';
      case OfferStatus.REJECTED:
        return 'bg-red-100 text-red-800';
      case OfferStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800';
      case OfferStatus.EXPIRED:
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: OfferStatus) => {
      switch (status) {
        case OfferStatus.ACCEPTED:
            return 'Diterima';
        case OfferStatus.REJECTED:
            return 'Ditolak';
        case OfferStatus.PENDING:
            return 'Menunggu';
        case OfferStatus.EXPIRED:
            return 'Tamat Tempoh';
        default:
            return status;
      }
  }

  return (
    <div className="mt-4">
      <h5 className="font-semibold text-gray-600 mb-2">Status Agihan Freelancer:</h5>
      <div className="border rounded-md overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Freelancer</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarikh Agih</th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Respon Pada</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {offers.map((offer) => (
                <tr key={offer.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                    {offer.freelancer?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(offer.status)}`}>
                        {getStatusLabel(offer.status)}
                    </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {new Date(offer.sentAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                    {offer.respondedAt ? new Date(offer.respondedAt).toLocaleString() : '-'}
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};
