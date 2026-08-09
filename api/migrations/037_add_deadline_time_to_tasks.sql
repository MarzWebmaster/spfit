-- Migration to add deadline_time column to tasks table
-- This allows setting specific time for deadline notifications

ALTER TABLE tasks 
ADD COLUMN deadline_time TIME NULL DEFAULT NULL 
AFTER deadline;

-- Add index for better query performance on deadline_time
CREATE INDEX idx_tasks_deadline_time ON tasks(deadline_time);

-- Update existing tasks to have NULL deadline_time (optional)
UPDATE tasks SET deadline_time = NULL WHERE deadline_time IS NOT NULL;