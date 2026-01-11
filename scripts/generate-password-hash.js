#!/usr/bin/env node

/**
 * Generate Base64-encoded bcrypt password hash for .env file
 * 
 * Usage:
 *   node scripts/generate-password-hash.js YourPassword
 */

const bcrypt = require('bcrypt');

const password = process.argv[2];

if (!password) {
  console.error('❌ Error: Please provide a password');
  console.log('\nUsage:');
  console.log('  node scripts/generate-password-hash.js YourPassword');
  process.exit(1);
}

console.log('🔒 Generating password hash...\n');

// Generate bcrypt hash
const hash = bcrypt.hashSync(password, 12);
console.log('Bcrypt hash:');
console.log(hash);

// Encode to Base64 (for .env file - avoids $ character issues)
const base64Hash = Buffer.from(hash).toString('base64');
console.log('\nBase64 encoded (use this in .env):');
console.log(base64Hash);

console.log('\n📝 Add to your .env file:');
console.log(`AUTH_PASSWORD_HASH_BASE64=${base64Hash}`);

console.log('\n✅ Done!');
