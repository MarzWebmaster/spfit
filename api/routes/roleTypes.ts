import { Router, Request, Response } from 'express';
import { AppDataSource } from '../config/database.ts';
import { RoleType } from '../models/RoleType.ts';
import { authenticateToken, requirePermission } from '../middleware/auth.ts';

const router = Router();
const CANONICAL_ROLE_TYPES = [
  { id: 1, name: 'Admin', description: 'Administrative' },
  { id: 2, name: 'Management', description: 'Management' },
  { id: 3, name: 'Associate Partner', description: 'Operational' },
  { id: 4, name: 'Freelancer', description: 'External' }
];

// GET /api/role-types - Get all role types
router.get('/', authenticateToken, requirePermission('settings:manage:roles'), async (req: Request, res: Response) => {
  try {
    const roleTypeRepository = AppDataSource.getRepository(RoleType);
    const roleTypes = await roleTypeRepository
      .createQueryBuilder('roleType')
      .where('roleType.id IN (:...ids)', { ids: CANONICAL_ROLE_TYPES.map(rt => rt.id) })
      .orderBy('FIELD(roleType.id, 1, 2, 3, 4)')
      .getMany();

    const roleTypeById = new Map(roleTypes.map(rt => [rt.id, rt]));
    const normalizedRoleTypes = CANONICAL_ROLE_TYPES.map(defaultType => {
      const fromDb = roleTypeById.get(defaultType.id);
      return fromDb
        ? {
            ...fromDb,
            id: defaultType.id,
            name: defaultType.name,
            description: defaultType.description,
          }
        : defaultType;
    });

    res.json({
      success: true,
      data: normalizedRoleTypes
    });
  } catch (error) {
    console.error('Error fetching role types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role types',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;
