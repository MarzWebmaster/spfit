
const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const MASTER_KEY_HEX = process.env.ENCRYPTION_KEY;

if (!MASTER_KEY_HEX) {
    console.error('ENCRYPTION_KEY not set');
    process.exit(1);
}

const getMasterKey = () => {
    return Buffer.from(MASTER_KEY_HEX, 'hex');
};

const encrypt = (text) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getMasterKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

const isEncrypted = (text) => {
    if (!text) return false;
    const parts = text.split(':');
    return parts.length === 3 && 
           /^[0-9a-f]+$/i.test(parts[0]) && 
           /^[0-9a-f]+$/i.test(parts[1]) && 
           /^[0-9a-f]+$/i.test(parts[2]);
};

const SENSITIVE_KEYS = [
    'wasapmatic_api_key',
    'wasapmatic_device_id',
    'smtp_password',
    'jwt_secret',
    'openai_api_key',
    'gemini_api_key',
    'stripe_secret_key',
    'stripe_webhook_secret'
];

const isSensitiveKey = (key) => {
    const lowerKey = key.toLowerCase();
    return SENSITIVE_KEYS.includes(lowerKey) || 
           lowerKey.endsWith('_key') || 
           lowerKey.endsWith('_secret') || 
           lowerKey.endsWith('_password') ||
           lowerKey.endsWith('_token');
};

async function migrate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'spfit_db'
        });

        const [rows] = await connection.execute('SELECT * FROM system_settings');
        
        for (const row of rows) {
            if (isSensitiveKey(row.setting_key)) {
                if (!isEncrypted(row.setting_value)) {
                    console.log(`Encrypting ${row.setting_key}...`);
                    const encrypted = encrypt(row.setting_value);
                    await connection.execute(
                        'UPDATE system_settings SET setting_value = ? WHERE id = ?',
                        [encrypted, row.id]
                    );
                    console.log(`Done.`);
                } else {
                    console.log(`Skipping ${row.setting_key} (already encrypted)`);
                }
            }
        }

        console.log('Migration complete.');
        await connection.end();
    } catch (e) {
        console.error(e);
    }
}

migrate();
