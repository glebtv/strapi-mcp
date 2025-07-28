// Strapi 5 bootstrap script to create admin user and API tokens with proper permissions

export async function bootstrap({ strapi }: { strapi: any }) {
  console.log('🚀 Starting Strapi 5 token automation...');

  // Create admin user if it doesn't exist
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@ci.local';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123456'; // Updated to meet password requirements

  try {
    const existingAdmin = await strapi.db.query('admin::user').findOne({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      const hashedPassword = await strapi.service('admin::auth').hashPassword(adminPassword);
      
      // First, get the super admin role
      const superAdminRole = await strapi.db.query('admin::role').findOne({
        where: { code: 'strapi-super-admin' }
      });

      if (!superAdminRole) {
        console.error('❌ Super admin role not found');
        return;
      }
      
      await strapi.db.query('admin::user').create({
        data: {
          firstname: 'Admin',
          lastname: 'User',
          email: adminEmail,
          password: hashedPassword,
          isActive: true,
          blocked: false,
          roles: [superAdminRole.id]
        }
      });
      console.log('✅ Admin user created successfully');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
  }

  // Create API tokens with proper permissions
  const tokens = [
    {
      name: 'CI/CD Full Access',
      description: 'Full access token for CI/CD pipelines',
      type: 'custom' as const,
      permissions: [
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
        // i18n permissions
        'plugin::i18n.locales.listLocales'
      ],
      expiresAt: null
    },
    {
      name: 'Testing Read Only',
      description: 'Read-only token for automated testing',
      type: 'read-only' as const,
      expiresAt: null
    }
  ];

  for (const tokenConfig of tokens) {
    const existingToken = await strapi.db.query('admin::api-token').findOne({
      where: { name: tokenConfig.name }
    });

    if (existingToken) {
      console.log(`⚠️  Token "${tokenConfig.name}" already exists`);
      
      // Update permissions for full access token if needed
      if (tokenConfig.name === 'CI/CD Full Access' && tokenConfig.type === 'custom') {
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
    if (tokenConfig.type === 'custom' && 'permissions' in tokenConfig) {
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