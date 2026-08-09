import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { MainCon } from '../models/MainCon.ts';
import { Task } from '../models/Task.ts';

export class MainConController {
  private mainConRepository = AppDataSource.getRepository(MainCon);

  private hasViewAllPermission(req: Request): boolean {
    const permissions = req.userPermissions || [];
    return req.user?.role?.toLowerCase() === 'admin'
      || permissions.includes('maincons:view:all')
      || permissions.includes('tasks:view:all');
  }

  private hasViewOwnPermission(req: Request): boolean {
    const permissions = req.userPermissions || [];
    return permissions.includes('maincons:view:own')
      || permissions.includes('tasks:view:own')
      || permissions.includes('tasks:view:assigned');
  }

  // Get all Main Cons
  getAll = async (req: Request, res: Response) => {
    try {
      const currentUserId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);

      const queryBuilder = this.mainConRepository
        .createQueryBuilder('mainCon')
        .orderBy('mainCon.name', 'ASC');

      if (!canViewAll && canViewOwn && currentUserId) {
        queryBuilder
          .innerJoin('mainCon.tasks', 'task')
          .andWhere('task.assigned_to = :currentUserId', { currentUserId })
          .distinct(true);
      }

      const mainCons = await queryBuilder.getMany();

      res.json({
        success: true,
        data: mainCons
      });
    } catch (error: any) {
      console.error('Error fetching Main Cons:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  // Get single Main Con
  getOne = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const currentUserId = req.user?.id;
      const canViewAll = this.hasViewAllPermission(req);
      const canViewOwn = this.hasViewOwnPermission(req);
      const mainCon = await this.mainConRepository.findOne({
        where: { id },
        relations: ['tasks']
      });

      if (!mainCon) {
        res.status(404).json({
          success: false,
          message: 'Main Con not found'
        });
        return;
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        const hasOwnAccess = await AppDataSource
          .createQueryBuilder()
          .select('1')
          .from(Task, 'task')
          .where('task.main_con_id = :id', { id })
          .andWhere('task.assigned_to = :currentUserId', { currentUserId })
          .getRawOne();

        if (!hasOwnAccess) {
          res.status(403).json({
            success: false,
            message: 'Anda hanya boleh melihat Main-Con tugasan anda sendiri'
          });
          return;
        }
      }

      res.json({
        success: true,
        data: mainCon
      });
    } catch (error: any) {
      console.error('Error fetching Main Con:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  // Create Main Con
  create = async (req: Request, res: Response) => {
    try {
      const { name, contact_person, contact_number, email, address, is_active } = req.body;

      if (!name) {
        res.status(400).json({
          success: false,
          message: 'Main Con name is required'
        });
        return;
      }

      const mainCon = this.mainConRepository.create({
        name,
        contact_person,
        contact_number,
        email,
        address,
        is_active: is_active !== undefined ? is_active : true
      });

      await this.mainConRepository.save(mainCon);

      res.status(201).json({
        success: true,
        message: 'Main Con created successfully',
        data: mainCon
      });
    } catch (error: any) {
      console.error('Error creating Main Con:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  // Update Main Con
  update = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { name, contact_person, contact_number, email, address, is_active } = req.body;

      const mainCon = await this.mainConRepository.findOne({ where: { id } });

      if (!mainCon) {
        res.status(404).json({
          success: false,
          message: 'Main Con not found'
        });
        return;
      }

      if (name) mainCon.name = name;
      if (contact_person !== undefined) mainCon.contact_person = contact_person;
      if (contact_number !== undefined) mainCon.contact_number = contact_number;
      if (email !== undefined) mainCon.email = email;
      if (address !== undefined) mainCon.address = address;
      if (is_active !== undefined) mainCon.is_active = is_active;

      await this.mainConRepository.save(mainCon);

      res.json({
        success: true,
        message: 'Main Con updated successfully',
        data: mainCon
      });
    } catch (error: any) {
      console.error('Error updating Main Con:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  // Delete Main Con
  delete = async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const mainCon = await this.mainConRepository.findOne({ 
        where: { id },
        relations: ['tasks'] 
      });

      if (!mainCon) {
        res.status(404).json({
          success: false,
          message: 'Main Con not found'
        });
        return;
      }

      if (mainCon.tasks && mainCon.tasks.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete Main Con with associated tasks'
        });
        return;
      }

      await this.mainConRepository.remove(mainCon);

      res.json({
        success: true,
        message: 'Main Con deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting Main Con:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };
}
