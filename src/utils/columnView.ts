export function normalizeColumnOrder<K extends string>(saved: unknown, defaults: readonly K[]): K[] {
  if (!Array.isArray(saved) || saved.length === 0) return [...defaults];
  const allowed = new Set<K>(defaults as K[]);
  const filtered = saved.filter((k): k is K => typeof k === 'string' && allowed.has(k as K));
  const dedup = Array.from(new Set(filtered)) as K[];
  if (dedup.length === 0) return [...defaults];
  const missing = defaults.filter((k) => !dedup.includes(k));
  return [...dedup, ...missing];
}

export function normalizeColumnVisibility<K extends string>(saved: unknown, defaults: Record<K, boolean>): Record<K, boolean> {
  if (!saved || typeof saved !== 'object') return { ...defaults };
  const raw = saved as Record<string, unknown>;
  const next = { ...defaults } as Record<K, boolean>;
  (Object.keys(defaults) as K[]).forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(raw, k)) next[k] = Boolean(raw[k as any]);
  });
  return next;
}

