import React from 'react';

interface ReportsHubProps {
  onNavigate: (view: 'freelancer' | 'task' | 'finance' | 'asset-updaters') => void;
}

const ReportCard: React.FC<{ title: string; description: string; onClick: () => void; }> = ({ title, description, onClick }) => (
    <div 
        className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow cursor-pointer border border-gray-200"
        onClick={onClick}
    >
        <h3 className="text-xl font-bold text-indigo-700">{title}</h3>
        <p className="mt-2 text-gray-600">{description}</p>
    </div>
);


export const ReportsHub: React.FC<ReportsHubProps> = ({ onNavigate }) => {
    return (
        <div>
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Hab Laporan</h2>
                <p className="mt-1 text-gray-600">Pilih laporan untuk melihat analisis terperinci.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <ReportCard 
                    title="Laporan Prestasi Freelancer"
                    description="Analisis prestasi, penilaian, dan pendapatan setiap juruteknik."
                    onClick={() => onNavigate('freelancer')}
                />
                <ReportCard 
                    title="Laporan Analisis Tugasan"
                    description="Lihat pecahan tugasan mengikut status, jenis, dan lokasi. Jejaki metrik utama."
                    onClick={() => onNavigate('task')}
                />
                <ReportCard 
                    title="Laporan Kewangan"
                    description="Jejaki pembayaran, pendapatan, dan baki tertunggak. Analisis aliran tunai."
                    onClick={() => onNavigate('finance')}
                />
                <ReportCard 
                    title="Laporan Pengemaskini Aset"
                    description="Kedudukan pengguna mengikut jumlah kemaskini aset. Tapis mengikut projek, masterlist, tempoh masa, dan jenis tindakan."
                    onClick={() => onNavigate('asset-updaters')}
                />
            </div>
        </div>
    );
};