ALTER TABLE `tasks`
  ADD COLUMN `arrival_confirmed_at` datetime NULL,
  ADD COLUMN `arrival_latitude` decimal(10,7) NULL,
  ADD COLUMN `arrival_longitude` decimal(10,7) NULL,
  ADD COLUMN `arrival_accuracy_meters` decimal(10,2) NULL;