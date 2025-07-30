import axios from 'axios';

async function manualCreateDoc() {
  try {
    // First login to get fresh JWT
    console.log('Logging in to Strapi admin...');
    const loginResponse = await axios.post('http://localhost:1337/admin/login', {
      email: 'admin@ci.local',
      password: 'Admin123456',
    });
    
    const jwt = loginResponse.data.data.token;
    console.log('Login successful!');
    
    // Now create the doc content type
    console.log('Creating doc content type...');
    
    const payload = {
      data: {
        components: [],
        contentTypes: [
          {
            action: "create",
            uid: "api::doc.doc",
            status: "NEW",
            modelType: "contentType",
            attributes: [
              {
                action: "create",
                name: "name",
                properties: {
                  type: "string",
                  required: true,
                  pluginOptions: {
                    i18n: {
                      localized: true,
                    },
                  },
                },
              },
              {
                action: "create",
                name: "content",
                properties: {
                  type: "richtext",
                  pluginOptions: {
                    i18n: {
                      localized: true,
                    },
                  },
                },
              },
              {
                action: "create",
                name: "slug",
                properties: {
                  type: "uid",
                  targetField: "name",
                  pluginOptions: {
                    i18n: {
                      localized: false,
                    },
                  },
                },
              },
            ],
            kind: "collectionType",
            modelName: "Doc",
            globalId: "Doc",
            pluginOptions: {
              i18n: {
                localized: true,
              },
            },
            draftAndPublish: true,
            displayName: "Doc",
            singularName: "doc",
            pluralName: "docs",
          },
        ],
      },
    };
    
    const response = await axios.post(
      'http://localhost:1337/content-type-builder/update-schema',
      payload,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    console.log('Response:', response.status, response.statusText);
    
    // Wait for restart
    console.log('Waiting for Strapi to restart...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Check if it was created
    console.log('Checking if doc content type exists...');
    const checkResponse = await axios.get('http://localhost:1337/api/docs');
    console.log('Doc API response:', checkResponse.status);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.status, error.response.data);
    }
  }
}

manualCreateDoc();