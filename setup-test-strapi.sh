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

# Build and start Strapi
echo "Building Strapi..."
npm run build

echo "Starting Strapi in background..."
npm run develop &
STRAPI_PID=$!
echo "Strapi PID: $STRAPI_PID"

# Wait for Strapi to be ready
echo "Waiting for Strapi to start..."
for i in {1..60}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:1337/_health | grep -q "204"; then
    echo "Strapi is ready!"
    break
  fi
  echo "Waiting... ($i/60)"
  sleep 2
done

# Create an API token using Strapi's admin API
# First, we need to create an admin user
ADMIN_EMAIL="test@example.com"
ADMIN_PASSWORD="Test1234!"

echo "Creating admin user..."
# Register the first admin user
ADMIN_JWT=$(curl -s -X POST http://localhost:1337/admin/register-admin \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASSWORD\",
    \"firstname\": \"Test\",
    \"lastname\": \"Admin\"
  }" | jq -r '.data.token')

if [ -z "$ADMIN_JWT" ] || [ "$ADMIN_JWT" = "null" ]; then
  echo "Failed to create admin user"
  exit 1
fi

echo "Admin user created successfully"

# Create an API token
echo "Creating API token..."
API_TOKEN_RESPONSE=$(curl -s -X POST http://localhost:1337/admin/api-tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "name": "CI Test Token",
    "description": "Token for CI tests",
    "type": "full-access",
    "lifespan": null
  }')

API_TOKEN=$(echo $API_TOKEN_RESPONSE | jq -r '.data.accessKey')

if [ -z "$API_TOKEN" ] || [ "$API_TOKEN" = "null" ]; then
  echo "Failed to create API token"
  echo "Response: $API_TOKEN_RESPONSE"
  exit 1
fi

echo "API token created successfully"

# Get public role ID
PUBLIC_ROLE_ID=$(curl -s http://localhost:1337/admin/roles \
  -H "Authorization: Bearer $ADMIN_JWT" | jq -r '.data[] | select(.type == "public") | .id')

echo "Updating public role permissions..."
# Enable all actions for public role (for testing)
curl -s -X PUT http://localhost:1337/admin/roles/$PUBLIC_ROLE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -d '{
    "permissions": {
      "api::project.project": {
        "controllers": {
          "project": {
            "find": { "enabled": true },
            "findOne": { "enabled": true },
            "create": { "enabled": true },
            "update": { "enabled": true },
            "delete": { "enabled": true }
          }
        }
      },
      "api::technology.technology": {
        "controllers": {
          "technology": {
            "find": { "enabled": true },
            "findOne": { "enabled": true },
            "create": { "enabled": true },
            "update": { "enabled": true },
            "delete": { "enabled": true }
          }
        }
      }
    }
  }'

echo ""
echo "========================================="
echo "Strapi test instance is ready!"
echo "========================================="
echo "Strapi URL: http://localhost:1337"
echo "Admin Email: $ADMIN_EMAIL"
echo "Admin Password: $ADMIN_PASSWORD"
echo "API Token: $API_TOKEN"
echo "Strapi PID: $STRAPI_PID"
echo ""
echo "To stop Strapi, run: kill $STRAPI_PID"
echo ""
echo "To run tests, use:"
echo "export STRAPI_URL=http://localhost:1337"
echo "export STRAPI_API_TOKEN=$API_TOKEN"
echo "npm test"