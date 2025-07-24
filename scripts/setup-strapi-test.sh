#!/bin/bash

# Exit on error
set -e

# Load nvm and use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

echo "Using Node version: $(node --version)"
echo "Setting up Strapi test instance..."

# Create a minimal Strapi 5 project for testing
npx create-strapi@latest strapi-test \
  --typescript \
  --no-run \
  --no-example \
  --no-git-init \
  --dbclient=sqlite \
  --skip-cloud \
  --install

cd strapi-test

# Create required content types
mkdir -p src/api/project/content-types/project
mkdir -p src/api/project/controllers
mkdir -p src/api/project/routes
mkdir -p src/api/project/services

cat > src/api/project/content-types/project/schema.json << 'EOF'
{
  "kind": "collectionType",
  "collectionName": "projects",
  "info": {
    "singularName": "project",
    "pluralName": "projects",
    "displayName": "Project",
    "description": ""
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "description": {
      "type": "text"
    },
    "slug": {
      "type": "uid",
      "targetField": "name"
    },
    "technologies": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::technology.technology",
      "inversedBy": "projects"
    }
  }
}
EOF

mkdir -p src/api/technology/content-types/technology
mkdir -p src/api/technology/controllers
mkdir -p src/api/technology/routes
mkdir -p src/api/technology/services

cat > src/api/technology/content-types/technology/schema.json << 'EOF'
{
  "kind": "collectionType",
  "collectionName": "technologies",
  "info": {
    "singularName": "technology",
    "pluralName": "technologies",
    "displayName": "Technology",
    "description": ""
  },
  "options": {
    "draftAndPublish": true
  },
  "pluginOptions": {},
  "attributes": {
    "name": {
      "type": "string",
      "required": true
    },
    "projects": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::project.project",
      "mappedBy": "technologies"
    }
  }
}
EOF

# Generate routes and controllers
cat > src/api/project/routes/project.js << 'EOF'
'use strict';
const { createCoreRouter } = require('@strapi/strapi').factories;
module.exports = createCoreRouter('api::project.project');
EOF

cat > src/api/project/controllers/project.js << 'EOF'
'use strict';
const { createCoreController } = require('@strapi/strapi').factories;
module.exports = createCoreController('api::project.project');
EOF

cat > src/api/project/services/project.js << 'EOF'
'use strict';
const { createCoreService } = require('@strapi/strapi').factories;
module.exports = createCoreService('api::project.project');
EOF

cat > src/api/technology/routes/technology.js << 'EOF'
'use strict';
const { createCoreRouter } = require('@strapi/strapi').factories;
module.exports = createCoreRouter('api::technology.technology');
EOF

cat > src/api/technology/controllers/technology.js << 'EOF'
'use strict';
const { createCoreController } = require('@strapi/strapi').factories;
module.exports = createCoreController('api::technology.technology');
EOF

cat > src/api/technology/services/technology.js << 'EOF'
'use strict';
const { createCoreService } = require('@strapi/strapi').factories;
module.exports = createCoreService('api::technology.technology');
EOF

# Configure Strapi to allow API token generation
cat > config/admin.js << 'EOF'
module.exports = ({ env }) => ({
  auth: {
    secret: env('ADMIN_JWT_SECRET', 'someSecretKey'),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', 'someRandomSalt'),
  },
});
EOF

# Build Strapi
echo "Building Strapi..."
npm run build

echo "Setup complete! To start Strapi, run: cd strapi-test && npm run develop"