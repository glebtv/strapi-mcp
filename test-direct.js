#!/usr/bin/env node

// Direct test of Strapi connection and API
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
    return true;
  } catch (error) {
    console.log(chalk.red('✗ Admin login failed:'), error.response?.data || error.message);
    return false;
  }
}

async function testHomepageEntries() {
  try {
    console.log(chalk.blue('\n=== Testing Homepage Entries ==='));
    
    // Try public API first
    try {
      const publicResponse = await axios.get(`${STRAPI_URL}/api/homepages`);
      console.log(chalk.cyan(`Found ${publicResponse.data.data.length} homepage entries via public API`));
      
      const entries = publicResponse.data.data;
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
      
      return entries;
    } catch (error) {
      console.log(chalk.yellow('Public API failed, trying admin API...'));
      
      // Try admin API if public fails
      if (adminToken) {
        const adminResponse = await axios.get(
          `${STRAPI_URL}/content-manager/collection-types/api::homepage.homepage`,
          {
            headers: {
              'Authorization': `Bearer ${adminToken}`,
              'Content-Type': 'application/json'
            },
            params: {
              page: 1,
              pageSize: 100
            }
          }
        );
      
      console.log(chalk.cyan(`Found ${adminResponse.data.results.length} homepage entries via admin API`));
      
      // Check for duplicates
      const entries = adminResponse.data.results;
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
      
      // Fix duplicates
      console.log(chalk.blue('\n=== Fixing Duplicates ==='));
      let deletedCount = 0;
      
      for (const [locale, localeEntries] of Object.entries(localeGroups)) {
        if (localeEntries.length > 1) {
          // Keep the first entry, delete the rest
          const entriesToDelete = localeEntries.slice(1);
          
          for (const entry of entriesToDelete) {
            try {
              const deleteUrl = `${STRAPI_URL}/content-manager/collection-types/api::homepage.homepage/${entry.documentId || entry.id}`;
              await axios.delete(deleteUrl, {
                headers: {
                  'Authorization': `Bearer ${adminToken}`,
                  'Content-Type': 'application/json'
                }
              });
              
              console.log(chalk.green(`✓ Deleted duplicate entry ${entry.documentId || entry.id} (locale: ${locale})`));
              deletedCount++;
            } catch (error) {
              console.log(chalk.red(`✗ Failed to delete entry ${entry.documentId || entry.id}:`), error.response?.data || error.message);
            }
          }
        }
      }
      
      if (deletedCount > 0) {
        console.log(chalk.green(`\n✓ Successfully deleted ${deletedCount} duplicate entries`));
      } else {
        console.log(chalk.cyan('\n✓ No duplicates found'));
      }
      
    }
    
  } catch (error) {
    console.log(chalk.red('✗ Failed to test homepage entries:'), error.response?.data || error.message);
  }
}

async function main() {
  console.log(chalk.blue.bold('Direct Strapi Test'));
  console.log(chalk.gray(`Strapi URL: ${STRAPI_URL}\n`));
  
  // Test admin login
  const loginSuccess = await loginAdmin();
  
  if (loginSuccess) {
    // Test homepage entries
    await testHomepageEntries();
  }
  
  console.log(chalk.blue('\n=== Test Complete ==='));
}

main().catch(error => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});