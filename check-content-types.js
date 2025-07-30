import axios from 'axios';
import fs from 'fs';

// Load admin JWT from test token file
const testTokens = JSON.parse(fs.readFileSync('.test-tokens.json', 'utf8'));

async function checkContentTypes() {
  try {
    console.log('Fetching content types...');
    
    const response = await axios.get(
      'http://localhost:1337/content-type-builder/content-types',
      {
        headers: {
          Authorization: `Bearer ${testTokens.adminJwt}`,
        },
      }
    );
    
    console.log('Content types:', JSON.stringify(response.data, null, 2));
    
    // Check specifically for doc content type
    const docType = response.data.data?.find(ct => ct.uid === 'api::doc.doc');
    if (docType) {
      console.log('\nDoc content type found:');
      console.log(JSON.stringify(docType, null, 2));
    } else {
      console.log('\nDoc content type NOT found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

checkContentTypes();