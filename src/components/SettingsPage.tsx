import React from 'react';
import type { User, SettingsView, Webhook, NotificationTemplate, SmtpSettings, Freelancer, UserStatus, Role } from '../types';
import { ICONS } from './ui/icons';
import { ProfileSettingsPage } from './settings/ProfileSettingsPage';
import { MailSettingsPage } from './settings/MailSettingsPage';
import { NotificationTemplatesPage } from './settings/NotificationTemplatesPage';
import { ApiWebhookPage } from './settings/ApiWebhookPage';
import { AIIntegrationsPage } from './settings/AIIntegrationsPage';
import { UserSettingsPage } from './settings/UserSettingsPage';
import { RolesPermissionsPage } from './settings/RolesPermissionsPage';
import AuditTrailTab from './settings/AuditTrailTab';
import { TaskSettingsPage } from './settings/TaskSettingsPage';
import { AssetSettingsPage } from './settings/AssetSettingsPage';
import { SystemUpdatePage } from './settings/SystemUpdatePage';
import { ChevronLeft } from 'lucide-react';

interface SettingsPageProps {
    currentUser: User;
    currentView: SettingsView;
    onNavigate: (view: SettingsView) => void;
    onUpdateProfile: (user: User) => void;
    smtpSettings: SmtpSettings;
    onSaveSmtpSettings: (settings: SmtpSettings) => void;
    webhooks: Webhook[];
    onAddWebhook: (webhook: Omit<Webhook, 'id'>) => void;
    onDeleteWebhook: (webhookId: number) => void;
    notificationTemplates: NotificationTemplate[];
    onOpenTemplateModal: (template: NotificationTemplate | null) => void;
    onDeleteTemplate: (templateId: number) => void;
    onSetDefaultTemplate: (templateId: number) => void;
    allUsers: (User | Freelancer)[];
    roles: Role[];
    onUpdateUserStatus: (userId: number, status: UserStatus) => void;
    onResetUserPassword: (userId: number) => void;
    onViewUserDetails: (user: User | Freelancer) => void;
    onAddUser: () => void;
    onEditUser: (user: User | Freelancer) => void;
    onDeleteUser: (userId: number) => void;
    onBanUser: (user: User | Freelancer) => void;
    onOpenRoleEditor: (role: Role | null) => void;
    onDeleteRole: (roleId: number) => void;
    defaultFreelancerRoleId: number;
    onSetDefaultFreelancerRole: (roleId: number) => void;
    hasPermission: (permission: string) => boolean;
    initialAuditSearch?: string;
    initialAuditTable?: string;
}

const SettingsCard: React.FC<{ icon: React.ReactElement<{ className?: string }>; title: string; description: string; onClick: () => void; isVisible?: boolean; }> = ({ icon, title, description, onClick, isVisible = true }) => {
    if (!isVisible) return null;
    return (
        <div
            onClick={onClick}
            className="group bg-white p-6 rounded-lg shadow-md hover:shadow-xl hover:bg-indigo-50 transition-all cursor-pointer border border-gray-200 flex items-start space-x-4"
        >
            <div className="flex-shrink-0 bg-indigo-100 text-indigo-600 rounded-lg p-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                {React.cloneElement(icon, { className: 'h-8 w-8' })}
            </div>
            <div>
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-indigo-700 transition-colors">{title}</h3>
                <p className="mt-1 text-sm text-gray-600">{description}</p>
            </div>
        </div>
    );
};

const SettingsHub: React.FC<{ onNavigate: (view: SettingsView) => void; hasPermission: (p: string) => boolean; }> = ({ onNavigate, hasPermission }) => (
    <div className="space-y-8">
        <div>
            <h2 className="text-3xl font-bold text-gray-800">Tetapan</h2>
            <p className="mt-1 text-gray-600">Urus konfigurasi sistem, profil, dan integrasi.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SettingsCard
                icon={ICONS.userCircle}
                title="Profil"
                description="Kemaskini butiran peribadi, kata laluan, dan lokasi perkhidmatan anda."
                onClick={() => onNavigate('profile')}
                isVisible={hasPermission('settings:manage:profile')}
            />
            <SettingsCard
                icon={ICONS.users}
                title="Pengurusan Pengguna"
                description="Urus pengguna berdaftar, tukar status, dan set semula kata laluan."
                onClick={() => onNavigate('users')}
                isVisible={hasPermission('settings:manage:users')}
            />
             <SettingsCard
                icon={ICONS.userGroup}
                title="Peranan & Kebenaran"
                description="Urus peranan dan kebenaran untuk setiap jenis pengguna."
                onClick={() => onNavigate('roles')}
                isVisible={hasPermission('settings:manage:roles')}
            />
            <SettingsCard
                icon={ICONS.mail}
                title="Mel"
                description="Konfigurasi tetapan pelayan SMTP untuk penghantaran e-mel notifikasi."
                onClick={() => onNavigate('mail')}
                isVisible={hasPermission('settings:manage:mail')}
            />
            <SettingsCard
                icon={ICONS.documentText}
                title="Templat Notifikasi"
                description="Cipta dan urus templat mesej untuk e-mel dan webhook."
                onClick={() => onNavigate('templates')}
                isVisible={hasPermission('settings:manage:templates')}
            />
            <SettingsCard
                icon={ICONS.link}
                title="API & Webhook"
                description="Urus URL webhook dan sambungkan dengan perkhidmatan lain."
                onClick={() => onNavigate('api')}
                isVisible={hasPermission('settings:manage:api')}
            />
            <SettingsCard
                icon={ICONS.briefcase}
                title="Tetapan Tugasan"
                description="Urus CRUD status tugasan dan jenis sokongan yang digunakan dalam borang tugasan."
                onClick={() => onNavigate('task-settings')}
                isVisible={hasPermission('settings:manage:templates')}
            />
            <SettingsCard
                icon={ICONS.clipboardCheck}
                title="Tetapan Aset"
                description="Urus CRUD kategori aset dan brand aset yang digunakan dalam modul aset."
                onClick={() => onNavigate('asset-settings')}
                isVisible={hasPermission('settings:manage:api')}
            />
            <SettingsCard
                icon={ICONS.sparkles}
                title="Integrasi AI & Messaging"
                description="Urus OpenAI, Gemini, dan Wasapmatic untuk automasi dan AI."
                onClick={() => onNavigate('ai-integrations')}
                isVisible={hasPermission('settings:manage:api')}
            />
            <SettingsCard
                icon={ICONS.clock}
                title="Kemaskini Sistem"
                description="Semak versi dari GitHub dan trigger update server melalui skrip deployment."
                onClick={() => onNavigate('system-update')}
                isVisible={hasPermission('system.admin')}
            />
            
            <SettingsCard
                icon={ICONS.clipboardCheck}
                title="Jejak Audit"
                description="Lihat log aktiviti sistem dan perubahan data."
                onClick={() => onNavigate('audit')}
                isVisible={hasPermission('system.admin')}
            />
        </div>
    </div>
);

export const SettingsPage: React.FC<SettingsPageProps> = (props) => {
    const { currentView, onNavigate, hasPermission } = props;

    switch (currentView) {
        case 'profile':
            return <ProfileSettingsPage onBack={() => onNavigate('hub')} currentUser={props.currentUser} onUpdateProfile={props.onUpdateProfile} />;
        case 'users':
            return <UserSettingsPage 
                        onBack={() => onNavigate('hub')} 
                        allUsers={props.allUsers}
                        roles={props.roles}
                        onUpdateStatus={props.onUpdateUserStatus}
                        onResetPassword={props.onResetUserPassword}
                        onViewDetails={props.onViewUserDetails}
                        onAddUser={props.onAddUser}
                        onEditUser={props.onEditUser}
                        onDeleteUser={props.onDeleteUser}
                        onBanUser={props.onBanUser}
                    />;
        case 'roles':
            return <RolesPermissionsPage
                        onBack={() => onNavigate('hub')}
                        roles={props.roles}
                        onOpenRoleEditor={props.onOpenRoleEditor}
                        onDeleteRole={props.onDeleteRole}
                        defaultFreelancerRoleId={props.defaultFreelancerRoleId}
                        onSetDefaultFreelancerRole={props.onSetDefaultFreelancerRole}
                    />;
        case 'mail':
            return <MailSettingsPage 
                        onBack={() => onNavigate('hub')} 
                        settings={props.smtpSettings}
                        onSave={props.onSaveSmtpSettings}
                    />;
        case 'templates':
            return <NotificationTemplatesPage 
                        onBack={() => onNavigate('hub')} 
                        templates={props.notificationTemplates}
                        onOpenTemplateModal={props.onOpenTemplateModal}
                        onDeleteTemplate={props.onDeleteTemplate}
                        onSetDefaultTemplate={props.onSetDefaultTemplate}
                    />;
        case 'api':
            return <ApiWebhookPage 
                        onBack={() => onNavigate('hub')} 
                        webhooks={props.webhooks}
                        onAddWebhook={props.onAddWebhook}
                        onDeleteWebhook={props.onDeleteWebhook}
                    />;
        case 'ai-integrations':
            return <AIIntegrationsPage onBack={() => onNavigate('hub')} />;
        case 'task-settings':
            return <TaskSettingsPage onBack={() => onNavigate('hub')} isAdmin={props.currentUser.role === 'Admin'} notificationTemplates={props.notificationTemplates} />;
        case 'asset-settings':
            return <AssetSettingsPage onBack={() => onNavigate('hub')} />;
        case 'system-update':
            return <SystemUpdatePage onBack={() => onNavigate('hub')} />;
        case 'audit':
            return (
                <div className="space-y-6">
                    <div className="flex items-center space-x-4 mb-6">
                        <button onClick={() => onNavigate('hub')} className="p-2 hover:bg-gray-100 rounded-full">
                            <ChevronLeft className="h-6 w-6 text-gray-600" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Jejak Audit</h1>
                    </div>
                    <AuditTrailTab initialSearch={(props as any)?.initialAuditSearch} initialTableName={(props as any)?.initialAuditTable} />
                </div>
            );
        case 'hub':
        default:
            return <SettingsHub onNavigate={onNavigate} hasPermission={hasPermission} />;
    }
};
