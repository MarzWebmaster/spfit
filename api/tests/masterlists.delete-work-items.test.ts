import request from 'supertest';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

import app from '../app';
import { AppDataSource } from '../config/database';
import { Role } from '../models/Role';
import { RoleType } from '../models/RoleType';
import { User, UserStatus } from '../models/User';
import { Project, ProjectStatus } from '../models/Project';
import { Masterlist, MasterlistStatus } from '../models/Masterlist';

jest.setTimeout(30000);

const login = async (email: string, password: string) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  expect(res.body?.success).toBe(true);
  expect(typeof res.body?.data?.accessToken).toBe('string');
  return res.body.data.accessToken as string;
};

describe('Masterlist Work Items Delete API', () => {
  let roleTypeId: number;
  let adminRoleId: number;
  let noPermRoleId: number;

  let adminUserId: number;
  let noPermUserId: number;

  let adminToken: string;
  let noPermToken: string;

  let projectId: number;
  let masterlistId: number;
  const testDocRelativePath = 'uploads/jest-doc.txt';

  let evilMasterlistId: number;
  const evilDocRelativePath = 'notuploads/jest-evil.txt';

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize();

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

    const noPermRoleName = `NoPerm_${Date.now()}`;
    const noPermRole = (await roleRepo.save(roleRepo.create({ name: noPermRoleName, role_type_id: roleTypeId, is_system_role: false } as any))) as unknown as Role;
    noPermRoleId = noPermRole.id;

    const adminEmail = `admin_${Date.now()}@example.com`;
    const adminUser = await userRepo.save(userRepo.create({
      name: 'Admin Test',
      email: adminEmail,
      password_hash: await bcrypt.hash('admin123', 10),
      role_id: adminRoleId,
      status: UserStatus.AKTIF
    }));
    adminUserId = adminUser.id;
    adminToken = await login(adminEmail, 'admin123');

    const noPermEmail = `noperm_${Date.now()}@example.com`;
    const noPermUser = await userRepo.save(userRepo.create({
      name: 'NoPerm Test',
      email: noPermEmail,
      password_hash: await bcrypt.hash('noperm123', 10),
      role_id: noPermRoleId,
      status: UserStatus.AKTIF
    }));
    noPermUserId = noPermUser.id;
    noPermToken = await login(noPermEmail, 'noperm123');

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), testDocRelativePath), 'hello');

    fs.mkdirSync(path.resolve(process.cwd(), 'notuploads'), { recursive: true });
    fs.writeFileSync(path.resolve(process.cwd(), evilDocRelativePath), 'evil');

    const project = await projectRepo.save(projectRepo.create({
      code: `PRJ_${Date.now()}`,
      name: 'Project Test',
      status: ProjectStatus.AKTIF
    }));
    projectId = project.id;

    const masterlist = (await masterlistRepo.save(masterlistRepo.create({
      project_id: projectId,
      code: `ML_${Date.now()}`,
      name: 'Masterlist Test',
      status: MasterlistStatus.AKTIF,
      work_links: [
        { title: 'Link A', url: 'https://example.com/a' },
        { title: 'Link B', url: 'https://example.com/b' }
      ],
      work_documents: [
        {
          title: 'Doc A',
          file_name: 'jest-doc.txt',
          file_path: testDocRelativePath,
          file_type: 'text/plain',
          file_size: 5,
          uploaded_at: new Date().toISOString()
        }
      ]
    } as any))) as unknown as Masterlist;
    masterlistId = masterlist.id;

    const evilMasterlist = (await masterlistRepo.save(masterlistRepo.create({
      project_id: projectId,
      code: `ML_EVIL_${Date.now()}`,
      name: 'Masterlist Evil Doc Test',
      status: MasterlistStatus.AKTIF,
      work_documents: [
        {
          title: 'Evil Doc',
          file_name: 'jest-evil.txt',
          file_path: evilDocRelativePath,
          file_type: 'text/plain',
          file_size: 4,
          uploaded_at: new Date().toISOString()
        }
      ]
    } as any))) as unknown as Masterlist;
    evilMasterlistId = evilMasterlist.id;
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      const userRepo = AppDataSource.getRepository(User);
      const roleRepo = AppDataSource.getRepository(Role);
      const masterlistRepo = AppDataSource.getRepository(Masterlist);
      const projectRepo = AppDataSource.getRepository(Project);

      if (masterlistId) await masterlistRepo.delete(masterlistId);
      if (evilMasterlistId) await masterlistRepo.delete(evilMasterlistId);
      if (projectId) await projectRepo.delete(projectId);
      if (adminUserId || noPermUserId) {
        await AppDataSource.query('DELETE FROM user_sessions WHERE user_id IN (?, ?)', [adminUserId || 0, noPermUserId || 0]);
      }
      if (adminUserId) await userRepo.delete(adminUserId);
      if (noPermUserId) await userRepo.delete(noPermUserId);
      if (noPermRoleId) await roleRepo.delete(noPermRoleId);

      const docAbsPath = path.resolve(process.cwd(), testDocRelativePath);
      if (fs.existsSync(docAbsPath)) fs.unlinkSync(docAbsPath);

      const evilAbsPath = path.resolve(process.cwd(), evilDocRelativePath);
      if (fs.existsSync(evilAbsPath)) fs.unlinkSync(evilAbsPath);

      await AppDataSource.destroy();
    }
  });

  it('401 tanpa token (work-links)', async () => {
    const res = await request(app).delete(`/api/masterlists/${masterlistId}/work-links/0`);
    expect(res.status).toBe(401);
  });

  it('403 token sah tapi tiada permission (work-links)', async () => {
    const res = await request(app)
      .delete(`/api/masterlists/${masterlistId}/work-links/0`)
      .set('Authorization', `Bearer ${noPermToken}`);
    expect(res.status).toBe(403);
  });

  it('401 tanpa token (work-documents)', async () => {
    const res = await request(app).delete(`/api/masterlists/${masterlistId}/work-documents/0`);
    expect(res.status).toBe(401);
  });

  it('403 token sah tapi tiada permission (work-documents)', async () => {
    const res = await request(app)
      .delete(`/api/masterlists/${masterlistId}/work-documents/0`)
      .set('Authorization', `Bearer ${noPermToken}`);
    expect(res.status).toBe(403);
  });

  it('200 delete work link (Admin bypass)', async () => {
    const res = await request(app)
      .delete(`/api/masterlists/${masterlistId}/work-links/0`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.work_links?.length).toBe(1);
    expect(res.body?.data?.work_links?.[0]?.title).toBe('Link B');
  });

  it('404 index out-of-range (work-links)', async () => {
    const res = await request(app)
      .delete(`/api/masterlists/${masterlistId}/work-links/99`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('200 delete work document + file terpadam (Admin bypass)', async () => {
    const beforePath = path.resolve(process.cwd(), testDocRelativePath);
    expect(fs.existsSync(beforePath)).toBe(true);

    const res = await request(app)
      .delete(`/api/masterlists/${masterlistId}/work-documents/0`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.data?.work_documents?.length ?? 0).toBe(0);
    expect(fs.existsSync(beforePath)).toBe(false);
  });

  it('404 index out-of-range (work-documents)', async () => {
    const res = await request(app)
      .delete(`/api/masterlists/${masterlistId}/work-documents/0`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('404 masterlist tidak wujud', async () => {
    const res = await request(app)
      .delete('/api/masterlists/99999999/work-links/0')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('400 fail path tidak sah (work-documents) dan fail tidak dipadam', async () => {
    const evilAbsPath = path.resolve(process.cwd(), evilDocRelativePath);
    expect(fs.existsSync(evilAbsPath)).toBe(true);

    const res = await request(app)
      .delete(`/api/masterlists/${evilMasterlistId}/work-documents/0`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(fs.existsSync(evilAbsPath)).toBe(true);
  });
});
