import mysql from 'mysql2/promise';

async function checkUsers() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'spfit_user',
      password: 'secure_password',
      database: 'spfit_db'
    });

    console.log('Connected to database successfully');
    
    // Check users table structure
    const [userColumns] = await connection.execute('DESCRIBE users');
    console.log('Users table structure:');
    console.table(userColumns);
    
    // Check roles table
    const [roles] = await connection.execute('SELECT * FROM roles');
    console.log('\nRoles in database:');
    console.table(roles);
    
    // Check users data with available columns
    const [users] = await connection.execute('SELECT * FROM users LIMIT 5');
    console.log('\nUsers in database:');
    console.table(users);
    
    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkUsers();