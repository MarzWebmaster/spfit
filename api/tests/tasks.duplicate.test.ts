import request from 'supertest';
import bcrypt from 'bcryptjs';

import app from '../app';
import { AppDataSource } from '../config/database';
import { runMigrations } from '../migrations/runMigrations';
import { Role } from '../models/Role';
import { RoleType } from '../models/RoleType';
import { User, UserStatus } from '../models/User';
import { TaskPart } from '../models/TaskPart';
import { SupportTypeOption } from '../models/SupportTypeOption';

jest.setTimeout(30000);

const login = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body?.success).toBe(true);
  expect(typeof res.body?.data?.accessToken).toBe('string');
  return res.body.data.accessToken as string;
};

describe('Tasks duplicate', () => {
  let roleTypeId: number;
  let adminRoleId: number;
  let adminUserId: number;
  let adminToken: string;

  let originalTaskId: number;
  let duplicatedTaskId: number;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();
    await runMigrations(AppDataSource);

    const roleTypeRepo = AppDataSource.getRepository(RoleType);
    const roleRepo = AppDataSource.getRepository(Role);
    const userRepo = AppDataSource.getRepository(User);
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

    const adminEmail = `admin_dup_task_${Date.now()}@example.com`;
    const adminUser = await userRepo.save(
      userRepo.create({
        name: 'Admin Duplicate Task Test',
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

    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Original Task',
        description: 'Original description',
        support_type: 'Perisian',
        client_location: 'Lokasi A',
        state: 'Selangor',
        requirement_date: new Date().toISOString(),
        requirement_time: '10:30',
        offer_price: 10.5,
        links: [{ url: 'https://example.com', description: 'Link A' }]
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body?.success).toBe(true);
    originalTaskId = Number(createRes.body?.data?.task?.id);
    expect(originalTaskId).toBeGreaterThan(0);

    await AppDataSource.query('UPDATE tasks SET assigned_to = ? WHERE id = ?', [adminUserId, originalTaskId]);

    const partRepo = AppDataSource.getRepository(TaskPart);
    await partRepo.save(
      partRepo.create([
        { task_id: originalTaskId, part_number: 'PN-1', description: 'Part 1', quantity: 1 } as any,
        { task_id: originalTaskId, part_number: 'PN-2', description: 'Part 2', quantity: 2 } as any
      ])
    );
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      if (duplicatedTaskId) {
        await AppDataSource.query('DELETE FROM task_parts WHERE task_id = ?', [duplicatedTaskId]);
        await AppDataSource.query('DELETE FROM task_links WHERE task_id = ?', [duplicatedTaskId]);
        await AppDataSource.query('DELETE FROM tasks WHERE id = ?', [duplicatedTaskId]);
      }
      if (originalTaskId) {
        await AppDataSource.query('DELETE FROM task_parts WHERE task_id = ?', [originalTaskId]);
        await AppDataSource.query('DELETE FROM task_links WHERE task_id = ?', [originalTaskId]);
        await AppDataSource.query('DELETE FROM tasks WHERE id = ?', [originalTaskId]);
      }

      if (adminUserId) {
        await AppDataSource.query('DELETE FROM audit_trails WHERE user_id = ?', [adminUserId]);
        await AppDataSource.query('DELETE FROM user_sessions WHERE user_id = ?', [adminUserId]);
        await AppDataSource.query('DELETE FROM users WHERE id = ?', [adminUserId]);
      }

      await AppDataSource.destroy();
    }
  });

  it('duplicate task: copy props + prefix title + copy parts/links', async () => {
    const res = await request(app)
      .post(`/api/tasks/${originalTaskId}/duplicate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);

    const duplicated = res.body?.data?.task;
    expect(duplicated).toBeTruthy();
    duplicatedTaskId = Number(duplicated.id);
    expect(duplicatedTaskId).toBeGreaterThan(0);
    expect(duplicatedTaskId).not.toBe(originalTaskId);

    expect(String(duplicated.title)).toMatch(/^Copy of /);
    expect(duplicated.description).toBe('Original description');
    expect(duplicated.client_location || duplicated.clientLocation).toBeTruthy();
    expect(Number(duplicated.assigned_to || duplicated.assignedTo)).toBe(adminUserId);
    expect(String(duplicated.log_number || duplicated.logNumber)).toMatch(/^SPFIT-\d{6}-\d{4}$/);

    const getRes = await request(app)
      .get(`/api/tasks/${duplicatedTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    const full = getRes.body?.data?.task;
    expect(Array.isArray(full.links)).toBe(true);
    expect(full.links.length).toBeGreaterThanOrEqual(1);
    expect(full.links[0].url).toBe('https://example.com');

    expect(Array.isArray(full.parts)).toBe(true);
    expect(full.parts.length).toBe(2);
    expect(full.parts[0].partNumber || full.parts[0].part_number).toBe('PN-1');
  });
});
