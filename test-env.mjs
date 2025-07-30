// Quick test to see if environment is being passed correctly
import dotenv from 'dotenv';

console.log('Test Environment:');
console.log('STRAPI_URL:', process.env.STRAPI_URL);
console.log('STRAPI_ADMIN_EMAIL:', process.env.STRAPI_ADMIN_EMAIL);
console.log('STRAPI_ADMIN_PASSWORD:', process.env.STRAPI_ADMIN_PASSWORD);
console.log('NODE_ENV:', process.env.NODE_ENV);

// Check if .env.test is loaded
const result = dotenv.config({ path: '.env.test' });
console.log('\nAfter loading .env.test:');
console.log('STRAPI_URL:', process.env.STRAPI_URL);
console.log('STRAPI_ADMIN_EMAIL:', process.env.STRAPI_ADMIN_EMAIL);
console.log('STRAPI_ADMIN_PASSWORD:', process.env.STRAPI_ADMIN_PASSWORD);