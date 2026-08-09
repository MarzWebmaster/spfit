import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User, UserStatus } from '../models/User';
import { UserProfile } from '../models/UserProfile';
import { Task, TaskStatus } from '../models/Task';
import { FreelancerLocation } from '../models/FreelancerLocation';
import { FreelancerSkill } from '../models/FreelancerSkill';
import { FreelancerBankAccount } from '../models/FreelancerBankAccount';
import { TaskFeedback } from '../models/TaskFeedback';
import { Notification, NotificationType } from '../models/Notification';
import { AuthService } from '../services/authService';
import { ActivityType } from '../models/ActivityLog';
import { AuditService } from '../services/auditService';
import { getFileInfo } from '../middleware/upload';
import fs from 'fs';
import path from 'path';



export class FreelancerController {
  private userRepository = AppDataSource.getRepository(User);
  private userProfileRepository = AppDataSource.getRepository(UserProfile);
  private taskRepository = AppDataSource.getRepository(Task);
  private freelancerLocationRepository = AppDataSource.getRepository(FreelancerLocation);
  private freelancerSkillRepository = AppDataSource.getRepository(FreelancerSkill);
  private freelancerBankAccountRepository = AppDataSource.getRepository(FreelancerBankAccount);
  private taskFeedbackRepository = AppDataSource.getRepository(TaskFeedback);
  private notificationRepository = AppDataSource.getRepository(Notification);
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Create notification
   */
  private async createNotification(
    userId: number,
    taskId: number | null,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      req?: Request;
      triggerUserId?: number;
    }
  ): Promise<void> {
    const notification = this.notificationRepository.create({
      user_id: userId,
      task_id: taskId,
      type,
      title,
      message,
      is_read: false,
      created_at: new Date()
    });
    
    const savedNotification = await this.notificationRepository.save(notification);

    await AuditService.log({
      req: options?.req,
      userId: options?.triggerUserId,
      actionType: 'CREATE',
      tableName: 'notifications',
      recordId: savedNotification.id,
      newValues: {
        user_id: userId,
        task_id: taskId,
        type,
        title,
        message,
        is_read: false,
        channel: 'in_app'
      },
      description: `Notifikasi automatik dihantar kepada pengguna ${userId}: ${title}`
    });
  }

  /**
   * Get all freelancers with filtering and pagination
   */
  getAllFreelancers = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'created_at',
        q,
        state,
        district,
        skill,
        minRating,
        maxRating,
        isAvailable
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const queryBuilder = this.userRepository.createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('user.profile', 'profile')
        .leftJoinAndSelect('user.freelancerLocations', 'locations')
        .leftJoinAndSelect('user.freelancerSkills', 'skills')
        .where('(LOWER(role.name) LIKE :freelancerRole)', { freelancerRole: '%freelance%' })
        // Use 'Aktif' instead of 'active' to match existing data
        .andWhere('user.status = :status', { status: 'Aktif' })
        .select([
          'user.id',
          'user.name',
          'user.email',
          'user.created_at',
          'role.name',
          'profile.id',
          'profile.phone',
          'profile.ic_number',
          'profile.experience',
          'profile.rating',
          'profile.is_available',
          'locations.id',
          'locations.district',
          'locations.state',
          'skills.id',
          'skills.skill'
        ]);

      // Apply filters
      if (q) {
        queryBuilder.andWhere(
          '(user.name LIKE :search OR user.email LIKE :search)',
          { search: `%${q}%` }
        );
      }

      if (state) {
        queryBuilder.andWhere('locations.state = :state', { state });
      }

      if (district) {
        queryBuilder.andWhere('locations.district = :district', { district });
      }

      if (skill) {
        queryBuilder.andWhere('skills.skill LIKE :skill', { skill: `%${skill}%` });
      }

      if (minRating) {
        queryBuilder.andWhere('profile.rating >= :minRating', { minRating: Number(minRating) });
      }

      if (maxRating) {
        queryBuilder.andWhere('profile.rating <= :maxRating', { maxRating: Number(maxRating) });
      }

      if (isAvailable !== undefined) {
        queryBuilder.andWhere('profile.is_available = :isAvailable', {
          isAvailable: isAvailable === 'true' 
        });
      }

      // Apply sorting
      queryBuilder.orderBy(`user.${sortBy}`, sort.toString().toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      queryBuilder.skip(skip).take(Number(limit));

      const [freelancers, total] = await queryBuilder.getManyAndCount();

      console.log(`📋 Retrieved ${freelancers.length} freelancers from database`);
      if (freelancers.length > 0) {
        console.log('First freelancer before normalization:', {
          id: freelancers[0].id,
          name: freelancers[0].name,
          freelancerLocationsCount: freelancers[0].freelancerLocations?.length,
          freelancerSkillsCount: freelancers[0].freelancerSkills?.length
        });
      }

      // Normalize freelancers data to match frontend expectations
      const normalizedFreelancers = freelancers.map(freelancer => ({
        ...freelancer,
        phone: freelancer.profile?.phone || freelancer.phone,
        icNumber: freelancer.profile?.ic_number || freelancer.ic_number,
        experience: freelancer.profile?.experience ?? freelancer.experience,
        rating: freelancer.profile?.rating ?? freelancer.rating,
        is_available: freelancer.profile?.is_available ?? freelancer.is_available,
        address: freelancer.profile?.address || '',
        city: freelancer.profile?.city || '',
        postcode: freelancer.profile?.postcode || '',
        state: freelancer.profile?.state || '',
        locations: freelancer.freelancerLocations?.map(loc => ({
          district: loc.district,
          state: loc.state
        })) || [],
        skills: freelancer.freelancerSkills?.map(skill => skill.skill) || []
      }));

      console.log('After normalization:', {
        count: normalizedFreelancers.length,
        firstFreelancerLocations: normalizedFreelancers[0]?.locations,
        firstFreelancerSkills: normalizedFreelancers[0]?.skills
      });

      res.json({
        success: true,
        message: 'Freelancers retrieved successfully',
        data: {
          freelancers: normalizedFreelancers,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get freelancers error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get freelancer profile by ID
   */
  getFreelancerProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const requesterId = req.user?.id;
      const requesterRole = req.user?.role;

      // Enforce own-scope check: if user only has view:own or settings:manage:profile,
      // they can only access their own profile
      if (requesterId && requesterId !== Number(id)) {
        const isAdmin = requesterRole?.toLowerCase() === 'admin';
        const hasAllOrManagePermission = req.userPermissions?.some(p => 
          ['freelancers:view:all', 'freelancers:manage'].includes(p)
        ) || isAdmin;
        
        if (!hasAllOrManagePermission) {
          res.status(403).json({
            success: false,
            message: 'You can only access your own freelancer profile'
          });
          return;
        }
      }

      const freelancer = await this.userRepository.findOne({
        where: { id: Number(id) },
        relations: [
          'role',
          'profile',
          'freelancerLocations',
          'freelancerSkills'
        ]
        // Removed select to fetch ALL fields including ic_number
      });

      if (!freelancer) {
        res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
        return;
      }

      console.log('🔍 Raw freelancer from DB getFreelancerProfile:', {
        id: freelancer.id,
        name: freelancer.name,
        ic_number: (freelancer as any).ic_number,
        ic_number_type: typeof (freelancer as any).ic_number,
        has_ic_field: 'ic_number' in freelancer
      });

      if (!freelancer.role.name.toLowerCase().includes('freelance')) {
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      // Get freelancer's task statistics
      const taskStats = await this.taskRepository
        .createQueryBuilder('task')
        .leftJoin('task.statusSetting', 'statusSetting')
        .select([
          'COUNT(*) as total_tasks',
          'COUNT(CASE WHEN statusSetting.name = "Selesai" THEN 1 END) as completed_tasks',
          'COUNT(CASE WHEN statusSetting.name = "Telah Dibayar" THEN 1 END) as paid_tasks'
        ])
        .where('task.assigned_to = :freelancerId', { freelancerId: Number(id) })
        .getRawOne();

      // Get recent feedback
      const recentFeedback = await this.taskFeedbackRepository
        .createQueryBuilder('feedback')
        .leftJoinAndSelect('feedback.task', 'task')
        .leftJoinAndSelect('task.creator', 'creator')
        .where('task.assigned_to = :freelancerId', { freelancerId: Number(id) })
        .orderBy('feedback.id', 'DESC')
        .limit(5)
        .getMany();

      const normalizedFreelancer = {
        ...freelancer,
        phone: freelancer.profile?.phone || freelancer.phone,
        icNumber: freelancer.profile?.ic_number || freelancer.ic_number,
        experience: freelancer.profile?.experience ?? freelancer.experience,
        rating: freelancer.profile?.rating ?? freelancer.rating,
        is_available: freelancer.profile?.is_available ?? freelancer.is_available,
        address: freelancer.profile?.address || '',
        city: freelancer.profile?.city || '',
        postcode: freelancer.profile?.postcode || '',
        state: freelancer.profile?.state || '',
        locations: freelancer.freelancerLocations?.map(loc => ({
          district: loc.district,
          state: loc.state
        })) || [],
        skills: freelancer.freelancerSkills?.map(skill => skill.skill) || []
      };

      console.log('✅ Normalized freelancer:', {
        id: normalizedFreelancer.id,
        name: normalizedFreelancer.name,
        icNumber: normalizedFreelancer.icNumber,
        ic_number: (normalizedFreelancer as any).ic_number,
        locations_count: normalizedFreelancer.locations?.length,
        skills_count: normalizedFreelancer.skills?.length
      });

      res.json({
        success: true,
        message: 'Freelancer profile retrieved successfully',
        data: {
          freelancer: normalizedFreelancer,
          statistics: {
            total_tasks: Number(taskStats.total_tasks) || 0,
            completed_tasks: Number(taskStats.completed_tasks) || 0,
            paid_tasks: Number(taskStats.paid_tasks) || 0,
            completion_rate: taskStats.total_tasks > 0 
              ? Math.round((taskStats.completed_tasks / taskStats.total_tasks) * 100) 
              : 0
          },
          recent_feedback: recentFeedback
        }
      });
    } catch (error) {
      console.error('Get freelancer profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update freelancer profile
   */
  updateFreelancerProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('🔧 updateFreelancerProfile called');
      const { id } = req.params;
      const {
        name,
        phone,
        ic_number,
        experience,
        bank_name,
        bank_account_number,
        payment_email,
        locations,
        skills,
        address,
        city,
        postcode,
        state: address_state
      } = req.body;
      const updaterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      console.log('🔧 Params:', { id, updaterId, name, phone, ic_number, experience });

      // Check if user exists and is a freelancer
      const freelancer = await this.userRepository.findOne({
        where: { id: Number(id) },
        relations: ['role', 'profile']
      });

      console.log('🔧 Freelancer found:', freelancer ? { id: freelancer.id, name: freelancer.name, role: freelancer.role.name } : null);

      if (!freelancer) {
        console.log('❌ Freelancer not found');
        res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
        return;
      }

      if (!freelancer.role.name.toLowerCase().includes('freelance')) {
        console.log('❌ User is not a freelancer, role:', freelancer.role.name);
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      // Check permission (freelancer can only update their own profile, or admin/staff)
      const userRole = req.user?.role;
      if (updaterId !== Number(id) && !['Admin', 'Staff', 'Supervisor'].includes(userRole || '')) {
        res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
        return;
      }

      // Update basic profile information
      const updateData: Partial<User> = {
        updated_at: new Date()
      };

      if (name !== undefined) updateData.name = name;

      const profileUpdateData: Partial<UserProfile> = {
        user_id: Number(id),
        updated_at: new Date()
      };

      if (phone !== undefined) profileUpdateData.phone = phone;
      if (ic_number !== undefined) profileUpdateData.ic_number = ic_number;
      if (experience !== undefined) profileUpdateData.experience = Number(experience);
      if (bank_name !== undefined) profileUpdateData.bank_name = bank_name;
      if (bank_account_number !== undefined) profileUpdateData.bank_account_number = bank_account_number;
      if (payment_email !== undefined) profileUpdateData.payment_email = payment_email;
      if (address !== undefined) profileUpdateData.address = address;
      if (city !== undefined) profileUpdateData.city = city;
      if (postcode !== undefined) profileUpdateData.postcode = postcode;
      if (address_state !== undefined) profileUpdateData.state = address_state;

      console.log('💾 Updating user data:', updateData);
      await this.userRepository.update(Number(id), updateData);
      await this.userProfileRepository.upsert(profileUpdateData, ['user_id']);
      console.log('✅ User data updated');

      // Update locations if provided
      if (locations && Array.isArray(locations)) {
        console.log('🗑️ Deleting existing locations for user:', Number(id));
        const deleteResult = await this.freelancerLocationRepository.delete({ user_id: Number(id) });
        console.log('Deleted locations:', deleteResult.affected);
        
        // Add new locations
        console.log('📍 Creating new locations:', locations);
        const locationEntities = locations.map(location => 
          this.freelancerLocationRepository.create({
            user_id: Number(id),
            district: location.district,
            state: location.state,
            created_at: new Date()
          })
        );
        
        const savedLocations = await this.freelancerLocationRepository.save(locationEntities);
        console.log('✅ Locations saved:', savedLocations);
      } else {
        console.log('⚠️ No locations provided or not an array');
      }

      // Update skills if provided
      if (skills && Array.isArray(skills)) {
        console.log('🗑️ Deleting existing skills for user:', Number(id));
        const deleteResult = await this.freelancerSkillRepository.delete({ user_id: Number(id) });
        console.log('Deleted skills:', deleteResult.affected);
        
        // Add new skills
        console.log('🛠️ Creating new skills:', skills);
        const skillEntities = skills.map(skill => 
          this.freelancerSkillRepository.create({
            user_id: Number(id),
            skill: skill.trim(),
            created_at: new Date()
          })
        );
        
        const savedSkills = await this.freelancerSkillRepository.save(skillEntities);
        console.log('✅ Skills saved:', savedSkills);
      } else {
        console.log('⚠️ No skills provided or not an array');
      }

      // Log profile update
      if (updaterId) {
        await this.authService.logActivity(
          updaterId,
          ActivityType.PROFILE_UPDATED,
          `Updated freelancer profile: ${freelancer.name}`,
          clientIp,
          userAgent,
          { freelancerId: Number(id), updatedFields: Object.keys(updateData) }
        );
      }

      // Get updated profile
      const updatedFreelancer = await this.userRepository.findOne({
        where: { id: Number(id) },
        relations: ['role', 'profile', 'freelancerLocations', 'freelancerSkills'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          created_at: true,
          updated_at: true,
          profile: {
            id: true,
            phone: true,
            ic_number: true,
            experience: true,
            rating: true,
            is_available: true,
            bank_name: true,
            bank_account_number: true,
            payment_email: true,
            address: true,
            city: true,
            postcode: true,
            state: true
          }
        }
      });

      const normalizedUpdatedFreelancer = updatedFreelancer ? {
        ...updatedFreelancer,
        phone: updatedFreelancer.profile?.phone || updatedFreelancer.phone,
        icNumber: updatedFreelancer.profile?.ic_number || updatedFreelancer.ic_number,
        experience: updatedFreelancer.profile?.experience ?? updatedFreelancer.experience,
        rating: updatedFreelancer.profile?.rating ?? updatedFreelancer.rating,
        is_available: updatedFreelancer.profile?.is_available ?? updatedFreelancer.is_available,
        bank_name: updatedFreelancer.profile?.bank_name || '',
        bank_account_number: updatedFreelancer.profile?.bank_account_number || '',
        payment_email: updatedFreelancer.profile?.payment_email || updatedFreelancer.email || '',
        address: updatedFreelancer.profile?.address || '',
        city: updatedFreelancer.profile?.city || '',
        postcode: updatedFreelancer.profile?.postcode || '',
        state: updatedFreelancer.profile?.state || '',
        locations: updatedFreelancer.freelancerLocations?.map(loc => ({
          district: loc.district,
          state: loc.state
        })) || [],
        skills: updatedFreelancer.freelancerSkills?.map(skill => skill.skill) || []
      } : updatedFreelancer;

      res.json({
        success: true,
        message: 'Freelancer profile updated successfully',
        data: { freelancer: normalizedUpdatedFreelancer }
      });
    } catch (error) {
      console.error('Update freelancer profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update freelancer availability
   */
  updateAvailability = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { is_available } = req.body;
      const updaterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check if user exists and is a freelancer
      const freelancer = await this.userRepository.findOne({
        where: { id: Number(id) },
        relations: ['role']
      });

      if (!freelancer) {
        res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
        return;
      }

      if (!freelancer.role.name.toLowerCase().includes('freelance')) {
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      // Check permission (freelancer can only update their own availability)
      if (updaterId !== Number(id)) {
        res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
        return;
      }

      // Update availability
      await this.userProfileRepository.upsert({
        user_id: Number(id),
        is_available: Boolean(is_available),
        updated_at: new Date()
      }, ['user_id']);

      // Log availability change
      if (updaterId) {
        await this.authService.logActivity(
          updaterId,
          ActivityType.AVAILABILITY_CHANGED,
          `Changed availability to ${is_available ? 'available' : 'unavailable'}`,
          clientIp,
          userAgent,
          { freelancerId: Number(id), isAvailable: Boolean(is_available) }
        );
      }

      res.json({
        success: true,
        message: `Availability updated to ${is_available ? 'available' : 'unavailable'}`,
        data: { is_available: Boolean(is_available) }
      });
    } catch (error) {
      console.error('Update availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get freelancer's tasks
   */
  getFreelancerTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const {
        page = 1,
        limit = 10,
        status,
        dateFrom,
        dateTo
      } = req.query;

      // Check permission
      const userRole = req.user?.role;
      if (req.user?.id !== Number(id) && !['Admin', 'Staff', 'Supervisor'].includes(userRole || '')) {
        res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
        return;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const queryBuilder = this.taskRepository.createQueryBuilder('task')
        .leftJoinAndSelect('task.creator', 'creator')
        .leftJoinAndSelect('task.statusSetting', 'statusSetting')
        .leftJoinAndSelect('task.report', 'report')
        .leftJoinAndSelect('task.feedback', 'feedback')
        .where('task.assigned_to = :freelancerId', { freelancerId: Number(id) })
        .select([
          'task.id',
          'task.title',
          'task.log_number',
          'task.description',
          'task.support_type',
          'task.client_location',
          'task.state',
          'task.deadline',
          'task.offer_price',
          'task.status_id',
          'task.remarks',
          'task.payment_date',
          'task.created_at',
          'task.updated_at',
          'statusSetting.id',
          'statusSetting.name',
          'creator.id',
          'creator.name',
          'creator.email',
          'report.id',
          'report.file_url',
          'report.submitted_at',
          'feedback.overall_rating',
          'feedback.comment'
        ]);

      // Apply filters
      if (status) {
        queryBuilder.andWhere('statusSetting.name = :status', { status });
      }

      if (dateFrom) {
        queryBuilder.andWhere('task.created_at >= :dateFrom', { dateFrom });
      }

      if (dateTo) {
        queryBuilder.andWhere('task.created_at <= :dateTo', { dateTo });
      }

      // Apply sorting and pagination
      queryBuilder
        .orderBy('task.created_at', 'DESC')
        .skip(skip)
        .take(Number(limit));

      const [tasks, total] = await queryBuilder.getManyAndCount();
      const normalizedTasks = tasks.map((task: any) => ({
        ...task,
        status: task.statusSetting?.name || null
      }));

      res.json({
        success: true,
        message: 'Freelancer tasks retrieved successfully',
        data: {
          tasks: normalizedTasks,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get freelancer tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Apply for a task (express interest)
   */
  applyForTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const { message } = req.body;
      const freelancerId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!freelancerId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Check if user is a freelancer
      const freelancer = await this.userRepository.findOne({
        where: { id: freelancerId },
        relations: ['role', 'profile']
      });

      if (!freelancer || !freelancer.role.name.toLowerCase().includes('freelance')) {
        res.status(403).json({
          success: false,
          message: 'Only freelancers can apply for tasks'
        });
        return;
      }

      if (freelancer.status !== UserStatus.AKTIF) {
        res.status(400).json({
          success: false,
          message: 'Your account is not active'
        });
        return;
      }

      const isAvailable = freelancer.profile?.is_available ?? freelancer.is_available;
      if (!isAvailable) {
        res.status(400).json({
          success: false,
          message: 'You must be available to apply for tasks'
        });
        return;
      }

      // Check if task exists and is available
      const task = await this.taskRepository.findOne({
        where: { id: Number(taskId) },
        relations: ['creator', 'statusSetting']
      });

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found'
        });
        return;
      }

      if (task.statusSetting?.name !== TaskStatus.BARU) {
        res.status(400).json({
          success: false,
          message: 'Task is no longer available for applications'
        });
        return;
      }

      if (task.created_by === freelancerId) {
        res.status(400).json({
          success: false,
          message: 'You cannot apply for your own task'
        });
        return;
      }

      // Create notification for task creator
      await this.createNotification(
        task.creator.id,
        task.id,
        NotificationType.TASK_APPLICATION,
        'New Task Application',
        `${freelancer.name} has applied for your task: ${task.title}${message ? ` - Message: ${message}` : ''}`,
        { req, triggerUserId: freelancerId }
      );

      // Log task application
      await this.authService.logActivity(
        freelancerId,
        ActivityType.TASK_APPLICATION,
        `Applied for task: ${task.title} (${task.log_number})`,
        clientIp,
        userAgent,
        { taskId: Number(taskId), message }
      );

      res.json({
        success: true,
        message: 'Task application submitted successfully'
      });
    } catch (error) {
      console.error('Apply for task error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get freelancer dashboard statistics
   */
  getFreelancerDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const freelancerId = req.user?.id;

      if (!freelancerId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Get task statistics
      const taskStats = await this.taskRepository
        .createQueryBuilder('task')
        .leftJoin('task.statusSetting', 'statusSetting')
        .select([
          'COUNT(*) as total_tasks',
          'COUNT(CASE WHEN statusSetting.name = "Telah Diambil" THEN 1 END) as active_tasks',
          'COUNT(CASE WHEN statusSetting.name = "Selesai" THEN 1 END) as completed_tasks',
          'COUNT(CASE WHEN statusSetting.name = "Telah Dibayar" THEN 1 END) as paid_tasks',
          'SUM(CASE WHEN statusSetting.name = "Telah Dibayar" THEN task.offer_price ELSE 0 END) as total_earnings'
        ])
        .where('task.assigned_to = :freelancerId', { freelancerId })
        .getRawOne();

      // Get recent tasks
      const recentTasks = await this.taskRepository.find({
        where: { assigned_to: freelancerId },
        relations: ['creator', 'statusSetting'],
        select: {
          id: true,
          title: true,
          log_number: true,
          status_id: true,
          deadline: true,
          offer_price: true,
          created_at: true,
          statusSetting: {
            id: true,
            name: true
          },
          creator: {
            id: true,
            name: true
          }
        },
        order: { created_at: 'DESC' },
        take: 5
      });

      // Get unread notifications
      const unreadNotifications = await this.notificationRepository.count({
        where: {
          user_id: freelancerId,
          is_read: false
        }
      });

      // Get average rating
      const ratingStats = await this.taskFeedbackRepository
        .createQueryBuilder('feedback')
        .leftJoin('feedback.task', 'task')
        .select([
          'AVG(feedback.overall_rating) as avg_rating',
          'COUNT(*) as total_reviews'
        ])
        .where('task.assigned_to = :freelancerId', { freelancerId })
        .getRawOne();

      const normalizedRecentTasks = recentTasks.map((task: any) => ({
        ...task,
        status: task.statusSetting?.name || null
      }));

      res.json({
        success: true,
        message: 'Dashboard data retrieved successfully',
        data: {
          statistics: {
            total_tasks: Number(taskStats.total_tasks) || 0,
            active_tasks: Number(taskStats.active_tasks) || 0,
            completed_tasks: Number(taskStats.completed_tasks) || 0,
            paid_tasks: Number(taskStats.paid_tasks) || 0,
            total_earnings: Number(taskStats.total_earnings) || 0,
            completion_rate: taskStats.total_tasks > 0 
              ? Math.round((taskStats.completed_tasks / taskStats.total_tasks) * 100) 
              : 0,
            average_rating: ratingStats.avg_rating ? Math.round(ratingStats.avg_rating * 10) / 10 : 0,
            total_reviews: Number(ratingStats.total_reviews) || 0
          },
          recent_tasks: normalizedRecentTasks,
          unread_notifications: unreadNotifications
        }
      });
    } catch (error) {
      console.error('Get freelancer dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get available tasks for freelancer
   */
  getAvailableTasks = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        state,
        support_type,
        minPrice,
        maxPrice,
        dateFrom,
        dateTo
      } = req.query;

      const freelancerId = req.user?.id;
      if (!freelancerId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const skip = (Number(page) - 1) * Number(limit);
      const queryBuilder = this.taskRepository.createQueryBuilder('task')
        .leftJoinAndSelect('task.creator', 'creator')
        .leftJoinAndSelect('task.statusSetting', 'statusSetting')
        .where('statusSetting.name = :status', { status: TaskStatus.BARU })
        .andWhere('task.created_by != :freelancerId', { freelancerId })
        .select([
          'task.id',
          'task.title',
          'task.log_number',
          'task.description',
          'task.support_type',
          'task.client_location',
          'task.state',
          'task.deadline',
          'task.offer_price',
          'task.status_id',
          'task.created_at',
          'statusSetting.id',
          'statusSetting.name',
          'creator.id',
          'creator.name'
        ]);

      // Apply filters
      if (state) {
        queryBuilder.andWhere('task.state = :state', { state });
      }

      if (support_type) {
        queryBuilder.andWhere('task.support_type = :support_type', { support_type });
      }

      if (minPrice) {
        queryBuilder.andWhere('task.offer_price >= :minPrice', { minPrice: Number(minPrice) });
      }

      if (maxPrice) {
        queryBuilder.andWhere('task.offer_price <= :maxPrice', { maxPrice: Number(maxPrice) });
      }

      if (dateFrom) {
        queryBuilder.andWhere('task.created_at >= :dateFrom', { dateFrom });
      }

      if (dateTo) {
        queryBuilder.andWhere('task.created_at <= :dateTo', { dateTo });
      }

      // Apply sorting and pagination
      queryBuilder
        .orderBy('task.created_at', 'DESC')
        .skip(skip)
        .take(Number(limit));

      const [tasks, total] = await queryBuilder.getManyAndCount();

      res.json({
        success: true,
        message: 'Available tasks retrieved successfully',
        data: {
          tasks,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get available tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get freelancer bank accounts
   */
  getFreelancerBankAccounts = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const freelancerId = Number(id);

      const freelancer = await this.userRepository.findOne({
        where: { id: freelancerId },
        relations: ['role']
      });

      if (!freelancer) {
        res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
        return;
      }

      if (!freelancer.role.name.toLowerCase().includes('freelance')) {
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      const bankAccounts = await this.freelancerBankAccountRepository.find({
        where: { user_id: freelancerId },
        order: {
          is_default: 'DESC',
          created_at: 'DESC'
        }
      });

      res.json({
        success: true,
        message: 'Freelancer bank accounts retrieved successfully',
        data: { bankAccounts }
      });
    } catch (error) {
      console.error('Get freelancer bank accounts error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create freelancer bank account
   */
  createFreelancerBankAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { bank_name, account_holder_name, account_number, is_default = false } = req.body;
      const freelancerId = Number(id);

      const freelancer = await this.userRepository.findOne({
        where: { id: freelancerId },
        relations: ['role']
      });

      if (!freelancer) {
        res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
        return;
      }

      if (!freelancer.role.name.toLowerCase().includes('freelance')) {
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      const shouldSetDefault = Boolean(is_default);
      if (shouldSetDefault) {
        await this.freelancerBankAccountRepository
          .createQueryBuilder()
          .update(FreelancerBankAccount)
          .set({ is_default: false })
          .where('user_id = :userId', { userId: freelancerId })
          .execute();
      }

      const bankAccount = this.freelancerBankAccountRepository.create({
        user_id: freelancerId,
        bank_name: bank_name.trim(),
        account_holder_name: account_holder_name.trim(),
        account_number: account_number.trim(),
        is_default: shouldSetDefault,
        created_at: new Date(),
        updated_at: new Date()
      });

      const savedBankAccount = await this.freelancerBankAccountRepository.save(bankAccount);

      res.status(201).json({
        success: true,
        message: 'Freelancer bank account created successfully',
        data: { bankAccount: savedBankAccount }
      });
    } catch (error) {
      console.error('Create freelancer bank account error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update freelancer bank account
   */
  updateFreelancerBankAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, accountId } = req.params;
      const freelancerId = Number(id);
      const bankAccountId = Number(accountId);
      const { bank_name, account_holder_name, account_number, is_default } = req.body;

      const freelancer = await this.userRepository.findOne({
        where: { id: freelancerId },
        relations: ['role']
      });

      if (!freelancer) {
        res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
        return;
      }

      if (!freelancer.role.name.toLowerCase().includes('freelance')) {
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      const existingBankAccount = await this.freelancerBankAccountRepository.findOne({
        where: {
          id: bankAccountId,
          user_id: freelancerId
        }
      });

      if (!existingBankAccount) {
        res.status(404).json({
          success: false,
          message: 'Bank account not found'
        });
        return;
      }

      const shouldSetDefault = is_default === undefined
        ? existingBankAccount.is_default
        : Boolean(is_default);

      if (shouldSetDefault) {
        await this.freelancerBankAccountRepository
          .createQueryBuilder()
          .update(FreelancerBankAccount)
          .set({ is_default: false })
          .where('user_id = :userId', { userId: freelancerId })
          .execute();
      }

      const updateData: Partial<FreelancerBankAccount> = {
        updated_at: new Date(),
        is_default: shouldSetDefault
      };

      if (bank_name !== undefined) updateData.bank_name = bank_name.trim();
      if (account_holder_name !== undefined) updateData.account_holder_name = account_holder_name.trim();
      if (account_number !== undefined) updateData.account_number = account_number.trim();

      await this.freelancerBankAccountRepository.update(bankAccountId, updateData);

      const updatedBankAccount = await this.freelancerBankAccountRepository.findOne({
        where: { id: bankAccountId, user_id: freelancerId }
      });

      res.json({
        success: true,
        message: 'Freelancer bank account updated successfully',
        data: { bankAccount: updatedBankAccount }
      });
    } catch (error) {
      console.error('Update freelancer bank account error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete freelancer bank account
   */
  deleteFreelancerBankAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id, accountId } = req.params;
      const freelancerId = Number(id);
      const bankAccountId = Number(accountId);

      const freelancer = await this.userRepository.findOne({
        where: { id: freelancerId },
        relations: ['role']
      });

      if (!freelancer) {
        res.status(404).json({
          success: false,
          message: 'Freelancer not found'
        });
        return;
      }

      if (!freelancer.role.name.toLowerCase().includes('freelance')) {
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      const existingBankAccount = await this.freelancerBankAccountRepository.findOne({
        where: {
          id: bankAccountId,
          user_id: freelancerId
        }
      });

      if (!existingBankAccount) {
        res.status(404).json({
          success: false,
          message: 'Bank account not found'
        });
        return;
      }

      await this.freelancerBankAccountRepository.delete({
        id: bankAccountId,
        user_id: freelancerId
      });

      res.json({
        success: true,
        message: 'Freelancer bank account deleted successfully'
      });
    } catch (error) {
      console.error('Delete freelancer bank account error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}