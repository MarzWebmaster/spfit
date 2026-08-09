import React, { useState } from 'react';
import type { User, Freelancer, Role } from '../types';
import { UserRole, UserStatus } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { UserStatusBadge } from './ui/UserStatusBadge';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | Freelancer | null;
  roles: Role[];
}

type DetailsTab = 'details' | 'activity';

const DetailRow: React.FC<{ label: string, value?: string | number | React.ReactNode }> = ({ label, value }) => (
    <>
        <div className="font-semibold text-gray-600">{label}:</div>
        <div className="text-gray-800">{value || 'N/A'}</div>
    </>
);

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ isOpen, onClose, user, roles }) => {
  const [activeTab, setActiveTab] = useState<DetailsTab>('details');
  
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab('details');
    }
  }, [isOpen]);

  if (!user) return null;

  const roleName = roles.find(r => r.id === user.roleId)?.name || 'Tiada Peranan';
  const isFreelancer = roleName === UserRole.FREELANCER;
  const freelancerDetails = isFreelancer ? user as Freelancer : null;
  
  const renderDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-2 bg-gray-50 rounded-md">
          <DetailRow label="ID Pengguna" value={user.id} />
          <DetailRow label="Peranan" value={roleName} />
          <DetailRow label="E-mel" value={user.email} />
          {isFreelancer && (
              <>
                  <DetailRow label="No. Telefon" value={freelancerDetails?.phone} />
                  <DetailRow label="No. IC" value={freelancerDetails?.icNumber || (freelancerDetails as any)?.ic_number} />
                  <DetailRow label="Pengalaman" value={`${freelancerDetails?.experience ?? 0} tahun`} />
                  <DetailRow label="Rating" value={freelancerDetails?.rating !== undefined ? freelancerDetails.rating.toFixed(1) : "N/A"} />
                  <DetailRow label="Alamat Rumah" value={freelancerDetails?.address} />
                  <DetailRow label="Bandar" value={freelancerDetails?.city} />
                  <DetailRow label="Poskod" value={freelancerDetails?.postcode} />
                  <DetailRow label="Negeri" value={freelancerDetails?.state} />
              </>
          )}
      </div>
      
      {isFreelancer && freelancerDetails && (
          <>
              <div>
                  <h5 className="font-semibold text-gray-600">Kemahiran:</h5>
                  <div className="flex flex-wrap gap-2 mt-1">
                      {freelancerDetails.skills.map(skill => (
                          <span key={skill} className="px-2 py-1 text-xs font-medium bg-indigo-100 text-indigo-800 rounded-full">
                              {skill}
                          </span>
                      ))}
                  </div>
              </div>

              <div>
                  <h5 className="font-semibold text-gray-600">Lokasi Perkhidmatan:</h5>
                   <ul className="list-disc list-inside mt-1">
                      {freelancerDetails.locations.map((loc, index) => (
                          <li key={index}>{loc.district}, {loc.state}</li>
                      ))}
                  </ul>
              </div>
          </>
      )}
      
      {user.status === UserStatus.BANNED && user.banReason && (
        <div>
          <h5 className="font-semibold text-red-600">Sebab Disekat:</h5>
          <p className="text-gray-800 whitespace-pre-wrap p-2 border border-red-200 rounded-md bg-red-50">{user.banReason}</p>
        </div>
      )}
    </div>
  );
  
  const renderActivityLog = () => (
    <div className="space-y-2">
      {user.activityLog && user.activityLog.length > 0 ? (
        user.activityLog.map((log, index) => (
          <div key={index} className="p-2 bg-gray-50 rounded-md">
            <p className="font-semibold text-gray-800">{log.action}</p>
            <p className="text-xs text-gray-500">{log.timestamp} &bull; Oleh: {log.performedBy}</p>
            {log.details && <p className="text-xs text-gray-600 mt-1">Butiran: {log.details}</p>}
          </div>
        ))
      ) : (
        <p className="text-gray-500 text-center py-4">Tiada aktiviti direkodkan.</p>
      )}
    </div>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Butiran Pengguna">
      <div className="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-2">
        <div className="flex justify-between items-center">
          <h4 className="text-xl font-bold text-gray-900">{user.name}</h4>
          <UserStatusBadge status={user.status} />
        </div>
        
         <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`${activeTab === 'details' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                >
                    Butiran
                </button>
                <button
                    onClick={() => setActiveTab('activity')}
                    className={`${activeTab === 'activity' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
                >
                    Log Aktiviti
                </button>
            </nav>
        </div>

        <div className="mt-4">
          {activeTab === 'details' ? renderDetails() : renderActivityLog()}
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <Button variant="secondary" onClick={onClose}>Tutup</Button>
      </div>
    </Modal>
  );
};