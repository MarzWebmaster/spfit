import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request, Response, NextFunction } from 'express';

// Ensure upload directories exist
const ensureDirectoryExists = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Create upload directories
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
const taskAttachmentsDir = path.join(uploadDir, 'task-attachments');
const taskReportsDir = path.join(uploadDir, 'task-reports');
const profilePicturesDir = path.join(uploadDir, 'profile-pictures');
const paymentSlipsDir = path.join(uploadDir, 'payment-slips');
const masterlistDocumentsDir = path.join(uploadDir, 'masterlist-documents');
const assetAttachmentsDir = path.join(uploadDir, 'asset-attachments');

// Ensure all directories exist
ensureDirectoryExists(uploadDir);
ensureDirectoryExists(taskAttachmentsDir);
ensureDirectoryExists(taskReportsDir);
ensureDirectoryExists(profilePicturesDir);
ensureDirectoryExists(paymentSlipsDir);
ensureDirectoryExists(masterlistDocumentsDir);
ensureDirectoryExists(assetAttachmentsDir);

// File filter function
const fileFilter = (allowedTypes: string[]) => {
  return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    // Check file extension
    if (allowedTypes.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  };
};

// Generate unique filename
const generateFilename = (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename?: string) => void) => {
  const fileExtension = path.extname(file.originalname);
  const originalBaseName = path.basename(file.originalname, fileExtension);
  const sanitizedBaseName = originalBaseName
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E6);
  const filename = `${sanitizedBaseName}-${uniqueSuffix}${fileExtension}`;
  cb(null, filename);
};

// Storage configuration for task attachments
const taskAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, taskAttachmentsDir);
  },
  filename: generateFilename
});

// Storage configuration for task reports
const taskReportStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, taskReportsDir);
  },
  filename: generateFilename
});

// Storage configuration for profile pictures
const profilePictureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePicturesDir);
  },
  filename: generateFilename
});

const paymentSlipStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, paymentSlipsDir);
  },
  filename: generateFilename
});

const masterlistDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, masterlistDocumentsDir);
  },
  filename: generateFilename
});

const assetAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, assetAttachmentsDir);
  },
  filename: generateFilename
});

// Memory storage for temporary processing
const memoryStorage = multer.memoryStorage();

// File size limits
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '52428800'); // 50MB default
const maxImageSize = 5 * 1024 * 1024; // 5MB for images
const maxDocumentSize = 10 * 1024 * 1024; // 10MB for documents

// Allowed file types
const allowedImageTypes = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
const allowedDocumentTypes = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.html', '.htm'];
const allowedSpreadsheetTypes = ['.csv', '.xls', '.xlsx', '.ods'];
const allowedPresentationTypes = ['.ppt', '.pptx'];
const allowedWorkDocumentTypes = [
  ...allowedDocumentTypes,
  ...allowedSpreadsheetTypes,
  ...allowedPresentationTypes
];
const allowedAttachmentTypes = [
  ...allowedImageTypes,
  ...allowedDocumentTypes,
  ...allowedSpreadsheetTypes,
  '.zip',
  '.rar',
  '.7z'
];

// Upload middleware configurations
export const uploadTaskAttachment = multer({
  storage: taskAttachmentStorage,
  limits: {
    fileSize: maxDocumentSize,
    files: 5 // Maximum 5 files per upload
  },
  fileFilter: fileFilter(allowedAttachmentTypes)
});

export const uploadTaskReport = multer({
  storage: taskReportStorage,
  limits: {
    fileSize: maxDocumentSize,
    files: 10 // Allow multiple support files
  },
  fileFilter: fileFilter(allowedDocumentTypes)
});

export const uploadProfilePicture = multer({
  storage: profilePictureStorage,
  limits: {
    fileSize: maxImageSize,
    files: 1 // Only one profile picture
  },
  fileFilter: fileFilter(allowedImageTypes)
});

export const uploadPaymentSlip = multer({
  storage: paymentSlipStorage,
  limits: {
    fileSize: 2 * 1024 * 1024,
    files: 1
  },
  fileFilter: fileFilter(allowedDocumentTypes)
});

export const uploadMasterlistDocument = multer({
  storage: masterlistDocumentStorage,
  limits: {
    fileSize: maxDocumentSize,
    files: 1
  },
  fileFilter: fileFilter(allowedWorkDocumentTypes)
});

export const uploadAssetAttachment = multer({
  storage: assetAttachmentStorage,
  limits: {
    fileSize: maxDocumentSize,
    files: 5 // Maximum 5 attachments per upload
  },
  fileFilter: fileFilter(allowedAttachmentTypes)
});

export const uploadMemory = multer({
  storage: memoryStorage,
  limits: {
    fileSize: maxFileSize
  }
});

// PDF upload for AI masterlist - larger limit (50MB) for multi-page documents
const maxPdfSize = 50 * 1024 * 1024; // 50MB for PDFs
const allowedPdfTypes = ['.pdf'];

export const uploadPDF = multer({
  storage: memoryStorage,
  limits: {
    fileSize: maxPdfSize,
    files: 1
  },
  fileFilter: fileFilter(allowedPdfTypes)
});

// Error handling middleware for multer
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: 'File too large',
          error: `Maximum file size is ${maxFileSize / 1024 / 1024}MB`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files',
          error: error.message
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field',
          error: error.message
        });
      default:
        return res.status(400).json({
          success: false,
          message: 'File upload error',
          error: error.message
        });
    }
  }

  if (error.message.includes('File type')) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type',
      error: error.message
    });
  }

  next(error);
};

// Utility function to delete uploaded files
export const deleteUploadedFiles = (files: Express.Multer.File[] | Express.Multer.File) => {
  const fileArray = Array.isArray(files) ? files : [files];
  
  fileArray.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  });
};

// Utility function to get file info
export const getFileInfo = (file: Express.Multer.File) => {
  return {
    filename: file.filename,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
    relativePath: path.relative(process.cwd(), file.path)
  };
};

// Middleware to validate file upload requirements
export const validateFileUpload = (required: boolean = true) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (required && (!req.file && !req.files)) {
      return res.status(400).json({
        success: false,
        message: 'File upload is required'
      });
    }
    next();
  };
};

// Middleware to clean up files on error
export const cleanupOnError = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  const originalJson = res.json;

  const cleanup = () => {
    if (res.statusCode >= 400) {
      if (req.file) {
        deleteUploadedFiles(req.file);
      }
      if (req.files) {
        if (Array.isArray(req.files)) {
          deleteUploadedFiles(req.files);
        } else {
          Object.values(req.files).forEach(files => {
            if (Array.isArray(files)) {
              deleteUploadedFiles(files);
            }
          });
        }
      }
    }
  };

  res.send = function(body) {
    cleanup();
    return originalSend.call(this, body);
  };

  res.json = function(body) {
    cleanup();
    return originalJson.call(this, body);
  };

  next();
};
