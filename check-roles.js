import mysql from 'mysql2/promise';

async function checkRoles() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'spfit_user',
      password: 'secure_password',
      database: 'spfit_db'
    });

    console.log('Connected to database successfully');
    
    // Check roles table
    const [roles] = await connection.execute('SELECT * FROM roles');
    console.log('Roles in database:');
    roles.forEach(role => {
      console.log(`ID: ${role.id}, Name: "${role.name}", Description: "${role.description}"`);
    });
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRoles();