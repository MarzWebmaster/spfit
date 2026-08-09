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

describe('Assets accessories', () => {
  let roleTypeId: number;
  let adminRoleId: number;
  let adminUserId: number;
  let adminToken: string;

  let projectId: number;
  let masterlistId: number;

  let desktopCategoryId: number;
  let laptopCategoryId: number;
  let monitorCategoryId: number;

  const createdAssetIds: number[] = [];

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    await runMigrations(AppDataSource);

    const roleTypeRepo = AppDataSource.getRepository(RoleType);
    const roleRepo = AppDataSource.getRepository(Role);
    const userRepo = AppDataSource.getRepository(User);
    const projectRepo = AppDataSource.getRepository(Project);
    const masterlistRepo = AppDataSource.getRepository(Masterlist);

    const existingRoleType = await roleTypeRepo.findOne({ where: { name: 'System' } });
    const anyRoleType = existingRoleType || (await roleTypeRepo.findOne({ where: {} }));
    const roleType = (anyRoleType || (await roleTypeRepo.save(roleTypeRepo.create({ name: `Test_${Date.now()}`, description: '' } as any)))) as RoleType;
    roleTypeId = roleType.id;

    const adminRoleExisting = await roleRepo.findOne({ where: { name: 'Admin' } });
    const adminRole = (adminRoleExisting || (await roleRepo.save(roleRepo.create({ name: 'Admin', role_type_id: roleTypeId, is_system_role: true } as any)))) as unknown as Role;
    adminRoleId = adminRole.id;

    const adminEmail = `admin_acc_${Date.now()}@example.com`;
    const adminUser = await userRepo.save(userRepo.create({
      name: 'Admin Accessories Test',
      email: adminEmail,
      password_hash: await bcrypt.hash('admin123', 10),
      role_id: adminRoleId,
      status: UserStatus.AKTIF
    }));
    adminUserId = adminUser.id;
    adminToken = await login(adminEmail, 'admin123');

    desktopCategoryId = await ensureCategory('desktop');
    laptopCategoryId = await ensureCategory('laptop');
    monitorCategoryId = await ensureCategory('monitor');

    const project = await projectRepo.save(projectRepo.create({
      code: `PRJ_ACC_${Date.now()}`,
      name: 'Project Accessories Test',
      status: ProjectStatus.AKTIF
    }));
    projectId = project.id;

    const masterlist = (await masterlistRepo.save(masterlistRepo.create({
      project_id: projectId,
      code: `ML_ACC_${Date.now()}`,
      name: 'Masterlist Accessories Test',
      status: MasterlistStatus.AKTIF
    } as any))) as unknown as Masterlist;
    masterlistId = masterlist.id;
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      if (createdAssetIds.length) {
        await AppDataSource.query(
          `DELETE FROM asset_accessories WHERE asset_id IN (${createdAssetIds.map(() => '?').join(',')}) OR accessory_asset_id IN (${createdAssetIds.map(() => '?').join(',')})`,
          [...createdAssetIds, ...createdAssetIds]
        );
        await AppDataSource.query(`DELETE FROM assets WHERE id IN (${createdAssetIds.map(() => '?').join(',')})`, createdAssetIds);
      }

      if (masterlistId) await AppDataSource.query('DELETE FROM masterlists WHERE id = ?', [masterlistId]);
      if (projectId) await AppDataSource.query('DELETE FROM projects WHERE id = ?', [projectId]);

      if (adminUserId) {
        await AppDataSource.query('DELETE FROM user_sessions WHERE user_id = ?', [adminUserId]);
        await AppDataSource.query('DELETE FROM users WHERE id = ?', [adminUserId]);
      }

      await AppDataSource.destroy();
    }
  });

  it('desktop: boleh simpan aksesori (monitor/keyboard/mouse/other)', async () => {
    const monitor = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ masterlist_id: masterlistId, name: 'Monitor Z', serial_number: 'SN-MON-Z', category_id: monitorCategoryId });
    expect(monitor.status).toBe(201);
    const monitorId = Number(monitor.body?.data?.id);
    createdAssetIds.push(monitorId);

    const keyboard = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ masterlist_id: masterlistId, name: 'Keyboard Z', serial_number: 'SN-KEY-Z' });
    expect(keyboard.status).toBe(201);
    const keyboardId = Number(keyboard.body?.data?.id);
    createdAssetIds.push(keyboardId);

    const mouse = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ masterlist_id: masterlistId, name: 'Mouse Z', serial_number: 'SN-MOU-Z' });
    expect(mouse.status).toBe(201);
    const mouseId = Number(mouse.body?.data?.id);
    createdAssetIds.push(mouseId);

    const otherDevice = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ masterlist_id: masterlistId, name: 'Dongle Z', serial_number: 'SN-OTH-Z' });
    expect(otherDevice.status).toBe(201);
    const otherId = Number(otherDevice.body?.data?.id);
    createdAssetIds.push(otherId);

    const pc = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        masterlist_id: masterlistId,
        name: 'PC A',
        serial_number: 'SN-PCA',
        category_id: desktopCategoryId,
        accessories: [
          { type: 'monitor', asset_id: monitorId },
          { type: 'keyboard', asset_id: keyboardId },
          { type: 'mouse', asset_id: mouseId },
          { type: 'other', asset_id: otherId, notes: 'Dipakai sebagai spare' }
        ]
      });

    expect(pc.status).toBe(201);
    const pcId = Number(pc.body?.data?.id);
    createdAssetIds.push(pcId);
    expect(Array.isArray(pc.body?.data?.accessories)).toBe(true);
    expect(pc.body?.data?.accessories?.length).toBe(4);

    const rows = await AppDataSource.query('SELECT * FROM asset_accessories WHERE asset_id = ? ORDER BY id ASC', [pcId]);
    expect(rows.length).toBe(4);
  });

  it('tidak boleh duplikasi accessory (exclusive pairing)', async () => {
    // 1. Create a monitor
    const monitor = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ masterlist_id: masterlistId, name: 'Monitor Shared', serial_number: 'SN-MON-SHARED', category_id: monitorCategoryId });
    const monitorId = Number(monitor.body?.data?.id);
    createdAssetIds.push(monitorId);

    // 2. Pair to PC 1
    const pc1 = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        masterlist_id: masterlistId,
        name: 'PC 1',
        serial_number: 'SN-PC1',
        category_id: desktopCategoryId,
        accessories: [{ type: 'monitor', asset_id: monitorId }]
      });
    expect(pc1.status).toBe(201);
    createdAssetIds.push(Number(pc1.body?.data?.id));

    // 3. Try to pair same monitor to PC 2
    const pc2 = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        masterlist_id: masterlistId,
        name: 'PC 2',
        serial_number: 'SN-PC2',
        category_id: desktopCategoryId,
        accessories: [{ type: 'monitor', asset_id: monitorId }]
      });
    expect(pc2.status).toBe(400); // Harus ditolak
    expect(pc2.body.message).toContain('telah dipasangkan');
  });

  it('laptop: boleh simpan aksesori (tanpa duplikasi asset_id)', async () => {
    const monitor = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ masterlist_id: masterlistId, name: 'Monitor A', serial_number: 'SN-MON-A', category_id: monitorCategoryId });
    expect(monitor.status).toBe(201);
    const monitorId = Number(monitor.body?.data?.id);
    createdAssetIds.push(monitorId);

    const mouse = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ masterlist_id: masterlistId, name: 'Mouse A', serial_number: 'SN-MOU-A' });
    expect(mouse.status).toBe(201);
    const mouseId = Number(mouse.body?.data?.id);
    createdAssetIds.push(mouseId);

    const laptop = await request(app)
      .post('/api/assets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        masterlist_id: masterlistId,
        name: 'Laptop A',
        serial_number: 'SN-LAPA',
        category_id: laptopCategoryId,
        accessories: [
          { type: 'monitor', asset_id: monitorId },
          { type: 'mouse', asset_id: mouseId }
        ]
      });

    expect(laptop.status).toBe(201);
    const laptopId = Number(laptop.body?.data?.id);
    createdAssetIds.push(laptopId);
    expect(Array.isArray(laptop.body?.data?.accessories)).toBe(true);
    expect(laptop.body?.data?.accessories?.length).toBe(2);

    const rows = await AppDataSource.query('SELECT * FROM asset_accessories WHERE asset_id = ? ORDER BY id ASC', [laptopId]);
    expect(rows.length).toBe(2);
    expect(rows[0].asset_id).toBe(laptopId);
  });
});
