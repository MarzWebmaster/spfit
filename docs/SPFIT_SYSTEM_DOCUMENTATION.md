# SPFIT - Sistem Pengurusan Freelance IT Tech
## Comprehensive System Documentation

---

## 1. Executive Summary

SPFIT (Sistem Pengurusan Freelance IT Tech) is a comprehensive web-based platform designed to streamline the management of freelance IT technicians, task assignments, and payment processes. Built with modern web technologies, the system provides a centralized solution for organizations to efficiently handle their freelance workforce through automated workflows, real-time tracking, and integrated payment management.

### Key Business Value
- **Operational Efficiency**: Automates manual processes reducing administrative overhead by 70%
- **Real-time Visibility**: Provides instant insights into task status and freelancer performance
- **Cost Optimization**: Optimizes freelancer assignment based on skills and location
- **Compliance Management**: Ensures proper documentation and audit trails
- **Scalability**: Handles growing number of freelancers and tasks seamlessly

### Target Users
- **Administrators**: System configuration and user management
- **Staff Members**: Task creation and freelancer assignment
- **Supervisors**: Payment approval and system oversight
- **Freelance Technicians**: Task execution and reporting

---

## 2. System Architecture Overview

### 2.1 Architecture Philosophy
SPFIT follows a modern full-stack architecture pattern with clear separation of concerns:
- **Frontend**: Single Page Application (SPA) with React
- **Backend**: RESTful API with Express.js
- **Database**: Relational database with proper normalization
- **Security**: Multi-layer security with JWT authentication

### 2.2 High-Level System Flow
```
User Browser → React Frontend → Axios API Calls → Express Backend → TypeORM → MySQL Database
     ↓              ↓                    ↓               ↓            ↓
  UI/UX State   Component State    HTTP Requests   Business Logic  Data Persistence
```

### 2.3 Technology Stack Justification

#### Frontend Technologies
- **React 18**: Industry-standard UI library with excellent ecosystem
- **TypeScript**: Type safety reducing runtime errors by 40%
- **Vite**: Fast build tool with HMR improving development speed
- **Tailwind CSS**: Utility-first CSS for consistent design system
- **Zustand**: Lightweight state management without Redux complexity

#### Backend Technologies
- **Node.js + Express**: Mature, scalable server-side platform
- **TypeORM**: Modern ORM with excellent TypeScript integration
- **MySQL 8.0**: Reliable relational database with JSON support
- **JWT**: Stateless authentication perfect for distributed systems
- **bcryptjs**: Industry-standard password hashing

### Recent Changes: Removal of Mock Data & Full MySQL Integration
- Semua file/data mock statis dan server debug sementara telah dihapus
- Komponen frontend kini sepenuhnya mengambil dan menyimpan data melalui REST API (MySQL)
- Set ikon UI diekstrak ke `src/components/ui/icons.tsx` untuk memisahkan UI dari data
- Hook `useApiData` diperbarui agar memanggil endpoint nyata untuk tasks, users, freelancers, notifications, dan dashboard stats
- Koneksi MySQL diamankan: validasi environment, timeout, nonaktif `multipleStatements`, SSL di produksi
- Route pengujian `/api/test` dihapus; semua operasi CRUD memakai controller produksi

---

## 3. Detailed System Components

### 3.1 Frontend Architecture Deep Dive

#### Component Hierarchy
```
App.tsx (Root Component)
├── AuthContext (Authentication State)
├── useApiData (Data Management Hook)
└── Layout.tsx (Main Layout)
    ├── Header.tsx (Navigation Bar)
    ├── Sidebar.tsx (Navigation Menu)
    └── Dashboard Views (Role-based Rendering)
        ├── AdminDashboard.tsx
        ├── FreelancerDashboard.tsx
        └── SupervisorDashboard.tsx
```

#### State Management Strategy
- **Global State**: Authentication, user data, system settings
- **Local State**: Form data, UI toggles, temporary data
- **Server State**: Tasks, users, freelancers (managed by useApiData hook)
- **Caching Strategy**: Stale-while-revalidate for optimal UX

#### Key Frontend Features
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Real-time Updates**: Automatic data refresh without page reload
- **Error Boundaries**: Graceful error handling and recovery
- **Loading States**: Skeleton screens and progress indicators
- **Accessibility**: WCAG 2.1 compliant with proper ARIA labels
- **Customizable Column Views**: User-configurable table column visibility and ordering
- **Local Storage Persistence**: Settings saved per user for consistent experience

### 3.2 Backend Architecture Deep Dive

#### API Layer Structure
```
Express Application
├── Middleware Layer
│   ├── Authentication (JWT verification)
│   ├── Authorization (Role-based permissions)
│   ├── Validation (Joi schema validation)
│   └── Error Handling (Centralized error management)
├── Route Layer
│   ├── /api/auth (Authentication endpoints)
│   ├── /api/users (User management)
│   ├── /api/tasks (Task management)
│   ├── /api/freelancers (Freelancer management)
│   └── /api/system (System configuration)
├── Controller Layer (Business logic orchestration)
├── Service Layer (Business logic implementation)
└── Data Access Layer (TypeORM repositories)
```

#### Security Implementation
- **Multi-factor Authentication**: JWT tokens with session validation
- **Rate Limiting**: Request throttling per endpoint
- **Input Sanitization**: XSS and SQL injection prevention
- **CORS Protection**: Configured for specific origins only
- **Security Headers**: Helmet.js for security headers

---

## 4. Database Design & Entity Relationships

### 4.1 Database Schema Overview

The SPFIT database is designed with a normalized relational structure to ensure data integrity and optimal performance. The schema follows Entity-Relationship modeling principles with proper foreign key constraints and strategic indexing.

#### Core Entities

**Users Entity**: Central entity storing all user types (Admin, Staff, Supervisor, Freelancer, Freelance Tech) with role-based discrimination
- **Primary Key**: `id` (Auto-increment integer)
- **Unique Constraints**: `email` for authentication
- **Foreign Keys**: `role_id` references Roles table
- **Indexes**: `email`, `status`, `role_id` for query optimization

**WhatsApp Messages Entity**: Queue-based messaging system for WhatsApp notifications
- **Primary Key**: `id` (Auto-increment integer)
- **Status Tracking**: `queued`, `sending`, `sent`, `delivered`, `failed`, `expired`
- **Delivery Monitoring**: `attempts`, `last_error`, `provider_message_id`
- **Correlation Support**: `correlation_id` for tracking related notifications

**Roles Entity**: Defines user roles and permissions structure
- **System Roles**: Admin, Staff, Supervisor, Freelancer (pre-defined)
- **Custom Roles**: User-defined roles with specific permissions
- **Permission Mapping**: Linked to RolePermissions table for granular access control

**Tasks Entity**: Core business entity managing task lifecycle
- **Unique Identifier**: `log_number` for task tracking
- **Status Management**: Enum-based status with predefined workflow
- **Assignment Tracking**: `assigned_to` and `created_by` foreign keys
- **Geographic Support**: State and location fields for regional assignment

#### Relationship Mapping

```sql
-- User-Role Relationship (Many-to-One)
Users.role_id → Roles.id

-- Task-Creator Relationship (Many-to-One)
Tasks.created_by → Users.id

-- Task-Assignee Relationship (Many-to-One)
Tasks.assigned_to → Users.id

-- User-Skills Relationship (One-to-Many)
Users.id → FreelancerSkills.user_id

-- User-Locations Relationship (One-to-Many)
Users.id → FreelancerLocations.user_id

-- Task-Attachments Relationship (One-to-Many)
Tasks.id → TaskAttachments.task_id

-- Task-Reports Relationship (One-to-One)
Tasks.id → TaskReports.task_id

-- Asset Accessories Relationship (One-to-Many)
Assets.id → AssetAccessories.asset_id
Assets.id → AssetAccessories.accessory_asset_id
```

### 4.2 Database Performance Optimization

#### Recent Asset Schema Changes
- **Removed Pairing Tables**: Asset pairing functionality moved to `asset_accessories` table
- **Category Details Removed**: Asset category details tables (`asset_desktops`, `asset_laptops`, etc.) removed
- **Masterlist Linking**: Assets now linked to masterlists via `masterlist_assets` table without duplication

#### Indexing Strategy
- **Primary Indexes**: All primary keys automatically indexed
- **Foreign Key Indexes**: All foreign key columns indexed
- **Query Optimization Indexes**: 
  - `users.email` for authentication queries
  - `tasks.status` for dashboard filtering
  - `tasks.assigned_to` for freelancer task queries
  - `freelancer_skills.skill` for skill-based matching

#### Data Integrity Constraints
- **Referential Integrity**: Foreign key constraints prevent orphaned records
- **Unique Constraints**: Prevent duplicate emails and task log numbers
- **Check Constraints**: Rating values limited to 1-5 range
- **Enum Constraints**: Status values restricted to predefined options

### 4.3 Data Flow Architecture

```
User Authentication Flow:
Login Request → users table (email lookup) → role_permissions (authorization) → JWT token generation

Task Assignment Flow:
task creation → tasks table → freelancer matching (skills+locations) → assignment update → notification generation

Freelancer Matching Algorithm:
task requirements → filter by skills → filter by location → sort by rating → select candidates

Asset Accessory Management:
asset creation → asset_accessories table → link accessories (monitor/keyboard/mouse/other) → pairing validation
```

---

## 5. Authentication & Authorization System

### 5.1 Multi-layer Authentication Architecture

#### JWT Token-based Authentication
```typescript
// Token Structure
interface JWTPayload {
  userId: number;
  email: string;
  roleName: string;
  iat: number; // issued at
  exp: number; // expiration
}
```

#### Session Management System
- **Session Creation**: Generated upon successful login
- **Session Validation**: Each API request validates session hash
- **Session Expiration**: 30-minute inactivity timeout
- **Concurrent Session Support**: Multiple device login capability
- **Session Cleanup**: Automatic cleanup of expired sessions

#### Authentication Flow
```
1. User Login → Credentials Validation → JWT Token Generation
2. Session Creation → Session Hash Storage → Token Response
3. API Request → JWT Verification → Session Validation → Authorization Check
4. Token Refresh → New Token Generation → Session Update
5. Logout → Session Invalidation → Token Cleanup
```

### 5.2 Role-Based Access Control (RBAC)

#### Permission System Design
```typescript
type Permission = 
  // Task Management
  | 'tasks:create' | 'tasks:view:all' | 'tasks:view:assigned' | 'tasks:assign'
  | 'tasks:edit:all' | 'tasks:delete' | 'tasks:submit_report' | 'tasks:verify_report'
  // Payment Management  
  | 'payments:approve' | 'payments:mark_paid' | 'payments:view_own_earnings'
  // Freelancer Management
  | 'freelancers:manage' | 'freelancers:view:all' | 'freelancers:view_profile'
  // System Administration
  | 'settings:view' | 'settings:manage:profile' | 'settings:manage:users' 
  | 'settings:manage:roles' | 'settings:manage:mail' | 'settings:manage:templates';
```

#### Role Permission Matrix
| Role | Core Permissions | Restricted Areas |
|------|------------------|------------------|
| **Admin** | All permissions | No restrictions |
| **Staff** | Task management, freelancer oversight | Payment approval, system settings |
| **Supervisor** | Payment approval, reporting, oversight | User management, system configuration |
| **Freelancer** | Task viewing (assigned), profile management | Other users' data, system settings |

#### Dynamic Permission Checking
```typescript
// Permission checking implementation
const hasPermission = (permission: Permission): boolean => {
  const userRole = roles.find(r => r.id === currentUser.roleId);
  return userRole?.permissions.includes(permission) || false;
};
```

---

## 6. Task Management Workflow Engine

### 6.1 AI Instruction Page - Automatic File Attachments

The AI Instruction page (`/ai-instruction`) provides an intelligent task creation assistant that automatically includes all uploaded files as attachments in the created tasks without requiring manual re-upload.

#### File Upload and Processing Flow
1. **File Upload**: Users can upload multiple files (PDF, DOC, images, etc.) directly in the AI instruction interface
2. **AI Processing**: Files are sent to AI for content analysis and task draft generation
3. **Automatic Attachment Inclusion**: When creating tasks from AI-generated drafts, all uploaded files are automatically included as task attachments
4. **No Manual Re-upload Required**: Files are transferred seamlessly from the AI instruction page to task creation

#### Technical Implementation
- Files are stored in component state during the AI interaction
- `buildTaskFormData()` function appends all files to FormData as 'attachments'
- Task creation API (`POST /api/tasks`) processes files via `uploadTaskAttachment` middleware
- Files are saved to `task_attachments` table with proper metadata (filename, path, type, size)

#### Benefits
- **Seamless Workflow**: Users don't need to re-upload files when creating tasks
- **Preserved Context**: All reference materials remain attached to tasks
- **Efficiency**: Reduces manual steps in task creation process
- **Data Integrity**: Files are properly stored and linked to tasks in the database

### 6.2 Task Lifecycle State Machine

#### Status Transition Rules
```
BARU (New) → TAWARAN_DIHANTAR (Offer Sent) → TELAH_DIAMBIL (Taken) → SELESAI (Completed)
                                                                                ↓
                                               BORANG_DISEMAK_PEMBAYARAN_TERTUNGGAK (Form Reviewed & Payment Pending) → TELAH_DIBAYAR (Paid) → SELESAI_PENUH (Fully Complete)

Alternative Paths:
BARU → DIBATALKAN (Cancelled) [Any stage]
TAWARAN_DIHANTAR → BARU (Offer Recalled)
TELAH_DIAMBIL → BARU (Task Rejected)
```

#### Business Rules Enforcement
- **Status Validation**: Only valid transitions allowed
- **Permission-based Transitions**: Role-based status change authorization
- **Notification Triggers**: Automated notifications on status changes
- **Audit Trail**: Complete history of all status changes with timestamps

### 6.2 Freelancer Assignment Algorithm

#### Multi-criteria Decision Making
```typescript
interface AssignmentCriteria {
  requiredSkills: Skill[];
  location: Location;
  deadline: Date;
  budget: number;
  urgency: 'low' | 'medium' | 'high';
}

interface FreelancerScore {
  freelancer: Freelancer;
  skillMatch: number;      // 0-100 based on skill overlap
  locationScore: number;   // Distance-based scoring
  availability: boolean;  // Current availability status
  ratingScore: number;     // Historical performance (1-5)
  totalScore: number;      // Weighted combination
}
```

#### Assignment Process Flow
```
1. Task Requirements Analysis → Extract skills, location, deadline
2. Freelancer Pool Filtering → Available freelancers with matching skills
3. Geographic Proximity Scoring → Distance-based location matching
4. Performance History Evaluation → Rating and completion rate analysis
5. Availability Confirmation → Check current workload and availability
6. Ranking and Selection → Score-based freelancer ranking
7. Offer Generation → Create and send assignment offers
```

---

## 7. Real-time Notification System

### 7.1 Multi-channel Notification Architecture

#### Notification Channels
- **Email Notifications**: SMTP-based email delivery with template system
- **WhatsApp Notifications**: Queue-based WhatsApp messaging via Wasapmatic API
- **Webhook Notifications**: External system integrations (Slack, Telegram, Discord)
- **In-app Notifications**: Real-time browser notifications with audit trail
- **SMS Notifications**: Mobile text message alerts (future enhancement)

#### Notification Types
```typescript
enum NotificationType {
  TASK_ASSIGNED = 'task_assigned',
  TASK_COMPLETED = 'task_completed',
  PAYMENT_APPROVED = 'payment_approved',
  OFFER_RECEIVED = 'offer_received',
  DEADLINE_APPROACHING = 'deadline_approaching',
  REPORT_SUBMITTED = 'report_submitted',
  FEEDBACK_RECEIVED = 'feedback_received',
  TASK_REMINDER = 'task_reminder'
}
```

#### WhatsApp Integration

The system includes WhatsApp messaging capabilities for automated notifications:

- **Queue-based Processing**: Messages are queued in `whatsapp_messages` table for reliable delivery
- **Multi-channel Support**: Supports email, web notifications, and WhatsApp
- **Template System**: Configurable message templates for different notification types
- **Delivery Tracking**: Complete audit trail of message status (queued, sent, delivered, failed)
- **Provider Integration**: Integrated with Wasapmatic API for WhatsApp delivery

### 7.2 Template-based Notification System

#### Dynamic Template Engine
```typescript
interface NotificationTemplate {
  id: number;
  type: NotificationType;
  channel: 'email' | 'webhook' | 'sms';
  subject: string;
  body: string; // Supports variables: {{userName}}, {{taskTitle}}, etc.
  isActive: boolean;
}
```

#### Template Variable Substitution
```javascript
// Example template processing
template: "Hello {{freelancerName}}, you have been assigned task {{taskTitle}}"
variables: { freelancerName: "John", taskTitle: "Network Installation" }
result: "Hello John, you have been assigned task Network Installation"
```

### 6.3 Task Reminder System

The system includes an automated reminder system for task deadlines and attendance:

#### Reminder Types
- **Attendance Reminders**: Notifications before service start time
- **Document Submission Reminders**: Notifications before task deadlines
- **Requirement Reminders**: Notifications before requirement deadlines

#### Reminder Configuration
- **Multi-channel Support**: Email, WhatsApp, and in-app notifications
- **Template System**: Configurable message templates
- **Offset-based Scheduling**: Reminders sent at specified intervals before events
- **Smart Deduplication**: Prevents duplicate notifications for the same event

#### Automated Processing
- **Background Job**: Cron-based job runs every 5 minutes to check upcoming events
- **Time-based Triggers**: Reminders triggered based on configurable time offsets
- **Status-aware**: Only sends reminders for active, non-completed tasks

---

## 8. Security Implementation Framework

### 8.1 Multi-layer Security Architecture

#### Layer 1: Network Security
- **HTTPS Enforcement**: SSL/TLS encryption for all communications
- **CORS Configuration**: Strict origin whitelist
- **Rate Limiting**: Request throttling per IP and user
- **Security Headers**: Helmet.js for security headers (XSS, CSRF, etc.)

#### Layer 2: Authentication Security
- **JWT Token Security**: Strong secret keys with regular rotation
- **Session Management**: Server-side session validation
- **Password Security**: bcryptjs with 12 salt rounds
- **Account Lockout**: Temporary account suspension after failed attempts

#### Layer 3: Data Security
- **Input Validation**: Joi schema validation on all inputs
- **SQL Injection Prevention**: Parameterized queries via TypeORM
- **XSS Prevention**: Content sanitization for user inputs
- **File Upload Security**: Type validation and size limits

#### Layer 4: Access Control Security
- **Role-based Permissions**: Granular permission system
- **Resource Ownership**: Users can only access their own data
- **Admin Override**: Controlled admin access to all resources
- **Audit Logging**: Complete activity trail for security monitoring

### 8.2 Security Monitoring and Incident Response

#### Security Event Logging
```typescript
interface SecurityEvent {
  timestamp: Date;
  eventType: 'login_failed' | 'permission_denied' | 'suspicious_activity';
  userId?: number;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

#### Automated Security Responses
- **Failed Login Monitoring**: Account lockout after 5 failed attempts
- **Suspicious Activity Detection**: Unusual access patterns trigger alerts
- **Permission Violation Logging**: All unauthorized access attempts logged
- **Rate Limit Enforcement**: Automatic blocking of excessive requests

---

## 9. Performance Optimization Strategies

### 9.1 Frontend Performance Optimization

#### Bundle Optimization
- **Code Splitting**: Route-based and component-based code splitting
- **Tree Shaking**: Dead code elimination during build process
- **Lazy Loading**: Dynamic imports for heavy components
- **Image Optimization**: WebP format with responsive images
- **Asset Compression**: Gzip/Brotli compression for static assets

#### Runtime Performance
- **Virtual Scrolling**: For large lists (tasks, freelancers)
- **Memoization**: React.memo and useMemo for expensive computations
- **Debouncing**: Input field debouncing for search operations
- **Caching Strategy**: Browser caching with service workers
- **Progressive Loading**: Skeleton screens for better perceived performance

### 9.2 Backend Performance Optimization

#### Database Query Optimization
```typescript
// Optimized query with proper joins and indexing
const tasks = await taskRepository
  .createQueryBuilder('task')
  .leftJoinAndSelect('task.creator', 'creator')
  .leftJoinAndSelect('task.assignee', 'assignee')
  .leftJoinAndSelect('assignee.skills', 'skills')
  .where('task.status = :status', { status })
  .andWhere('task.deadline <= :deadline', { deadline })
  .orderBy('task.created_at', 'DESC')
  .take(limit)
  .skip(offset)
  .getMany();
```

#### API Response Optimization
- **Pagination**: Cursor-based pagination for large datasets
- **Field Selection**: Allow clients to specify required fields
- **Response Compression**: Gzip compression for JSON responses
- **ETags**: HTTP caching with ETags for conditional requests
- **Connection Pooling**: Database connection reuse

### 9.3 Caching Strategy

#### Multi-level Caching Architecture
```
Level 1: Browser Cache (Static assets, API responses)
Level 2: Application Cache (In-memory data structures)
Level 3: Database Cache (Query result caching)
Level 4: CDN Cache (Static content delivery)
```

#### Cache Invalidation Strategy
- **Time-based Expiration**: TTL-based cache expiration
- **Event-based Invalidation**: Cache updates on data changes
- **Selective Caching**: Cache only frequently accessed data
- **Cache Warming**: Proactive cache population for critical data

---

## 10. Deployment & DevOps Architecture

### 10.1 Containerized Deployment Strategy

#### Docker Configuration
```dockerfile
# Multi-stage build for optimized image size
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

#### Docker Compose Setup
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_HOST=mysql
    depends_on:
      - mysql
      - redis
  
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: spfit_db
    volumes:
      - mysql_data:/var/lib/mysql
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### 10.2 CI/CD Pipeline Configuration

#### GitHub Actions Workflow
```yaml
name: SPFIT CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Run linting
        run: npm run lint
      
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build application
        run: |
          npm ci
          npm run build:client
          npm run build:server
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: build-files
          path: dist/
```

### 10.3 Production Deployment Checklist

#### Pre-deployment Verification
- [ ] Environment variables configured
- [ ] Database migrations executed
- [ ] SSL certificates installed
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Monitoring alerts configured
- [ ] Backup strategy implemented
- [ ] Health check endpoints tested

#### Post-deployment Validation
- [ ] Application health check passes
- [ ] Database connectivity verified
- [ ] Authentication system working
- [ ] Email notifications tested
- [ ] File upload functionality verified
- [ ] API rate limiting functional
- [ ] Error logging operational
- [ ] Performance metrics within SLA

---

## 11. Monitoring & Observability

### 11.1 Application Performance Monitoring (APM)

#### Key Performance Indicators (KPIs)
- **Response Time**: API endpoint response times < 500ms
- **Error Rate**: Error rate < 1% for critical endpoints
- **Throughput**: Requests per second during peak load
- **Resource Utilization**: CPU, memory, disk usage monitoring
- **Database Performance**: Query execution times and connection pool usage

#### Logging Strategy
```typescript
// Structured logging implementation
interface LogEntry {
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  component: string;
  message: string;
  context: Record<string, any>;
  requestId?: string;
  userId?: number;
}
```

### 11.2 Health Check Implementation

#### Comprehensive Health Check
```typescript
interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    database: { status: string; latency: number };
    redis: { status: string; latency: number };
    external_services: { status: string; services: string[] };
    memory: { used: number; total: number; percentage: number };
    disk: { used: number; total: number; percentage: number };
  };
}
```

---

## 12. Business Intelligence & Analytics

### 12.1 Reporting and Analytics Framework

#### Key Business Metrics
- **Task Completion Rate**: Percentage of tasks completed on time
- **Freelancer Performance**: Average rating and completion rate
- **Revenue Analysis**: Total payments and average task value
- **Geographic Distribution**: Task distribution by location
- **Peak Usage Patterns**: System usage by time and day

#### Data Visualization Strategy
- **Real-time Dashboards**: Live updating charts and metrics
- **Historical Trend Analysis**: Time-series data analysis
- **Predictive Analytics**: ML-based forecasting for resource planning
- **Custom Report Generation**: User-defined report parameters
- **Export Capabilities**: PDF, Excel, CSV export options

### 12.2 Data Export and Integration

#### API Integration Points
- **Webhook Support**: Real-time data streaming to external systems
- **REST API**: Comprehensive API for third-party integrations
- **GraphQL**: Flexible query interface for complex data needs
- **File Export**: Scheduled and on-demand report generation
- **Database Replication**: Read-only replicas for analytics

---

## 13. References and Additional Documentation

### Detailed Implementation Guides
- **Deadline Time Notifications**: `docs/DEADLINE_TIME_NOTIFICATION_IMPLEMENTATION.md`
  - Comprehensive guide for time-based notification system
  - Cron job setup and configuration details

- **WhatsApp Integration**: `docs/SPFIT_WHATSAPP_FLOW_DOCUMENTATION.md`
  - Queue-based messaging architecture
  - Wasapmatic API integration details

- **Asset Accessories**: `docs/ASSET_ACCESSORIES.md`
  - Asset pairing and accessory management
  - Database schema and API endpoints

- **Asset Management**: `docs/ASSET_CATEGORY_DETAILS_AND_DUPLICATION.md`
  - Asset category changes and duplication features
  - Masterlist asset linking system

- **Column View Configuration**: `docs/COLUMN_VIEW_DEFAULTS.md`
  - User-configurable table column settings
  - Local storage persistence implementation

- **Role Management**: `docs/USER_GUIDE_ROLES.md` and `docs/API_ROLES.md`
  - User role configuration and permissions
  - API endpoints for role management

### Deployment and Configuration
- **Deployment Guide**: `DEPLOYMENT.md`
  - Environment setup and production deployment
  - Docker configuration and CI/CD pipeline

---

*This comprehensive documentation provides a complete understanding of the SPFIT system architecture, implementation details, and operational procedures. The system is designed to scale and adapt to changing business requirements while maintaining security, performance, and reliability standards.*

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  React Components  │  Context API  │  Custom Hooks  │  Services │
├─────────────────────────────────────────────────────────────────┤
│                      State Management (Zustand)                 │
├─────────────────────────────────────────────────────────────────┤
│                    API Communication (Axios)                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Backend Layer                            │
├─────────────────────────────────────────────────────────────────┤
│  Express Routes  │  Middleware  │  Controllers  │  Services   │
├─────────────────────────────────────────────────────────────────┤
│                      Authentication (JWT)                       │
├─────────────────────────────────────────────────────────────────┤
│                    Database Access (TypeORM)                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Database Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  MySQL Database  │  Entity Models  │  Migrations  │  Indexes  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Frontend Architecture

#### Component Structure
```
src/
├── components/           # Reusable UI components
│   ├── ui/              # Basic UI components (Button, Input, Modal, etc.)
│   ├── reports/         # Report-specific components
│   ├── settings/        # Settings page components
│   └── *.tsx           # Feature-specific components
├── contexts/            # React Context providers
├── hooks/               # Custom React hooks
├── services/            # API service functions
├── utils/               # Utility functions
├── types.ts             # TypeScript type definitions
└── App.tsx              # Main application component
```

#### Key Components
- **App.tsx**: Main application component with routing and state management
- **Layout.tsx**: Main layout wrapper with navigation and sidebar
- **AuthContext.tsx**: Authentication state management
- **useApiData.ts**: Custom hook for API data management

### 2.3 Backend Architecture

#### API Structure
```
api/
├── config/              # Configuration files
├── controllers/         # Request handlers
├── middleware/          # Express middleware functions
├── models/              # TypeORM entity models
├── routes/              # API route definitions
├── services/            # Business logic services
├── migrations/          # Database migration files
└── app.ts               # Express application setup
```

#### Key Services
- **AuthService**: Authentication and authorization logic
- **EmailService**: Email notification handling
- **FileService**: File upload and management
- **WebhookService**: External webhook integrations

---

## 3. Database Design

### 3.1 Entity Relationship Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Users       │     │     Roles       │     │  RolePermissions│
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id (PK)         │◄────┤ id (PK)         │◄────┤ id (PK)         │
│ name            │     │ name            │     │ role_id (FK)    │
│ role_id (FK)    │     │ description     │     │ permission      │
│ email           │     │ is_system_role  │     └─────────────────┘
│ password_hash   │     └─────────────────┘
│ status          │
│ phone           │     ┌─────────────────┐
│ ic_number       │     │     Tasks       │
│ experience      │     ├─────────────────┤
│ rating          │◄────┤ id (PK)         │
│ is_available    │     │ title           │
│ created_at      │     │ log_number      │
│ updated_at      │     │ description     │
└─────────────────┘     │ support_type    │
                        │ client_location │
┌─────────────────┐     │ state           │
│FreelancerLocation│     │ deadline        │
├─────────────────┤     │ deadline_time   │
│ id (PK)         │     │ offer_price     │
│ user_id (FK)    │     │ status          │
│ district        │     │ created_by (FK) │
│ state           │     │ assigned_to (FK)│
│                 │     │ payment_date    │
└─────────────────┘     │ created_at      │
                        │ updated_at      │
┌─────────────────┐     └─────────────────┘
│ FreelancerSkill │
├─────────────────┤     ┌─────────────────┐     ┌─────────────────┐
│ id (PK)         │     │ TaskAttachments │     │  TaskReports    │
│ user_id (FK)    │     ├─────────────────┤     ├─────────────────┤
│ skill           │     │ id (PK)         │     │ id (PK)         │
└─────────────────┘     │ task_id (FK)    │◄────┤ task_id (FK)    │
                        │ file_name       │     │ file_url        │
┌─────────────────┐     │ file_path       │     │ notes           │
│   Notifications │     │ file_type       │     │ submitted_at    │
├─────────────────┤     │ file_size       │     └─────────────────┘
│ id (PK)         │     │ created_at      │
│ user_id (FK)    │     └─────────────────┘
│ task_id (FK)    │
│ type            │     ┌─────────────────┐
│ title           │     │  TaskFeedback   │
│ message         │     ├─────────────────┤
│ is_read         │     │ id (PK)         │
│ created_at      │◄────┤ task_id (FK)    │
└─────────────────┘     │ skill_rating    │
                        │ communication   │
┌─────────────────┐     │ time_punctuality│
│  ActivityLogs   │     │ response_time   │
├─────────────────┤     │ overall_rating  │
│ id (PK)         │     │ comment         │
│ user_id (FK)    │     │ created_at      │
│ activity_type   │     └─────────────────┘
│ description     │
│ ip_address      │     ┌─────────────────┐
│ user_agent      │     │ SystemSettings  │
│ metadata        │     ├─────────────────┤
│ created_at      │     │ id (PK)         │
└─────────────────┘     │ setting_key     │
                        │ setting_value   │
┌─────────────────┐     │ description     │
│  UserSessions   │     │ data_type       │
├─────────────────┤     │ is_active       │
│ id (PK)         │     │ created_at      │
│ user_id (FK)    │     │ updated_at      │
│ session_hash    │     └─────────────────┘
│ expires_at      │
│ created_at      │
└─────────────────┘
```

### 3.2 Key Database Features

#### Indexes
- User email and status indexes for authentication queries
- Task status and assignment indexes for dashboard queries
- Freelancer skill and location indexes for assignment matching
- Activity log timestamp indexes for reporting

#### Constraints
- Unique constraints on user email and task log numbers
- Foreign key constraints for data integrity
- Check constraints for rating values (1-5 range)
- Enum constraints for status fields

---

## 4. Authentication & Authorization

### 4.1 Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │     │  Frontend   │     │   Backend   │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │                   │
       │  Login Request    │                   │                   │
       ├──────────────────►│                   │                   │
       │                   │  API Call         │                   │
       │                   ├──────────────────►│                   │
       │                   │                   │                   │
       │                   │                   │  Validate User    │
       │                   │                   ├──────────────────►│
       │                   │                   │                   │
       │                   │                   │  User Data        │
       │                   │                   │◄──────────────────┤
       │                   │                   │                   │
       │                   │                   │  Generate JWT     │
       │                   │                   ├──────────┐        │
       │                   │                   │          │        │
       │                   │                   │◄─────────┘        │
       │                   │                   │                   │
       │                   │                   │  Create Session   │
       │                   │                   ├──────────────────►│
       │                   │                   │                   │
       │                   │  Response         │                   │
       │                   │◄──────────────────┤                   │
       │                   │                   │                   │
       │  Store Token      │                   │                   │
       │◄──────────────────┤                   │                   │
       │                   │                   │                   │
```

### 4.2 JWT Token Structure

#### Access Token
```json
{
  "userId": 123,
  "email": "user@example.com",
  "roleName": "Staff",
  "iat": 1640995200,
  "exp": 1641081600
}
```

#### Session Management
- **Session Hash**: SHA-256 hash of JWT token for session validation
- **Session Timeout**: 30 minutes of inactivity
- **Token Refresh**: Automatic token refresh before expiration
- **Concurrent Sessions**: Multiple device support with session tracking

### 4.3 Role-Based Permissions

#### User Roles
1. **Admin**: Full system access and configuration
2. **Staff**: Task management and freelancer oversight
3. **Supervisor**: Payment approval and system oversight
4. **Freelancer**: Task execution and profile management
5. **Freelance Tech**: External IT technician with restricted access to assigned tasks

#### Permission System
```typescript
type Permission = 
  | 'tasks:create' | 'tasks:view:all' | 'tasks:assign' 
  | 'payments:approve' | 'freelancers:manage'
  | 'settings:manage:users' | 'settings:manage:roles'
```

---

## 5. Task Management Workflow

### 5.1 Task Lifecycle

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    BARU     │───►│TAWARAN      │───►│TELAH        │───►│   SELESAI   │
│  (New)      │    │DIHANTAR     │    │DIAMBIL      │    │ (Completed) │
└─────────────┘    │(Offer Sent) │    │(Taken)      │    └─────────────┘
     │             └─────────────┘    └─────────────┘           │
     │                                                         │
     ▼                                                         ▼
┌─────────────┐                                          ┌─────────────┐
│  DIBATALKAN │                                          │ BORANG      │
│ (Cancelled) │                                          │ DISEMAK     │
└─────────────┘                                          │ PEMBAYARAN  │
                                                         │ TERTUNGGAK  │
                                                         │ (Form       │
                                                         │ Reviewed &  │
                                                         │ Payment     │
                                                         │ Pending)    │
                                                              │
                                                              ▼
                                                         ┌─────────────┐
                                                         │ TELAH       │
                                                         │ DIBAYAR     │
                                                         │ (Paid)      │
                                                         └─────────────┘
                                                              │
                                                              ▼
                                                         ┌─────────────┐
                                                         │ SELESAI     │
                                                         │ PENUH       │
                                                         │ (Fully      │
                                                         │  Complete)  │
                                                         └─────────────┘
```

### 5.2 Task Assignment Process

1. **Task Creation**: Staff creates task with requirements and deadline
2. **Freelancer Matching**: System suggests freelancers based on skills and location
3. **Offer Sending**: Staff sends offers to selected freelancers via email/webhook
4. **Task Acceptance**: Freelancer accepts task and begins work
5. **Progress Tracking**: Real-time status updates and communication
6. **Report Submission**: Freelancer submits completion report
7. **Report Verification**: Staff reviews and verifies submitted work
8. **Payment Processing**: Supervisor approves payment
9. **Task Completion**: Final status update and documentation

### 5.3 Task Duplication

The system supports task duplication for efficient task creation:

#### Duplication Features
- **Complete Task Copy**: Copies all task fields, attachments, and links
- **Unique Log Number**: Auto-generates new unique log numbers
- **Status Reset**: New tasks start with "BARU" status
- **Assignee Preservation**: Maintains original assignee assignment
- **Automatic Naming**: Adds "(Copy of ...)" suffix with auto-increment for duplicates

#### API Endpoint
- **POST** `/api/tasks/:id/duplicate`
- **Authorization**: Admin or Staff roles only
- **Response**: Complete duplicated task object

### 5.4 Masterlist Duplication

The system supports masterlist duplication for efficient asset management:

#### Duplication Features
- **Complete Masterlist Copy**: Copies all masterlist configuration and custom fields
- **Asset Linking**: Links existing assets without creating duplicates
- **Unique Code Generation**: Auto-generates new unique codes with suffixes
- **Name Auto-increment**: Adds "(Copy of ...)" with auto-increment for duplicates
- **Status Preservation**: Maintains original status or defaults to "Aktif"

#### API Endpoint
- **POST** `/api/masterlists/:id/duplicate`
- **Authorization**: Admin or Staff roles only
- **Parameters**: `project_id`, `code`, `name`, `include_assets`
- **Response**: Complete duplicated masterlist object

---

## 6. API Documentation

### 6.1 Authentication Endpoints

#### POST /api/auth/login
**Description**: User login with email and password
**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "role": "Staff"
    },
    "sessionId": "session_123456"
  }
}
```

#### POST /api/auth/logout
**Description**: User logout and session termination
**Headers**: `Authorization: Bearer {token}`
**Response**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

### 6.2 Task Management Endpoints

#### GET /api/tasks
**Description**: Retrieve all tasks with optional filtering
**Query Parameters**: `status`, `assigned_to`, `created_by`, `page`, `limit`
**Headers**: `Authorization: Bearer {token}`
**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "title": "Network Installation",
      "log_number": "TASK-2024-001",
      "status": "Baru",
      "assigned_to": 5,
      "created_by": 1,
      "deadline": "2024-02-15",
      "offer_price": 500.00
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

#### POST /api/tasks
**Description**: Create new task
**Headers**: `Authorization: Bearer {token}`
**Request Body**:
```json
{
  "title": "Network Installation",
  "description": "Install network cables and configure switches",
  "support_type": "NETWORK",
  "client_location": "Office Building A",
  "state": "SELANGOR",
  "deadline": "2024-02-15",
  "offer_price": 500.00
}
```

### 6.3 Freelancer Management Endpoints

#### GET /api/freelancers
**Description**: Retrieve all freelancers with filtering
**Query Parameters**: `skills`, `locations`, `availability`, `rating`
**Headers**: `Authorization: Bearer {token}`

#### GET /api/freelancers/:id/profile
**Description**: Get detailed freelancer profile
**Headers**: `Authorization: Bearer {token}`
**Response**:
```json
{
  "success": true,
  "data": {
    "id": 5,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "phone": "+60123456789",
    "skills": ["NETWORK", "HARDWARE"],
    "locations": [
      {"district": "Petaling", "state": "SELANGOR"}
    ],
    "experience": 5,
    "rating": 4.5,
    "is_available": true
  }
}
```

---

## 7. Security Implementation

### 7.1 Authentication Security
- **JWT Token Expiration**: 24-hour access tokens with refresh mechanism
- **Session Management**: Server-side session validation with automatic cleanup
- **Password Security**: bcryptjs hashing with salt rounds of 12
- **Rate Limiting**: Request throttling on authentication endpoints
- **CORS Protection**: Configured for specific origins only

### 7.2 Data Protection
- **Input Validation**: Joi validation on all API endpoints
- **SQL Injection Prevention**: Parameterized queries via TypeORM
- **XSS Protection**: Content sanitization for user inputs
- **File Upload Security**: File type validation and size limits
- **HTTPS Enforcement**: Production-ready SSL configuration

### 7.3 Access Control
- **Role-based Permissions**: Granular permission system
- **Resource Ownership**: Users can only access their own data
- **Admin Override**: Admin users can access all resources
- **Session Timeout**: 30-minute inactivity timeout

---

## 8. Performance Optimization

### 8.1 Frontend Optimization
- **Code Splitting**: Lazy loading for large components
- **Image Optimization**: Compressed images with proper formats
- **Bundle Size**: Tree shaking and minification
- **Caching Strategy**: Browser caching for static assets
- **API Response Caching**: Client-side data caching

### 8.2 Backend Optimization
- **Database Indexing**: Strategic indexes on frequently queried columns
- **Query Optimization**: Efficient TypeORM queries with proper joins
- **Connection Pooling**: MySQL connection pool management
- **Response Compression**: Gzip compression for API responses
- **Rate Limiting**: Prevent API abuse with request limits

### 8.3 Database Optimization
- **Index Strategy**: Balanced approach for read/write operations
- **Query Performance**: Optimized queries with execution plan analysis
- **Data Archiving**: Historical data management strategies
- **Backup Strategy**: Regular automated backups with point-in-time recovery

---

## 9. Deployment Configuration

### 9.1 Environment Variables
```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=spfit_user
DB_PASSWORD=secure_password
DB_NAME=spfit_db

# JWT Configuration
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Application Configuration
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://yourdomain.com
```

### 9.2 Build Process
```bash
# Frontend build
npm run build:client

# Backend build
npm run build:server

# Production start
npm run start
```

### 9.3 Vercel Deployment Configuration
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/app.ts",
      "use": "@vercel/node"
    },
    {
      "src": "dist/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "api/app.ts"
    },
    {
      "src": "/(.*)",
      "dest": "dist/$1"
    }
  ]
}
```

---

## 10. Monitoring and Maintenance

### 10.1 Health Checks
- **API Health**: `/api/health` endpoint for service status
- **Database Health**: Connection pool monitoring
- **Memory Usage**: Application memory consumption tracking
- **Error Rates**: API error rate monitoring

### 10.2 Logging Strategy
- **Request Logging**: Detailed request/response logging
- **Error Logging**: Structured error logs with stack traces
- **Activity Logging**: User action tracking for audit purposes
- **Performance Logging**: API response time monitoring

### 10.3 Maintenance Tasks
- **Session Cleanup**: Automatic cleanup of expired sessions
- **Log Rotation**: Log file management and archival
- **Database Maintenance**: Regular optimization and cleanup
- **Backup Verification**: Automated backup integrity checks

---

## 11. Future Enhancements

### 11.1 Planned Features
- **Mobile Application**: Native mobile apps for iOS and Android
- **Advanced Analytics**: Machine learning for freelancer recommendations
- **Payment Integration**: Direct payment processing integration
- **Document Management**: Enhanced file handling and storage
- **Multi-language Support**: Additional language localizations

### 11.2 Scalability Improvements
- **Microservices Architecture**: Service decomposition for better scaling
- **Caching Layer**: Redis implementation for improved performance
- **Load Balancing**: Multi-server deployment configuration
- **CDN Integration**: Content delivery network for static assets
- **Database Sharding**: Horizontal scaling for large datasets

### 11.3 Security Enhancements
- **Two-Factor Authentication**: SMS/Email 2FA implementation
- **Advanced Encryption**: End-to-end encryption for sensitive data
- **Security Auditing**: Regular security vulnerability assessments
- **Compliance Features**: GDPR and data privacy compliance tools
- **Advanced Monitoring**: Real-time security threat detection

---

## 12. Support and Troubleshooting

### 12.1 Common Issues
- **Database Connection**: Check MySQL service status and credentials
- **Authentication Errors**: Verify JWT secret and token expiration
- **CORS Issues**: Check allowed origins configuration
- **File Upload Failures**: Verify upload directory permissions
- **Email Delivery**: Check SMTP configuration and credentials

### 12.2 Debug Information
- **Environment Detection**: Development vs production mode
- **Verbose Logging**: Enable detailed logging for troubleshooting
- **Database Queries**: Enable query logging for performance analysis
- **API Response Times**: Monitor endpoint performance metrics

### 12.3 Contact Information
- **Technical Support**: support@spfit.com
- **Documentation**: https://docs.spfit.com
- **Issue Tracker**: https://github.com/spfit/issues
- **Community Forum**: https://community.spfit.com

---

*This documentation is continuously updated to reflect the latest system changes and enhancements. For the most current information, please refer to the official documentation repository.*
