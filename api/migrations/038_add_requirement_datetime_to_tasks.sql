ALTER TABLE tasks 
ADD COLUMN requirement_date DATE NULL AFTER service_stop_time,
ADD COLUMN requirement_time TIME NULL AFTER requirement_date;
