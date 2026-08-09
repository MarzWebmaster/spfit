import React, { useState } from 'react';
import type { Task, DetailedRating } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Textarea } from './ui/Textarea';

interface RateFreelancerModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
  onSave: (taskId: number, ratingData: DetailedRating) => void;
}

const StarRatingInput: React.FC<{ rating: number, setRating: (r: number) => void }> = ({ rating, setRating }) => {
    return (
        <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                    aria-label={`Rate ${star} stars`}
                >
                    <svg
                        className={`w-7 h-7 transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                </button>
            ))}
        </div>
    );
};

export const RateFreelancerModal: React.FC<RateFreelancerModalProps> = ({ isOpen, onClose, task, onSave }) => {
  const [ratings, setRatings] = useState({
      skill: 0,
      communication: 0,
      timePunctuality: 0,
      responseTime: 0,
  });
  const [comment, setComment] = useState('');

  const handleRatingChange = (category: keyof typeof ratings, value: number) => {
      setRatings(prev => ({...prev, [category]: value}));
  };

  // Auto-calculate overall average
  const calculatedOverall = (() => {
    const values = Object.values(ratings);
    if (values.some(r => r === 0)) return 0;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
  })();

  const handleSave = () => {
    if (Object.values(ratings).some(r => r === 0)) {
      alert('Sila berikan penilaian untuk semua kriteria (sekurang-kurangnya 1 bintang).');
      return;
    }
    onSave(task.id, { ...ratings, overall: calculatedOverall, comment });
  };
  
  React.useEffect(() => {
    if (!isOpen) {
      setRatings({ skill: 0, communication: 0, timePunctuality: 0, responseTime: 0 });
      setComment('');
    }
  }, [isOpen]);
  
  const ratingCategories: { key: keyof typeof ratings, label: string }[] = [
      { key: 'skill', label: 'Kemahiran (Skill)' },
      { key: 'communication', label: 'Komunikasi' },
      { key: 'timePunctuality', label: 'Ketepatan Masa' },
      { key: 'responseTime', label: 'Masa Respons' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Beri Penilaian: ${task.title}`}>
      <div className="space-y-5">
        {ratingCategories.map(({ key, label }) => (
            <div key={key} className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700">{label}</label>
                <StarRatingInput rating={ratings[key]} setRating={(r) => handleRatingChange(key, r)} />
            </div>
        ))}
        
        {/* Live Overall Preview */}
        {Object.values(ratings).some(r => r > 0) && (
          <div className="pt-4 border-t">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-gray-700">Purata Keseluruhan</label>
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} className={`w-5 h-5 ${star <= Math.round(calculatedOverall) ? 'text-yellow-400' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm font-bold text-gray-800">{calculatedOverall.toFixed(1)} / 5.0</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="pt-4 border-t">
            <Textarea label="Komen (Pilihan)" id="comment" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Berikan maklum balas mengenai kerja juruteknik..." />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button onClick={handleSave}>Simpan Penilaian</Button>
      </div>
    </Modal>
  );
};
