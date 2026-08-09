require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTableStructure() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    console.log('🔍 Checking users table structure...');
    
    const [rows] = await connection.execute('DESCRIBE users');
    
    console.log('\n📋 Users Table Structure:');
    rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.Field}: ${row.Type} (${row.Null === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Focus on experience column
    const experienceColumn = rows.find(row => row.Field === 'experience');
    if (experienceColumn) {
      console.log('\n🎯 Experience Column Details:');
      console.log(`   - Type: ${experienceColumn.Type}`);
      console.log(`   - Nullable: ${experienceColumn.Null}`);
      console.log(`   - Default: ${experienceColumn.Default}`);
    }
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTableStructure();