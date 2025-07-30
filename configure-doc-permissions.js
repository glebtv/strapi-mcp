import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'strapi-test', '.tmp', 'data.db');

console.log('🔓 Configuring permissions for doc content type...');
console.log(`📂 Database path: ${DB_PATH}`);

const db = new Database(DB_PATH, { verbose: console.log });

try {
  // Get the public role ID
  const publicRole = db.prepare('SELECT id FROM up_roles WHERE type = ?').get('public');
  
  if (!publicRole) {
    console.error('❌ Public role not found');
    process.exit(1);
  }
  
  console.log(`✅ Found public role with ID: ${publicRole.id}`);
  
  // Define all doc permissions
  const docPermissions = [
    'api::doc.doc.find',
    'api::doc.doc.findOne',
    'api::doc.doc.create',
    'api::doc.doc.update',
    'api::doc.doc.delete'
  ];
  
  // Get the current timestamp for created_at and updated_at
  const now = new Date().toISOString();
  
  // Insert permissions
  const insertPermission = db.prepare(`
    INSERT OR IGNORE INTO up_permissions (action, created_at, updated_at)
    VALUES (?, ?, ?)
  `);
  
  const linkPermissionToRole = db.prepare(`
    INSERT OR IGNORE INTO up_permissions_role_lnk (permission_id, role_id, permission_ord)
    VALUES (?, ?, ?)
  `);
  
  let grantedCount = 0;
  let ord = 1;
  
  for (const action of docPermissions) {
    // Insert the permission
    const result = insertPermission.run(action, now, now);
    
    // Get the permission ID
    const permission = db.prepare('SELECT id FROM up_permissions WHERE action = ?').get(action);
    
    if (permission) {
      // Link to public role
      linkPermissionToRole.run(permission.id, publicRole.id, ord++);
      console.log(`✅ Granted permission: ${action}`);
      grantedCount++;
    }
  }
  
  // Also get authenticated role and grant permissions
  const authRole = db.prepare('SELECT id FROM up_roles WHERE type = ?').get('authenticated');
  
  if (authRole) {
    console.log(`\n✅ Found authenticated role with ID: ${authRole.id}`);
    
    for (const action of docPermissions) {
      const permission = db.prepare('SELECT id FROM up_permissions WHERE action = ?').get(action);
      
      if (permission) {
        linkPermissionToRole.run(permission.id, authRole.id, ord++);
        console.log(`✅ Granted permission to authenticated: ${action}`);
      }
    }
  }
  
  console.log(`\n📊 Summary: ${grantedCount} permissions granted for doc content type`);
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
} finally {
  db.close();
}