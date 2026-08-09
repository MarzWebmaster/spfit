import React, { useState, useEffect } from 'react';
import { notificationsApi } from '../services/api';

type ChannelTab = 'all' | 'whatsapp' | 'inapp' | 'templates';

interface WhatsAppMsg {
  id: number;
  to: string;
  message: string;
  template_name: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  queued_at: string;
  sent_at: string | null;
  delivered_at: string | null;
}

interface InAppNotif {
  id: number;
  user_id: number;
  task_id: number | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface NotifTemplate {
  id: number;
  type: string;
  channel: string;
  name: string;
  subjectOrTitle: string;
  body: string;
}

interface AllNotifData {
  whatsapp: WhatsAppMsg[];
  inApp: InAppNotif[];
  templates: NotifTemplate[];
  summary: {
    total_whatsapp: number;
    total_inapp: number;
    channels: string[];
  };
}

const STATUS_BADGE: Record<string, string> = {
  queued: "bg-yellow-100 text-yellow-800",
  sending: "bg-blue-100 text-blue-800",
  sent: "bg-emerald-100 text-emerald-800",
  delivered: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-800",
};

const formatDate = (d: string | null) => {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleString("ms-MY", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  } catch { return d; }
};

export const NotificationsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ChannelTab>("all");
  const [data, setData] = useState<AllNotifData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await notificationsApi.getAllNotifications();
        if (res.success && res.data) {
          const d = res.data.data || res.data;
          setData(d as AllNotifData);
        } else {
          setError(res.message || "Gagal dapat data notifikasi");
        }
      } catch (e: any) {
        setError(e.message || "Ralat");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const count = data?.summary;
  const tabs: { key: ChannelTab; label: string; count?: number }[] = [
    { key: "all", label: "Semua", count: (count?.total_whatsapp || 0) + (count?.total_inapp || 0) },
    { key: "whatsapp", label: "WhatsApp", count: count?.total_whatsapp },
    { key: "inapp", label: "In-App", count: count?.total_inapp },
    { key: "templates", label: "Template", count: data?.templates?.length },
  ];

  if (loading) return (
    <div className="bg-white shadow-md rounded-lg p-8 text-center text-gray-500">
      <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
      Memuat data notifikasi...
    </div>
  );

  if (error) return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>
    </div>
  );

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="p-4 sm:p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-800">Sejarah Notifikasi</h2>
        <p className="mt-1 text-sm text-gray-600">
          Log semua notifikasi — WhatsApp, In-App, dan Template
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {tabs.map(t => (
            <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
              className={"px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 " + (
                activeTab === t.key
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={"text-xs px-1.5 py-0.5 rounded-full " + (activeTab === t.key ? "bg-blue-500" : "bg-slate-300 text-slate-700")}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* WhatsApp Messages */}
      {activeTab === "whatsapp" || activeTab === "all" ? (
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            WhatsApp Messages
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {data?.whatsapp?.length || 0}
            </span>
          </h3>
          {(!data?.whatsapp || data.whatsapp.length === 0) ? (
            <p className="text-gray-400 text-sm italic">Tiada WhatsApp message.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Masa</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Penerima</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Template</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Cubaan</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.whatsapp.map(w => (
                    <tr key={w.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(w.queued_at)}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium">{w.to}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{w.template_name || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={"px-2 py-0.5 rounded-full text-[10px] font-medium " + (STATUS_BADGE[w.status] || "bg-gray-100")}>
                          {w.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{w.attempts}</td>
                      <td className="px-3 py-2 max-w-[150px] truncate text-red-600" title={w.last_error || ""}>
                        {w.last_error || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* In-App Notifications */}
      {activeTab === "inapp" || activeTab === "all" ? (
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            In-App Notifications
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              {data?.inApp?.length || 0}
            </span>
          </h3>
          {(!data?.inApp || data.inApp.length === 0) ? (
            <p className="text-gray-400 text-sm italic">Tiada notifikasi in-app.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Masa</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Jenis</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Tajuk</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">User ID</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Task</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Baca</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.inApp.map(n => (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(n.created_at)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded">
                          {n.type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate font-medium" title={n.title}>
                        {n.title}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{n.user_id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{n.task_id || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {n.is_read ? (
                          <span className="text-emerald-600">✓</span>
                        ) : (
                          <span className="text-amber-500 font-bold">●</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {/* Notification Templates */}
      {activeTab === "templates" ? (
        <div className="p-4 sm:p-6">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            Template Notifikasi
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {data?.templates?.length || 0}
            </span>
          </h3>
          {(!data?.templates || data.templates.length === 0) ? (
            <p className="text-gray-400 text-sm italic">Tiada template.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.templates.map(t => (
                <div key={t.id} className="border rounded-lg p-3 hover:border-blue-200 transition">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={"text-[10px] px-1.5 py-0.5 rounded font-medium " + (
                      t.channel === "Whatsapp" ? "bg-green-100 text-green-700" :
                      t.channel === "E-mel" ? "bg-blue-100 text-blue-700" :
                      "bg-purple-100 text-purple-700"
                    )}>{t.channel}</span>
                    <span className="font-semibold text-sm">{t.name}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">{t.type}</p>
                  <p className="text-xs text-gray-700 mt-1 line-clamp-2">{t.subjectOrTitle}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "all" && (!data?.whatsapp || data.whatsapp.length === 0) && (!data?.inApp || data.inApp.length === 0) && (
        <p className="text-center text-gray-400 text-sm py-6">Tiada sebarang notifikasi ditemui.</p>
      )}
    </div>
  );
};
