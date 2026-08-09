import request from 'supertest';
import bcrypt from 'bcryptjs';

import app from '../app';
import { AppDataSource } from '../config/database';
import { runMigrations } from '../migrations/runMigrations';
import { Role } from '../models/Role';
import { RoleType } from '../models/RoleType';
import { User, UserStatus } from '../models/User';
import { Project, ProjectStatus } from '../models/Project';
import { Masterlist, MasterlistStatus } from '../models/Masterlist';
import { AssetCategoryOption } from '../models/AssetCategoryOption';

jest.setTimeout(30000);

const login = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body?.success).toBe(true);
  expect(typeof res.body?.data?.accessToken).toBe('string');
  return res.body.data.accessToken as string;
};

const ensureCategory = async (name: string) => {
  const repo = AppDataSource.getRepository(AssetCategoryOption);
  const existing = await repo.findOneBy({ name });
  if (existing) return existing.id;
  const saved = await repo.save(repo.create({ name, sort_order: 0, is_active: true }));
  return saved.id;
};

describe('Removed Category Details API', () => {
  it('should skip tests since category_details were removed', () => {
    expect(true).toBe(true);
  });
});
