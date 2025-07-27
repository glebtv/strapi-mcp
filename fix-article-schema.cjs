const fs = require('fs');
const path = require('path');

// Fix the article schema to properly enable i18n at the content type level
const schemaPath = path.join(__dirname, 'strapi-test/src/api/article/content-types/article/schema.json');

if (fs.existsSync(schemaPath)) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  
  console.log('Current schema:', JSON.stringify(schema, null, 2));
  
  // Add i18n plugin options at the content type level
  if (!schema.pluginOptions) {
    schema.pluginOptions = {};
  }
  
  schema.pluginOptions.i18n = {
    localized: true
  };
  
  console.log('\nFixed schema:', JSON.stringify(schema, null, 2));
  
  // Write the fixed schema
  fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
  
  console.log('\n✅ Schema fixed! The article content type now has i18n enabled at the content type level.');
  console.log('⚠️  You need to restart Strapi for this change to take effect.');
} else {
  console.log('Article schema file not found at:', schemaPath);
}