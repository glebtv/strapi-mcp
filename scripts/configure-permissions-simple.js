#!/usr/bin/env node

/**
 * Simple script to configure public permissions for test content types
 * This allows REST API access without authentication
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to Strapi database
const dbPath = path.join(__dirname, '../strapi-test/.tmp/data.db');

console.log('🔓 Configuring public permissions for test content types...');
console.log(`📂 Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to the SQLite database.');
});

// Find the public role
db.get("SELECT id FROM up_roles WHERE type = 'public'", (err, publicRole) => {
  if (err || !publicRole) {
    console.error('❌ Could not find public role:', err);
    db.close();
    process.exit(1);
  }

  console.log(`✅ Found public role with ID: ${publicRole.id}`);

  // Define permissions to grant
  const permissions = [
    // Project permissions
    'api::project.project.find',
    'api::project.project.findOne',
    'api::project.project.create',
    'api::project.project.update',
    'api::project.project.delete',
    // Technology permissions
    'api::technology.technology.find',
    'api::technology.technology.findOne',
    'api::technology.technology.create',
    'api::technology.technology.update',
    'api::technology.technology.delete',
    // Upload permissions
    'plugin::upload.content-api.find',
    'plugin::upload.content-api.findOne',
    'plugin::upload.content-api.upload',
    'plugin::upload.content-api.destroy',
  ];

  // Insert permissions
  let insertCount = 0;
  let errorCount = 0;

  permissions.forEach((action, index) => {
    // Generate a unique document_id for each permission
    const documentId = `perm_${Date.now()}_${index}`;
    
    // First, insert the permission
    db.run(
      "INSERT INTO up_permissions (document_id, action, created_at, updated_at, published_at) VALUES (?, ?, datetime('now'), datetime('now'), datetime('now'))",
      [documentId, action],
      function(err) {
        if (err) {
          console.error(`❌ Error inserting permission ${action}:`, err.message);
          errorCount++;
        } else {
          const permissionId = this.lastID;
          
          // Then link it to the public role
          db.run(
            "INSERT INTO up_permissions_role_lnk (permission_id, role_id, permission_ord) VALUES (?, ?, ?)",
            [permissionId, publicRole.id, index + 1],
            (linkErr) => {
              if (linkErr) {
                console.error(`❌ Error linking permission ${action}:`, linkErr.message);
                errorCount++;
              } else {
                console.log(`✅ Granted permission: ${action}`);
                insertCount++;
              }
              
              // Check if we're done
              if (insertCount + errorCount === permissions.length) {
                console.log(`\n📊 Summary: ${insertCount} permissions granted, ${errorCount} errors`);
                db.close();
                process.exit(errorCount > 0 ? 1 : 0);
              }
            }
          );
        }
      }
    );
  });
});