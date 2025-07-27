const axios = require('axios');

async function debugLocales() {
  const baseUrl = 'http://localhost:1337';
  const documentId = process.argv[2];
  
  if (!documentId) {
    console.error('Usage: node test-locale-debug.js <documentId>');
    process.exit(1);
  }
  
  // Load tokens from test-tokens.json
  const testTokens = require('./test-tokens.json');
  const token = testTokens.fullAccessToken;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  console.log('Testing locale fetching for documentId:', documentId);
  console.log('='.repeat(60));
  
  try {
    // Test 1: Fetch without locale parameter
    console.log('\n1. Fetch without locale parameter:');
    const defaultFetch = await axios.get(`${baseUrl}/api/docs/${documentId}`, { headers });
    console.log('Response:', JSON.stringify(defaultFetch.data.data, null, 2));
    
    // Test 2: Fetch with locale=en
    console.log('\n2. Fetch with locale=en:');
    const enFetch = await axios.get(`${baseUrl}/api/docs/${documentId}?locale=en`, { headers });
    console.log('Response:', JSON.stringify(enFetch.data.data, null, 2));
    
    // Test 3: Fetch with locale=ru
    console.log('\n3. Fetch with locale=ru:');
    const ruFetch = await axios.get(`${baseUrl}/api/docs/${documentId}?locale=ru`, { headers });
    console.log('Response:', JSON.stringify(ruFetch.data.data, null, 2));
    
    // Test 4: Fetch with locale=zh
    console.log('\n4. Fetch with locale=zh:');
    const zhFetch = await axios.get(`${baseUrl}/api/docs/${documentId}?locale=zh`, { headers });
    console.log('Response:', JSON.stringify(zhFetch.data.data, null, 2));
    
    // Test 5: Fetch all with populate localizations
    console.log('\n5. Fetch with populate=localizations:');
    const popFetch = await axios.get(`${baseUrl}/api/docs/${documentId}?populate=localizations`, { headers });
    console.log('Response:', JSON.stringify(popFetch.data.data, null, 2));
    
    // Test 6: Fetch all docs
    console.log('\n6. Fetch all docs (no locale filter):');
    const allFetch = await axios.get(`${baseUrl}/api/docs`, { headers });
    console.log('Total docs:', allFetch.data.data.length);
    allFetch.data.data.forEach(doc => {
      console.log(`- ID: ${doc.id}, DocumentID: ${doc.documentId}, Name: ${doc.name}, Locale: ${doc.locale || 'N/A'}`);
    });
    
    // Test 7: Fetch all docs with locale=all
    console.log('\n7. Fetch all docs with locale=all:');
    const allLocaleFetch = await axios.get(`${baseUrl}/api/docs?locale=all`, { headers });
    console.log('Total docs:', allLocaleFetch.data.data.length);
    allLocaleFetch.data.data.forEach(doc => {
      console.log(`- ID: ${doc.id}, DocumentID: ${doc.documentId}, Name: ${doc.name}, Locale: ${doc.locale || 'N/A'}`);
    });
    
    // Test 8: Check available locales
    console.log('\n8. Available locales:');
    const localesRes = await axios.get(`${baseUrl}/api/i18n/locales`, { headers });
    console.log('Locales:', JSON.stringify(localesRes.data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

debugLocales();