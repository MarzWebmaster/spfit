import request from 'supertest';
import bcrypt from 'bcryptjs';

import app from '../app';
import { AppDataSource } from '../config/database';
import { runMigrations } from '../migrations/runMigrations';
import { Role } from '../models/Role';
import { RoleType } from '../models/RoleType';
import { User, UserStatus } from '../models/User';
import { Project, ProjectStatus } from '../models/Project';
import { AssetCategoryOption } from '../models/AssetCategoryOption';
import { SupportTypeOption } from '../models/SupportTypeOption';

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

describe('Masterlists duplicate', () => {
  let roleTypeId: number;
  let adminRoleId: number;
  let adminUserId: number;
  let adminToken: string;

  let projectId: number;
  let masterlistId: number;
  let duplicatedMasterlistId: number;

  let desktopCategoryId: number;
  let createdAssetId: number;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    await runMigrations(AppDataSource);

    const roleTypeRepo = AppDataSource.getRepository(RoleType);
    const roleRepo = AppDataSource.getRepository(Role);
    const userRepo = AppDataSource.getRepository(User);
    const projectRepo = AppDataSource.getRepository(Project);
    const supportTypeRepo = AppDataSource.getRepository(SupportTypeOption);

    const existingRoleType = await roleTypeRepo.findOne({ where: { name: 'System' } });
    const anyRoleType = existingRoleType || (await roleTypeRepo.findOne({ where: {} }));
    const roleType = (anyRoleType ||
      (await roleTypeRepo.save(roleTypeRepo.create({ name: `Test_${Date.now()}`, description: '' } as any)))) as RoleType;
    roleTypeId = roleType.id;

    const adminRoleExisting = await roleRepo.findOne({ where: { name: 'Admin' } });
    const adminRole = (adminRoleExisting ||
      (await roleRepo.save(roleRepo.create({ name: 'Admin', role_type_id: roleTypeId, is_system_role: true } as any)))) as unknown as Role;
    adminRoleId = adminRole.id;

    const adminEmail = `admin_dup_masterlist_${Date.now()}@example.com`;
    const adminUser = await userRepo.save(
      userRepo.create({
        name: 'Admin Duplicate Masterlist Test',
        email: adminEmail,
        password_hash: await bcrypt.hash('admin123', 10),
        role_id: adminRoleId,
        status: UserStatus.AKTIF
      })
    );
    adminUserId = adminUser.id;
    adminToken = await login(adminEmail, 'admin123');

    const perisian = await supportTypeRepo.findOne({ where: { name: 'Perisian' } });
    if (!perisian) {
      await supportTypeRepo.save(supportTypeRepo.create({ name: 'Perisian', is_active: true, sort_order: 2 } as any));
    }

    desktopCategoryId = await ensureCategory('desktop');

    const project = await projectRepo.save(
      projectRepo.create({
        code: `PRJ_DUP_ML_${Date.now()}`,
        name: 'Project Duplicate Masterlist Test',
        status: ProjectStatus.AKTIF
      })
    );
    projectId = project.id;

    const masterlistRes = await request(app)
      .post('/api/masterlists')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('project_id', String(projectId))
      .field('code', `ML_DUP_${Date.now()}`)
      .field('name', 'Masterlist Original')
      .field('description', 'Desc')
      .field('status', 'Aktif');

    expect(masterlistRes.status).toBe(201);
    masterlistId = Number(masterlistRes.body?.data?.id);
    expect(masterlistId).toBeGreaterThan(0);

    const assetRes = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        masterlist_id: masterlistId,
        asset_tag: 'TAG-ML-1',
        name: 'Desktop A',
        category_id: desktopCategoryId,
        serial_number: 'SN-ML-1'
      });

    expect(assetRes.status).toBe(201);
    createdAssetId = Number(assetRes.body?.data?.id);
    expect(createdAssetId).toBeGreaterThan(0);

    await AppDataSource.query(
      'INSERT INTO asset_users (asset_id, user_name, position, department, branch, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [createdAssetId, 'User A', 'Pos', 'Dept', 'Branch', 'State']
    );

  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      if (duplicatedMasterlistId) {
        await AppDataSource.query('DELETE FROM masterlist_assets WHERE masterlist_id = ?', [duplicatedMasterlistId]);
      }
      if (createdAssetId) {
        await AppDataSource.query('DELETE FROM asset_users WHERE asset_id = ?', [createdAssetId]);
        await AppDataSource.query('DELETE FROM assets WHERE id = ?', [createdAssetId]);
      }

      if (duplicatedMasterlistId) await AppDataSource.query('DELETE FROM masterlists WHERE id = ?', [duplicatedMasterlistId]);
      if (masterlistId) await AppDataSource.query('DELETE FROM masterlists WHERE id = ?', [masterlistId]);
      if (projectId) await AppDataSource.query('DELETE FROM projects WHERE id = ?', [projectId]);

      if (adminUserId) {
        await AppDataSource.query('DELETE FROM audit_trails WHERE user_id = ?', [adminUserId]);
        await AppDataSource.query('DELETE FROM user_sessions WHERE user_id = ?', [adminUserId]);
        await AppDataSource.query('DELETE FROM users WHERE id = ?', [adminUserId]);
      }

      await AppDataSource.destroy();
    }
  });

  it('duplicate masterlist: link listing assets without creating new assets', async () => {
    const res = await request(app)
      .post(`/api/masterlists/${masterlistId}/duplicate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ include_assets: true });

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    const data = res.body?.data;
    expect(data?.masterlist).toBeTruthy();
    duplicatedMasterlistId = Number(data.masterlist.id);
    expect(duplicatedMasterlistId).toBeGreaterThan(0);
    expect(duplicatedMasterlistId).not.toBe(masterlistId);

    const createdAsset = await AppDataSource.query('SELECT * FROM assets WHERE id = ?', [createdAssetId]);
    expect(createdAsset.length).toBe(1);
    expect(Number(createdAsset[0].masterlist_id)).toBe(masterlistId);

    const newMasterlistDirectAssets = await AppDataSource.query('SELECT * FROM assets WHERE masterlist_id = ?', [duplicatedMasterlistId]);
    expect(newMasterlistDirectAssets.length).toBe(0);

    const listingRows = await AppDataSource.query(
      'SELECT * FROM masterlist_assets WHERE masterlist_id = ? AND asset_id = ?',
      [duplicatedMasterlistId, createdAssetId]
    );
    expect(listingRows.length).toBe(1);

    const listRes = await request(app)
      .get('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, limit: 10, masterlist_id: duplicatedMasterlistId });
    expect(listRes.status).toBe(200);
    expect(listRes.body?.success).toBe(true);
    const listedAssets = listRes.body?.data?.assets || [];
    expect(Array.isArray(listedAssets)).toBe(true);
    expect(listedAssets.length).toBe(1);
    expect(Number(listedAssets[0].id)).toBe(createdAssetId);
  });
});
