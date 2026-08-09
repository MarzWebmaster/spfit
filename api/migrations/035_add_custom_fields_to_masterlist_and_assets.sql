-- Migration: Add custom fields to masterlists and assets
-- Description: Adds JSON columns to store custom field definitions and values.

ALTER TABLE `masterlists` 
ADD COLUMN `custom_fields_definition` JSON NULL AFTER `status`;

ALTER TABLE `assets` 
ADD COLUMN `custom_fields_values` JSON NULL AFTER `notes`;
