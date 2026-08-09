export const TASK_COLUMN_KEYS = ['created_at', 'status', 'district', 'state', 'title', 'freelancer', 'offer_price', 'location'] as const;
export type TaskColumnKey = (typeof TASK_COLUMN_KEYS)[number];

export const TASK_DEFAULT_VISIBLE: Record<TaskColumnKey, boolean> = {
  created_at: true,
  status: true,
  district: true,
  state: true,
  title: true,
  freelancer: true,
  offer_price: true,
  location: false
};

export const TASK_DEFAULT_ORDER: TaskColumnKey[] = [...TASK_COLUMN_KEYS];

export const MASTERLIST_COLUMN_KEYS = ['status', 'updated_at', 'name', 'project', 'asset_count', 'description', 'created_at', 'code'] as const;
export type MasterlistColumnKey = (typeof MASTERLIST_COLUMN_KEYS)[number];

export const MASTERLIST_DEFAULT_VISIBLE: Record<MasterlistColumnKey, boolean> = {
  status: true,
  updated_at: true,
  name: true,
  project: true,
  asset_count: true,
  description: false,
  created_at: false,
  code: false
};

export const MASTERLIST_DEFAULT_ORDER: MasterlistColumnKey[] = [...MASTERLIST_COLUMN_KEYS];

