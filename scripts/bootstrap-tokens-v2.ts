// Strapi 5 bootstrap script to create admin user and API tokens with proper permissions
import type { Strapi } from '@strapi/strapi';

export default async function bootstrap({ strapi }: { strapi: Strapi }) {
  console.log('🚀 Starting Strapi 5 token automation...');

  // Create admin user if it doesn't exist
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ci.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123456';

  try {
    const existingAdmin = await strapi.db.query('admin::user').findOne({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      const hashedPassword = await strapi.service('admin::auth').hashPassword(adminPassword);
      
      await strapi.db.query('admin::user').create({
        data: {
          firstname: 'Admin',
          lastname: 'User',
          email: adminEmail,
          password: hashedPassword,
          isActive: true,
          blocked: false,
          roles: [1] // Super admin role
        }
      });
      console.log('✅ Admin user created successfully');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
  }

  // Create API tokens
  const tokens = [
    {
      name: 'CI/CD Full Access',
      description: 'Full access token for CI/CD pipelines',
      type: 'custom' as const,
      permissions: [] as any[], // Will be populated below
      expiresAt: null
    },
    {
      name: 'Testing Read Only',
      description: 'Read-only token for automated testing',
      type: 'read-only' as const,
      expiresAt: null
    }
  ];

  // Get all content type permissions for full access token
  const contentTypes = ['api::project.project', 'api::technology.technology'];
  const actions = ['find', 'findOne', 'create', 'update', 'delete'];
  
  // Build permissions array for full access token
  const fullPermissions: string[] = [];
  
  for (const contentType of contentTypes) {
    for (const action of actions) {
      fullPermissions.push(`${contentType}.${action}`);
    }
  }
  
  // Add upload permissions
  fullPermissions.push(
    'plugin::upload.content-api.find',
    'plugin::upload.content-api.findOne',
    'plugin::upload.content-api.upload',
    'plugin::upload.content-api.destroy'
  );
  
  // Add i18n permissions
  fullPermissions.push('plugin::i18n.locales.listLocales');
  
  // Set permissions for full access token
  tokens[0].permissions = fullPermissions;

  // Create tokens
  for (const tokenConfig of tokens) {
    const existingToken = await strapi.db.query('admin::api-token').findOne({
      where: { name: tokenConfig.name }
    });

    if (existingToken) {
      console.log(`⚠️  Token "${tokenConfig.name}" already exists`);
      
      // Update permissions if it's the full access token
      if (tokenConfig.name === 'CI/CD Full Access' && tokenConfig.permissions) {
        try {
          await strapi.db.query('admin::api-token').update({
            where: { id: existingToken.id },
            data: {
              type: 'custom',
              permissions: tokenConfig.permissions
            }
          });
          console.log(`✅ Updated permissions for ${tokenConfig.name}`);
        } catch (error) {
          console.error(`❌ Failed to update permissions:`, error);
        }
      }
      continue;
    }

    // Create token using the api-token service
    const tokenService = strapi.service('admin::api-token');
    const tokenData: any = {
      name: tokenConfig.name,
      description: tokenConfig.description,
      type: tokenConfig.type,
      lifespan: null
    };
    
    // Add permissions if custom type
    if (tokenConfig.type === 'custom' && tokenConfig.permissions) {
      tokenData.permissions = tokenConfig.permissions;
    }
    
    const token = await tokenService.create(tokenData);

    console.log(`✅ Created token: ${tokenConfig.name}`);
    console.log(`🔑 Access Key: ${token.accessKey}`);
    
    // Environment variable format for CI/CD
    const envVarName = tokenConfig.name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_TOKEN';
    console.log(`📝 Export: export ${envVarName}="${token.accessKey}"`);
  }
}