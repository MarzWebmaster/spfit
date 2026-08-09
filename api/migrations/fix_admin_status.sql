-- Fix admin user status to match UserStatus enum
UPDATE `users` SET `status` = 'Aktif' WHERE `email` = 'admin@spfit.com';