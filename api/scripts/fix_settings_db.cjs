
const mysql = require('mysql2/promise');

async function fix() {
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

    if (rows.length > 0) {
      const setting = rows[0];
      const val = setting.setting_value;
      console.log('Current value:', val);

      try {
        // Check if it is the problematic JSON string
        const parsed = JSON.parse(val);
        if (parsed && parsed.setting_value) {
          console.log('Found double-wrapped value. Fixing to:', parsed.setting_value);
          
          await connection.execute(
            'UPDATE system_settings SET setting_value = ? WHERE id = ?',
            [parsed.setting_value, setting.id]
          );
          console.log('Fixed.');
        } else {
            console.log('Value is not double-wrapped (or different format). Skipping.');
        }
      } catch (e) {
        console.log('Value is not JSON (or parsing failed). Skipping.', e.message);
      }
    } else {
        console.log('Setting not found.');
    }

    await connection.end();
  } catch (err) {
    console.error(err);
  }
}

fix();
