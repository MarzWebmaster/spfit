# Implementasi Trigger Notifikasi Berdasarkan Masa Keperluan (Deadline Time)

## Gambaran Keseluruhan

Field `deadline_time` telah ditambah ke dalam jadual `tasks` melalui migration `037_add_deadline_time_to_tasks.sql`. Field ini membolehkan pengguna menetapkan masa spesifik untuk keperluan tugasan, bukan hanya tarikh sahaja.

## Struktur Database

```sql
ALTER TABLE tasks 
ADD COLUMN deadline_time TIME NULL DEFAULT NULL 
AFTER deadline;

CREATE INDEX idx_tasks_deadline_time ON tasks(deadline_time);
```

## Frontend Implementation

Field `deadline_time` telah ditambah ke dalam `TaskFormPage.tsx` dengan ciri-ciri berikut:

1. **Input Field**: Field masa (type="time") dengan placeholder "HH:MM"
2. **Validation**: Tidak wajib - boleh kosong atau diisi
3. **Backend Integration**: Data dihantar sebagai `deadline_time` dalam payload

## Backend Implementation

### TaskController.ts

Field `deadline_time` telah ditambah ke dalam:
1. `createTask` method - menerima `deadline_time` dari request body
2. `updateTask` method - menerima `deadline_time` dari request body

### Model Task

Field perlu ditambah ke dalam model Task di `api/models/Task.ts`:

```typescript
@Column({ type: 'time', nullable: true })
deadline_time: string | null;
```

## Sistem Notifikasi Berdasarkan Deadline Time

### Pendekatan yang Disyorkan

#### 1. Cron Job / Scheduler

Buat cron job yang berjalan setiap jam untuk memeriksa tugasan yang hampir mencapai deadline:

```javascript
// Contoh: api/services/deadlineNotificationService.ts
import { AppDataSource } from '../config/database';
import { Task } from '../models/Task';
import { NotificationService } from './notificationService';

export class DeadlineNotificationService {
  async checkUpcomingDeadlines() {
    const taskRepository = AppDataSource.getRepository(Task);
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Format waktu untuk perbandingan
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    const oneHourLaterTime = oneHourLater.toTimeString().slice(0, 5);
    
    // Cari tugasan yang deadline_time dalam 1 jam akan datang
    const tasks = await taskRepository
      .createQueryBuilder('task')
      .where('task.deadline = :today', { today: now.toISOString().split('T')[0] })
      .andWhere('task.deadline_time IS NOT NULL')
      .andWhere('task.deadline_time BETWEEN :currentTime AND :oneHourLaterTime', {
        currentTime,
        oneHourLaterTime
      })
      .andWhere('task.status_id NOT IN (:...completedStatuses)', {
        completedStatuses: [/* ID status selesai */]
      })
      .leftJoinAndSelect('task.assignee', 'assignee')
      .leftJoinAndSelect('task.creator', 'creator')
      .getMany();
    
    for (const task of tasks) {
      // Hantar notifikasi
      await this.sendDeadlineNotification(task);
    }
  }
  
  async sendDeadlineNotification(task: Task) {
    const notificationService = new NotificationService();
    
    // Notifikasi kepada assignee
    if (task.assigned_to) {
      await notificationService.createNotification(
        task.assigned_to,
        task.id,
        'DEADLINE_REMINDER',
        `Tugasan Akan Tamat: ${task.title}`,
        `Tugasan "${task.title}" akan tamat pada ${task.deadline} ${task.deadline_time}. Sila selesaikan segera.`
      );
    }
    
    // Notifikasi kepada creator
    await notificationService.createNotification(
      task.created_by,
      task.id,
      'DEADLINE_REMINDER',
      `Tugasan Akan Tamat: ${task.title}`,
      `Tugasan "${task.title}" akan tamat pada ${task.deadline} ${task.deadline_time}.`
    );
  }
}
```

#### 2. Setup Cron Job

Buat script untuk dijalankan oleh sistem cron:

```javascript
// scripts/check-deadline-notifications.js
const { DeadlineNotificationService } = require('../api/services/deadlineNotificationService');

async function runDeadlineCheck() {
  try {
    const service = new DeadlineNotificationService();
    await service.checkUpcomingDeadlines();
    console.log('Deadline notification check completed at', new Date().toISOString());
  } catch (error) {
    console.error('Error checking deadline notifications:', error);
  }
}

runDeadlineCheck();
```

#### 3. Cron Schedule (Linux)

```bash
# Jalankan setiap jam
0 * * * * cd /path/to/project && node scripts/check-deadline-notifications.js
```

#### 4. Alternatif: Background Worker

Gunakan library seperti `bull` atau `agenda` untuk job queue:

```javascript
// api/workers/deadlineWorker.js
const Queue = require('bull');
const { DeadlineNotificationService } = require('../services/deadlineNotificationService');

const deadlineQueue = new Queue('deadline-notifications', {
  redis: { port: 6379, host: '127.0.0.1' }
});

// Schedule job untuk berjalan setiap jam
deadlineQueue.add({}, { repeat: { cron: '0 * * * *' } });

deadlineQueue.process(async (job) => {
  const service = new DeadlineNotificationService();
  await service.checkUpcomingDeadlines();
});
```

## Notifikasi yang Disokong

### 1. In-App Notifications
- Notifikasi dalam aplikasi untuk assignee dan creator
- Tunjukkan dalam dashboard pengguna

### 2. Email Notifications
- Hantar email reminder 1 jam sebelum deadline
- Template email khas untuk deadline reminder

### 3. WhatsApp Notifications (Opsional)
- Integrasi dengan API WhatsApp untuk reminder segera

## Konfigurasi

### Environment Variables

```env
# Deadline Notification Settings
DEADLINE_REMINDER_HOURS_BEFORE=1
ENABLE_DEADLINE_EMAIL_NOTIFICATIONS=true
ENABLE_DEADLINE_WHATSAPP_NOTIFICATIONS=false
```

### Status yang Dikecualikan

Tugasan dengan status berikut tidak perlu notifikasi deadline:
- Selesai
- Telah Dibayar  
- Dibatalkan
- Borang Disemak

## Testing

### Unit Tests

```javascript
describe('DeadlineNotificationService', () => {
  it('should find tasks with deadline_time within next hour', async () => {
    // Test implementation
  });
  
  it('should send notifications to assignee and creator', async () => {
    // Test implementation
  });
});
```

### Manual Testing

1. Buat tugasan dengan `deadline_time` ditetapkan ke masa 1 jam dari sekarang
2. Tunggu cron job berjalan
3. Pastikan notifikasi dihantar kepada pengguna yang berkenaan

## Langkah Seterusnya

1. **Implement Notification Service**: Buat service untuk menghantar notifikasi
2. **Setup Cron Job**: Konfigurasi cron job di server production
3. **Add Email Templates**: Buat template email untuk deadline reminders
4. **Monitoring**: Tambah logging dan monitoring untuk notifikasi
5. **User Preferences**: Tambah setting untuk pengguna memilih jenis notifikasi

## Troubleshooting

### Masalah Biasa

1. **Timezone Issues**: Pastikan server timezone sama dengan aplikasi
2. **Cron Job Not Running**: Periksa cron service status dan logs
3. **Notifications Not Sent**: Periksa connection ke email/notification service
4. **Duplicate Notifications**: Implement deduplication logic

### Logging

```javascript
console.log(`[${new Date().toISOString()}] Deadline check: Found ${tasks.length} tasks`);
console.log(`[${new Date().toISOString()}] Sent notification for task ${task.id}`);
```

## Kesimpulan

Implementasi `deadline_time` membolehkan sistem menghantar notifikasi yang lebih tepat berdasarkan masa spesifik. Dengan sistem cron job yang sesuai, pengguna akan menerima reminder tepat pada masanya untuk tugasan yang hampir tamat tempoh.