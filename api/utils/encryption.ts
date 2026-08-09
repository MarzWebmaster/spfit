
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Algorithm: AES-256-GCM
// Key length: 32 bytes (256 bits)
// IV length: 16 bytes (128 bits) - standard for GCM is 12 bytes usually, but 16 is fine too. Let's use 12 bytes (96 bits) which is recommended for GCM.
// Auth tag length: 16 bytes (128 bits)

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; 
const AUTH_TAG_LENGTH = 16;

// Master key from environment
const MASTER_KEY_HEX = process.env.ENCRYPTION_KEY;

if (!MASTER_KEY_HEX) {
  console.warn('WARNING: ENCRYPTION_KEY is not set in environment variables. Encryption will fail.');
}

const getMasterKey = (): Buffer => {
    if (!MASTER_KEY_HEX) {
        throw new Error('Encryption key not configured');
    }
    // Ensure key is 32 bytes
    const key = Buffer.from(MASTER_KEY_HEX, 'hex');
    if (key.length !== 32) {
        throw new Error(`Invalid encryption key length. Expected 32 bytes, got ${key.length}`);
    }
    return key;
};

/**
 * Encrypts a text string
 * Format: "iv:authTag:encryptedContent" (hex encoded parts)
 */
export const encrypt = (text: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getMasterKey();
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return format: IV:AuthTag:EncryptedData
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts an encrypted string
 * Expects format: "iv:authTag:encryptedContent"
 * Returns null if decryption fails or format is invalid (so caller can handle legacy plain text)
 */
export const decrypt = (encryptedText: string): string | null => {
    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) {
            // Not in our encrypted format
            return null;
        }
        
        const [ivHex, authTagHex, encryptedHex] = parts;
        
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const key = getMasterKey();
        
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        // Decryption failed (wrong key, tampered data, or not encrypted)
        // console.error('Decryption failed:', error);
        return null;
    }
};

/**
 * Checks if a string looks like it is encrypted with our format
 */
export const isEncrypted = (text: string): boolean => {
    if (!text) return false;
    const parts = text.split(':');
    // Basic format check: 3 parts, hex characters
    return parts.length === 3 && 
           /^[0-9a-f]+$/i.test(parts[0]) && 
           /^[0-9a-f]+$/i.test(parts[1]) && 
           /^[0-9a-f]+$/i.test(parts[2]);
};

/**
 * List of keys that should always be encrypted
 */
export const SENSITIVE_KEYS = [
    'wasapmatic_api_key',
    'wasapmatic_device_id',
    'marz_wasap_api_secret',
    'marz_wasap_account_id',
    'smtp_password',
    'jwt_secret',
    'openai_api_key',
    'gemini_api_key',
    'stripe_secret_key',
    'stripe_webhook_secret'
];

export const isSensitiveKey = (key: string): boolean => {
    const lowerKey = key.toLowerCase();
    return SENSITIVE_KEYS.includes(lowerKey) || 
           lowerKey.endsWith('_key') || 
           lowerKey.endsWith('_secret') || 
           lowerKey.endsWith('_password') ||
           lowerKey.endsWith('_token');
};
