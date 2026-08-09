
const mysql = require('mysql2/promise');
require('dotenv').config();

console.log('Starting verification...');

async function verify() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'spfit_db'
    });

    console.log('Connected to DB.');

    const [rows] = await connection.execute(
      "SELECT * FROM system_settings WHERE setting_key IN ('wasapmatic_api_key', 'wasapmatic_device_id')"
    );

    console.log('Found settings:', rows.length);

    rows.forEach(row => {
        const val = row.setting_value;
        const parts = val.split(':');
        // Basic check: 3 parts separated by colon, first part is hex (IV)
        const isEncrypted = parts.length === 3 && /^[0-9a-f]+$/i.test(parts[0]);
        
        console.log(`Key: ${row.setting_key}`);
        console.log(`Value: ${val.substring(0, 30)}...`);
        console.log(`Is Encrypted? ${isEncrypted ? 'YES' : 'NO'}`);
        
        if (!isEncrypted) {
            console.error('FAILURE: Key should be encrypted!');
        }
    });

    await connection.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

verify();
