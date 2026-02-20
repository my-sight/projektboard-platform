
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generate Ed25519 key pair
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
    modulusLength: 4096,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

console.log('Keys generated successfully.');

// --- OUTPUT ---

const envLocalPath = path.join(__dirname, '../.env.local');
const publicKeyPath = path.join(__dirname, '../src/constants/license_public_key.ts');
const secretsDir = path.join(__dirname, '../.secrets');

// 1. Ensure secrets dir exists (for admin's private key storage)
if (!fs.existsSync(secretsDir)) {
    fs.mkdirSync(secretsDir);
}

// 2. Save Private Key (Keep this safe!)
const privateKeyFile = path.join(secretsDir, 'license_private_key.pem');
fs.writeFileSync(privateKeyFile, privateKey);
console.log(`[SECRET] Private Key saved to: ${privateKeyFile}`);
console.log('   -> KEEP THIS SAFE. Do not commit to Git.');

// 3. Save Public Key as TypeScript constant
const publicKeyContent = `// Auto-generated public key for license verification
export const LICENSE_PUBLIC_KEY = \`
${publicKey.trim()}
\`;
`;

fs.writeFileSync(publicKeyPath, publicKeyContent);
console.log(`[PUBLIC] Public Key saved to: ${publicKeyPath}`);
