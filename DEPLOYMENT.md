# SPFIT System Deployment Guide

## Prerequisites

1. **Database Setup**
   - Set up a production MySQL database (recommended: PlanetScale, AWS RDS, or similar)
   - Note down the connection details (host, port, database name, username, password)

2. **Environment Variables**
   - Copy `.env.production` to `.env.local` or configure in your deployment platform
   - Update all placeholder values with your production credentials

## Deployment Steps

### 1. Prepare for Deployment

```bash
# Install dependencies
npm install

# Build the project
npm run build:production

# Test the build locally (optional)
npm run preview
```

### 2. Database Migration

Before deploying, ensure your production database is set up:

```sql
-- Run the migration script on your production database
-- File: api/migrations/001_initial_schema.sql
```

### 3. Deploy to Vercel

#### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

#### Option B: Using Git Integration

1. Push your code to GitHub/GitLab/Bitbucket
2. Connect your repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy automatically on push

### 4. Environment Variables Configuration

In your Vercel dashboard, add these environment variables:

```
DB_HOST=your-production-db-host
DB_PORT=3306
DB_NAME=spfit_production
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
JWT_SECRET=your-super-secure-jwt-secret
JWT_EXPIRES_IN=7d
NODE_ENV=production
UPLOAD_MAX_SIZE=10485760
UPLOAD_ALLOWED_TYPES=jpg,jpeg,png,gif,pdf,doc,docx
FRONTEND_URL=https://your-domain.vercel.app
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=noreply@yourdomain.com
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
API_BASE_URL=https://your-domain.vercel.app/api
```

### 5. Post-Deployment Verification

1. **Health Check**: Visit `https://your-domain.vercel.app/api/system/health`
2. **Database Connection**: Verify database connectivity
3. **Authentication**: Test login functionality
4. **File Upload**: Test file upload features
5. **Email**: Test email notifications

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Verify database credentials
   - Check database server accessibility
   - Ensure database exists and migrations are applied

2. **Environment Variables**
   - Verify all required environment variables are set
   - Check for typos in variable names
   - Ensure sensitive values are properly escaped

3. **Build Errors**
   - Run `npm run build:production` locally to identify issues
   - Check TypeScript compilation errors
   - Verify all dependencies are installed

4. **API Routes Not Working**
   - Check Vercel function logs
   - Verify API routes are properly configured
   - Ensure serverless function limits are not exceeded

### Monitoring

- Use Vercel Analytics for performance monitoring
- Set up error tracking (Sentry, LogRocket, etc.)
- Monitor database performance and connections
- Set up uptime monitoring

## Security Considerations

1. **Environment Variables**: Never commit production credentials to version control
2. **Database**: Use strong passwords and restrict access
3. **JWT Secret**: Use a cryptographically secure random string
4. **HTTPS**: Ensure all communications use HTTPS
5. **Rate Limiting**: Configure appropriate rate limits for your use case
6. **CORS**: Set specific origins instead of wildcards

## Backup Configuration (CRITICAL FOR VPS DEPLOYMENT)

### Path Configuration by Platform

The `BACKUP_PATH` environment variable uses **absolute filesystem paths**. This must be different for each platform:

#### Windows Local Development
```
BACKUP_PATH=D:\SPFIT_Backups
# or any Windows absolute path:
BACKUP_PATH=E:\Projects\MyApp\backups
```

#### Linux/macOS Local Development
```
BACKUP_PATH=/home/username/spfit_backups
# or
BACKUP_PATH=/Users/username/spfit_backups
```

#### Linux VPS/Server (Recommended)
```
# Option 1: Under home directory
BACKUP_PATH=/home/ubuntu/spfit_backups

# Option 2: Using standard /var/www location
BACKUP_PATH=/var/www/spfit/backups

# Option 3: Separate data drive
BACKUP_PATH=/data/backups/spfit
```

#### Windows Server (VPS)
```
BACKUP_PATH=E:\app\spfit\backups
# or
BACKUP_PATH=D:\backups\spfit
```

### VPS Setup Instructions

When deploying to a Linux VPS:

#### 1. Create Backup Directory
```bash
# SSH into your VPS
ssh user@your-vps-ip

# Create backup directory (example using /var/www)
sudo mkdir -p /var/www/spfit/backups

# Set proper permissions (replace 'appuser' with actual app user)
sudo chown appuser:appuser /var/www/spfit/backups
sudo chmod 755 /var/www/spfit/backups
```

#### 2. Configure Environment Variable
In your VPS `.env` or deployment platform environment variables:
```
BACKUP_PATH=/var/www/spfit/backups
GITHUB_TOKEN=your-github-pat-token
SERVER_HOST=0.0.0.0
NODE_ENV=production
```

#### 3. Enable Automatic Directory Creation
The application automatically creates the backup directory if it doesn't exist, but ensure your app user has write permissions.

### Backup API Endpoints

Access backups through secure authenticated endpoints (Admin only):

```bash
# List all available backups
GET /api/system/backups
# Response: { success, data: { files: [...], total: 0 } }

# Download specific backup file
GET /api/system/backups/download/:fileName
# Example: /api/system/backups/download/backup-2026-04-02.sql
# Returns: File download (binary)
```

### Security Features

- ✅ **Path Traversal Protection**: Prevents `../` or invalid filenames
- ✅ **Directory Boundary Check**: Ensures files stay within backup folder
- ✅ **Authentication Required**: Only admin users can access
- ✅ **Activity Logging**: All downloads logged with user, IP, timestamp
- ✅ **File Validation**: Checks file exists before sending

### Common VPS Backup Paths

| OS | Standard Path | Alternative |
|----|---------------|-------------|
| Linux (CentOS/RHEL) | `/var/www/spfit/backups` | `/opt/spfit/backups` |
| Linux (Ubuntu/Debian) | `/var/www/spfit/backups` | `/home/appuser/backups` |
| Windows Server | `E:\backups\spfit` | `D:\app\backups` |

## Maintenance

- Regularly update dependencies
- Monitor database performance
- Review and rotate secrets periodically
- Keep backups of your database
- Monitor application logs for errors
- Verify backup directory permissions on VPS
- Monitor backup disk usage to prevent full disks

---

For additional support, refer to the technical documentation or contact the development team.