#!/bin/bash

# Exit on error
set -e

# Load nvm and use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

echo "Using Node version: $(node --version)"
echo "🚀 Setting up Strapi test instance..."

# Generate secure random values for Strapi configuration
export APP_KEYS=$(openssl rand -base64 32)
export API_TOKEN_SALT=$(openssl rand -base64 32)
export ADMIN_JWT_SECRET=$(openssl rand -base64 32)
export TRANSFER_TOKEN_SALT=$(openssl rand -base64 32)
export ADMIN_PASSWORD=$(openssl rand -base64 16)
export JWT_SECRET=$(openssl rand -base64 32)

# Create a minimal Strapi 5 project for testing
echo "📦 Creating Strapi project..."
npx -y create-strapi@latest strapi-test \
  --typescript \
  --no-run \
  --no-example \
  --no-git-init \
  --dbclient=sqlite \
  --skip-cloud \
  --install

cd strapi-test

# Create .env file with proper configuration
echo "🔧 Creating .env file..."
cat > .env << EOF
HOST=0.0.0.0
PORT=1337
APP_KEYS=$APP_KEYS
API_TOKEN_SALT=$API_TOKEN_SALT
ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET
TRANSFER_TOKEN_SALT=$TRANSFER_TOKEN_SALT
JWT_SECRET=$JWT_SECRET
ADMIN_EMAIL=admin@ci.local
ADMIN_PASSWORD=$ADMIN_PASSWORD
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db
NODE_ENV=test
EOF

# Create config/plugins.js to configure the JWT secret
echo "🔧 Creating plugins configuration..."
mkdir -p config
cat > config/plugins.js << 'EOF'
module.exports = ({ env }) => ({
  'users-permissions': {
    config: {
      jwtSecret: env('JWT_SECRET'),
    },
  },
});
EOF

# Create required content types
echo "📝 Creating content types..."
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

# Copy bootstrap script to create tokens automatically
echo "📋 Copying bootstrap script..."
cp ../scripts/bootstrap-tokens.ts src/index.ts

# Build Strapi
echo "🔨 Building Strapi..."
npm run build

# Start Strapi and capture output to extract token
echo "🚀 Starting Strapi..."
npm run start > strapi_output.log 2>&1 &
STRAPI_PID=$!
echo "Strapi PID: $STRAPI_PID"

# Wait for token generation
echo "⏳ Waiting for Strapi to start and generate tokens..."
for i in {1..60}; do
  if grep -q "🔑 Access Key:" strapi_output.log; then
    echo "✅ Token generated!"
    break
  fi
  echo "Waiting... ($i/60)"
  sleep 1
done

# Extract the API token with proper pattern
FULL_ACCESS_TOKEN=$(grep -A1 "CI/CD Full Access" strapi_output.log | grep "🔑 Access Key:" | sed 's/.*🔑 Access Key: //')
READ_ONLY_TOKEN=$(grep -A1 "Testing Read Only" strapi_output.log | grep "🔑 Access Key:" | sed 's/.*🔑 Access Key: //')

if [ -z "$FULL_ACCESS_TOKEN" ]; then
  echo "❌ Failed to extract API token"
  echo "=== Strapi Output ==="
  cat strapi_output.log
  kill $STRAPI_PID 2>/dev/null || true
  exit 1
fi

echo "✅ API Tokens extracted successfully"
echo "📝 Full Access Token: $FULL_ACCESS_TOKEN"
echo "📝 Read Only Token: $READ_ONLY_TOKEN"

# Test the token
echo "🧪 Testing API token..."
sleep 2
if curl -f -H "Authorization: Bearer $FULL_ACCESS_TOKEN" http://localhost:1337/api/projects; then
  echo "✅ Token validation successful!"
else
  echo "❌ Token validation failed"
  cat strapi_output.log
  kill $STRAPI_PID 2>/dev/null || true
  exit 1
fi

echo ""
echo "🎉 Strapi test instance is ready!"
echo ""
echo "📋 Configuration:"
echo "  URL: http://localhost:1337"
echo "  Admin Email: admin@ci.local"
echo "  Admin Password: $ADMIN_PASSWORD"
echo "  Full Access Token: $FULL_ACCESS_TOKEN"
echo "  Read Only Token: $READ_ONLY_TOKEN"
echo ""
echo "💡 To stop Strapi, run: kill $STRAPI_PID"
echo ""
echo "🔧 For testing strapi-mcp, export these variables:"
echo "export STRAPI_URL=http://localhost:1337"
echo "export STRAPI_API_TOKEN=$FULL_ACCESS_TOKEN"
echo "export STRAPI_READ_ONLY_TOKEN=$READ_ONLY_TOKEN"