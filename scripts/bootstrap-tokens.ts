import type { Core } from '@strapi/strapi';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {
    // Add your own logic here.
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🚀 Starting Strapi 5 token automation...');
      
      await ensureAdminUser(strapi);
      await createApiTokens(strapi);
    }
  },

  destroy(/* { strapi }: { strapi: Core.Strapi } */) {
    // Add your own logic here.
  },
};

async function ensureAdminUser(strapi: Core.Strapi): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@strapi.local';
  
  const existingAdmin = await strapi.db.query('admin::user').findOne({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
    return;
  }

  const superAdminRole = await strapi.db.query('admin::role').findOne({
    where: { code: 'strapi-super-admin' }
  });

  if (!superAdminRole) {
    throw new Error('Super admin role not found');
  }

  const hashedPassword = await strapi.admin.services.auth.hashPassword(
    process.env.ADMIN_PASSWORD || 'defaultPassword123'
  );

  await strapi.db.query('admin::user').create({
    data: {
      firstname: process.env.ADMIN_FIRSTNAME || 'Admin',
      lastname: process.env.ADMIN_LASTNAME || 'User',
      email: adminEmail,
      username: process.env.ADMIN_USERNAME || 'admin',
      password: hashedPassword,
      isActive: true,
      roles: [superAdminRole.id]
    }
  });
  
  console.log('✅ Admin user created successfully');
}

async function createApiTokens(strapi: Core.Strapi): Promise<void> {
  const tokens = [
    {
      name: 'CI/CD Full Access',
      description: 'Full access token for CI/CD pipeline',
      type: 'full-access' as const,
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
      continue;
    }

    // Create token using the api-token service
    const tokenService = strapi.service('admin::api-token');
    const token = await tokenService.create({
      name: tokenConfig.name,
      description: tokenConfig.description,
      type: tokenConfig.type,
      lifespan: null
    });

    console.log(`✅ Created token: ${tokenConfig.name}`);
    console.log(`🔑 Access Key: ${token.accessKey}`);
    
    // Environment variable format for CI/CD
    const envVarName = tokenConfig.name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_TOKEN';
    console.log(`📝 Export: export ${envVarName}="${token.accessKey}"`);
  }
}