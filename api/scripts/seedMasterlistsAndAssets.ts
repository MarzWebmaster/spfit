import { AppDataSource } from '../config/database.ts';

type ProjectRow = {
  id: number;
  code: string;
  name: string;
};

type MasterlistSeed = {
  code: string;
  name: string;
  description: string;
  status: 'Aktif' | 'Tidak Aktif';
};

type AssetSeed = {
  asset_tag: string;
  name: string;
  category: string;
  brand: string;
  model: string;
  serial_number: string;
  location: string;
  status: 'Aktif' | 'Tidak Aktif' | 'Rosak' | 'Lupus';
  notes: string;
};

type IdRow = {
  id: number;
};

const MASTERLIST_TEMPLATES: MasterlistSeed[] = [
  {
    code: 'ML-INFRA',
    name: 'Infrastruktur Rangkaian',
    description: 'Senarai aset berkaitan rangkaian dan konektiviti.',
    status: 'Aktif'
  },
  {
    code: 'ML-ENDPT',
    name: 'Peranti Endpoint',
    description: 'Laptop, desktop, dan workstation di tapak.',
    status: 'Aktif'
  },
  {
    code: 'ML-PERIF',
    name: 'Peranti Sokongan',
    description: 'Printer, scanner, UPS, dan peralatan sokongan lain.',
    status: 'Aktif'
  }
];

const ASSET_TEMPLATES: AssetSeed[] = [
  {
    asset_tag: 'AST-SW-01',
    name: 'Switch Core 24 Port',
    category: 'Network',
    brand: 'Cisco',
    model: 'CBS350-24T',
    serial_number: 'CSW24001',
    location: 'Server Room',
    status: 'Aktif',
    notes: 'Switch utama untuk sambungan antara rak.'
  },
  {
    asset_tag: 'AST-AP-01',
    name: 'Access Point Level 1',
    category: 'Network',
    brand: 'TP-Link',
    model: 'EAP610',
    serial_number: 'TPEAP61001',
    location: 'Tingkat 1',
    status: 'Aktif',
    notes: 'Liputan WiFi untuk ruang kerja depan.'
  },
  {
    asset_tag: 'AST-LT-01',
    name: 'Laptop Technician',
    category: 'Endpoint',
    brand: 'Dell',
    model: 'Latitude 5430',
    serial_number: 'DLL5430001',
    location: 'Bilik IT',
    status: 'Aktif',
    notes: 'Digunakan untuk troubleshooting onsite.'
  },
  {
    asset_tag: 'AST-PR-01',
    name: 'Printer Laser',
    category: 'Peripheral',
    brand: 'HP',
    model: 'LaserJet Pro M404',
    serial_number: 'HPLJ404001',
    location: 'Pejabat Pentadbiran',
    status: 'Aktif',
    notes: 'Printer utama untuk dokumen operasi.'
  }
];

async function seed() {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }

    const projects = (await AppDataSource.query(
      "SELECT id, code, name FROM projects ORDER BY id ASC LIMIT 3"
    )) as ProjectRow[];

    if (!projects.length) {
      console.log('Tiada projek ditemui. Seed masterlist/aset dibatalkan.');
      return;
    }

    let insertedMasterlists = 0;
    let updatedMasterlists = 0;
    let insertedAssets = 0;
    let updatedAssets = 0;

    for (const project of projects) {
      for (const template of MASTERLIST_TEMPLATES) {
        const scopedCode = `${template.code}-${project.code}`.slice(0, 50);

        const existingMasterlist = await AppDataSource.query(
          'SELECT id FROM masterlists WHERE project_id = ? AND code = ? LIMIT 1',
          [project.id, scopedCode]
        );

        let masterlistId: number;

        if (existingMasterlist.length > 0) {
          masterlistId = Number(existingMasterlist[0].id);
          await AppDataSource.query(
            'UPDATE masterlists SET name = ?, description = ?, status = ? WHERE id = ?',
            [template.name, template.description, template.status, masterlistId]
          );
          updatedMasterlists += 1;
        } else {
          const insertResult: any = await AppDataSource.query(
            'INSERT INTO masterlists (project_id, code, name, description, status) VALUES (?, ?, ?, ?, ?)',
            [project.id, scopedCode, template.name, template.description, template.status]
          );
          masterlistId = Number(insertResult.insertId);
          insertedMasterlists += 1;
        }

        for (const assetTemplate of ASSET_TEMPLATES) {
          const scopedTag = `${assetTemplate.asset_tag}-${project.code}`.slice(0, 100);

          await AppDataSource.query(
            'INSERT IGNORE INTO asset_category (name) VALUES (?)',
            [assetTemplate.category]
          );
          await AppDataSource.query(
            'INSERT IGNORE INTO asset_brand (name) VALUES (?)',
            [assetTemplate.brand]
          );

          const categoryRows = await AppDataSource.query(
            'SELECT id FROM asset_category WHERE name = ? LIMIT 1',
            [assetTemplate.category]
          ) as IdRow[];
          const brandRows = await AppDataSource.query(
            'SELECT id FROM asset_brand WHERE name = ? LIMIT 1',
            [assetTemplate.brand]
          ) as IdRow[];

          const categoryId = Number(categoryRows[0]?.id || 0) || null;
          const brandId = Number(brandRows[0]?.id || 0) || null;

          const existingAsset = await AppDataSource.query(
            'SELECT id FROM assets WHERE masterlist_id = ? AND asset_tag = ? LIMIT 1',
            [masterlistId, scopedTag]
          );

          if (existingAsset.length > 0) {
            await AppDataSource.query(
              `UPDATE assets
               SET name = ?, category_id = ?, brand_id = ?, model = ?, serial_number = ?, location = ?, status = ?, notes = ?
               WHERE id = ?`,
              [
                assetTemplate.name,
                categoryId,
                brandId,
                assetTemplate.model,
                assetTemplate.serial_number,
                assetTemplate.location,
                assetTemplate.status,
                assetTemplate.notes,
                Number(existingAsset[0].id)
              ]
            );
            updatedAssets += 1;
          } else {
            await AppDataSource.query(
              `INSERT INTO assets
               (masterlist_id, asset_tag, name, category_id, brand_id, model, serial_number, location, status, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                masterlistId,
                scopedTag,
                assetTemplate.name,
                categoryId,
                brandId,
                assetTemplate.model,
                assetTemplate.serial_number,
                assetTemplate.location,
                assetTemplate.status,
                assetTemplate.notes
              ]
            );
            insertedAssets += 1;
          }
        }
      }
    }

    const masterlistCountRow = await AppDataSource.query('SELECT COUNT(*) AS total FROM masterlists');
    const assetCountRow = await AppDataSource.query('SELECT COUNT(*) AS total FROM assets');

    console.log('Seed masterlist/aset selesai.');
    console.log(`Masterlist inserted: ${insertedMasterlists}, updated: ${updatedMasterlists}`);
    console.log(`Aset inserted: ${insertedAssets}, updated: ${updatedAssets}`);
    console.log(`Jumlah masterlists dalam DB: ${Number(masterlistCountRow[0]?.total || 0)}`);
    console.log(`Jumlah assets dalam DB: ${Number(assetCountRow[0]?.total || 0)}`);
  } catch (error: any) {
    console.error('Seed gagal:', error?.message || error);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

void seed();
