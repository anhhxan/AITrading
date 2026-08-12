import crypto from 'crypto';

// Format: v1:<base64(iv + ciphertext + authTag)>
// IV is always 12 bytes for GCM. Auth tag is 16 bytes.

function getKey(): Buffer {
  const keyStr = process.env.ENCRYPTION_KEY;
  if (!keyStr) {
    throw new Error('ENCRYPTION_KEY is not set');
  }
  const key = Buffer.from(keyStr, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes when base64 decoded');
  }
  return key;
}

export function encryptCredential(plaintext: string): string {
  if (!plaintext) return plaintext;
  
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  
  // Combine: iv (12) + encrypted (N) + authTag (16)
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return `v1:${combined.toString('base64')}`;
}

export function decryptCredential(encryptedData: string): string {
  if (!encryptedData) return encryptedData;
  if (!encryptedData.startsWith('v1:')) {
    throw new Error('Unsupported encryption version');
  }

  const key = getKey();
  const b64Data = encryptedData.slice(3);
  const combined = Buffer.from(b64Data, 'base64');
  
  if (combined.length < 28) { // 12 IV + 16 AuthTag + at least 0 bytes ciphertext
    throw new Error('Invalid encrypted data format');
  }

  const iv = combined.subarray(0, 12);
  const authTag = combined.subarray(combined.length - 16);
  const encrypted = combined.subarray(12, combined.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
