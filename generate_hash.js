const bcrypt = require('bcrypt');

async function generateHash() {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    console.log('Password hash for admin123:');
    console.log(hash);
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

generateHash();