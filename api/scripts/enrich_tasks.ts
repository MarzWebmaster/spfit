import { initializeDatabase, AppDataSource } from '../config/database';
import { Task } from '../models/Task';
import { MainCon } from '../models/MainCon';
import { TaskLink } from '../models/TaskLink';
import { TaskPart } from '../models/TaskPart';
import { EquipmentCode } from '../models/EquipmentCode';

const MAIN_CON_SEEDS = [
  {
    name: 'Juricco',
    contact_person: 'Zahid',
    contact_number: '0181234567',
    email: 'support@juricco.com',
    address: 'Kuala Lumpur',
    is_active: true,
  },
  {
    name: 'Starza',
    contact_person: 'Aiman',
    contact_number: '0198877665',
    email: 'ops@starza.com',
    address: 'Petaling Jaya',
    is_active: true,
  },
  {
    name: 'Nexus Infra',
    contact_person: 'Faris',
    contact_number: '0175566771',
    email: 'infra@nexus.my',
    address: 'Shah Alam',
    is_active: true,
  },
];

const TASK_DETAIL_SEEDS = [
  {
    pic_name: 'Zahid',
    pic_phone: '0181234567',
    client_name: 'LHDN Sandakan',
    asset_tag_id: 'A/2024/001',
    asset_brand: 'HP',
    asset_model: 'ProDesk 400 G9',
    asset_serial_number: '4CE1234ABC',
    branch_name: 'Sandakan',
    equipment_types_id: ['PC'],
    action_taken: 'Pemeriksaan bekalan kuasa, reset RAM, kemas kini BIOS, dan ujian boot berjaya.',
  },
  {
    pic_name: 'Hafiz',
    pic_phone: '0197788991',
    client_name: 'LHDN Petaling Jaya',
    asset_tag_id: 'PRN/2024/014',
    asset_brand: 'Brother',
    asset_model: 'HL-L5100DN',
    asset_serial_number: 'BR8201ZX',
    branch_name: 'Petaling Jaya',
    equipment_types_id: ['PRINTER'],
    action_taken: 'Konfigurasi semula IP printer, restart print spooler, dan ujian cetak lulus.',
  },
  {
    pic_name: 'Nadia',
    pic_phone: '0176655443',
    client_name: 'LHDN Shah Alam',
    asset_tag_id: 'NB/2024/077',
    asset_brand: 'Dell',
    asset_model: 'Latitude 5420',
    asset_serial_number: 'DLX2217SS',
    branch_name: 'Shah Alam',
    equipment_types_id: ['NOTEBOOK'],
    action_taken: 'Format semula OS, kemas kini driver, konfigurasi domain, dan semakan antivirus.',
  },
  {
    pic_name: 'Aiman',
    pic_phone: '0133344556',
    client_name: 'LHDN Cyberjaya',
    asset_tag_id: 'SRV/2024/023',
    asset_brand: 'Dell EMC',
    asset_model: 'PowerEdge R740',
    asset_serial_number: 'R740-99A2',
    branch_name: 'Cyberjaya',
    equipment_types_id: ['PC'],
    action_taken: 'Penyelenggaraan bulanan server: patch OS, semakan RAID, pembersihan log, backup berjaya.',
  },
  {
    pic_name: 'Faris',
    pic_phone: '0162233445',
    client_name: 'LHDN Bangsar',
    asset_tag_id: 'NET/2024/012',
    asset_brand: 'Ubiquiti',
    asset_model: 'UAP-AC-PRO',
    asset_serial_number: 'UBQ1138YY',
    branch_name: 'Bangsar',
    equipment_types_id: ['PC'],
    action_taken: 'Pemasangan access point baharu, set SSID, optimasi channel, dan ujian liputan selesai.',
  },
];

function pickSeed(index: number) {
  return TASK_DETAIL_SEEDS[index % TASK_DETAIL_SEEDS.length];
}

function pickMainConId(index: number, ids: number[]) {
  if (ids.length === 0) return undefined;
  return ids[index % ids.length];
}

async function ensureMainCons() {
  const repo = AppDataSource.getRepository(MainCon);
  const existing = await repo.find({ order: { id: 'ASC' } });

  const byName = new Map(existing.map((m) => [m.name.toLowerCase(), m]));

  for (const item of MAIN_CON_SEEDS) {
    if (!byName.has(item.name.toLowerCase())) {
      const created = repo.create(item);
      await repo.save(created);
    }
  }

  return repo.find({ where: { is_active: true }, order: { id: 'ASC' } });
}

async function enrichTasks() {
  try {
    await initializeDatabase();

    const taskRepo = AppDataSource.getRepository(Task);
    const linkRepo = AppDataSource.getRepository(TaskLink);
    const partRepo = AppDataSource.getRepository(TaskPart);
    const equipmentRepo = AppDataSource.getRepository(EquipmentCode);

    const equipmentCodes = await equipmentRepo.find({ where: { is_active: true } });
    const equipmentCodeIdMap = new Map(equipmentCodes.map((item) => [String(item.code || '').toUpperCase(), item.id]));

    const mainCons = await ensureMainCons();
    const mainConIds = mainCons.map((m) => m.id);

    const tasks = await taskRepo.find({ order: { id: 'ASC' } });

    if (tasks.length === 0) {
      console.log('Tiada task dijumpai untuk dikemaskini.');
      return;
    }

    let updatedCount = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const seed = pickSeed(i);
      const now = new Date();
      const taskDate = task.created_at || now;

      if (!task.main_con_id) task.main_con_id = pickMainConId(i, mainConIds);
      if (!task.pic_name) task.pic_name = seed.pic_name;
      if (!task.pic_phone) task.pic_phone = seed.pic_phone;
      if (!task.client_name) task.client_name = seed.client_name;
      if (!task.asset_tag_id) task.asset_tag_id = seed.asset_tag_id;
      if (!task.asset_brand) task.asset_brand = seed.asset_brand;
      if (!task.asset_model) task.asset_model = seed.asset_model;
      if (!task.asset_serial_number) task.asset_serial_number = seed.asset_serial_number;
      if (!task.branch_name) task.branch_name = seed.branch_name;
      if (!task.equipment_types_id || task.equipment_types_id.length === 0) {
        const resolvedEquipmentIds = seed.equipment_types_id
          .map((code) => equipmentCodeIdMap.get(String(code).toUpperCase()))
          .filter((id): id is number => Number.isInteger(id));
        if (resolvedEquipmentIds.length > 0) {
          task.equipment_types_id = resolvedEquipmentIds;
        }
      }

      if (!task.received_date) task.received_date = taskDate;
      if (!task.received_time) task.received_time = '09:00:00';
      if (!task.irt_date) task.irt_date = taskDate;
      if (!task.irt_time) task.irt_time = '10:00:00';
      if (!task.service_start_date) task.service_start_date = taskDate;
      if (!task.service_start_time) task.service_start_time = '10:30:00';
      if (!task.service_stop_date) task.service_stop_date = taskDate;
      if (!task.service_stop_time) task.service_stop_time = '12:00:00';

      await taskRepo.save(task);
      updatedCount++;

      const existingLinks = await linkRepo.count({ where: { task_id: task.id } });
      if (existingLinks === 0) {
        const link = linkRepo.create({
          task_id: task.id,
          url: `https://helpdesk.spfit.local/tickets/${task.log_number || task.id}`,
          description: `Rujukan tiket untuk ${task.title}`,
        });
        await linkRepo.save(link);
      }

      const existingParts = await partRepo.count({ where: { task_id: task.id } });
      if (existingParts === 0) {
        const part = partRepo.create({
          task_id: task.id,
          part_number: `PART-${String(task.id).padStart(4, '0')}`,
          description: 'Komponen gantian contoh',
          quantity: 1,
        });
        await partRepo.save(part);
      }
    }

    console.log(`Selesai: ${updatedCount} task telah dikemaskini dengan data lengkap.`);
  } catch (error) {
    console.error('Ralat semasa kemaskini data task:', error);
    process.exitCode = 1;
  }
}

enrichTasks();
