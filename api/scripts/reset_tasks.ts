
import { AppDataSource, initializeDatabase } from '../config/database';
import { Task, TaskStatus } from '../models/Task';
import { User } from '../models/User';
import { MainCon } from '../models/MainCon';
import { TaskOffer } from '../models/TaskOffer';
import { TaskWaitingList } from '../models/TaskWaitingList';
import { TaskPart } from '../models/TaskPart';
import { Notification } from '../models/Notification';
import { TaskAttachment } from '../models/TaskAttachment';
import { TaskLink } from '../models/TaskLink';
import { TaskReport } from '../models/TaskReport';
import { TaskFeedback } from '../models/TaskFeedback';
import { TaskStatusOption } from '../models/TaskStatusOption';
import { In } from 'typeorm';

async function resetTasks() {
  try {
    // Use initializeDatabase to ensure migrations are run
    await initializeDatabase();
    console.log('Database connected and migrations run');

    const taskRepository = AppDataSource.getRepository(Task);
    const userRepository = AppDataSource.getRepository(User);
    const mainConRepository = AppDataSource.getRepository(MainCon);
    const taskStatusRepository = AppDataSource.getRepository(TaskStatusOption);

    // Get an admin user (or any user) to be the creator
    const adminUser = await userRepository.findOne({ where: {} }); // Just get the first user
    if (!adminUser) {
      console.error('No users found. Cannot create tasks without a creator.');
      process.exit(1);
    }

    // Get a main con (optional)
    const mainCon = await mainConRepository.findOne({ where: {} });

    const newStatus = await taskStatusRepository.findOne({ where: { name: TaskStatus.BARU } });
    if (!newStatus) {
      console.error(`Task status '${TaskStatus.BARU}' not found. Cannot create tasks.`);
      process.exit(1);
    }

    // Delete all existing tasks
    console.log('Deleting all existing tasks...');
    const tasks = await taskRepository.find();
    
    if (tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);
        console.log(`Found ${tasks.length} tasks to delete.`);

        // Delete related records manually to avoid foreign key constraints
        console.log('Deleting related records...');
        // We catch errors here in case tables don't exist or other issues, but proceed
        try { await AppDataSource.getRepository(TaskOffer).delete({ task: { id: In(taskIds) } }); } catch (e) { console.warn('Error deleting offers:', e); }
        try { await AppDataSource.getRepository(TaskWaitingList).delete({ task: { id: In(taskIds) } }); } catch (e) { console.warn('Error deleting waiting list:', e); }
        try { await AppDataSource.getRepository(TaskPart).delete({ task: { id: In(taskIds) } }); } catch (e) { console.warn('Error deleting parts:', e); }
        try { await AppDataSource.getRepository(Notification).delete({ task: { id: In(taskIds) } }); } catch (e) { console.warn('Error deleting notifications:', e); }
        try { await AppDataSource.getRepository(TaskAttachment).delete({ task: { id: In(taskIds) } }); } catch (e) { console.warn('Error deleting attachments:', e); }
        try { await AppDataSource.getRepository(TaskLink).delete({ task: { id: In(taskIds) } }); } catch (e) { console.warn('Error deleting links:', e); }
        try { await AppDataSource.getRepository(TaskReport).delete({ task: { id: In(taskIds) } }); } catch (e) { console.warn('Error deleting reports:', e); }
        try { await AppDataSource.getRepository(TaskFeedback).delete({ task: { id: In(taskIds) } }); } catch (e) { console.warn('Error deleting feedback:', e); }
        
        // Finally delete tasks
        await taskRepository.remove(tasks);
    }
    console.log('Deleted existing tasks.');

    console.log('Creating new tasks...');

    const newTasksData = [
      {
        title: 'Pemasangan PC Baru di HQ',
        description: 'Memasang dan konfigurasi 5 unit PC baru untuk jabatan kewangan.',
        client_location: 'Kuala Lumpur',
        state: 'Wilayah Persekutuan',
        offer_price: 150.00,
        deadline: new Date(new Date().setDate(new Date().getDate() + 3)), // 3 days from now
        support_type: 'Onsite Support',
        log_number: 'LOG-001',
      },
      {
        title: 'Troubleshoot Printer Network',
        description: 'Printer di tingkat 2 tidak boleh connect ke network.',
        client_location: 'Petaling Jaya',
        state: 'Selangor',
        offer_price: 80.00,
        deadline: new Date(new Date().setDate(new Date().getDate() + 1)),
        support_type: 'Onsite Support',
        log_number: 'LOG-002',
      },
      {
        title: 'Format Laptop Staff',
        description: 'Format semula laptop staff HR dan install software asas.',
        client_location: 'Shah Alam',
        state: 'Selangor',
        offer_price: 100.00,
        deadline: new Date(new Date().setDate(new Date().getDate() + 2)),
        support_type: 'Onsite Support',
        log_number: 'LOG-003',
      },
      {
        title: 'Server Maintenance Monthly',
        description: 'Routine maintenance untuk server database.',
        client_location: 'Cyberjaya',
        state: 'Selangor',
        offer_price: 300.00,
        deadline: new Date(new Date().setDate(new Date().getDate() + 5)),
        support_type: 'Onsite Support',
        log_number: 'LOG-004',
      },
      {
        title: 'Wifi Access Point Installation',
        description: 'Install 2 access point baru di meeting room.',
        client_location: 'Bangsar',
        state: 'Wilayah Persekutuan',
        offer_price: 200.00,
        deadline: new Date(new Date().setDate(new Date().getDate() + 4)),
        support_type: 'Onsite Support',
        log_number: 'LOG-005',
      }
    ];

    for (const taskData of newTasksData) {
      const task = new Task();
      task.title = taskData.title;
      task.description = taskData.description;
      task.client_location = taskData.client_location;
      task.state = taskData.state;
      task.offer_price = taskData.offer_price;
      task.deadline = taskData.deadline;
      task.support_type = taskData.support_type;
      task.log_number = taskData.log_number;
      task.status_id = newStatus.id; // Unassigned
      task.created_by = adminUser.id;
      task.assigned_to = undefined; // Explicitly null/undefined
      if (mainCon) task.main_con_id = mainCon.id;
      
      await taskRepository.save(task);
      console.log(`Created task: ${task.title}`);
    }

    console.log('All tasks reset successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error resetting tasks:', error);
    process.exit(1);
  }
}

resetTasks();
