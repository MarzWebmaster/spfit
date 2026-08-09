import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { Project, ProjectStatus } from '../models/Project.ts';

export class ProjectController {
  private projectRepository = AppDataSource.getRepository(Project);

  getAll = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'created_at',
        q,
        status
      } = req.query;

      const safeSortBy = ['created_at', 'updated_at', 'name', 'code', 'status'].includes(String(sortBy))
        ? String(sortBy)
        : 'created_at';
      const safeSort = String(sort).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const pageNumber = Math.max(Number(page) || 1, 1);
      const limitNumber = Math.max(Number(limit) || 10, 1);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAll = req.user?.role?.toLowerCase() === 'admin'
        || userPermissions.includes('projects:view:all')
        || userPermissions.includes('tasks:view:all');
      const canViewOwn = userPermissions.includes('projects:view:own')
        || userPermissions.includes('tasks:view:own')
        || userPermissions.includes('tasks:view:assigned');

      const queryBuilder = this.projectRepository
        .createQueryBuilder('project')
        .leftJoinAndSelect('project.creator', 'creator')
        .leftJoinAndSelect('project.mainCon', 'mainCon')
        .select([
          'project.id',
          'project.code',
          'project.name',
          'project.client_name',
          'project.description',
          'project.status',
          'project.start_date',
          'project.end_date',
          'project.budget',
          'project.main_con_id',
          'project.created_by',
          'project.created_at',
          'project.updated_at',
          'mainCon.id',
          'mainCon.name',
          'creator.id',
          'creator.name',
          'creator.email'
        ]);

      if (q) {
        queryBuilder.andWhere(
          '(project.code LIKE :search OR project.name LIKE :search OR project.client_name LIKE :search)',
          { search: `%${String(q)}%` }
        );
      }

      if (status) {
        queryBuilder.andWhere('project.status = :status', { status: String(status) });
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        queryBuilder.andWhere(
          '(project.created_by = :currentUserId OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project.id AND t.assigned_to = :currentUserId))',
          { currentUserId }
        );
      }

      queryBuilder
        .orderBy(`project.${safeSortBy}`, safeSort as 'ASC' | 'DESC')
        .skip((pageNumber - 1) * limitNumber)
        .take(limitNumber);

      const [projects, total] = await queryBuilder.getManyAndCount();
      const totalPages = Math.max(Math.ceil(total / limitNumber), 1);

      res.json({
        success: true,
        data: {
          projects,
          pagination: {
            total,
            page: pageNumber,
            limit: limitNumber,
            totalPages
          }
        }
      });
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  getOne = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const currentUserId = req.user?.id;
      const userPermissions = req.userPermissions || [];
      const canViewAll = req.user?.role?.toLowerCase() === 'admin'
        || userPermissions.includes('projects:view:all')
        || userPermissions.includes('tasks:view:all');
      const canViewOwn = userPermissions.includes('projects:view:own')
        || userPermissions.includes('tasks:view:own')
        || userPermissions.includes('tasks:view:assigned');
      const project = await this.projectRepository.findOne({
        where: { id },
        relations: ['creator', 'mainCon']
      });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        });
        return;
      }

      if (!canViewAll && canViewOwn && currentUserId) {
        const hasOwnAccess = await AppDataSource
          .createQueryBuilder()
          .select('1')
          .from(Project, 'project')
          .where('project.id = :id', { id })
          .andWhere('(project.created_by = :currentUserId OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = project.id AND t.assigned_to = :currentUserId))', { currentUserId })
          .getRawOne();

        if (!hasOwnAccess) {
          res.status(403).json({
            success: false,
            message: 'Anda hanya boleh melihat projek yang diassign kepada anda'
          });
          return;
        }
      }

      res.json({
        success: true,
        data: project
      });
    } catch (error: any) {
      console.error('Error fetching project:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  create = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, name, client_name, description, status, start_date, end_date, budget, main_con_id } = req.body;

      const existing = await this.projectRepository.findOne({ where: { code } });
      if (existing) {
        res.status(409).json({
          success: false,
          message: 'Kod projek sudah wujud'
        });
        return;
      }

      const project = this.projectRepository.create({
        code,
        name,
        client_name,
        description,
        status: status || ProjectStatus.AKTIF,
        start_date,
        end_date,
        budget,
        main_con_id: main_con_id ? Number(main_con_id) : undefined,
        created_by: req.user?.id
      });

      const savedProject = await this.projectRepository.save(project);

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: savedProject
      });
    } catch (error: any) {
      console.error('Error creating project:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  update = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const project = await this.projectRepository.findOne({ where: { id } });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        });
        return;
      }

      const {
        code,
        name,
        client_name,
        description,
        status,
        start_date,
        end_date,
        budget,
        main_con_id
      } = req.body;

      if (code && code !== project.code) {
        const duplicate = await this.projectRepository.findOne({ where: { code } });
        if (duplicate) {
          res.status(409).json({
            success: false,
            message: 'Kod projek sudah wujud'
          });
          return;
        }
        project.code = code;
      }

      if (name !== undefined) project.name = name;
      if (client_name !== undefined) project.client_name = client_name;
      if (description !== undefined) project.description = description;
      if (status !== undefined) project.status = status;
      if (start_date !== undefined) project.start_date = start_date;
      if (end_date !== undefined) project.end_date = end_date;
      if (budget !== undefined) project.budget = budget;
      if (main_con_id !== undefined) project.main_con_id = main_con_id ? Number(main_con_id) : undefined;

      const updated = await this.projectRepository.save(project);

      res.json({
        success: true,
        message: 'Project updated successfully',
        data: updated
      });
    } catch (error: any) {
      console.error('Error updating project:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const project = await this.projectRepository.findOne({ where: { id } });

      if (!project) {
        res.status(404).json({
          success: false,
          message: 'Project not found'
        });
        return;
      }

      await this.projectRepository.remove(project);

      res.json({
        success: true,
        message: 'Project deleted successfully'
      });
    } catch (error: any) {
      console.error('Error deleting project:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };
}
