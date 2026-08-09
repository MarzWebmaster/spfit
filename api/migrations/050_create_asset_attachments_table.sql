-- Create asset_attachments table
CREATE TABLE asset_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asset_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NULL,
    file_size INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_asset_attachments_asset_id (asset_id),
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);