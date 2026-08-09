import React, { useState } from 'react';
import type { Task, Freelancer } from '../types';
import { ReportsHub } from './reports/ReportsHub';
import { FreelancerReportPage } from './reports/FreelancerReportPage';
import { TaskReportPage } from './reports/TaskReportPage';
import { FinanceReportPage } from './reports/FinanceReportPage';
import { AssetUpdatersReportPage } from './reports/AssetUpdatersReportPage';


interface ReportsPageProps {
  tasks: Task[];
  freelancers: Freelancer[];
}

type ReportView = 'hub' | 'freelancer' | 'task' | 'finance' | 'asset-updaters';

export const ReportsPage: React.FC<ReportsPageProps> = ({ tasks, freelancers }) => {
    const [reportView, setReportView] = useState<ReportView>('hub');

    const handleNavigate = (view: ReportView) => {
        setReportView(view);
    };

    const renderReportView = () => {
        switch(reportView) {
            case 'freelancer':
                return <FreelancerReportPage tasks={tasks} freelancers={freelancers} onBack={() => handleNavigate('hub')} />;
            case 'task':
                return <TaskReportPage tasks={tasks} onBack={() => handleNavigate('hub')} />;
            case 'finance':
                return <FinanceReportPage tasks={tasks} freelancers={freelancers} onBack={() => handleNavigate('hub')} />;
            case 'asset-updaters':
                return <AssetUpdatersReportPage onBack={() => handleNavigate('hub')} />;
            case 'hub':
            default:
                return <ReportsHub onNavigate={handleNavigate} />;
        }
    };

    return (
        <div>
            {renderReportView()}
        </div>
    );
};