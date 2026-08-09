import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const API_BASE_URL = 'http://localhost:3003/api';

// Admin user data
const adminUserData = {
  name: 'System Administrator',
  email: 'admin@spfit.com',
  password: 'Admin123!',
  role_id: 1, // Admin role
  phone: '0123456789',
  ic_number: '123456789012'
};

/**
 * Create admin user via registration
 */
async function createAdminUser() {
  console.log('🚀 Creating Admin User...');
  console.log('API Base URL:', API_BASE_URL);
  
  try {
    // Try to register admin user
    const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adminUserData)
    });
    
    const registerResult = await registerResponse.json();
    
    if (registerResult.success) {
      console.log('✅ Admin user created successfully:');
      console.log('   - ID:', registerResult.data.user.id);
      console.log('   - Name:', registerResult.data.user.name);
      console.log('   - Email:', registerResult.data.user.email);
      console.log('   - Role ID:', registerResult.data.user.role_id);
      console.log('   - Token:', registerResult.data.token);
      
      // Test login with the created admin
      console.log('\n=== Testing Admin Login ===');
      const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: adminUserData.email,
          password: adminUserData.password
        })
      });
      
      const loginResult = await loginResponse.json();
      
      if (loginResult.success) {
        console.log('✅ Admin login successful');
        console.log('   - Token:', loginResult.data.token);
        console.log('   - User ID:', loginResult.data.user.id);
        console.log('   - Role:', loginResult.data.user.role?.name || 'N/A');
        
        console.log('\n🎉 Admin user setup completed successfully!');
        console.log('You can now use these credentials:');
        console.log(`   Email: ${adminUserData.email}`);
        console.log(`   Password: ${adminUserData.password}`);
      } else {
        console.error('❌ Admin login failed:', loginResult.message);
      }
    } else {
      console.error('❌ Admin user creation failed:', registerResult.message);
      if (registerResult.errors) {
        registerResult.errors.forEach(error => {
          console.error(`   - ${error.field}: ${error.message}`);
        });
      }
      
      // If user already exists, try to login
      if (registerResult.message && registerResult.message.includes('already exists')) {
        console.log('\n=== Admin user already exists, testing login ===');
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: adminUserData.email,
            password: adminUserData.password
          })
        });
        
        const loginResult = await loginResponse.json();
        
        if (loginResult.success) {
          console.log('✅ Admin login successful with existing credentials');
          console.log('   - Token:', loginResult.data.token);
          console.log('   - User ID:', loginResult.data.user.id);
          console.log('   - Role:', loginResult.data.user.role?.name || 'N/A');
        } else {
          console.error('❌ Admin login failed:', loginResult.message);
          console.log('\n💡 Possible solutions:');
          console.log('   1. Check if the backend server is running on port 3002');
          console.log('   2. Verify database connection and tables exist');
          console.log('   3. Check if admin user exists in database with different credentials');
        }
      }
    }
  } catch (error) {
    console.error('❌ Error during admin user creation:', error.message);
    console.log('\n💡 Troubleshooting:');
    console.log('   1. Ensure backend server is running: npm run server:dev');
    console.log('   2. Check database connection in .env file');
    console.log('   3. Verify API endpoints are accessible');
  }
}

// Run the admin creation
createAdminUser().catch(error => {
  console.error('❌ Script execution failed:', error);
  process.exit(1);
});