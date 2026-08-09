-- Remove action_taken column from tasks table since all task completion data now stored in task_done table
ALTER TABLE tasks DROP COLUMN action_taken;
