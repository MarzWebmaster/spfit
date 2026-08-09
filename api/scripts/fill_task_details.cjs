const mysql = require('mysql2/promise');
require('dotenv').config();

const MAIN_CONS = [
  { name: 'Juricco', contact_person: 'Zahid', contact_number: '0181234567', email: 'support@juricco.com', address: 'Kuala Lumpur', is_active: 1 },
  { name: 'Starza', contact_person: 'Aiman', contact_number: '0198877665', email: 'ops@starza.com', address: 'Petaling Jaya', is_active: 1 },
  { name: 'Nexus Infra', contact_person: 'Faris', contact_number: '0175566771', email: 'infra@nexus.my', address: 'Shah Alam', is_active: 1 }
];

const SEEDS = [
  {
    pic_name: 'Zahid', pic_phone: '0181234567', client_name: 'LHDN Sandakan', branch_name: 'Sandakan',
    equipment_types: JSON.stringify(['PC']), asset_tag_id: 'A/2024/001', asset_brand: 'HP', asset_model: 'ProDesk 400 G9',
    asset_serial_number: '4CE1234ABC', action_taken: 'Pemeriksaan bekalan kuasa, reset RAM, kemas kini BIOS, dan ujian boot berjaya.'
  },
  {
    pic_name: 'Hafiz', pic_phone: '0197788991', client_name: 'LHDN Petaling Jaya', branch_name: 'Petaling Jaya',
    equipment_types: JSON.stringify(['PRINTER']), asset_tag_id: 'PRN/2024/014', asset_brand: 'Brother', asset_model: 'HL-L5100DN',
    asset_serial_number: 'BR8201ZX', action_taken: 'Konfigurasi semula IP printer, restart print spooler, dan ujian cetak lulus.'
  },
  {
    pic_name: 'Nadia', pic_phone: '0176655443', client_name: 'LHDN Shah Alam', branch_name: 'Shah Alam',
    equipment_types: JSON.stringify(['NOTEBOOK']), asset_tag_id: 'NB/2024/077', asset_brand: 'Dell', asset_model: 'Latitude 5420',
    asset_serial_number: 'DLX2217SS', action_taken: 'Format semula OS, kemas kini driver, konfigurasi domain, dan semakan antivirus.'
  },
  {
    pic_name: 'Aiman', pic_phone: '0133344556', client_name: 'LHDN Cyberjaya', branch_name: 'Cyberjaya',
    equipment_types: JSON.stringify(['PC']), asset_tag_id: 'SRV/2024/023', asset_brand: 'Dell EMC', asset_model: 'PowerEdge R740',
    asset_serial_number: 'R740-99A2', action_taken: 'Penyelenggaraan bulanan server: patch OS, semakan RAID, pembersihan log, backup berjaya.'
  },
  {
    pic_name: 'Faris', pic_phone: '0162233445', client_name: 'LHDN Bangsar', branch_name: 'Bangsar',
    equipment_types: JSON.stringify(['PC']), asset_tag_id: 'NET/2024/012', asset_brand: 'Ubiquiti', asset_model: 'UAP-AC-PRO',
    asset_serial_number: 'UBQ1138YY', action_taken: 'Pemasangan access point baharu, set SSID, optimasi channel, dan ujian liputan selesai.'
  }
];

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'spfit_db'
  });

  try {
    // Ensure main_cons seed exists
    for (const item of MAIN_CONS) {
      await connection.execute(
        `INSERT INTO main_cons (name, contact_person, contact_number, email, address, is_active)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           contact_person = VALUES(contact_person),
           contact_number = VALUES(contact_number),
           email = VALUES(email),
           address = VALUES(address),
           is_active = VALUES(is_active)`,
        [item.name, item.contact_person, item.contact_number, item.email, item.address, item.is_active]
      );
    }

    const [mainConRows] = await connection.execute('SELECT id FROM main_cons WHERE is_active = 1 ORDER BY id');
    const mainConIds = mainConRows.map((r) => r.id);

    const [tasks] = await connection.execute('SELECT id, log_number, created_at FROM tasks ORDER BY id');
    if (!tasks.length) {
      console.log('Tiada task dalam DB.');
      return;
    }

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const seed = SEEDS[i % SEEDS.length];
      const mainConId = mainConIds.length ? mainConIds[i % mainConIds.length] : null;

      await connection.execute(
        `UPDATE tasks
         SET
           main_con_id = COALESCE(main_con_id, ?),
           pic_name = COALESCE(pic_name, ?),
           pic_phone = COALESCE(pic_phone, ?),
           client_name = COALESCE(client_name, ?),
           branch_name = COALESCE(branch_name, ?),
           equipment_types = COALESCE(equipment_types, ?),
           asset_tag_id = COALESCE(asset_tag_id, ?),
           asset_brand = COALESCE(asset_brand, ?),
           asset_model = COALESCE(asset_model, ?),
           asset_serial_number = COALESCE(asset_serial_number, ?),
           received_date = COALESCE(received_date, DATE(created_at)),
           received_time = COALESCE(received_time, '09:00:00'),
           irt_date = COALESCE(irt_date, DATE(created_at)),
           irt_time = COALESCE(irt_time, '10:00:00'),
           service_start_date = COALESCE(service_start_date, DATE(created_at)),
           service_start_time = COALESCE(service_start_time, '10:30:00'),
           service_stop_date = COALESCE(service_stop_date, DATE(created_at)),
           service_stop_time = COALESCE(service_stop_time, '12:00:00'),
           action_taken = COALESCE(action_taken, ?)
         WHERE id = ?`,
        [
          mainConId,
          seed.pic_name,
          seed.pic_phone,
          seed.client_name,
          seed.branch_name,
          seed.equipment_types,
          seed.asset_tag_id,
          seed.asset_brand,
          seed.asset_model,
          seed.asset_serial_number,
          seed.action_taken,
          task.id
        ]
      );

      await connection.execute(
        `INSERT INTO task_links (task_id, url, description)
         SELECT ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM task_links WHERE task_id = ? LIMIT 1)`,
        [
          task.id,
          `https://helpdesk.spfit.local/tickets/${task.log_number || task.id}`,
          'Rujukan tiket',
          task.id
        ]
      );

      await connection.execute(
        `INSERT INTO task_parts (task_id, part_number, description, quantity)
         SELECT ?, ?, ?, 1
         WHERE NOT EXISTS (SELECT 1 FROM task_parts WHERE task_id = ? LIMIT 1)`,
        [task.id, `PART-${String(task.id).padStart(4, '0')}`, 'Komponen gantian contoh', task.id]
      );
    }

    const [checkRows] = await connection.execute(
      `SELECT id, log_number, main_con_id, pic_name, pic_phone, client_name, branch_name, equipment_types,
              asset_tag_id, asset_brand, asset_model, asset_serial_number, received_date, received_time,
              irt_date, irt_time, service_start_date, service_start_time, service_stop_date, service_stop_time
       FROM tasks
       ORDER BY id`
    );

    console.table(checkRows);
    console.log(`Selesai isi data lengkap untuk ${tasks.length} task.`);
  } finally {
    await connection.end();
  }
}

run().catch((e) => {
  console.error('Ralat:', e);
  process.exit(1);
});
