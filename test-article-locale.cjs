const axios = require('axios');

async function testArticleLocales() {
  const baseUrl = 'http://localhost:1337';
  
  // Load tokens from test-tokens.json
  const testTokens = require('./test-tokens.json');
  const token = testTokens.fullAccessToken;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    // First, check if article content type exists
    console.log('Checking article content type...');
    try {
      const check = await axios.get(`${baseUrl}/api/articles?pagination[limit]=1`, { headers });
      console.log('Articles endpoint exists, response:', check.data);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('Article content type does not exist. Creating it...');
        
        // Use MCP to create article content type with i18n
        const { spawn } = require('child_process');
        const mcp = spawn('node', ['build/index.js'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            STRAPI_URL: 'http://localhost:1337',
            STRAPI_ADMIN_EMAIL: testTokens.adminEmail,
            STRAPI_ADMIN_PASSWORD: testTokens.adminPassword
          }
        });

        const createContentTypeRequest = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'create_content_type',
            arguments: {
              displayName: 'Article',
              singularName: 'article',
              pluralName: 'articles',
              kind: 'collectionType',
              draftAndPublish: true,
              pluginOptions: {
                i18n: {
                  localized: true
                }
              },
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
                content: {
                  type: 'richtext',
                  required: false,
                  pluginOptions: {
                    i18n: {
                      localized: true
                    }
                  }
                },
                slug: {
                  type: 'uid',
                  targetField: 'title',
                  required: true
                }
              }
            }
          },
          id: 1
        };

        mcp.stdin.write(JSON.stringify(createContentTypeRequest) + '\n');
        
        // Wait for response
        await new Promise((resolve, reject) => {
          let output = '';
          mcp.stdout.on('data', (data) => {
            output += data;
            const lines = output.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const response = JSON.parse(line);
                  if (response.result) {
                    console.log('Content type created:', response.result);
                    mcp.kill();
                    resolve();
                  } else if (response.error) {
                    console.error('Error creating content type:', response.error);
                    mcp.kill();
                    reject(new Error(response.error.message));
                  }
                } catch (e) {
                  // Not a complete JSON line yet
                }
              }
            }
          });
          
          mcp.on('close', () => {
            resolve();
          });
        });
        
        // Wait for Strapi to reload
        console.log('Waiting for Strapi to reload...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // Set permissions
        console.log('Setting permissions...');
        const permMcp = spawn('node', ['build/index.js'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            STRAPI_URL: 'http://localhost:1337',
            STRAPI_ADMIN_EMAIL: testTokens.adminEmail,
            STRAPI_ADMIN_PASSWORD: testTokens.adminPassword
          }
        });

        const setPermissionsRequest = {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'update_content_type_permissions',
            arguments: {
              contentType: 'api::article.article',
              permissions: {
                public: {
                  find: true,
                  findOne: true,
                  create: false,
                  update: false,
                  delete: false
                },
                authenticated: {
                  find: true,
                  findOne: true,
                  create: true,
                  update: true,
                  delete: true
                }
              }
            }
          },
          id: 2
        };

        permMcp.stdin.write(JSON.stringify(setPermissionsRequest) + '\n');
        
        await new Promise((resolve) => {
          let output = '';
          permMcp.stdout.on('data', (data) => {
            output += data;
            const lines = output.split('\n');
            for (const line of lines) {
              if (line.trim()) {
                try {
                  const response = JSON.parse(line);
                  if (response.id === 2) {
                    console.log('Permissions set:', response);
                    permMcp.kill();
                    resolve();
                  }
                } catch (e) {
                  // Not a complete JSON line yet
                }
              }
            }
          });
          
          permMcp.on('close', () => {
            resolve();
          });
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Now create an article with locales
    console.log('\nCreating English article...');
    const createRes = await axios.post(`${baseUrl}/api/articles`, {
      data: {
        title: 'Test Article',
        content: 'This is a test article in English',
        slug: 'test-article'
      }
    }, { headers });
    
    const documentId = createRes.data.data.documentId;
    console.log('Created article with documentId:', documentId);
    console.log('Response:', JSON.stringify(createRes.data.data, null, 2));
    
    // Create Russian version
    console.log('\nCreating Russian version...');
    const ruRes = await axios.put(`${baseUrl}/api/articles/${documentId}?locale=ru`, {
      data: {
        title: 'Тестовая статья',
        content: 'Это тестовая статья на русском языке',
        slug: 'test-article-ru'
      }
    }, { headers });
    console.log('Russian response:', JSON.stringify(ruRes.data.data, null, 2));
    
    // Create Chinese version
    console.log('\nCreating Chinese version...');
    const zhRes = await axios.put(`${baseUrl}/api/articles/${documentId}?locale=zh`, {
      data: {
        title: '测试文章',
        content: '这是一篇中文测试文章',
        slug: 'test-article-zh'
      }
    }, { headers });
    console.log('Chinese response:', JSON.stringify(zhRes.data.data, null, 2));
    
    // Test fetching different locales
    console.log('\n' + '='.repeat(60));
    console.log('Testing locale fetching...');
    console.log('='.repeat(60));
    
    console.log('\n1. Fetch without locale parameter:');
    const defaultFetch = await axios.get(`${baseUrl}/api/articles/${documentId}`, { headers });
    console.log('Response:', JSON.stringify(defaultFetch.data.data, null, 2));
    
    console.log('\n2. Fetch with locale=en:');
    const enFetch = await axios.get(`${baseUrl}/api/articles/${documentId}?locale=en`, { headers });
    console.log('Response:', JSON.stringify(enFetch.data.data, null, 2));
    
    console.log('\n3. Fetch with locale=ru:');
    const ruFetch = await axios.get(`${baseUrl}/api/articles/${documentId}?locale=ru`, { headers });
    console.log('Response:', JSON.stringify(ruFetch.data.data, null, 2));
    
    console.log('\n4. Fetch with locale=zh:');
    const zhFetch = await axios.get(`${baseUrl}/api/articles/${documentId}?locale=zh`, { headers });
    console.log('Response:', JSON.stringify(zhFetch.data.data, null, 2));
    
    console.log('\n5. Fetch all articles (no locale):');
    const allFetch = await axios.get(`${baseUrl}/api/articles`, { headers });
    console.log('Total articles:', allFetch.data.data.length);
    allFetch.data.data.forEach(doc => {
      console.log(`- ID: ${doc.id}, DocumentID: ${doc.documentId}, Title: ${doc.title}, Locale: ${doc.locale || 'N/A'}`);
    });
    
    console.log('\n6. Fetch all articles with locale=all:');
    const allLocaleFetch = await axios.get(`${baseUrl}/api/articles?locale=all`, { headers });
    console.log('Total articles:', allLocaleFetch.data.data.length);
    allLocaleFetch.data.data.forEach(doc => {
      console.log(`- ID: ${doc.id}, DocumentID: ${doc.documentId}, Title: ${doc.title}, Locale: ${doc.locale || 'N/A'}`);
    });
    
    console.log('\n7. Fetch with populate=localizations:');
    const popFetch = await axios.get(`${baseUrl}/api/articles/${documentId}?populate=localizations`, { headers });
    console.log('Response:', JSON.stringify(popFetch.data.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testArticleLocales();