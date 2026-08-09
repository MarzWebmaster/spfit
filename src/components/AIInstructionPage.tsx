import React, { useState } from 'react';
import { Sparkles, ClipboardList } from 'lucide-react';
import { FloatingTaskAssistant } from './FloatingTaskAssistant';
import { AIMasterlistAssistant } from './AIMasterlistAssistant';

type AITab = 'task' | 'masterlist';

interface AIInstructionPageProps {
  canUseAITask: boolean;
  canUseAIMasterlist: boolean;
}

export const AIInstructionPage: React.FC<AIInstructionPageProps> = ({
  canUseAITask,
  canUseAIMasterlist,
}) => {
  const initialTab: AITab = canUseAITask ? 'task' : 'masterlist';
  const [activeTab, setActiveTab] = useState<AITab>(initialTab);

  if (!canUseAITask && !canUseAIMasterlist) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">AI Instruction</h1>
          <p className="mt-1 text-sm text-slate-600">
            Anda tidak mempunyai kebenaran untuk akses AI Task atau AI Masterlist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">AI Instruction</h1>
        <p className="mt-1 text-sm text-slate-600">
          Gunakan halaman ini untuk berikan arahan kepada AI, lampirkan dokumen, dan bina draf tugasan atau kemaskini masterlist.
        </p>

        {/* Tabs */}
        <div className="mt-4 flex flex-wrap gap-2">
          {canUseAITask && (
            <button
              type="button"
              onClick={() => setActiveTab('task')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'task'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              AI Task
            </button>
          )}
          {canUseAIMasterlist && (
            <button
              type="button"
              onClick={() => setActiveTab('masterlist')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'masterlist'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ClipboardList className="h-4 w-4" />
              AI Masterlist
            </button>
          )}
        </div>
      </div>

      {activeTab === 'task' && canUseAITask && <FloatingTaskAssistant embedded />}
      {activeTab === 'masterlist' && canUseAIMasterlist && <AIMasterlistAssistant />}
    </div>
  );
};
