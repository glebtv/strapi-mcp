import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    console.log('🚀 Starting test token automation...');
    
    // Create admin user
    const adminEmail = 'test@example.com';
    const adminPassword = 'Test1234!';
    
    const existingAdmin = await strapi.db.query('admin::user').findOne({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      const superAdminRole = await strapi.db.query('admin::role').findOne({
        where: { code: 'strapi-super-admin' }
      });

      if (superAdminRole) {
        const hashedPassword = await strapi.admin.services.auth.hashPassword(adminPassword);

        await strapi.db.query('admin::user').create({
          data: {
            firstname: 'Test',
            lastname: 'Admin',
            email: adminEmail,
            username: 'admin',
            password: hashedPassword,
            isActive: true,
            roles: [superAdminRole.id]
          }
        });
        
        console.log('✅ Admin user created successfully');
      }
    }

    // Create API token
    const tokenName = 'Test Token';
    const existingToken = await strapi.db.query('admin::api-token').findOne({
      where: { name: tokenName }
    });

    if (!existingToken) {
      const tokenService = strapi.service('admin::api-token');
      const token = await tokenService.create({
        name: tokenName,
        description: 'Full access token for tests',
        type: 'full-access',
        lifespan: null
      });

      console.log(`✅ Created token: ${tokenName}`);
      console.log(`🔑 Access Key: ${token.accessKey}`);
      
      // Save to environment for easy access
      process.env.STRAPI_API_TOKEN = token.accessKey;
    } else {
      console.log(`⚠️  Token "${tokenName}" already exists`);
      // For local testing, let's show the existing token
      process.env.STRAPI_API_TOKEN = existingToken.accessKey;
      console.log(`🔑 Using existing token`);
    }
    
    // Enable public permissions for content types
    const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' }
    });
    
    if (publicRole) {
      // Create or update permissions for projects
      const projectActions = [
        'api::project.project.find',
        'api::project.project.findOne',
        'api::project.project.create',
        'api::project.project.update',
        'api::project.project.delete'
      ];
      
      for (const action of projectActions) {
        const existingPerm = await strapi.db.query('plugin::users-permissions.permission').findOne({
          where: { role: publicRole.id, action }
        });
        
        if (existingPerm) {
          await strapi.db.query('plugin::users-permissions.permission').update({
            where: { id: existingPerm.id },
            data: { enabled: true }
          });
        } else {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              role: publicRole.id,
              action,
              enabled: true
            }
          });
        }
      }
      
      // Create or update permissions for technologies
      const techActions = [
        'api::technology.technology.find',
        'api::technology.technology.findOne',
        'api::technology.technology.create',
        'api::technology.technology.update',
        'api::technology.technology.delete'
      ];
      
      for (const action of techActions) {
        const existingPerm = await strapi.db.query('plugin::users-permissions.permission').findOne({
          where: { role: publicRole.id, action }
        });
        
        if (existingPerm) {
          await strapi.db.query('plugin::users-permissions.permission').update({
            where: { id: existingPerm.id },
            data: { enabled: true }
          });
        } else {
          await strapi.db.query('plugin::users-permissions.permission').create({
            data: {
              role: publicRole.id,
              action,
              enabled: true
            }
          });
        }
      }
      
      console.log('✅ Public permissions enabled');
    }
  },
};