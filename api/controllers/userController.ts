import { Request, Response } from 'express';
import { AppDataSource } from '../config/database.js';
import { User, UserStatus } from '../models/User.js';
import { UserProfile } from '../models/UserProfile.js';
import { Role } from '../models/Role.js';
import { FreelancerLocation } from '../models/FreelancerLocation.js';
import { FreelancerSkill } from '../models/FreelancerSkill.js';
import { AuthService } from '../services/authService.js';
import { ActivityType } from '../models/ActivityLog.js';
import { AuditService } from '../services/auditService.js';
import { Like, In } from 'typeorm';

export class UserController {
  private userRepository = AppDataSource.getRepository(User);
   private userProfileRepository = AppDataSource.getRepository(UserProfile);
  private roleRepository = AppDataSource.getRepository(Role);
  private freelancerLocationRepository = AppDataSource.getRepository(FreelancerLocation);
  private freelancerSkillRepository = AppDataSource.getRepository(FreelancerSkill);
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Get all users with pagination and filtering
   */
  getUsers = async (req: Request, res: Response): Promise<void> => {
    console.log('Get users request received:', {
      headers: req.headers,
      query: req.query
    });
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'created_at',
        q,
        status,
        role,
        dateFrom,
        dateTo
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const queryBuilder = this.userRepository.createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .select([
          'user.id',
          'user.name',
          'user.email',
          'user.status',
          'user.created_at',
          'user.updated_at',
          'role.id',
          'role.name'
        ]);

      // Apply filters
      if (q) {
        queryBuilder.andWhere(
          '(user.name LIKE :search OR user.email LIKE :search)',
          { search: `%${q}%` }
        );
      }

      if (status) {
        queryBuilder.andWhere('user.status = :status', { status });
      }

      if (role) {
        queryBuilder.andWhere('role.name = :role', { role });
      }

      if (dateFrom) {
        queryBuilder.andWhere('user.created_at >= :dateFrom', { dateFrom });
      }

      if (dateTo) {
        queryBuilder.andWhere('user.created_at <= :dateTo', { dateTo });
      }

      // Apply sorting
      queryBuilder.orderBy(`user.${sortBy}`, sort.toString().toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      queryBuilder.skip(skip).take(Number(limit));

      const [users, total] = await queryBuilder.getManyAndCount();
      console.log('Users found:', {
        count: users.length,
        total,
        users: users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role?.name }))
      });

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          users,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
          }
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get user by ID
   */
  getUserById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const user = await this.userRepository.findOne({
        where: { id: Number(id) },
        relations: ['role', 'freelancerLocations', 'freelancerSkills'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          ban_reason: true,
          phone: true,
          ic_number: true,
          experience: true,
          rating: true,
          is_available: true,
          created_at: true,
          updated_at: true,
          role: {
            id: true,
            name: true,
            description: true
          }
        }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        message: 'User retrieved successfully',
        data: { user }
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Create new user
   */
  createUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, email, password, role_id, phone, ic_number, experience, address, city, postcode, state: address_state } = req.body;
      const creatorId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check if email already exists
      const existingUser = await this.userRepository.findOne({
        where: { email }
      });

      if (existingUser) {
        res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
        return;
      }

      // Verify role exists
      const role = await this.roleRepository.findOne({
        where: { id: role_id }
      });

      if (!role) {
        res.status(400).json({
          success: false,
          message: 'Invalid role ID'
        });
        return;
      }

      // Hash password
      const passwordHash = await this.authService.hashPassword(password);

      // Create user
      const user = this.userRepository.create({
        name,
        email,
        password_hash: passwordHash,
        role_id: Number(role_id),
        phone,
        ic_number,
        experience,
        status: UserStatus.AKTIF,
        is_available: role.name === 'Freelancer',
        created_at: new Date(),
        updated_at: new Date()
      });

      const savedUser = await this.userRepository.save(user);

        await this.userProfileRepository.upsert({
          user_id: savedUser.id,
          phone,
          ic_number,
          address,
          city,
          postcode,
          state: address_state,
          experience: Number(experience || 0),
          is_available: true,
          created_at: new Date(),
          updated_at: new Date()
        }, ['user_id']);

      // Log user creation
      if (creatorId) {
        await this.authService.logActivity(
          creatorId,
          ActivityType.SYSTEM_ACCESS,
          `Created user: ${name} (${email})`,
          clientIp,
          userAgent,
          { createdUserId: savedUser.id }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: creatorId,
            actionType: 'CREATE',
            tableName: 'users',
            recordId: savedUser.id,
            newValues: savedUser,
            description: `Mencipta pengguna baru: ${name}`
        });
      }

      // Get user with role for response
      const userWithRole = await this.userRepository.findOne({
        where: { id: savedUser.id },
        relations: ['role'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          phone: true,
          ic_number: true,
          experience: true,
          rating: true,
          is_available: true,
          created_at: true,
          updated_at: true,
          role: {
            id: true,
            name: true,
            description: true
          }
        }
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user: userWithRole }
      });
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update user
   */
  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, email, password, phone, ic_number, experience, is_available, roleId, role_id } = req.body;
      const updaterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      console.log('🔧 updateUser called with:', { id, name, phone, ic_number, experience, is_available, roleId, role_id });

      const user = await this.userRepository.findOne({
        where: { id: Number(id) }
      });

      if (!user) {
        console.log('❌ User not found:', id);
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Update user data
      const updateData: Partial<User> = {
        updated_at: new Date()
      };

      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (ic_number !== undefined) updateData.ic_number = ic_number;
      if (experience !== undefined) updateData.experience = experience;
      if (is_available !== undefined) updateData.is_available = is_available;
      if (roleId !== undefined) updateData.role_id = Number(roleId);
      if (role_id !== undefined) updateData.role_id = Number(role_id);
      if (password !== undefined) {
        const trimmedPassword = String(password).trim();
        if (trimmedPassword.length < 8) {
          res.status(400).json({
            success: false,
            message: 'Kata laluan mesti sekurang-kurangnya 8 aksara'
          });
          return;
        }
        updateData.password_hash = await this.authService.hashPassword(trimmedPassword);
      }

        await this.userProfileRepository.upsert({
          user_id: Number(id),
          ...(phone !== undefined && { phone }),
          ...(ic_number !== undefined && { ic_number }),
          ...(experience !== undefined && { experience: Number(experience) }),
          ...(is_available !== undefined && { is_available: Boolean(is_available) }),
          updated_at: new Date()
        }, ['user_id']);

      console.log('🔧 Updating user with data:', updateData);
      await this.userRepository.update(Number(id), updateData);

      console.log('✅ User updated successfully');

      // Log user update
      if (updaterId) {
        await this.authService.logActivity(
          updaterId,
          ActivityType.PROFILE_UPDATED,
          `Updated user: ${user.name} (ID: ${id})`,
          clientIp,
          userAgent,
          { updatedUserId: Number(id), updatedFields: Object.keys(updateData) }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: updaterId,
            actionType: 'UPDATE',
            tableName: 'users',
            recordId: Number(id),
            oldValues: user,
            newValues: updateData,
            description: `Mengemaskini profil pengguna: ${user.name}`
        });
      }

      // Get updated user
      const updatedUser = await this.userRepository.findOne({
        where: { id: Number(id) },
        relations: ['role'],
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          phone: true,
          ic_number: true,
          experience: true,
          rating: true,
          is_available: true,
          created_at: true,
          updated_at: true,
          role: {
            id: true,
            name: true,
            description: true
          }
        }
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: { user: updatedUser }
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Update user status (activate, deactivate, ban)
   */
  updateUserStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, ban_reason } = req.body;
      const updaterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const user = await this.userRepository.findOne({
        where: { id: Number(id) }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Update user status
      const updateData: Partial<User> = {
        status,
        updated_at: new Date()
      };

      if (status === UserStatus.DISEKAT && ban_reason) {
        updateData.ban_reason = ban_reason;
      } else if (status !== UserStatus.DISEKAT) {
        updateData.ban_reason = null;
      }

      await this.userRepository.update(Number(id), updateData);

      // Log status change
      if (updaterId) {
        const activityType = status === UserStatus.DISEKAT ? ActivityType.SYSTEM_ACCESS :
                          status === UserStatus.AKTIF ? ActivityType.PROFILE_UPDATED : 
                           ActivityType.PROFILE_UPDATED;
        
        await this.authService.logActivity(
          updaterId,
          activityType,
          `Changed user status to ${status}: ${user.name} (ID: ${id})${ban_reason ? ` - Reason: ${ban_reason}` : ''}`,
          clientIp,
          userAgent,
          { targetUserId: Number(id), newStatus: status, banReason: ban_reason }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: updaterId,
            actionType: 'UPDATE',
            tableName: 'users',
            recordId: Number(id),
            oldValues: { status: user.status, ban_reason: user.ban_reason },
            newValues: { status, ban_reason },
            description: `Mengubah status pengguna ${user.name} kepada ${status}`
        });
      }

      res.json({
        success: true,
        message: `User status updated to ${status}`,
        data: { status }
      });
    } catch (error) {
      console.error('Update user status error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Delete user (soft delete by setting status to inactive)
   */
  deleteUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const deleterId = req.user?.id;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const user = await this.userRepository.findOne({
        where: { id: Number(id) }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Soft delete by setting status to inactive
      await this.userRepository.update(Number(id), {
        status: UserStatus.TIDAK_AKTIF,
        updated_at: new Date()
      });

      // Log user deletion
      if (deleterId) {
        await this.authService.logActivity(
          deleterId,
          ActivityType.SYSTEM_ACCESS,
          `Deleted user: ${user.name} (ID: ${id})`,
          clientIp,
          userAgent,
          { deletedUserId: Number(id) }
        );

        // Audit Trail
        await AuditService.log({
            req,
            userId: deleterId,
            actionType: 'DELETE',
            tableName: 'users',
            recordId: Number(id),
            oldValues: user,
            description: `Menghapus pengguna: ${user.name}`
        });
      }

      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };

  /**
   * Get freelancers with their locations and skills
   */
  getFreelancers = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'desc',
        sortBy = 'rating',
        q,
        state,
        skill,
        available
      } = req.query;

      const skip = (Number(page) - 1) * Number(limit);
      const queryBuilder = this.userRepository.createQueryBuilder('user')
        .leftJoinAndSelect('user.role', 'role')
        .leftJoinAndSelect('user.freelancerLocations', 'locations')
        .leftJoinAndSelect('user.freelancerSkills', 'skills')
        .where('role.name = :roleName', { roleName: 'Freelancer' })
        .andWhere('user.status = :status', { status: 'active' })
        .select([
          'user.id',
          'user.name',
          'user.email',
          'user.phone',
          'user.experience',
          'user.rating',
          'user.is_available',
          'user.ic_number',
          'user.created_at',
          'role.name',
          'locations.district',
          'locations.state',
          'skills.skill'
        ]);

      // Apply filters
      if (q) {
        queryBuilder.andWhere('user.name LIKE :search', { search: `%${q}%` });
      }

      if (state) {
        queryBuilder.andWhere('locations.state = :state', { state });
      }

      if (skill) {
        queryBuilder.andWhere('skills.skill LIKE :skill', { skill: `%${skill}%` });
      }

      if (available !== undefined) {
        queryBuilder.andWhere('user.is_available = :available', { available: available === 'true' });
      }

      // Apply sorting
      queryBuilder.orderBy(`user.${sortBy}`, sort.toString().toUpperCase() as 'ASC' | 'DESC');

      // Apply pagination
      queryBuilder.skip(skip).take(Number(limit));

      const [freelancers, total] = await queryBuilder.getManyAndCount();

      res.json({
        success: true,
        message: 'Freelancers retrieved successfully',
        data: {
          freelancers,
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
   * Update freelancer profile (location and skills)
   */
  updateFreelancerProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { locations, skills } = req.body;
      const currentUserId = req.user?.id;
      const userRole = req.user?.role;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check permission (self or admin)
      if (Number(id) !== currentUserId && !['Admin', 'Staff', 'Supervisor'].includes(userRole || '')) {
        res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: Number(id) },
        relations: ['role', 'freelancerLocations', 'freelancerSkills']
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Check if user is freelancer
      if (user.role.name !== 'Freelancer') {
        res.status(400).json({
          success: false,
          message: 'User is not a freelancer'
        });
        return;
      }

      // Update locations if provided
      if (locations && Array.isArray(locations)) {
        // Remove existing locations
        if (user.freelancerLocations) {
          await this.freelancerLocationRepository.remove(user.freelancerLocations);
        }

        // Add new locations
        const newLocations = locations.map(location => 
          this.freelancerLocationRepository.create({
            user_id: user.id,
            district: location.district?.trim() || location,
            state: location.state?.trim() || 'Unknown'
          })
        );
        await this.freelancerLocationRepository.save(newLocations);
      }

      // Update skills if provided
      if (skills && Array.isArray(skills)) {
        // Remove existing skills
        if (user.freelancerSkills) {
          await this.freelancerSkillRepository.remove(user.freelancerSkills);
        }

        // Add new skills
        const newSkills = skills.map(skill => 
          this.freelancerSkillRepository.create({
            user_id: user.id,
            skill: skill.skill?.trim() || skill
          })
        );
        await this.freelancerSkillRepository.save(newSkills);
      }

      // Get updated user with relations
      const updatedUser = await this.userRepository.findOne({
        where: { id: Number(id) },
        relations: ['role', 'freelancerLocations', 'freelancerSkills'],
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          ic_number: true,
          experience: true,
          status: true,
          created_at: true,
          role: { id: true, name: true },
          freelancerLocations: { id: true, district: true, state: true },
          freelancerSkills: { id: true, skill: true }
        }
      });

      // Log freelancer profile update
      if (currentUserId) {
        await this.authService.logActivity(
          currentUserId,
          ActivityType.PROFILE_UPDATED,
          `Updated freelancer profile for ${user.name}`,
          clientIp,
          userAgent,
          {
            targetUserId: Number(id),
            locationsCount: locations?.length || 0,
            skillsCount: skills?.length || 0
          }
        );
      }

      res.json({
        success: true,
        message: 'Freelancer profile updated successfully',
        data: { user: updatedUser }
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
   * Upload user avatar/profile image
   */
  uploadAvatar = async (req: Request, res: Response): Promise<void> => {
    try {
      const uploadedFile = (req as any).file as Express.Multer.File | undefined;
      const { id } = req.params;
      const currentUserId = req.user?.id;
      const userRole = req.user?.role;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // Check permission (self or admin)
      if (Number(id) !== currentUserId && !['Admin', 'Staff', 'Supervisor'].includes(userRole || '')) {
        res.status(403).json({
          success: false,
          message: 'Permission denied'
        });
        return;
      }

      if (!uploadedFile) {
        res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
        return;
      }

      const user = await this.userRepository.findOne({
        where: { id: Number(id) }
      });

      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }

      // Delete old avatar if exists
      if (user.profile_image) {
        const fs = require('fs');
        const path = require('path');
        const oldImagePath = path.join(process.cwd(), user.profile_image);
        
        if (fs.existsSync(oldImagePath)) {
          try {
            fs.unlinkSync(oldImagePath);
          } catch (error) {
            console.error('Error deleting old avatar:', error);
          }
        }
      }

      // Update user with new avatar path
      const avatarPath = uploadedFile.path.replace(process.cwd(), '').replace(/\\/g, '/');
      await this.userRepository.update(Number(id), {
        profile_image: avatarPath,
        updated_at: new Date()
      });

      // Log avatar upload
      if (currentUserId) {
        await this.authService.logActivity(
          currentUserId,
          ActivityType.PROFILE_UPDATED,
          `Uploaded avatar for ${user.name}`,
          clientIp,
          userAgent,
          {
            targetUserId: Number(id),
            fileName: uploadedFile.filename,
            fileSize: uploadedFile.size
          }
        );
      }

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          avatar_url: avatarPath,
          file_info: {
            filename: uploadedFile.filename,
            size: uploadedFile.size,
            mimetype: uploadedFile.mimetype
          }
        }
      });
    } catch (error) {
      console.error('Upload avatar error:', error);
      
      // Clean up uploaded file on error
      if ((req as any).file) {
        const uploadedFile = (req as any).file as Express.Multer.File;
        const fs = require('fs');
        try {
          fs.unlinkSync(uploadedFile.path);
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }
      
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  };
}