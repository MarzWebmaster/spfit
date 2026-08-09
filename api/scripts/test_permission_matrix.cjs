const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const axios = require('axios');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3005';
const TEST_PASSWORD = 'Passw0rd!123';

const roleConfigs = {
  Admin: ['Admin'],
  Staff: ['Staff'],
  Supervisor: ['Supervisor'],
  Freelancer: ['Freelancer', 'Freelance Tech'],
};

const endpointTests = [
  { name: 'Tasks List', method: 'get', url: '/api/tasks', permsAny: ['tasks:view:all', 'tasks:view:assigned'] },
  { name: 'Task Create', method: 'post', url: '/api/tasks', permsAny: ['tasks:create'], data: {} },
  { name: 'Task Update', method: 'put', url: '/api/tasks/999999', permsAny: ['tasks:edit:all'], data: {} },
  { name: 'Task Assign', method: 'patch', url: '/api/tasks/999999/assign', permsAny: ['tasks:assign'], data: {} },
  { name: 'Task Delete', method: 'delete', url: '/api/tasks/999999', permsAny: ['tasks:delete'] },

  { name: 'Users List', method: 'get', url: '/api/users', permsAny: ['settings:manage:users'] },
  { name: 'Users Create', method: 'post', url: '/api/users', permsAny: ['settings:manage:users'], data: {} },

  { name: 'Freelancers List', method: 'get', url: '/api/freelancers', permsAny: ['freelancers:view:all', 'freelancers:manage'] },

  { name: 'TaskDone List', method: 'get', url: '/api/tasks-done', permsAny: ['tasks:view:all', 'tasks:view:assigned'] },
  { name: 'TaskDone Create', method: 'post', url: '/api/tasks-done', permsAny: ['tasks:submit_report'], data: {} },

  { name: 'Notifications', method: 'get', url: '/api/notifications', permsAny: ['notifications:view'] },

  { name: 'System Dashboard', method: 'get', url: '/api/system/dashboard', permsAny: ['settings:view'] },
  { name: 'System Settings List', method: 'get', url: '/api/system/settings', permsAny: ['settings:view', 'settings:manage:api'] },
  { name: 'System Settings Update', method: 'put', url: '/api/system/settings/spfit_test_key', permsAny: ['settings:manage:api'], data: { value: '1' } },

  { name: 'Roles List', method: 'get', url: '/api/roles', permsAny: ['settings:manage:roles'] },
  { name: 'RoleTypes List', method: 'get', url: '/api/role-types', permsAny: ['settings:manage:roles'] },

  { name: 'MainCons List', method: 'get', url: '/api/main-cons', permsAny: ['tasks:view:all', 'tasks:create', 'tasks:edit:all'] },

  { name: 'Offers Task List', method: 'get', url: '/api/offers/task/1', permsAny: ['tasks:assign'] },

  { name: 'OpenAI Test', method: 'post', url: '/api/openai/test', permsAny: ['settings:manage:api'], data: {} },
  { name: 'Gemini Test', method: 'post', url: '/api/gemini/test', permsAny: ['settings:manage:api'], data: {} },
  { name: 'Wasapmatic Profile', method: 'get', url: '/api/wasapmatic/profile', permsAny: ['settings:manage:api'] },

  { name: 'Audit Logs', method: 'get', url: '/api/audit', permsAny: ['system.admin'] },
  { name: 'Delivery Logs', method: 'get', url: '/api/delivery', permsAny: ['system.admin'] },
];

function shouldAllow(userPermissions, permsAny) {
  return permsAny.some((p) => userPermissions.has(p));
}

function isAuthorizedStatus(status) {
  return status !== 401 && status !== 403;
}

async function getRoleIdByNames(conn, names) {
  const placeholders = names.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT id, name FROM roles WHERE name IN (${placeholders}) ORDER BY FIELD(name, ${placeholders}) LIMIT 1`,
    [...names, ...names]
  );
  return rows[0] || null;
}

async function getRolePermissions(conn, roleId) {
  const [rows] = await conn.execute('SELECT permission FROM role_permissions WHERE role_id = ?', [roleId]);
  return new Set(rows.map((r) => r.permission));
}

async function ensureTestUser(conn, roleName, roleId) {
  const email = `permtest.${roleName.toLowerCase()}@spfit.test.com`;
  const name = `Perm Test ${roleName}`;
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);

  const [existingRows] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
  if (existingRows.length > 0) {
    await conn.execute(
      'UPDATE users SET name = ?, role_id = ?, password_hash = ?, status = ? WHERE email = ?',
      [name, roleId, hash, 'Aktif', email]
    );
  } else {
    await conn.execute(
      'INSERT INTO users (name, role_id, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [name, roleId, email, hash, 'Aktif']
    );
  }

  return { email, password: TEST_PASSWORD };
}

async function login(credentials) {
  const res = await axios.post(`${BASE_URL}/api/auth/login`, credentials, { validateStatus: () => true });
  if (res.status !== 200 || !res.data?.data?.accessToken) {
    throw new Error(`Login failed for ${credentials.email}: ${res.status} ${JSON.stringify(res.data)}`);
  }
  return res.data.data.accessToken;
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spfit_db',
  });

  const summary = [];

  try {
    for (const [label, roleNames] of Object.entries(roleConfigs)) {
      const roleRow = await getRoleIdByNames(conn, roleNames);
      if (!roleRow) {
        summary.push({ role: label, error: `Role not found: ${roleNames.join(', ')}` });
        continue;
      }

      const permissions = await getRolePermissions(conn, roleRow.id);
      const creds = await ensureTestUser(conn, label, roleRow.id);
      const token = await login(creds);

      const roleResult = { role: label, roleName: roleRow.name, total: 0, pass: 0, fail: 0, details: [] };

      for (const t of endpointTests) {
        const expectedAllow = shouldAllow(permissions, t.permsAny);
        const res = await axios({
          method: t.method,
          url: `${BASE_URL}${t.url}`,
          data: t.data,
          headers: { Authorization: `Bearer ${token}` },
          validateStatus: () => true,
        });

        const actualAllow = isAuthorizedStatus(res.status);
        const ok = expectedAllow === actualAllow;

        roleResult.total += 1;
        if (ok) roleResult.pass += 1;
        else roleResult.fail += 1;

        roleResult.details.push({
          test: t.name,
          expected: expectedAllow ? 'ALLOW' : 'DENY',
          actual: actualAllow ? 'ALLOW' : 'DENY',
          status: res.status,
          ok,
        });
      }

      summary.push(roleResult);
    }
  } finally {
    await conn.end();
  }

  console.log('\n=== PERMISSION MATRIX RESULT ===');
  for (const item of summary) {
    if (item.error) {
      console.log(`\n[${item.role}] ERROR: ${item.error}`);
      continue;
    }

    console.log(`\n[${item.role}] role=${item.roleName} | pass=${item.pass}/${item.total} | fail=${item.fail}`);
    item.details.filter((d) => !d.ok).forEach((d) => {
      console.log(`  - FAIL ${d.test}: expected=${d.expected}, actual=${d.actual}, status=${d.status}`);
    });
  }

  const hasFail = summary.some((s) => s.fail && s.fail > 0);
  process.exit(hasFail ? 2 : 0);
}

run().catch((err) => {
  console.error('Permission matrix test failed:', err);
  process.exit(1);
});
