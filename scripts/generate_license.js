
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Load Private Key
const secretsDir = path.join(__dirname, '../.secrets');
const privateKeyFile = path.join(secretsDir, 'license_private_key.pem');

if (!fs.existsSync(privateKeyFile)) {
    console.error('Error: Private key not found. Run "node scripts/generate_keys.js" first.');
    process.exit(1);
}

const privateKey = fs.readFileSync(privateKeyFile, 'utf8');

// Configuration
const args = process.argv.slice(2);
const expiryDateInput = args[0]; // Format: YYYY-MM-DD

if (!expiryDateInput) {
    console.error('Usage: node scripts/generate_license.js YYYY-MM-DD [CustomerName]');
    console.log('Example: node scripts/generate_license.js 2025-12-31 "Acme Corp"');
    process.exit(1);
}

const expiryDate = new Date(expiryDateInput);
if (isNaN(expiryDate.getTime())) {
    console.error('Error: Invalid date format. Use YYYY-MM-DD.');
    process.exit(1);
}

// Payload
const payload = {
    expiry: expiryDate.toISOString().split('T')[0], // YYYY-MM-DD
    customer: args[1] || 'Standard Customer',
    created: new Date().toISOString()
};

const payloadString = JSON.stringify(payload);

// Sign
const signature = crypto.sign(null, Buffer.from(payloadString), privateKey);
const signatureBase64 = signature.toString('base64');
const payloadBase64 = Buffer.from(payloadString).toString('base64');

// Token Format: payload_base64.signature_base64
const token = `${payloadBase64}.${signatureBase64}`;

console.log('\n--- NEW LICENSE TOKEN ---');
console.log(`Customer: ${payload.customer}`);
console.log(`Expires:  ${payload.expiry}`);
console.log('-------------------------');
console.log(token);
console.log('-------------------------\n');
