import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { Asset, AssetStatus } from '../models/Asset.ts';
import { AssetUser } from '../models/AssetUser.ts';
import { AssetAccessory } from '../models/AssetAccessory.ts';
import { Masterlist } from '../models/Masterlist.ts';
import { AssetCategoryOption } from '../models/AssetCategoryOption.ts';
import { AssetBrandOption } from '../models/AssetBrandOption.ts';
import { In } from 'typeorm';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';

interface ImportRow {
  asset_tag?: string;
  name?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial_number?: string;
  group?: string;
  status?: string;
  notes?: string;
  user_name?: string;
  position?: string;
  department?: string;
  floor?: string;
  building?: string;
  location?: string;
  branch?: string;
  state?: string;
  monitor_sn?: string;
  monitor_name?: string;
  keyboard_sn?: string;
  keyboard_name?: string;
  mouse_sn?: string;
  mouse_name?: string;
  [key: string]: string | undefined;
}

interface ImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  createdCount: number;
  updatedCount: number;
  pairedCount?: number;
  errorCount: number;
  errors: Array<{
    rowNumber: number;
    rowData: ImportRow;
    errors: string[];
  }>;
}

export class AssetImportController {
  private assetRepository = AppDataSource.getRepository(Asset);
  private assetUserRepository = AppDataSource.getRepository(AssetUser);
  private accessoryRepository = AppDataSource.getRepository(AssetAccessory);
  private masterlistRepository = AppDataSource.getRepository(Masterlist);
  private categoryRepository = AppDataSource.getRepository(AssetCategoryOption);
  private brandRepository = AppDataSource.getRepository(AssetBrandOption);

  private normalizeSerialNumber = (serial?: string): string | undefined => {
    const normalized = serial?.trim();
    return normalized ? normalized.toUpperCase() : undefined;
  };

  private normalizeUserName = (userName?: string): string | undefined => {
    const normalized = userName?.trim();
    return normalized ? normalized.toUpperCase() : undefined;
  };

  private parseCSVLine = (line: string): string[] => {
    const values: string[] = [];
    let currentValue = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      const nextCharacter = line[index + 1];

      if (character === '"') {
        if (inQuotes && nextCharacter === '"') {
          currentValue += '"';
          index++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (character === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
        continue;
      }

      currentValue += character;
    }

    values.push(currentValue.trim());
    return values;
  };

  validateRow = (row: ImportRow, rowNumber: number): string[] => {
    const errors: string[] = [];

    // Required fields
    if (!row.name || !String(row.name).trim()) {
      errors.push('Nama aset diperlukan');
    }

    // Status validation
    if (row.status && !Object.values(AssetStatus).includes(row.status as AssetStatus)) {
      errors.push(`Status "${row.status}" tidak sah. Guna: ${Object.values(AssetStatus).join(', ')}`);
    }

    return errors;
  };

  private detectTextDelimiterAndParse = (text: string): ImportRow[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    // Try common delimiters
    const delimiters = [',', '\t', '|', ';'];
    let bestDelimiter = ',';
    let bestConsistency = 0;

    for (const delim of delimiters) {
      const counts = lines.map((line) => line.split(delim).length);
      const first = counts[0];
      if (first <= 1) continue;
      const consistent = counts.filter((c) => c === first).length;
      const pct = consistent / counts.length;
      if (pct > bestConsistency) {
        bestConsistency = pct;
        bestDelimiter = delim;
      }
    }

    // If no clear delimiter found, try key:value pattern
    if (bestConsistency < 0.5) {
      return this.parseKeyValueText(lines);
    }

    // Parse as delimited
    const headerLine = lines[0];
    const headers = headerLine.split(bestDelimiter).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
    const rows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(bestDelimiter).map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: ImportRow = {};
      headers.forEach((header, idx) => {
        if (values[idx]) row[header] = values[idx];
      });
      if (row.name || row.serial_number) rows.push(row);
    }
    return rows;
  };

  private parseKeyValueText = (lines: string[]): ImportRow[] => {
    const rows: ImportRow[] = [];
    let currentRow: ImportRow = {};

    const keyMap: Record<string, string> = {
      'asset tag': 'asset_tag',
      'nama aset': 'name',
      'asset name': 'name',
      'serial number': 'serial_number',
      'no siri': 'serial_number',
      'jenama': 'brand',
      'brand': 'brand',
      'model': 'model',
      'kategori': 'category',
      'category': 'category',
      'status': 'status',
      'nama pengguna': 'user_name',
      'user name': 'user_name',
      'jawatan': 'position',
      'position': 'position',
      'bahagian': 'department',
      'jabatan': 'department',
      'department': 'department',
      'tingkat': 'floor',
      'floor': 'floor',
      'bangunan': 'building',
      'building': 'building',
      'lokasi': 'location',
      'location': 'location',
      'cawangan': 'branch',
      'branch': 'branch',
      'negeri': 'state',
      'state': 'state',
      'nota': 'notes',
      'notes': 'notes',
      'monitor sn': 'monitor_sn',
      'monitor name': 'monitor_name',
      'monitor nama': 'monitor_name',
      'keyboard sn': 'keyboard_sn',
      'keyboard name': 'keyboard_name',
      'mouse sn': 'mouse_sn',
      'mouse name': 'mouse_name',
    };

    for (const line of lines) {
      // Check if this line starts a new record (separator or empty line pattern)
      if (/^[-=_]{3,}$/.test(line) || line === '') {
        if (Object.keys(currentRow).length > 0) {
          rows.push(currentRow);
          currentRow = {};
        }
        continue;
      }

      // Try key:value split
      const colonIdx = line.indexOf(':');
      const eqIdx = line.indexOf('=');
      const sepIdx = colonIdx > 0 ? colonIdx : eqIdx > 0 ? eqIdx : -1;

      if (sepIdx > 0) {
        const rawKey = line.substring(0, sepIdx).trim().toLowerCase();
        const value = line.substring(sepIdx + 1).trim();
        const mappedKey = keyMap[rawKey] || Object.values(keyMap).find((v) => v === rawKey);
        if (mappedKey && value) {
          currentRow[mappedKey] = value;
        }
      }
    }

    // Don't forget the last row
    if (Object.keys(currentRow).length > 0) {
      rows.push(currentRow);
    }

    // If no structured data found via key:value, try filename detection
    if (rows.length === 0 && lines.length > 0) {
      // Look for SN-like patterns anywhere in text
      const snPattern = /\b(?:SN|S\/N|SERIAL)[\s:]*\b([A-Za-z0-9\-_]{3,30})\b/gi;
      let match;
      const namePattern = /\b(?:NAME|NAMA|MODEL)[\s:]*\b(.{2,80})/gi;
      let nameMatch;

      const fullText = lines.join(' ');
      while ((match = snPattern.exec(fullText)) !== null) {
        const row: ImportRow = {};
        row.serial_number = match[1].trim();
        row.name = row.serial_number;
        namePattern.lastIndex = 0;
        if ((nameMatch = namePattern.exec(fullText)) !== null) {
          row.name = nameMatch[1].trim().split(/[,\n]/)[0].trim();
        }
        rows.push(row);
      }
    }

    return rows;
  };

  private async handlePairedAccessory(
    mainAssetId: number,
    masterlistId: number,
    accessoryType: 'monitor' | 'keyboard' | 'mouse',
    accessorySN?: string,
    accessoryName?: string
  ): Promise<void> {
    const normalizedSN = this.normalizeSerialNumber(accessorySN);
    console.log(`[Import Pair] Handling ${accessoryType}: SN="${accessorySN}" → normalized="${normalizedSN}", Name="${accessoryName}" for mainAsset #${mainAssetId}`);
    if (!normalizedSN || !accessorySN) {
      console.log(`[Import Pair] ⏭️ Skipping ${accessoryType} — no SN`);
      return;
    }

    let accessoryAsset: Asset | null = null;

    // Search everywhere (not just same masterlist) and update if found
    const allWithSN = await this.assetRepository.find({
      where: { serial_number: normalizedSN }
    });

    if (allWithSN.length > 0) {
      accessoryAsset = allWithSN[0];
      console.log(`[Import Pair] 🔍 Found existing accessory #${accessoryAsset.id}: "${accessoryAsset.name}" in masterlist #${accessoryAsset.masterlist_id}`);
      // Update accessory name and masterlist if needed
      let updated = false;
      if (accessoryName && accessoryAsset.name !== accessoryName.trim()) {
        accessoryAsset.name = accessoryName.trim();
        updated = true;
      }
      if (accessoryAsset.masterlist_id !== masterlistId) {
        accessoryAsset.masterlist_id = masterlistId;
        updated = true;
      }
      if (updated) {
        await this.assetRepository.save(accessoryAsset);
        console.log(`[Import Pair] 📝 Updated accessory #${accessoryAsset.id}`);
      }
    } else {
      // Create new if not found
      const name = accessoryName?.trim() || `Aksesori ${normalizedSN}`;
      console.log(`[Import Pair] 🆕 Creating new ${accessoryType}: "${name}"`);
      accessoryAsset = await this.assetRepository.save(
        this.assetRepository.create({
          masterlist_id: masterlistId,
          name,
          serial_number: normalizedSN,
          status: AssetStatus.AKTIF
        })
      );
    }

    // Copy user assignments from main asset to accessory asset
    await this.copyAssetUsersToAccessory(mainAssetId, accessoryAsset.id);
    console.log(`[Import Pair] 👤 User info copied from main #${mainAssetId} to accessory #${accessoryAsset.id}`);

    // Check existing pairing
    const existingPairing = await this.accessoryRepository.findOne({
      where: { asset_id: mainAssetId, accessory_asset_id: accessoryAsset.id }
    });
    if (existingPairing) {
      console.log(`[Import Pair] ⏭️ Already paired`);
      return;
    }

    // Create new pairing
    await this.accessoryRepository.save(
      this.accessoryRepository.create({
        asset_id: mainAssetId,
        accessory_asset_id: accessoryAsset.id,
        accessory_type: accessoryType
      })
    );
    console.log(`[Import Pair] ✅ Paired ${accessoryType} #${accessoryAsset.id} to main #${mainAssetId}`);
  }

  private async copyAssetUsersToAccessory(mainAssetId: number, accessoryAssetId: number): Promise<void> {
    const mainAssetUsers = await this.assetUserRepository.find({ where: { asset_id: mainAssetId } });
    if (!mainAssetUsers.length) return;

    for (const user of mainAssetUsers) {
      const existing = await this.assetUserRepository.findOne({
        where: { asset_id: accessoryAssetId, user_name: user.user_name }
      });
      if (existing) continue;

      const newUser = this.assetUserRepository.create({
        asset_id: accessoryAssetId,
        user_name: user.user_name,
        position: user.position,
        department: user.department,
        floor: user.floor,
        building: user.building,
        location: user.location,
        branch: user.branch,
        state: user.state
      });
      await this.assetUserRepository.save(newUser);
    }
  }

  importAssets = async (req: Request, res: Response): Promise<void> => {
    try {
      const { masterlist_id, rows, columnMapping } = req.body as {
        masterlist_id: number;
        rows: ImportRow[];
        columnMapping: { [key: string]: string };
      };

      if (!masterlist_id || !rows || !Array.isArray(rows)) {
        res.status(400).json({
          success: false,
          message: 'masterlist_id dan rows diperlukan'
        });
        return;
      }

      // Verify masterlist exists
      const masterlist = await this.masterlistRepository.findOne({
        where: { id: masterlist_id }
      });
      if (!masterlist) {
        res.status(404).json({
          success: false,
          message: 'Masterlist tidak ditemui'
        });
        return;
      }

      const result: ImportResult = {
        success: true,
        totalRows: rows.length,
        successCount: 0,
        createdCount: 0,
        updatedCount: 0,
        pairedCount: 0,
        errorCount: 0,
        errors: []
      };

      // Pre-cache categories and brands
      const allCategories = await this.categoryRepository.find();
      const allBrands = await this.brandRepository.find();
      const categoryMap = new Map(allCategories.map(c => [c.name.toLowerCase(), c]));
      const brandMap = new Map(allBrands.map(b => [b.name.toLowerCase(), b]));
      const serialNumbers = rows
        .map((row) => this.normalizeSerialNumber(row.serial_number))
        .filter((serial): serial is string => Boolean(serial));

      const existingAssetsBySerial = new Map<string, Asset[]>();
      if (serialNumbers.length > 0) {
        const existingAssets = await this.assetRepository.find({
          where: { serial_number: In(serialNumbers) },
          relations: ['masterlist']
        });

        existingAssets.forEach((asset) => {
          const serial = this.normalizeSerialNumber(asset.serial_number || undefined);
          if (serial) {
            const list = existingAssetsBySerial.get(serial) || [];
            list.push(asset);
            existingAssetsBySerial.set(serial, list);
          }
        });
      }

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2; // +2 because 1-indexed and skip header

        const rowErrors = this.validateRow(row, rowNumber);
        if (rowErrors.length > 0) {
          result.errorCount++;
          result.errors.push({ rowNumber, rowData: row, errors: rowErrors });
          continue;
        }

        try {
          // Find or create category
          let categoryId: number | null = null;
          if (row.category) {
            const lookup = row.category.trim();
            // Exact match first
            let category = categoryMap.get(lookup.toLowerCase());
            // Fuzzy match: check if lookup is part of any category name, or vice versa
            if (!category) {
              const allNames = Array.from(categoryMap.keys());
              const fuzzy = allNames.find(k => k.includes(lookup.toLowerCase()) || lookup.toLowerCase().includes(k));
              category = fuzzy ? categoryMap.get(fuzzy) : undefined;
            }
            // Auto-create if still not found
            if (!category) {
              const newCat = this.categoryRepository.create({ name: lookup, is_active: true });
              await this.categoryRepository.save(newCat);
              categoryMap.set(lookup.toLowerCase(), newCat);
              category = newCat;
            }
            categoryId = category!.id;
          }

          // Find or create brand
          let brandId: number | null = null;
          if (row.brand) {
            const lookup = row.brand.trim();
            // Exact match first
            let brand = brandMap.get(lookup.toLowerCase());
            // Fuzzy match
            if (!brand) {
              const allNames = Array.from(brandMap.keys());
              const fuzzy = allNames.find(k => k.includes(lookup.toLowerCase()) || lookup.toLowerCase().includes(k));
              brand = fuzzy ? brandMap.get(fuzzy) : undefined;
            }
            // Auto-create if still not found
            if (!brand) {
              const newBrand = this.brandRepository.create({ name: lookup, is_active: true });
              await this.brandRepository.save(newBrand);
              brandMap.set(lookup.toLowerCase(), newBrand);
              brand = newBrand;
            }
            brandId = brand!.id;
          }

          const normalizedSerialNumber = this.normalizeSerialNumber(row.serial_number);
          const existingAssetsForSerial = normalizedSerialNumber
            ? existingAssetsBySerial.get(normalizedSerialNumber) || []
            : [];
          const existingAssetInSameMasterlist = existingAssetsForSerial.find(
            (asset) => asset.masterlist_id === masterlist_id
          );
          const existingAssetInOtherMasterlist = existingAssetsForSerial.find(
            (asset) => asset.masterlist_id !== masterlist_id
          );

          let savedAsset: Asset;
          if (existingAssetInSameMasterlist) {
            existingAssetInSameMasterlist.masterlist_id = masterlist_id;
            existingAssetInSameMasterlist.asset_tag = row.asset_tag?.trim() || existingAssetInSameMasterlist.asset_tag;
            existingAssetInSameMasterlist.name = String(row.name).trim();
            existingAssetInSameMasterlist.category_id = categoryId;
            existingAssetInSameMasterlist.brand_id = brandId;
            existingAssetInSameMasterlist.model = row.model?.trim() || null;
            existingAssetInSameMasterlist.serial_number = normalizedSerialNumber || null;
            existingAssetInSameMasterlist.group = row.group?.trim() || null;
            existingAssetInSameMasterlist.status = (row.status as AssetStatus) || AssetStatus.AKTIF;
            existingAssetInSameMasterlist.notes = row.notes?.trim() || null;
            savedAsset = await this.assetRepository.save(existingAssetInSameMasterlist);
            result.updatedCount++;
          } else if (existingAssetInOtherMasterlist) {
            const conflictMasterlistName = existingAssetInOtherMasterlist.masterlist
              ? `${existingAssetInOtherMasterlist.masterlist.code} - ${existingAssetInOtherMasterlist.masterlist.name}`
              : `ID ${existingAssetInOtherMasterlist.masterlist_id}`;

            result.errorCount++;
            result.errors.push({
              rowNumber,
              rowData: row,
              errors: [
                `Serial number "${normalizedSerialNumber}" sudah wujud dalam masterlist lain: ${conflictMasterlistName}`
              ]
            });
            continue;
          } else {
            const asset = this.assetRepository.create({
              masterlist_id,
              asset_tag: row.asset_tag?.trim() || undefined,
              name: String(row.name).trim(),
              category_id: categoryId,
              brand_id: brandId,
              model: row.model?.trim() || undefined,
              serial_number: normalizedSerialNumber || undefined,
              group: row.group?.trim() || undefined,
              status: (row.status as AssetStatus) || AssetStatus.AKTIF,
              notes: row.notes?.trim() || undefined,
              created_by: req.user?.id
            });

            savedAsset = await this.assetRepository.save(asset);
            result.createdCount++;
            if (normalizedSerialNumber) {
              const list = existingAssetsBySerial.get(normalizedSerialNumber) || [];
              list.push(savedAsset);
              existingAssetsBySerial.set(normalizedSerialNumber, list);
            }
          }

          // Create asset user if user_name provided
          if (row.user_name && row.user_name.trim()) {
            try {
              const normalizedUserName = this.normalizeUserName(row.user_name);
              if (!normalizedUserName) {
                throw new Error('Nama pengguna tidak sah');
              }

              const assetUser = this.assetUserRepository.create({
                asset_id: savedAsset.id,
                user_name: normalizedUserName,
                position: row.position?.trim() || undefined,
                department: row.department?.trim() || undefined,
                floor: row.floor?.trim() || undefined,
                building: row.building?.trim() || undefined,
                location: row.location?.trim() || undefined,
                branch: row.branch?.trim() || undefined,
                state: row.state?.trim() || undefined
              });
              await this.assetUserRepository.save(assetUser);
            } catch (userError: any) {
              console.warn(`Warning: gagal create asset user untuk asset ${savedAsset.id}:`, userError.message);
              // Don't fail the entire row if user creation fails
            }
          }

          // Handle paired accessories (monitor, keyboard, mouse)
          const pairDebug = {
            monitor_sn: row.monitor_sn, monitor_name: row.monitor_name,
            keyboard_sn: row.keyboard_sn, keyboard_name: row.keyboard_name,
            mouse_sn: row.mouse_sn, mouse_name: row.mouse_name
          };
          console.log(`[Import] Row check for paired data:`, JSON.stringify(pairDebug));

          if (row.monitor_sn || row.monitor_name) {
            await this.handlePairedAccessory(
              savedAsset.id, masterlist_id, 'monitor',
              row.monitor_sn, row.monitor_name
            );
            result.pairedCount = (result.pairedCount || 0) + 1;
          }
          if (row.keyboard_sn || row.keyboard_name) {
            await this.handlePairedAccessory(
              savedAsset.id, masterlist_id, 'keyboard',
              row.keyboard_sn, row.keyboard_name
            );
            result.pairedCount = (result.pairedCount || 0) + 1;
          }
          if (row.mouse_sn || row.mouse_name) {
            await this.handlePairedAccessory(
              savedAsset.id, masterlist_id, 'mouse',
              row.mouse_sn, row.mouse_name
            );
            result.pairedCount = (result.pairedCount || 0) + 1;
          }

          result.successCount++;
        } catch (error: any) {
          result.errorCount++;
          result.errors.push({
            rowNumber,
            rowData: row,
            errors: [error.message || 'Ralat semasa membuat aset']
          });
        }
      }

      result.success = result.errorCount === 0;

      res.status(200).json({
        success: result.success,
        message: result.success ? 'Semua aset berjaya diimport' : `Import selesai dengan ${result.errorCount} ralat`,
        data: result
      });
    } catch (error: any) {
      console.error('Error importing assets:', error);
      res.status(500).json({
        success: false,
        message: 'Ralat semasa mengimport aset',
        error: error.message
      });
    }
  };

  parseCSV = (csvContent: string): ImportRow[] => {
    const lines = csvContent
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const headers = this.parseCSVLine(lines[0]).map((header) => header.trim().toLowerCase());
    const rows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      const row: ImportRow = {};

      headers.forEach((header, index) => {
        if (values[index]) {
          row[header] = values[index];
        }
      });

      // Accept row if it has at minimum a name, serial_number, or BM equivalents
      const hasName = row.name || row['nama'] || row['nama aset'] || row['asset name'];
      const hasSN = row.serial_number || row['serial'] || row['sn'] || row['no siri'] || row['nombor siri'];
      if (hasName || hasSN || Object.values(row).some(v => v?.toString().trim())) {
        rows.push(row);
      }
    }

    return rows;
  };

  parseXLSX = (buffer: Buffer): ImportRow[] => {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });

    if (jsonData.length === 0) return [];

    const rows: ImportRow[] = [];
    for (const raw of jsonData) {
      const row: ImportRow = {};
      for (const [key, value] of Object.entries(raw)) {
        const lowerKey = key.trim().toLowerCase();
        row[lowerKey] = String(value ?? '').trim();
      }
      if (row.name || row.serial_number) {
        rows.push(row);
      }
    }
    return rows;
  };

  parsePDF = async (buffer: Buffer): Promise<ImportRow[]> => {
    try {
      const pdfParse = (await import('pdf-parse')).default || (await import('pdf-parse'));
      const data = await pdfParse(buffer);
      const text = data.text || '';
      return this.detectTextDelimiterAndParse(text);
    } catch (err) {
      console.error('PDF parse error:', err);
      return [];
    }
  };

  parseDOCX = async (buffer: Buffer): Promise<ImportRow[]> => {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value || '';
      return this.detectTextDelimiterAndParse(text);
    } catch (err) {
      console.error('DOCX parse error:', err);
      return [];
    }
  };

  parseTXT = (buffer: Buffer): ImportRow[] => {
    const text = buffer.toString('utf8');
    return this.detectTextDelimiterAndParse(text);
  };

  validateFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const masterlist_id = req.body?.masterlist_id || req.query?.masterlist_id;
      const file = req.file;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'File diperlukan'
        });
        return;
      }

      if (!masterlist_id) {
        res.status(400).json({
          success: false,
          message: 'masterlist_id diperlukan'
        });
        return;
      }

      let rows: ImportRow[] = [];

      if (file.originalname.endsWith('.csv') || file.mimetype.includes('text/csv') || file.mimetype.includes('csv')) {
        rows = this.parseCSV(file.buffer.toString('utf8'));
      } else if (file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls') ||
                 file.mimetype.includes('spreadsheet') || file.mimetype.includes('excel') ||
                 file.mimetype.includes('officedocument')) {
        rows = this.parseXLSX(file.buffer);
      } else if (file.originalname.endsWith('.pdf') || file.mimetype.includes('pdf')) {
        rows = await this.parsePDF(file.buffer);
      } else if (file.originalname.endsWith('.docx') || file.mimetype.includes('word') ||
                 file.mimetype.includes('officedocument.wordprocessingml')) {
        rows = await this.parseDOCX(file.buffer);
      } else if (file.originalname.endsWith('.txt') || file.mimetype.includes('text/plain') ||
                 file.originalname.endsWith('.log') || file.originalname.endsWith('.md') ||
                 file.originalname.endsWith('.rtf')) {
        rows = this.parseTXT(file.buffer);
      } else {
        res.status(400).json({
          success: false,
          message: 'Format fail tidak disokong. Guna CSV, XLSX, PDF, DOCX, atau TXT sahaja.'
        });
        return;
      }

      if (rows.length === 0) {
        res.status(400).json({
          success: false,
          message: 'File tidak ada data yang sah'
        });
        return;
      }

      // Return sample rows for preview
      res.status(200).json({
        success: true,
        data: {
          totalRows: rows.length,
          sampleRows: rows.slice(0, 5),
          allRows: rows,
          headers: rows.length > 0 ? Object.keys(rows[0]) : []
        }
      });
    } catch (error: any) {
      console.error('Error validating file:', error);
      res.status(500).json({
        success: false,
        message: 'Ralat semasa memvalidasi fail',
        error: error.message
      });
    }
  };
}
