#!/usr/bin/env node

// Test using Admin API
import axios from 'axios';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_EMAIL = process.env.STRAPI_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.STRAPI_ADMIN_PASSWORD;

let adminToken = null;

async function loginAdmin() {
  try {
    console.log(chalk.blue('Logging in as admin...'));
    const response = await axios.post(`${STRAPI_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    
    adminToken = response.data.data.token;
    console.log(chalk.green('✓ Admin login successful'));
    console.log(chalk.gray(`Token: ${adminToken.substring(0, 20)}...`));
    return true;
  } catch (error) {
    console.log(chalk.red('✗ Admin login failed:'), error.response?.data || error.message);
    return false;
  }
}

async function testAdminMe() {
  try {
    console.log(chalk.blue('\n=== Testing Admin /me Endpoint ==='));
    const response = await axios.get(`${STRAPI_URL}/admin/users/me`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(chalk.green('✓ Admin /me successful'));
    console.log(chalk.gray(`User: ${response.data.data.email}`));
    return true;
  } catch (error) {
    console.log(chalk.red('✗ Admin /me failed:'), error.response?.status, error.response?.data || error.message);
    return false;
  }
}

async function listContentTypes() {
  try {
    console.log(chalk.blue('\n=== Listing Content Types ==='));
    const response = await axios.get(`${STRAPI_URL}/content-manager/content-types`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(chalk.green('✓ Content types listed successfully'));
    const contentTypes = response.data.data;
    
    // Find homepage content type
    const homepage = contentTypes.find(ct => ct.uid === 'api::homepage.homepage');
    if (homepage) {
      console.log(chalk.cyan('Found homepage content type:'));
      console.log(chalk.gray(JSON.stringify(homepage, null, 2)));
    }
    
    return contentTypes;
  } catch (error) {
    console.log(chalk.red('✗ Failed to list content types:'), error.response?.status, error.response?.data || error.message);
    return [];
  }
}

async function getHomepageEntries() {
  try {
    console.log(chalk.blue('\n=== Getting Homepage Entries ==='));
    
    // Try with proper pagination params
    const response = await axios.get(`${STRAPI_URL}/content-manager/collection-types/api::homepage.homepage`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      params: {
        page: 1,
        pageSize: 100,
        sort: 'createdAt:desc'
      }
    });
    
    console.log(chalk.green('✓ Homepage entries fetched successfully'));
    const entries = response.data.results || [];
    console.log(chalk.cyan(`Found ${entries.length} homepage entries`));
    
    // Analyze entries
    const localeGroups = {};
    entries.forEach(entry => {
      const locale = entry.locale || 'default';
      if (!localeGroups[locale]) {
        localeGroups[locale] = [];
      }
      localeGroups[locale].push(entry);
    });
    
    console.log(chalk.yellow('\nEntries by locale:'));
    for (const [locale, localeEntries] of Object.entries(localeGroups)) {
      console.log(`  ${locale}: ${localeEntries.length} entries`);
      if (localeEntries.length > 1) {
        console.log(chalk.red(`    ⚠️  Duplicate entries detected!`));
        localeEntries.forEach(entry => {
          console.log(`      - ID: ${entry.id}, DocumentID: ${entry.documentId}, Created: ${entry.createdAt}`);
        });
      }
    }
    
    return { entries, localeGroups };
  } catch (error) {
    console.log(chalk.red('✗ Failed to get homepage entries:'), error.response?.status, error.response?.data || error.message);
    return { entries: [], localeGroups: {} };
  }
}

async function deleteHomepageEntry(entryId) {
  try {
    const deleteUrl = `${STRAPI_URL}/content-manager/collection-types/api::homepage.homepage/${entryId}`;
    console.log(chalk.gray(`Deleting: ${deleteUrl}`));
    
    const response = await axios.delete(deleteUrl, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(chalk.green(`✓ Deleted entry ${entryId}`));
    return true;
  } catch (error) {
    console.log(chalk.red(`✗ Failed to delete entry ${entryId}:`), error.response?.status, error.response?.data || error.message);
    return false;
  }
}

async function fixDuplicates(localeGroups) {
  console.log(chalk.blue('\n=== Fixing Duplicate Entries ==='));
  let deletedCount = 0;
  
  for (const [locale, localeEntries] of Object.entries(localeGroups)) {
    if (localeEntries.length > 1) {
      console.log(chalk.yellow(`\nFixing duplicates for locale: ${locale}`));
      
      // Sort by creation date, keep the oldest
      const sortedEntries = localeEntries.sort((a, b) => 
        new Date(a.createdAt) - new Date(b.createdAt)
      );
      
      const toKeep = sortedEntries[0];
      const toDelete = sortedEntries.slice(1);
      
      console.log(chalk.cyan(`Keeping entry: ${toKeep.documentId || toKeep.id} (created: ${toKeep.createdAt})`));
      
      for (const entry of toDelete) {
        const entryId = entry.documentId || entry.id;
        const deleted = await deleteHomepageEntry(entryId);
        if (deleted) {
          deletedCount++;
        }
      }
    }
  }
  
  if (deletedCount > 0) {
    console.log(chalk.green(`\n✓ Successfully deleted ${deletedCount} duplicate entries`));
  } else {
    console.log(chalk.cyan('\n✓ No duplicates to fix'));
  }
}

async function main() {
  console.log(chalk.blue.bold('Strapi Admin API Test'));
  console.log(chalk.gray(`Strapi URL: ${STRAPI_URL}`));
  console.log(chalk.gray(`Admin Email: ${ADMIN_EMAIL}\n`));
  
  // Login as admin
  const loginSuccess = await loginAdmin();
  if (!loginSuccess) {
    console.log(chalk.red('\nCannot proceed without admin login'));
    process.exit(1);
  }
  
  // Test admin endpoints
  await testAdminMe();
  
  // List content types
  await listContentTypes();
  
  // Get homepage entries
  const { entries, localeGroups } = await getHomepageEntries();
  
  // Fix duplicates if found
  if (entries.length > 0) {
    await fixDuplicates(localeGroups);
    
    // Verify fix
    console.log(chalk.blue('\n=== Verifying Fix ==='));
    const { entries: newEntries } = await getHomepageEntries();
  }
  
  console.log(chalk.blue('\n=== Test Complete ==='));
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});