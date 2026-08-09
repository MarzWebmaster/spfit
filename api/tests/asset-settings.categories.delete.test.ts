import request from 'supertest';
import bcrypt from 'bcryptjs';

import app from '../app';
import { AppDataSource } from '../config/database';
import { runMigrations } from '../migrations/runMigrations';
import { Role } from '../models/Role';
import { RoleType } from '../models/RoleType';
import { User, UserStatus } from '../models/User';
import { AssetCategoryOption } from '../models/AssetCategoryOption';

jest.setTimeout(30000);

const login = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body?.success).toBe(true);
  expect(typeof res.body?.data?.accessToken).toBe('string');
  return res.body.data.accessToken as string;
};

describe('Asset Settings - categories delete blocked', () => {
  let roleTypeId: number;
  let adminRoleId: number;
  let adminUserId: number;
  let adminToken: string;
  let categoryId: number;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    await runMigrations(AppDataSource);

    const roleTypeRepo = AppDataSource.getRepository(RoleType);
    const roleRepo = AppDataSource.getRepository(Role);
    const userRepo = AppDataSource.getRepository(User);
    const categoryRepo = AppDataSource.getRepository(AssetCategoryOption);

    const existingRoleType = await roleTypeRepo.findOne({ where: { name: 'System' } });
    const anyRoleType = existingRoleType || (await roleTypeRepo.findOne({ where: {} }));
    const roleType = (anyRoleType || (await roleTypeRepo.save(roleTypeRepo.create({ name: `Test_${Date.now()}`, description: '' } as any)))) as RoleType;
    roleTypeId = roleType.id;

    const adminRoleExisting = await roleRepo.findOne({ where: { name: 'Admin' } });
    const adminRole = (adminRoleExisting || (await roleRepo.save(roleRepo.create({ name: 'Admin', role_type_id: roleTypeId, is_system_role: true } as any)))) as unknown as Role;
    adminRoleId = adminRole.id;

    const adminEmail = `admin_cat_del_${Date.now()}@example.com`;
    const adminUser = await userRepo.save(userRepo.create({
      name: 'Admin Category Delete Block Test',
      email: adminEmail,
      password_hash: await bcrypt.hash('admin123', 10),
      role_id: adminRoleId,
      status: UserStatus.AKTIF
    }));
    adminUserId = adminUser.id;
    adminToken = await login(adminEmail, 'admin123');

    const saved = await categoryRepo.save(categoryRepo.create({
      name: `cat_del_${Date.now()}`,
      sort_order: 0,
      is_active: true
    }));
    categoryId = saved.id;
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      if (categoryId) await AppDataSource.query('DELETE FROM asset_category WHERE id = ?', [categoryId]);
      if (adminUserId) {
        await AppDataSource.query('DELETE FROM user_sessions WHERE user_id = ?', [adminUserId]);
        await AppDataSource.query('DELETE FROM users WHERE id = ?', [adminUserId]);
      }
      await AppDataSource.destroy();
    }
  });

  it('menolak DELETE kategori aset (405) dan rekod kekal', async () => {
    const res = await request(app)
      .delete(`/api/asset-settings/categories/${categoryId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(405);
    expect(res.body?.success).toBe(false);

    const repo = AppDataSource.getRepository(AssetCategoryOption);
    const still = await repo.findOneBy({ id: categoryId });
    expect(still).not.toBeNull();
  });

  it('DELETE kategori dengan id tidak sah pulang 400', async () => {
    const res = await request(app)
      .delete('/api/asset-settings/categories/abc')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body?.success).toBe(false);
  });
});
