/**
 * Script to set up i18n locales in a Strapi instance
 * This should be run after Strapi is started to add the required locales
 */

import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;

interface Locale {
  code: string;
  name: string;
  isDefault?: boolean;
}

const requiredLocales: Locale[] = [
  { code: 'ru', name: 'Russian', isDefault: false },
  { code: 'zh', name: 'Chinese (Simplified)', isDefault: false }
];

async function loginAdmin() {
  try {
    const response = await axios.post(`${STRAPI_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    return response.data.data.token;
  } catch (error) {
    console.error('Failed to login as admin:', error);
    throw error;
  }
}

async function getExistingLocales(token: string) {
  try {
    const response = await axios.get(`${STRAPI_URL}/i18n/locales`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Failed to get existing locales:', error);
    return [];
  }
}

async function createLocale(locale: Locale, token: string) {
  try {
    const response = await axios.post(
      `${STRAPI_URL}/i18n/locales`,
      locale,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`✅ Created locale: ${locale.code} (${locale.name})`);
    return response.data;
  } catch (error: any) {
    console.error(`❌ Failed to create locale ${locale.code}:`, error.response?.data || error.message);
    throw error;
  }
}

async function setupLocales() {
  console.log('🌍 Setting up i18n locales...');
  
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Admin credentials not found. Please set STRAPI_ADMIN_EMAIL and STRAPI_ADMIN_PASSWORD');
    process.exit(1);
  }

  try {
    // Login as admin
    console.log('🔑 Logging in as admin...');
    const token = await loginAdmin();
    
    // Get existing locales
    console.log('📋 Checking existing locales...');
    const existingLocales = await getExistingLocales(token);
    const existingCodes = existingLocales.map((l: any) => l.code);
    
    console.log(`Found ${existingLocales.length} existing locales:`, existingCodes.join(', '));
    
    // Create missing locales
    for (const locale of requiredLocales) {
      if (!existingCodes.includes(locale.code)) {
        await createLocale(locale, token);
      } else {
        console.log(`✓ Locale ${locale.code} already exists`);
      }
    }
    
    console.log('✅ i18n locale setup complete!');
  } catch (error) {
    console.error('❌ Failed to setup locales:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  setupLocales();
}

export { setupLocales };