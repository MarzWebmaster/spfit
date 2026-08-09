import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { AssetUser } from '../models/AssetUser.ts';
import { Asset } from '../models/Asset.ts';

const assetUserRepository = AppDataSource.getRepository(AssetUser);
const assetRepository = AppDataSource.getRepository(Asset);

/**
 * Create asset user
 */
export const createAssetUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { asset_id, user_name, position, department, floor, building, location, branch, state } = req.body;

    // Validate required fields
    if (!asset_id || !user_name) {
      res.status(400).json({
        success: false,
        message: 'asset_id dan user_name diperlukan'
      });
      return;
    }

    // Check if asset exists
    const asset = await assetRepository.findOne({ where: { id: asset_id } });
    if (!asset) {
      res.status(404).json({
        success: false,
        message: 'Aset tidak ditemukan'
      });
      return;
    }

    // Check for duplicate
    const existing = await assetUserRepository.findOne({
      where: { asset_id, user_name }
    });

    if (existing) {
      res.status(409).json({
        success: false,
        message: 'Pengguna untuk aset ini sudah ada'
      });
      return;
    }

    const assetUser = assetUserRepository.create({
      asset_id,
      user_name,
      position: position || null,
      department: department || null,
      floor: floor || null,
      building: building || null,
      location: location || null,
      branch: branch || null,
      state: state || null
    });

    const saved = await assetUserRepository.save(assetUser);

    res.status(201).json({
      success: true,
      data: saved,
      message: 'Pengguna aset ditambah berjaya'
    });
  } catch (error) {
    console.error('Error creating asset user:', error);
    res.status(500).json({
      success: false,
      message: 'Ralat dalaman pelayan'
    });
  }
};

/**
 * Get all asset users for an asset
 */
export const getAssetUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { asset_id } = req.params;

    const assetUsers = await assetUserRepository.find({
      where: { asset_id: parseInt(asset_id) },
      order: { created_at: 'DESC' }
    });

    res.status(200).json({
      success: true,
      data: assetUsers
    });
  } catch (error) {
    console.error('Error getting asset users:', error);
    res.status(500).json({
      success: false,
      message: 'Ralat dalaman pelayan'
    });
  }
};

/**
 * Get single asset user
 */
export const getAssetUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const assetUser = await assetUserRepository.findOne({
      where: { id: parseInt(id) }
    });

    if (!assetUser) {
      res.status(404).json({
        success: false,
        message: 'Pengguna aset tidak ditemukan'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: assetUser
    });
  } catch (error) {
    console.error('Error getting asset user:', error);
    res.status(500).json({
      success: false,
      message: 'Ralat dalaman pelayan'
    });
  }
};

/**
 * Update asset user
 */
export const updateAssetUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { user_name, position, department, floor, building, location, branch, state } = req.body;

    const assetUser = await assetUserRepository.findOne({
      where: { id: parseInt(id) }
    });

    if (!assetUser) {
      res.status(404).json({
        success: false,
        message: 'Pengguna aset tidak ditemukan'
      });
      return;
    }

    // Update fields
    if (user_name) assetUser.user_name = user_name;
    if (position !== undefined) assetUser.position = position;
    if (department !== undefined) assetUser.department = department;
    if (floor !== undefined) assetUser.floor = floor;
    if (building !== undefined) assetUser.building = building;
    if (location !== undefined) assetUser.location = location;
    if (branch !== undefined) assetUser.branch = branch;
    if (state !== undefined) assetUser.state = state;

    const updated = await assetUserRepository.save(assetUser);

    res.status(200).json({
      success: true,
      data: updated,
      message: 'Pengguna aset dikemaskini berjaya'
    });
  } catch (error) {
    console.error('Error updating asset user:', error);
    res.status(500).json({
      success: false,
      message: 'Ralat dalaman pelayan'
    });
  }
};

/**
 * Delete asset user
 */
export const deleteAssetUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const assetUser = await assetUserRepository.findOne({
      where: { id: parseInt(id) }
    });

    if (!assetUser) {
      res.status(404).json({
        success: false,
        message: 'Pengguna aset tidak ditemukan'
      });
      return;
    }

    await assetUserRepository.remove(assetUser);

    res.status(200).json({
      success: true,
      message: 'Pengguna aset dihapus berjaya'
    });
  } catch (error) {
    console.error('Error deleting asset user:', error);
    res.status(500).json({
      success: false,
      message: 'Ralat dalaman pelayan'
    });
  }
};
