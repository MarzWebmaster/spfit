const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const BASE_URL = 'http://localhost:3005';

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spfit_db',
  });

  try {
    const [roleRows] = await conn.execute("SELECT id FROM roles WHERE name IN ('Freelancer','Freelance Tech') LIMIT 1");
    if (!roleRows.length) throw new Error('Freelancer role not found');
    const freelancerRoleId = roleRows[0].id;

    const email = 'permtest.freelancer@spfit.test.com';
    const password = 'Passw0rd!123';
    const passwordHash = await bcrypt.hash(password, 10);

    const [existing] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
    let freelancerId;
    if (!existing.length) {
      const [ins] = await conn.execute(
        "INSERT INTO users (name, role_id, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'Aktif', NOW(), NOW())",
        ['Perm Test Freelancer', freelancerRoleId, email, passwordHash]
      );
      freelancerId = ins.insertId;
    } else {
      freelancerId = existing[0].id;
      await conn.execute("UPDATE users SET role_id = ?, password_hash = ?, status = 'Aktif' WHERE id = ?", [freelancerRoleId, passwordHash, freelancerId]);
    }

    const [taskRows] = await conn.execute('SELECT id FROM tasks ORDER BY id DESC LIMIT 1');
    if (!taskRows.length) throw new Error('No task found');
    const taskId = taskRows[0].id;

    await conn.execute("UPDATE tasks SET assigned_to = ?, status = 'Telah Diambil' WHERE id = ?", [freelancerId, taskId]);

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const loginJson = await loginRes.json();
    if (!loginRes.ok) {
      console.log('LOGIN FAIL:', loginRes.status, loginJson);
      return;
    }

    const token = loginJson?.data?.accessToken;

    const pdfPath = path.join(__dirname, 'tmp-test.pdf');
    const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n', 'utf8');
    fs.writeFileSync(pdfPath, pdfContent);

    const fd = new FormData();
    fd.append('task_id', String(taskId));
    fd.append('service_start_date', '2026-02-22');
    fd.append('action_taken', 'Test action taken');
    fd.append('remarks', 'Test remarks');

    const fileBuffer = fs.readFileSync(pdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    fd.append('support_pdf', blob, 'tmp-test.pdf');

    const submitRes = await fetch(`${BASE_URL}/api/tasks-done`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });

    const text = await submitRes.text();
    console.log('SUBMIT STATUS:', submitRes.status);
    console.log('SUBMIT BODY:', text);

    fs.unlinkSync(pdfPath);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error('REPRO ERROR:', e);
  process.exit(1);
});
