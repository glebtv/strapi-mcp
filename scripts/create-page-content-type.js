#!/usr/bin/env node

// Script to create a page content type with dynamic zones and i18n

const axios = require('axios');

const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@test.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

let adminToken = null;

// Login as admin
async function login() {
  try {
    const response = await axios.post(`${STRAPI_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    adminToken = response.data.data.token;
    console.log('✅ Logged in as admin');
    return adminToken;
  } catch (error) {
    console.error('❌ Failed to login:', error.response?.data || error.message);
    throw error;
  }
}

// Create component
async function createComponent(componentData) {
  try {
    const response = await axios.post(
      `${STRAPI_URL}/content-type-builder/components`,
      componentData,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Created component: ${componentData.component.displayName}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to create component ${componentData.component.displayName}:`, error.response?.data || error.message);
    throw error;
  }
}

// Create content type
async function createContentType(contentTypeData) {
  try {
    const response = await axios.post(
      `${STRAPI_URL}/content-type-builder/content-types`,
      contentTypeData,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log(`✅ Created content type: ${contentTypeData.contentType.displayName}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Failed to create content type:`, error.response?.data || error.message);
    throw error;
  }
}

// Main setup function
async function setup() {
  console.log('🚀 Starting page content type setup...');
  
  try {
    // Login
    await login();
    
    // Create Hero component
    await createComponent({
      component: {
        category: 'sections',
        displayName: 'Hero',
        icon: 'star',
        attributes: {
          title: {
            type: 'string',
            required: true
          },
          subtitle: {
            type: 'string'
          },
          image: {
            type: 'media',
            multiple: false,
            required: false,
            allowedTypes: ['images']
          },
          cta: {
            type: 'component',
            repeatable: false,
            component: 'shared.button'
          }
        }
      }
    });
    
    // Create Button component (used by Hero)
    await createComponent({
      component: {
        category: 'shared',
        displayName: 'Button',
        icon: 'cursor',
        attributes: {
          label: {
            type: 'string',
            required: true
          },
          url: {
            type: 'string',
            required: true
          },
          style: {
            type: 'enumeration',
            enum: ['primary', 'secondary', 'outline'],
            default: 'primary'
          }
        }
      }
    });
    
    // Create Columns component
    await createComponent({
      component: {
        category: 'sections',
        displayName: 'Columns',
        icon: 'apps',
        attributes: {
          title: {
            type: 'string'
          },
          columns: {
            type: 'component',
            repeatable: true,
            component: 'shared.column'
          }
        }
      }
    });
    
    // Create Column component (used by Columns)
    await createComponent({
      component: {
        category: 'shared',
        displayName: 'Column',
        icon: 'file',
        attributes: {
          title: {
            type: 'string',
            required: true
          },
          content: {
            type: 'richtext'
          },
          icon: {
            type: 'string'
          }
        }
      }
    });
    
    // Create Prices component
    await createComponent({
      component: {
        category: 'sections',
        displayName: 'Prices',
        icon: 'dollar-sign',
        attributes: {
          title: {
            type: 'string',
            required: true
          },
          description: {
            type: 'text'
          },
          plans: {
            type: 'component',
            repeatable: true,
            component: 'shared.pricing-plan'
          }
        }
      }
    });
    
    // Create Pricing Plan component (used by Prices)
    await createComponent({
      component: {
        category: 'shared',
        displayName: 'Pricing Plan',
        icon: 'shopping-cart',
        attributes: {
          name: {
            type: 'string',
            required: true
          },
          price: {
            type: 'decimal',
            required: true
          },
          currency: {
            type: 'string',
            default: 'USD'
          },
          features: {
            type: 'json'
          },
          recommended: {
            type: 'boolean',
            default: false
          }
        }
      }
    });
    
    // Wait a bit for components to be registered
    console.log('⏳ Waiting for components to be registered...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Create Page content type with dynamic zone
    await createContentType({
      contentType: {
        kind: 'collectionType',
        displayName: 'Page',
        singularName: 'page',
        pluralName: 'pages',
        description: 'Pages with dynamic content sections',
        draftAndPublish: true,
        attributes: {
          title: {
            type: 'string',
            required: true,
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          },
          slug: {
            type: 'uid',
            targetField: 'title',
            required: true,
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          },
          sections: {
            type: 'dynamiczone',
            components: [
              'sections.hero',
              'sections.columns',
              'sections.prices'
            ],
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          },
          seo: {
            type: 'component',
            repeatable: false,
            component: 'shared.seo',
            pluginOptions: {
              i18n: {
                localized: true
              }
            }
          }
        },
        pluginOptions: {
          i18n: {
            localized: true
          }
        }
      }
    });
    
    // Create SEO component
    await createComponent({
      component: {
        category: 'shared',
        displayName: 'SEO',
        icon: 'search',
        attributes: {
          metaTitle: {
            type: 'string'
          },
          metaDescription: {
            type: 'text',
            maxLength: 160
          },
          metaImage: {
            type: 'media',
            multiple: false,
            required: false,
            allowedTypes: ['images']
          },
          keywords: {
            type: 'text'
          }
        }
      }
    });
    
    // Configure permissions for public access
    console.log('⏳ Waiting for content type to be fully created...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get public role
    const rolesResponse = await axios.get(`${STRAPI_URL}/users-permissions/roles`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    
    const publicRole = rolesResponse.data.roles.find(role => role.type === 'public');
    
    if (publicRole) {
      // Get current permissions
      const permissionsResponse = await axios.get(`${STRAPI_URL}/users-permissions/permissions`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      
      const permissions = permissionsResponse.data.permissions;
      
      // Enable find and findOne for pages
      if (permissions['api::page']) {
        permissions['api::page'].controllers.page = {
          find: { enabled: true, policy: '' },
          findOne: { enabled: true, policy: '' },
          create: { enabled: false, policy: '' },
          update: { enabled: false, policy: '' },
          delete: { enabled: false, policy: '' }
        };
      }
      
      // Update role permissions
      await axios.put(
        `${STRAPI_URL}/users-permissions/roles/${publicRole.id}`,
        {
          name: 'Public',
          description: 'Default role given to unauthenticated user.',
          permissions: permissions,
          users: []
        },
        {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        }
      );
      
      console.log('✅ Configured public permissions for pages');
    }
    
    console.log('🎉 Page content type setup complete!');
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setup();