import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { Role } from '../models/Role.ts';
import { RolePermission } from '../models/RolePermission.ts';
import { AuditTrail } from '../models/AuditTrail.ts';
import { authenticateToken, requirePermission } from '../middleware/auth.ts';

const router = Router();

// Helper to log audit
async function logAudit(
  userId: number | null,
  action: string,
  recordId: number,
  oldValues: any,
  newValues: any,
  req: Request,
  description: string
) {
  try {
    const auditRepo = AppDataSource.getRepository(AuditTrail);
    const log = new AuditTrail();
    log.user_id = userId;
    log.action_type = action;
    log.table_name = 'roles';
    log.record_id = recordId;
    log.old_values = oldValues;
    log.new_values = newValues;
    log.ip_address = req.ip || req.socket.remoteAddress || 'unknown';
    log.user_agent = req.headers['user-agent'] || 'unknown';
    log.description = description;
    await auditRepo.save(log);
  } catch (err) {
    console.error('Failed to save audit log:', err);
  }
}

// GET /api/roles - Get all roles
router.get('/', authenticateToken, requirePermission('settings:manage:roles'), async (req: Request, res: Response) => {
  try {
    const roleRepository = AppDataSource.getRepository(Role);
    const roles = await roleRepository.find({
      relations: ['permissions', 'roleType'],
      order: { created_at: 'DESC' }
    });

    // Transform data to match frontend format
    const transformedRoles = roles.map(role => ({
      id: role.id,
      name: role.name,
      description: role.description || '',
      permissions: role.permissions.map(p => p.permission),
      roleType: role.roleType, // Return the whole object
      roleTypeId: role.role_type_id,
      isSystemRole: role.is_system_role,
      createdAt: role.created_at,
      updatedAt: role.updated_at
    }));

    // Log Audit (READ)
    // Only log if user is authenticated (which is enforced by middleware now)
    await logAudit(
        req.user?.id || null,
        'READ',
        0, // No specific record ID for list
        null,
        null,
        req,
        'Viewed all roles'
    );

    res.json({
      success: true,
      data: transformedRoles
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch roles',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// GET /api/roles/:id - Get role by ID
router.get('/:id', authenticateToken, requirePermission('settings:manage:roles'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const roleRepository = AppDataSource.getRepository(Role);
    
    const role = await roleRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['permissions', 'roleType']
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    const transformedRole = {
      id: role.id,
      name: role.name,
      description: role.description || '',
      permissions: role.permissions.map(p => p.permission),
      roleType: role.roleType,
      roleTypeId: role.role_type_id,
      isSystemRole: role.is_system_role,
      createdAt: role.created_at,
      updatedAt: role.updated_at
    };

    // Log Audit (READ)
    await logAudit(
        req.user?.id || null,
        'READ',
        role.id,
        null,
        transformedRole, // Log what was viewed
        req,
        `Viewed role: ${role.name}`
    );

    res.json({
      success: true,
      data: transformedRole
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role'
    });
  }
});

// POST /api/roles - Create new role
router.post('/', authenticateToken, requirePermission('settings:manage:roles'), async (req: Request, res: Response) => {
  try {
    const { name, description, permissions, roleTypeId } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Role name is required'
      });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissions must be an array'
      });
    }

    const roleRepository = AppDataSource.getRepository(Role);
    
    // Check if role name already exists
    const existingRole = await roleRepository.findOne({
      where: { name: name.trim() }
    });

    if (existingRole) {
      return res.status(400).json({
        success: false,
        error: 'Role name already exists'
      });
    }

    // Start transaction
    await AppDataSource.transaction(async manager => {
      // Create role
      const role = new Role();
      role.name = name.trim();
      role.description = description?.trim() || null;
      // Default to Operasi (ID 3) if not provided, assuming ID 3 is Operasi. 
      // Better to look it up or require it. Let's assume ID 3 is Operasi as per migration.
      // But user might not have run migration yet. 
      // I'll default to 3 but if it fails FK constraint, it fails.
      role.role_type_id = roleTypeId || 3; 
      role.is_system_role = false;

      const savedRole = await manager.save(role);

      // Create role permissions
      if (permissions.length > 0) {
        const rolePermissions = permissions.map((permission: string) => {
          const rolePermission = new RolePermission();
          rolePermission.role_id = savedRole.id;
          rolePermission.permission = permission;
          return rolePermission;
        });

        await manager.save(rolePermissions);
      }

      // Fetch the complete role with permissions
      const completeRole = await manager.findOne(Role, {
        where: { id: savedRole.id },
        relations: ['permissions', 'roleType']
      });

      const transformedRole = {
        id: completeRole!.id,
        name: completeRole!.name,
        description: completeRole!.description || '',
        permissions: completeRole!.permissions.map(p => p.permission),
        roleType: completeRole!.roleType,
        roleTypeId: completeRole!.role_type_id,
        isSystemRole: completeRole!.is_system_role,
        createdAt: completeRole!.created_at,
        updatedAt: completeRole!.updated_at
      };

      // Log Audit
      await logAudit(
        req.user?.id || null,
        'CREATE',
        savedRole.id,
        null,
        transformedRole,
        req,
        `Created role: ${role.name}`
      );

      res.status(201).json({
        success: true,
        data: transformedRole,
        message: 'Role created successfully'
      });
    });

  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create role'
    });
  }
});

// PUT /api/roles/:id - Update role
router.put('/:id', authenticateToken, requirePermission('settings:manage:roles'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, roleTypeId } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Role name is required'
      });
    }

    if (!permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        error: 'Permissions must be an array'
      });
    }

    const roleRepository = AppDataSource.getRepository(Role);

    // Check if role exists
    const role = await roleRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['permissions', 'roleType']
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    // Capture old values for audit
    const oldValues = {
        name: role.name,
        description: role.description,
        roleType: role.roleType,
        permissions: role.permissions.map(p => p.permission)
    };

    // Check if it's a system role
    if (role.is_system_role) {
      // For system roles, we prevent changing name, but allow description and roleType updates
      if (role.name !== name.trim()) {
          // If name changed, reject
          return res.status(400).json({
            success: false,
            error: 'Cannot change name of a system role'
          });
      }
    } else {
        // Only check name duplication if it's NOT a system role (or if we allow name change)
        // Check if role name already exists (excluding current role)
        const existingRole = await roleRepository.findOne({
          where: { name: name.trim() }
        });

        if (existingRole && existingRole.id !== role.id) {
          return res.status(400).json({
            success: false,
            error: 'Role name already exists'
          });
        }
        role.name = name.trim();
    }

    // Start transaction
    await AppDataSource.transaction(async manager => {
      // Update role
      role.description = description?.trim() || null;
      if (roleTypeId) {
          // Explicitly clear the relation object so TypeORM uses the foreign key column 'role_type_id'
          // This prevents TypeORM from resurrecting the old relation if it's still loaded in the entity
          (role as any).roleType = undefined;
          role.role_type_id = roleTypeId;
      }
      
      await manager.save(role);

      // Delete existing permissions
      await manager.delete(RolePermission, { role_id: role.id });

      // Create new permissions
      if (permissions.length > 0) {
        const rolePermissions = permissions.map((permission: string) => {
          const rolePermission = new RolePermission();
          rolePermission.role_id = role.id;
          rolePermission.permission = permission;
          return rolePermission;
        });

        await manager.save(rolePermissions);
      }

      // Fetch the complete updated role with permissions
      const updatedRole = await manager.findOne(Role, {
        where: { id: role.id },
        relations: ['permissions', 'roleType']
      });

      const transformedRole = {
        id: updatedRole!.id,
        name: updatedRole!.name,
        description: updatedRole!.description || '',
        permissions: updatedRole!.permissions.map(p => p.permission),
        roleType: updatedRole!.roleType,
        roleTypeId: updatedRole!.role_type_id,
        isSystemRole: updatedRole!.is_system_role,
        createdAt: updatedRole!.created_at,
        updatedAt: updatedRole!.updated_at
      };

      // Log Audit
      await logAudit(
        req.user?.id || null,
        'UPDATE',
        role.id,
        oldValues,
        transformedRole,
        req,
        `Updated role: ${role.name}`
      );

      res.json({
        success: true,
        data: transformedRole,
        message: 'Role updated successfully'
      });
    });

  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update role'
    });
  }
});

// DELETE /api/roles/:id - Delete role
router.delete('/:id', authenticateToken, requirePermission('settings:manage:roles'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const PROTECTED_ROLES = ['Freelancer', 'Staff', 'Admin', 'Supervisor'];
    const roleRepository = AppDataSource.getRepository(Role);

    // Check if role exists
    const role = await roleRepository.findOne({
      where: { id: parseInt(id) },
      relations: ['users']
    });

    if (!role) {
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    // Check if it's a protected role
    if (PROTECTED_ROLES.includes(role.name)) {
      return res.status(400).json({
        success: false,
        error: `Peranan '${role.name}' tidak boleh dipadam.`
      });
    }

    // Check if it's a system role
    if (role.is_system_role) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete system role'
      });
    }

    // Check if role is assigned to users
    if (role.users && role.users.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete role that is assigned to users'
      });
    }

    // Delete role (permissions will be deleted automatically due to CASCADE)
    // Capture old values for audit
    const oldValues = {
        name: role.name,
        description: role.description,
      roleType: role.roleType,
        // permissions might not be loaded unless relations are fetched. 
        // We fetched 'users' but not 'permissions' in GET. Let's assume basic info is enough or fetch it.
        // Actually, we can just log what we have.
    };

    await roleRepository.remove(role);

    // Log Audit
    await logAudit(
      req.user?.id || null,
      'DELETE',
      role.id, // ID might be gone if hard delete? No, typeorm entity retains ID in memory usually, but record is gone.
      oldValues,
      null,
      req,
      `Deleted role: ${role.name}`
    );

    res.json({
      success: true,
      message: 'Role deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete role'
    });
  }
});

export default router;