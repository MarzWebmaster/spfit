
const mysql = require('mysql2/promise');

async function check() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'spfit_db'
    });

    const [rows] = await connection.execute(
      'SELECT * FROM system_settings WHERE setting_key = ?',
      ['spfit_default_freelancer_role_id']
    );

    console.log('Existing setting:', rows);
    
    // Also check role types just in case
    const [roles] = await connection.execute('SELECT id, name FROM roles LIMIT 5');
    console.log('Roles sample:', roles);

    await connection.end();
  } catch (err) {
    console.error(err);
  }
}

check();
