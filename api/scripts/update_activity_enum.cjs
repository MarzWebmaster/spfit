
const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'spfit_db'
        });

        console.log('Modifying activity_logs.activity_type to VARCHAR...');
        await connection.execute(
            'ALTER TABLE activity_logs MODIFY COLUMN activity_type VARCHAR(50)'
        );
        console.log('Done.');

        await connection.end();
    } catch (e) {
        console.error(e);
    }
}

migrate();
