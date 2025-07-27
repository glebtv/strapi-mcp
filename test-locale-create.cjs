const axios = require('axios');

async function createAndTestLocales() {
  const baseUrl = 'http://localhost:1337';
  
  // Load tokens from test-tokens.json
  const testTokens = require('./test-tokens.json');
  const token = testTokens.fullAccessToken;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  try {
    // Create a document in English
    console.log('Creating English document...');
    const createRes = await axios.post(`${baseUrl}/api/docs`, {
      data: {
        name: 'Test Document',
        content: 'This is a test document in English',
        slug: 'test-document',
        publishDate: new Date().toISOString()
      }
    }, { headers });
    
    const documentId = createRes.data.data.documentId;
    console.log('Created document with documentId:', documentId);
    console.log('Response:', JSON.stringify(createRes.data.data, null, 2));
    
    // Create Russian version
    console.log('\nCreating Russian version...');
    const ruRes = await axios.put(`${baseUrl}/api/docs/${documentId}?locale=ru`, {
      data: {
        name: 'Тестовый документ',
        content: 'Это тестовый документ на русском языке',
        slug: 'test-document-ru'
      }
    }, { headers });
    console.log('Russian response:', JSON.stringify(ruRes.data.data, null, 2));
    
    // Create Chinese version
    console.log('\nCreating Chinese version...');
    const zhRes = await axios.put(`${baseUrl}/api/docs/${documentId}?locale=zh`, {
      data: {
        name: '测试文档',
        content: '这是一个中文测试文档',
        slug: 'test-document-zh'
      }
    }, { headers });
    console.log('Chinese response:', JSON.stringify(zhRes.data.data, null, 2));
    
    // Now run the debug script
    console.log('\n' + '='.repeat(60));
    console.log('Running locale debug tests...');
    console.log('='.repeat(60));
    
    const { spawn } = require('child_process');
    const debug = spawn('node', ['test-locale-debug.cjs', documentId], { stdio: 'inherit' });
    
    debug.on('close', (code) => {
      console.log(`\nDebug script exited with code ${code}`);
      console.log('\nDocument ID for manual testing:', documentId);
      console.log('To test manually, run: node test-locale-debug.cjs', documentId);
    });
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

createAndTestLocales();