import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Generic validation middleware factory
 */
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

/**
 * Validate query parameters
 */
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Query validation failed',
        errors
      });
    }

    req.query = value;
    next();
  };
};

/**
 * Validate route parameters
 */
export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Parameter validation failed',
        errors
      });
    }

    req.params = value;
    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  // ID parameter validation
  id: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  // Pagination query validation
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('created_at')
  }),

  // Search query validation
  search: Joi.object({
    q: Joi.string().min(1).max(255),
    status: Joi.string(),
    dateFrom: Joi.date().iso(),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom'))
  })
};

// Authentication validation schemas
export const authSchemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name must not exceed 100 characters',
      'any.required': 'Name is required'
    }),
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'Password is required'
    }),
    // role_id is intentionally excluded from public registration; role is always Freelancer
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).max(20).optional().messages({
      'string.pattern.base': 'Phone number format is invalid'
    }),
    ic_number: Joi.string().pattern(/^[0-9\-]+$/).optional().messages({
      'string.pattern.base': 'IC number format is invalid'
    }),
    experience: Joi.number().integer().min(0).optional(),
    locations: Joi.array().items(
      Joi.object({
        district: Joi.string().min(1).max(100).required(),
        state: Joi.string().min(1).max(50).required()
      })
    ).optional(),
    skills: Joi.array().items(Joi.string().min(1).max(100)).optional()
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    }),
    rememberMe: Joi.boolean().optional(),
    location: Joi.object({
      status: Joi.string().valid('granted', 'denied', 'unsupported', 'error', 'timeout').required(),
      latitude: Joi.number().optional(),
      longitude: Joi.number().optional(),
      accuracy: Joi.number().optional(),
      capturedAt: Joi.string().optional(),
      error: Joi.string().allow('').optional()
    }).optional()
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number'
    }),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Passwords do not match'
    })
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
    ic_number: Joi.string().pattern(/^[0-9\-]+$/).optional(),
    experience: Joi.string().max(1000).optional(),
    is_available: Joi.boolean().optional(),
    bank_name: Joi.string().max(120).allow('').optional(),
    bank_account_number: Joi.string().max(50).allow('').optional(),
    payment_email: Joi.string().email().allow('').optional()
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    captchaAnswer: Joi.number().integer().required().messages({
      'any.required': 'Sila jawab soalan keselamatan',
      'number.base': 'Jawapan mesti nombor'
    }),
    number1: Joi.number().integer().required().messages({
      'any.required': 'Nombor pertama diperlukan untuk keselamatan'
    }),
    number2: Joi.number().integer().required().messages({
      'any.required': 'Nombor kedua diperlukan untuk keselamatan'
    })
  }),

  resetPassword: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required'
    }),
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, and one number',
      'any.required': 'New password is required'
    })
  })
};

// User validation schemas
export const userSchemas = {
  create: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role_id: Joi.number().integer().positive().required(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).max(20).optional(),
    ic_number: Joi.string().pattern(/^[0-9\-]+$/).optional(),
    experience: Joi.number().integer().min(0).max(50).optional()
  }),

  userIdParam: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
    ic_number: Joi.string().pattern(/^[0-9\-]+$/).optional(),
    experience: Joi.string().max(1000).optional(),
    is_available: Joi.boolean().optional()
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('AKTIF', 'TIDAK_AKTIF', 'DISEKAT').required(),
    ban_reason: Joi.string().when('status', {
      is: 'DISEKAT',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }),

  updateUser: Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(8).optional(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
    ic_number: Joi.string().pattern(/^[0-9\-]+$/).optional(),
    experience: Joi.number().integer().min(0).max(50).optional(),
    is_available: Joi.boolean().optional(),
    roleId: Joi.number().integer().positive().optional(),
    role_id: Joi.number().integer().positive().optional()
  }),

  updateUserStatus: Joi.object({
    status: Joi.string().valid('Aktif', 'Tidak Aktif', 'Disekat').required(),
    ban_reason: Joi.string().when('status', {
       is: 'Disekat',
       then: Joi.required(),
       otherwise: Joi.optional()
     })
  }),

  getFreelancersQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('created_at'),
    skills: Joi.string().optional(),
    location: Joi.string().optional(),
    available: Joi.boolean().optional()
  }),

    getUsersQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('created_at'),
    role: Joi.string().optional(),
    status: Joi.string().valid('Aktif', 'Tidak Aktif', 'Disekat').optional(),
    search: Joi.string().optional()
  }),  createUser: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
    role_id: Joi.number().integer().positive().required(),
    phone: Joi.string().pattern(/^[0-9+\-\s()]+$/).optional(),
    ic_number: Joi.string().pattern(/^[0-9\-]+$/).optional(),
    experience: Joi.number().integer().min(0).max(50).optional()
  }),

  updateFreelancerProfile: Joi.object({
    locations: Joi.array().items(
      Joi.object({
        district: Joi.string().max(100).required(),
        state: Joi.string().max(50).required()
      })
    ).min(1).optional(),
    skills: Joi.array().items(
      Joi.string().max(100)
    ).min(1).optional()
  })
};

// Task validation schemas
export const taskSchemas = {
  create: Joi.object({
    title: Joi.string().min(1).max(255).allow('').optional(),
    log_number: Joi.string().max(50).allow('').optional(),
    description: Joi.string().allow('').optional(),
    support_type: Joi.string().max(100).optional(),
    support_type_id: Joi.number().integer().positive().optional(),
    status_id: Joi.number().integer().positive().optional(),
    client_location: Joi.string().max(255).required(),
    bandar_daerah: Joi.string().max(255).allow('').optional(),
    state: Joi.string().max(50).required(),
    deadline: Joi.date().iso().optional(),
    offer_price: Joi.number().min(0).precision(2).optional()
  }).or('support_type', 'support_type_id'),

  update: Joi.object({
    title: Joi.string().min(5).max(255).optional(),
    description: Joi.string().min(10).optional(),
    support_type: Joi.string().max(100).optional(),
    support_type_id: Joi.number().integer().positive().optional(),
    status_id: Joi.number().integer().positive().optional(),
    client_location: Joi.string().max(255).optional(),
    bandar_daerah: Joi.string().max(255).allow('').optional(),
    state: Joi.string().max(50).optional(),
    deadline: Joi.date().iso().optional(),
    offer_price: Joi.number().positive().precision(2).optional(),
    remarks: Joi.string().max(1000).allow('').optional()
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid(
      'Baru',
      'Tawaran Dihantar',
      'Telah Diambil',
      'Selesai',
      'Borang Disemak & Pembayaran Tertunggak',
      'Telah Dibayar',
      'Dibatalkan',
      'Selesai Penuh'
    ).required(),
    remarks: Joi.string().max(1000).optional()
  }),

  assign: Joi.object({
    assigned_to: Joi.number().integer().positive().required()
  }),

  taskIdParam: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  deleteAttachmentParam: Joi.object({
    id: Joi.number().integer().positive().required(),
    attachmentId: Joi.number().integer().positive().required()
  }),

  updateTaskStatus: Joi.object({
    status: Joi.string().valid(
      'Baru',
      'Tawaran Dihantar',
      'Telah Diambil',
      'Selesai',
      'Borang Disemak & Pembayaran Tertunggak',
      'Telah Dibayar',
      'Dibatalkan',
      'Selesai Penuh'
    ).required(),
    remarks: Joi.string().max(1000).optional()
  }),

  assignTask: Joi.object({
    assigned_to: Joi.number().integer().positive().allow(null).required()
  }),












    createTask: Joi.object({
    title: Joi.string().required(),
    log_number: Joi.string().max(50).allow('').optional(),
    description: Joi.string().required(),
    support_type: Joi.string().max(100).optional(),
    support_type_id: Joi.number().integer().positive().optional(),
    status_id: Joi.number().integer().positive().optional(),
    client_location: Joi.string().max(255).required(),
    bandar_daerah: Joi.string().max(255).allow('').optional(),
    state: Joi.string().max(50).required(),
    deadline: Joi.date().iso().optional(),
    deadline_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).allow('', null).optional(),
    requirement_date: Joi.date().iso().required(),
    requirement_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).required(),
    offer_price: Joi.number().positive().precision(2).required(),

    status: Joi.string().allow('').optional(),
    remarks: Joi.string().max(1000).allow('').optional(),
    project_id: Joi.number().integer().positive().optional(),
    main_con_id: Joi.number().integer().positive().optional(),
    pic_name: Joi.string().max(255).allow('').optional(),
    pic_phone: Joi.string().max(50).allow('').optional(),
    client_name: Joi.string().max(255).allow('').optional(),
    asset_tag_id: Joi.string().max(100).allow('').optional(),
    asset_brand: Joi.string().max(100).allow('').optional(),
    asset_model: Joi.string().max(100).allow('').optional(),
    asset_serial_number: Joi.string().max(100).allow('').optional(),
    branch_name: Joi.string().max(255).allow('').optional(),
    service_start_date: Joi.date().iso().optional(),
    service_start_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).allow('').optional(),
    equipment_types_id: Joi.alternatives().try(
      Joi.string(),
      Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number().integer().positive()))
    ).optional(),
    links: Joi.alternatives().try(
      Joi.array().items(
        Joi.object({
          url: Joi.string().uri().required(),
          description: Joi.string().allow('').optional()
        })
      ),
      Joi.string()
    ).optional()
  }).or('support_type', 'support_type_id'),

























    updateTask: Joi.object({
    title: Joi.string().min(5).max(255).optional(),
    description: Joi.string().min(10).optional(),
    support_type: Joi.string().max(100).optional(),
    support_type_id: Joi.number().integer().positive().optional(),
    status_id: Joi.number().integer().positive().optional(),
    client_location: Joi.string().max(255).optional(),
    bandar_daerah: Joi.string().max(255).allow('').optional(),
    state: Joi.string().max(50).optional(),
    deadline: Joi.date().iso().optional(),
    deadline_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).allow('', null).optional(),
    offer_price: Joi.number().positive().precision(2).optional(),
    remarks: Joi.string().max(1000).allow('').optional(),
    project_id: Joi.number().integer().positive().allow(null).optional(),
    main_con_id: Joi.number().integer().positive().optional(),
    pic_name: Joi.string().max(255).allow('').optional(),
    pic_phone: Joi.string().max(50).allow('').optional(),
    client_name: Joi.string().max(255).allow('').optional(),
    asset_tag_id: Joi.string().max(100).allow('').optional(),
    asset_brand: Joi.string().max(100).allow('').optional(),
    asset_model: Joi.string().max(100).allow('').optional(),
    asset_serial_number: Joi.string().max(100).allow('').optional(),
    branch_name: Joi.string().max(255).allow('').optional(),
    service_start_date: Joi.date().iso().optional().allow(null),
    service_start_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).allow('', null).optional(),
    requirement_date: Joi.date().iso().optional(),
    requirement_time: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/).allow('').optional(),
    equipment_types_id: Joi.alternatives().try(

      Joi.string(),
      Joi.array().items(Joi.string())
    ).optional()
  }),

  getTasksQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().default('created_at'),
    status: Joi.string().optional().allow(''),
    assigned_to: Joi.number().integer().positive().optional(),
    client_id: Joi.number().integer().positive().optional(),
    search: Joi.string().optional().allow(''),
    q: Joi.string().optional().allow(''),
    category: Joi.string().optional().allow(''),
    support_type: Joi.string().optional().allow(''),
    dateFrom: Joi.date().iso().optional().allow(''),
    dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional().allow(''),
    state: Joi.string().optional().allow(''),
    created_by: Joi.number().integer().positive().optional(),
    project_id: Joi.number().integer().positive().optional(),
    startDate: Joi.date().iso().optional().allow(''),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional().allow('')
  })
};

// Task report validation schemas
export const reportSchemas = {
  submit: Joi.object({
    notes: Joi.string().max(1000).optional()
  }),

  submitReport: Joi.object({
    notes: Joi.string().max(1000).optional()
  })
};

// Feedback validation schemas
export const feedbackSchemas = {
  submit: Joi.object({
    skill_rating: Joi.number().integer().min(1).max(5).required(),
    communication_rating: Joi.number().integer().min(1).max(5).required(),
    time_punctuality_rating: Joi.number().integer().min(1).max(5).required(),
    response_time_rating: Joi.number().integer().min(1).max(5).required(),
    overall_rating: Joi.number().integer().min(1).max(5).optional(),
    comment: Joi.string().max(1000).optional()
  }),

  submitFeedback: Joi.object({
    skill_rating: Joi.number().integer().min(1).max(5).required(),
    communication_rating: Joi.number().integer().min(1).max(5).required(),
    time_punctuality_rating: Joi.number().integer().min(1).max(5).required(),
    response_time_rating: Joi.number().integer().min(1).max(5).required(),
    overall_rating: Joi.number().integer().min(1).max(5).optional(),
    comment: Joi.string().max(1000).optional()
  })
};

// Freelancer profile validation schemas
export const freelancerSchemas = {
  updateProfile: Joi.object({
    name: Joi.string().max(255).optional(),
    phone: Joi.string().max(20).optional(),
    ic_number: Joi.string().max(20).optional(),
    experience: Joi.number().integer().min(0).max(50).optional(),
    bank_name: Joi.string().max(120).allow('').optional(),
    bank_account_number: Joi.string().max(50).allow('').optional(),
    payment_email: Joi.string().email().allow('').optional(),
    locations: Joi.array().items(
      Joi.object({
        district: Joi.string().required(),
        state: Joi.string().required()
      })
    ).optional(),
    skills: Joi.array().items(Joi.string().max(50)).max(20).optional(),
    hourly_rate: Joi.number().positive().max(10000).optional(),
    availability: Joi.string().valid('available', 'busy', 'unavailable').optional(),
    bio: Joi.string().max(1000).optional(),
    portfolio_url: Joi.string().uri().optional(),
    location: Joi.string().max(100).optional()
  }),

  getFreelancersQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    skills: Joi.array().items(Joi.string().max(50)).optional(),
    availability: Joi.string().valid('available', 'busy', 'unavailable').optional(),
    min_rate: Joi.number().positive().optional(),
    max_rate: Joi.number().positive().optional(),
    location: Joi.string().max(100).optional(),
    experience_min: Joi.number().integer().min(0).optional(),
    experience_max: Joi.number().integer().min(0).optional(),
    sort_by: Joi.string().valid('name', 'hourly_rate', 'experience', 'created_at').default('created_at'),
    sort_order: Joi.string().valid('asc', 'desc').default('desc')
  }),

  updateAvailability: Joi.object({
    availability: Joi.string().valid('available', 'busy', 'unavailable').required()
  }),

  bankAccountParams: Joi.object({
    id: Joi.number().integer().positive().required(),
    accountId: Joi.number().integer().positive().required()
  }),

  createBankAccount: Joi.object({
    bank_name: Joi.string().max(120).required(),
    account_holder_name: Joi.string().max(120).required(),
    account_number: Joi.string().max(50).required(),
    is_default: Joi.boolean().optional()
  }),

  updateBankAccount: Joi.object({
    bank_name: Joi.string().max(120).optional(),
    account_holder_name: Joi.string().max(120).optional(),
    account_number: Joi.string().max(50).optional(),
    is_default: Joi.boolean().optional()
  })
};

// System validation schemas
export const systemSchemas = {
  exportLogsQuery: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
    level: Joi.string().valid('error', 'warn', 'info', 'debug').optional(),
    format: Joi.string().valid('json', 'csv').default('json')
  }),

  settingKeyParam: Joi.object({
    key: Joi.string().required()
  }),

  getActivityLogsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    user_id: Joi.number().integer().positive().optional(),
    action: Joi.string().optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
  })
};

// Notification validation schemas
export const notificationSchemas = {
  markAsRead: Joi.object({
    notification_ids: Joi.array().items(Joi.number().integer().positive()).min(1).required()
  }),

  getNotificationsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    is_read: Joi.boolean().optional(),
    type: Joi.string().optional()
  }),

  notificationIdParam: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  createNotification: Joi.object({
    user_id: Joi.number().integer().positive().required(),
    title: Joi.string().max(255).required(),
    message: Joi.string().max(1000).required(),
    type: Joi.string().max(50).optional(),
    data: Joi.object().optional()
  }),

  broadcastNotification: Joi.object({
    title: Joi.string().max(255).required(),
    message: Joi.string().max(1000).required(),
    type: Joi.string().max(50).optional(),
    role_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
    user_ids: Joi.array().items(Joi.number().integer().positive()).optional(),
    data: Joi.object().optional()
  })
};

export const projectSchemas = {
  createProject: Joi.object({
    code: Joi.string().max(50).required(),
    name: Joi.string().min(3).max(255).required(),
    client_name: Joi.string().max(255).allow('').optional(),
    description: Joi.string().max(2000).allow('').optional(),
    status: Joi.string().valid('Aktif', 'Selesai', 'Dibatalkan').optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).optional(),
    budget: Joi.number().positive().precision(2).optional(),
    main_con_id: Joi.number().integer().positive().optional().allow(null)
  }),

  updateProject: Joi.object({
    code: Joi.string().max(50).optional(),
    name: Joi.string().min(3).max(255).optional(),
    client_name: Joi.string().max(255).allow('').optional(),
    description: Joi.string().max(2000).allow('').optional(),
    status: Joi.string().valid('Aktif', 'Selesai', 'Dibatalkan').optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
    budget: Joi.number().positive().precision(2).optional(),
    main_con_id: Joi.number().integer().positive().optional().allow(null)
  }),

  projectIdParam: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  getProjectsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().valid('created_at', 'updated_at', 'name', 'code', 'status').default('created_at'),
    q: Joi.string().optional().allow(''),
    status: Joi.string().valid('Aktif', 'Selesai', 'Dibatalkan').optional().allow('')
  })
};

export const masterlistSchemas = {
  createMasterlist: Joi.object({
    project_id: Joi.number().integer().positive().required(),
    code: Joi.string().max(50).required(),
    name: Joi.string().min(3).max(255).required(),
    description: Joi.string().max(2000).allow('').optional(),
    status: Joi.string().valid('Aktif', 'Tidak Aktif').optional(),
    link_url: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
    link_title: Joi.string().max(255).optional(),
    links: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            title: Joi.string().max(255).required(),
            url: Joi.string().uri({ scheme: ['http', 'https'] }).required()
          })
        ),
        Joi.string().allow('')
      )
      .optional(),
    document_title: Joi.string().max(255).optional()
  }).and('link_url', 'link_title'),

  updateMasterlist: Joi.object({
    project_id: Joi.number().integer().positive().optional(),
    code: Joi.string().max(50).optional(),
    name: Joi.string().min(3).max(255).optional(),
    description: Joi.string().max(2000).allow('').optional(),
    status: Joi.string().valid('Aktif', 'Tidak Aktif').optional(),
    link_url: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
    link_title: Joi.string().max(255).optional(),
    links: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            title: Joi.string().max(255).required(),
            url: Joi.string().uri({ scheme: ['http', 'https'] }).required()
          })
        ),
        Joi.string().allow('')
      )
      .optional(),
    document_title: Joi.string().max(255).optional()
  }).and('link_url', 'link_title'),

  masterlistIdParam: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  masterlistItemIndexParam: Joi.object({
    id: Joi.number().integer().positive().required(),
    index: Joi.number().integer().min(0).required()
  }),

  duplicateMasterlist: Joi.object({
    project_id: Joi.number().integer().positive().optional(),
    code: Joi.string().max(50).optional(),
    name: Joi.string().min(3).max(255).optional(),
    include_assets: Joi.boolean().optional()
  }),

  getMasterlistsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().valid('created_at', 'updated_at', 'name', 'code', 'status').default('created_at'),
    q: Joi.string().allow('').optional(),
    status: Joi.string().valid('Aktif', 'Tidak Aktif').allow('').optional(),
    project_id: Joi.number().integer().positive().optional()
  })
};

export const assetSchemas = {
  createAsset: Joi.object({
    masterlist_id: Joi.number().integer().positive().required(),
    asset_tag: Joi.string().max(100).allow('').optional(),
    name: Joi.string().min(2).max(255).required(),
    category_id: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.valid(null, '')
    ).optional(),
    brand_id: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.valid(null, '')
    ).optional(),
    model: Joi.string().max(100).allow('').optional(),
    serial_number: Joi.string().max(120).required(),
    group: Joi.string().max(255).allow('').optional(),
    location: Joi.string().max(255).allow('').optional(),
    status: Joi.string().valid('Aktif', 'Tidak Aktif', 'Rosak', 'Lupus').optional(),
    notes: Joi.string().max(2000).allow('').optional(),
    accessories: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('monitor', 'keyboard', 'mouse', 'other').required(),
        asset_id: Joi.number().integer().positive().required(),
        notes: Joi.string().max(255).allow('', null).optional()
      })
    ).optional()
  }),

  updateAsset: Joi.object({
    masterlist_id: Joi.number().integer().positive().optional(),
    asset_tag: Joi.string().max(100).allow('').optional(),
    name: Joi.string().min(2).max(255).optional(),
    category_id: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.valid(null, '')
    ).optional(),
    brand_id: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.valid(null, '')
    ).optional(),
    model: Joi.string().max(100).allow('').optional(),
    serial_number: Joi.string().max(120).optional(),
    group: Joi.string().max(255).allow('').optional(),
    location: Joi.string().max(255).allow('').optional(),
    status: Joi.string().valid('Aktif', 'Tidak Aktif', 'Rosak', 'Lupus').optional(),
    notes: Joi.string().max(2000).allow('').optional(),
    accessories: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('monitor', 'keyboard', 'mouse', 'other').required(),
        asset_id: Joi.number().integer().positive().required(),
        notes: Joi.string().max(255).allow('', null).optional()
      })
    ).optional()
  }),

  assetIdParam: Joi.object({
    id: Joi.number().integer().positive().required()
  }),

  getAssetsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sort: Joi.string().valid('asc', 'desc').default('desc'),
    sortBy: Joi.string().valid('created_at', 'updated_at', 'name', 'asset_tag', 'status').default('created_at'),
    q: Joi.string().allow('').optional(),
    status: Joi.string().valid('Aktif', 'Tidak Aktif', 'Rosak', 'Lupus').allow('').optional(),
    masterlist_id: Joi.number().integer().positive().optional(),
    project_id: Joi.number().integer().positive().optional()
  }),

  importAssets: Joi.object({
    masterlist_id: Joi.number().integer().positive().required(),
    rows: Joi.array().items(
      Joi.object({
        asset_tag: Joi.string().max(100).allow('').optional(),
        name: Joi.string().min(1).max(255).required(),
        category: Joi.string().max(255).allow('').optional(),
        brand: Joi.string().max(255).allow('').optional(),
        model: Joi.string().max(100).allow('').optional(),
        serial_number: Joi.string().max(120).allow('').optional(),
        group: Joi.string().max(255).allow('').optional(),
        status: Joi.string().valid('Aktif', 'Tidak Aktif', 'Rosak', 'Lupus').optional(),
        notes: Joi.string().max(2000).allow('').optional(),
        user_name: Joi.string().max(255).allow('').optional(),
        position: Joi.string().max(255).allow('').optional(),
        floor: Joi.string().max(255).allow('').optional(),
        building: Joi.string().max(255).allow('').optional(),
        location: Joi.string().max(255).allow('').optional(),
        branch: Joi.string().max(255).allow('').optional(),
        state: Joi.string().max(255).allow('').optional()
      })
    ).required(),
    columnMapping: Joi.object().optional()
  })
};
