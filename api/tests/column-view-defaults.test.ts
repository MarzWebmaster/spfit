import { normalizeColumnOrder, normalizeColumnVisibility } from '../../src/utils/columnView';
import {
  TASK_COLUMN_KEYS,
  TASK_DEFAULT_ORDER,
  TASK_DEFAULT_VISIBLE,
  MASTERLIST_COLUMN_KEYS,
  MASTERLIST_DEFAULT_ORDER,
  MASTERLIST_DEFAULT_VISIBLE
} from '../../src/utils/columnViewDefaults';

describe('Column view defaults', () => {
  it('Task: default order & visibility ikut tetapan yang ditetapkan', () => {
    expect(TASK_DEFAULT_ORDER).toEqual(['created_at', 'status', 'district', 'state', 'title', 'freelancer', 'offer_price', 'location']);
    expect(TASK_DEFAULT_VISIBLE).toEqual({
      created_at: true,
      status: true,
      district: true,
      state: true,
      title: true,
      freelancer: true,
      offer_price: true,
      location: false
    });
  });

  it('Masterlists: default order & visibility ikut tetapan yang ditetapkan', () => {
    expect(MASTERLIST_DEFAULT_ORDER).toEqual(['status', 'updated_at', 'name', 'project', 'asset_count', 'description', 'created_at', 'code']);
    expect(MASTERLIST_DEFAULT_VISIBLE).toEqual({
      status: true,
      updated_at: true,
      name: true,
      project: true,
      asset_count: true,
      description: false,
      created_at: false,
      code: false
    });
  });

  it('normalizeColumnOrder: simpan order yang sah + append yang tiada (ikut default)', () => {
    const saved = ['title', 'status', 'unknown', 'status'];
    const result = normalizeColumnOrder(saved, TASK_COLUMN_KEYS);
    expect(result).toEqual(['title', 'status', 'created_at', 'district', 'state', 'freelancer', 'offer_price', 'location']);
  });

  it('normalizeColumnVisibility: guna saved value jika ada, selain itu kekal default', () => {
    const saved = { status: false, location: true, something_else: true };
    const result = normalizeColumnVisibility(saved, TASK_DEFAULT_VISIBLE);
    expect(result.status).toBe(false);
    expect(result.location).toBe(true);
    expect(result.created_at).toBe(true);
  });

  it('normalizeColumnOrder: bila saved kosong/invalid, pulangkan default', () => {
    expect(normalizeColumnOrder(undefined, MASTERLIST_COLUMN_KEYS)).toEqual(MASTERLIST_DEFAULT_ORDER);
    expect(normalizeColumnOrder([], MASTERLIST_COLUMN_KEYS)).toEqual(MASTERLIST_DEFAULT_ORDER);
  });
});

