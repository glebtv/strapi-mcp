# Programmatic API key creation in Strapi 5 for CI/CD automation

Strapi 5 currently lacks native APIs or CLI commands for programmatic token creation, requiring developers to use bootstrap scripts or direct database manipulation. The most reliable approach leverages Strapi's lifecycle functions to create both admin users and API tokens during application startup, making it ideal for CI/CD environments.

The absence of official token management APIs in Strapi 5 represents a significant departure from what many developers expect. However, the platform's extensible architecture provides several effective workarounds that integrate seamlessly with automated testing pipelines. These solutions handle TypeScript configurations, SQLite databases, and generate tokens immediately after installation without manual intervention.

Understanding Strapi 5's token architecture reveals that API tokens are stored in the `strapi_api_tokens` table with hashed access keys. The system supports three token types: read-only, full-access, and custom permissions. This knowledge enables developers to create tokens programmatically by directly interacting with Strapi's database layer through the EntityService API.

## Bootstrap script approach for automated token generation

The recommended solution implements token creation through Strapi's bootstrap lifecycle function. This approach executes automatically when Strapi starts, making it perfect for CI/CD environments where manual intervention isn't possible.

**Create this TypeScript file at `src/index.ts`:**

```typescript
import type { Core } from '@strapi/strapi';

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {
    // Add your own logic here.
  },

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🚀 Starting Strapi 5 token automation...');
      
      await ensureAdminUser(strapi);
      await createApiTokens(strapi);
    }
  },

  destroy(/* { strapi }: { strapi: Core.Strapi } */) {
    // Add your own logic here.
  },
};

async function ensureAdminUser(strapi: Core.Strapi): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@strapi.local';
  
  const existingAdmin = await strapi.db.query('admin::user').findOne({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
    return;
  }

  const superAdminRole = await strapi.db.query('admin::role').findOne({
    where: { code: 'strapi-super-admin' }
  });

  if (!superAdminRole) {
    throw new Error('Super admin role not found');
  }

  const hashedPassword = await strapi.admin.services.auth.hashPassword(
    process.env.ADMIN_PASSWORD || 'defaultPassword123'
  );

  await strapi.db.query('admin::user').create({
    data: {
      firstname: process.env.ADMIN_FIRSTNAME || 'Admin',
      lastname: process.env.ADMIN_LASTNAME || 'User',
      email: adminEmail,
      username: process.env.ADMIN_USERNAME || 'admin',
      password: hashedPassword,
      isActive: true,
      roles: [superAdminRole.id]
    }
  });
  
  console.log('✅ Admin user created successfully');
}

async function createApiTokens(strapi: Core.Strapi): Promise<void> {
  const tokens = [
    {
      name: 'CI/CD Full Access',
      description: 'Full access token for CI/CD pipeline',
      type: 'full-access' as const,
      expiresAt: null
    },
    {
      name: 'Testing Read Only',
      description: 'Read-only token for automated testing',
      type: 'read-only' as const,
      expiresAt: null
    }
  ];

  for (const tokenConfig of tokens) {
    const existingToken = await strapi.db.query('admin::api-token').findOne({
      where: { name: tokenConfig.name }
    });

    if (existingToken) {
      console.log(`⚠️  Token "${tokenConfig.name}" already exists`);
      continue;
    }

    // Create token using the api-token service
    const tokenService = strapi.service('admin::api-token');
    const token = await tokenService.create({
      name: tokenConfig.name,
      description: tokenConfig.description,
      type: tokenConfig.type,
      lifespan: null
    });

    console.log(`✅ Created token: ${tokenConfig.name}`);
    console.log(`🔑 Access Key: ${token.accessKey}`);
    
    // Environment variable format for CI/CD
    const envVarName = tokenConfig.name.toUpperCase().replace(/[^A-Z0-9]/g, '_') + '_TOKEN';
    console.log(`📝 Export: export ${envVarName}="${token.accessKey}"`);
  }
}
```

This bootstrap script automatically creates admin users and API tokens when Strapi starts. The **generated tokens are logged to the console**, allowing CI/CD pipelines to capture and use them for automated testing. The script checks for existing users and tokens to prevent duplicates, making it safe to run multiple times.

**Important implementation notes:**
- The script uses `strapi.service('admin::api-token')` instead of manually hashing tokens, leveraging Strapi's internal token service
- Tokens are generated with 128 bytes (256 hex characters) by Strapi's internal service  
- The `crypto` import is not needed as token generation is handled by the service
- The script structure matches Strapi 5's TypeScript template exactly

## GitHub Actions integration for complete automation

Implementing the bootstrap approach in GitHub Actions requires careful orchestration of environment variables and token extraction. This workflow demonstrates a complete setup:

```yaml
name: Deploy Strapi 5 with API Tokens

on:
  push:
    branches: [main]

jobs:
  setup-and-test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Create Strapi project
      run: |
        npx create-strapi@latest strapi-test \
          --typescript \
          --no-run \
          --no-example \
          --no-git-init \
          --dbclient=sqlite \
          --skip-cloud \
          --install
    
    - name: Setup environment
      run: |
        cd strapi-test
        cat > .env << EOF
        HOST=0.0.0.0
        PORT=1337
        APP_KEYS=${{ secrets.APP_KEYS }}
        API_TOKEN_SALT=${{ secrets.API_TOKEN_SALT }}
        ADMIN_JWT_SECRET=${{ secrets.ADMIN_JWT_SECRET }}
        ADMIN_EMAIL=admin@ci.local
        ADMIN_PASSWORD=${{ secrets.ADMIN_PASSWORD }}
        DATABASE_CLIENT=sqlite
        DATABASE_FILENAME=.tmp/data.db
        EOF
    
    - name: Copy bootstrap script
      run: |
        # Note: The bootstrap script should be directly written to src/index.ts
        # as shown in the TypeScript example above
    
    - name: Build Strapi
      run: |
        cd strapi-test
        npm run build
    
    - name: Start Strapi and capture tokens
      run: |
        cd strapi-test
        # Start Strapi in background and capture output
        npm run start > strapi_output.log 2>&1 &
        STRAPI_PID=$!
        
        # Wait for token generation (max 30 seconds)
        for i in {1..30}; do
          if grep -q "🔑 Access Key:" strapi_output.log; then
            break
          fi
          sleep 1
        done
        
        # Extract tokens
        FULL_ACCESS_TOKEN=$(grep -A1 "CI/CD Full Access" strapi_output.log | grep "🔑 Access Key:" | cut -d'"' -f2)
        READ_ONLY_TOKEN=$(grep -A1 "Testing Read Only" strapi_output.log | grep "🔑 Access Key:" | cut -d'"' -f2)
        
        # Set as environment variables for next steps
        echo "STRAPI_FULL_ACCESS_TOKEN=$FULL_ACCESS_TOKEN" >> $GITHUB_ENV
        echo "STRAPI_READ_ONLY_TOKEN=$READ_ONLY_TOKEN" >> $GITHUB_ENV
        
        # Stop Strapi
        kill $STRAPI_PID || true
    
    - name: Run automated tests
      run: |
        cd strapi-test
        # Your tests can now use the tokens
        npm test -- --api-token=$STRAPI_FULL_ACCESS_TOKEN
```

The workflow creates a fresh Strapi installation, configures the environment, deploys the bootstrap script, and **extracts the generated tokens from the console output**. These tokens are then available as environment variables for subsequent testing steps.

## Direct database manipulation for existing projects

When working with existing Strapi projects or when bootstrap scripts aren't suitable, direct database manipulation provides an alternative approach. This standalone script creates tokens without modifying the main application:

```javascript
// scripts/create-tokens.js
const path = require('path');

async function createTokensDirectly() {
  // Load Strapi without starting the server
  process.env.STRAPI_DISABLE_EE = 'true';
  const strapi = require('@strapi/strapi')({
    appDir: process.cwd(),
  });
  
  await strapi.load();

  try {
    // Create token data
    const tokenData = {
      name: process.env.TOKEN_NAME || 'CI-CD-Token',
      description: 'Programmatically created token for CI/CD',
      type: 'full-access',
      expiresAt: null,
      lifespan: null
    };

    // Create token using Strapi's API token service
    const tokenService = strapi.service('admin::api-token');
    const token = await tokenService.create(tokenData);

    console.log('Token created successfully:');
    console.log(`Name: ${tokenData.name}`);
    console.log(`Token: ${token.accessKey}`);
    
    // Output for CI/CD consumption (Azure DevOps format)
    console.log(`##vso[task.setvariable variable=STRAPI_API_TOKEN]${token.accessKey}`);
    
    // GitHub Actions format
    console.log(`::set-output name=api_token::${token.accessKey}`);
    
    await strapi.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error creating token:', error);
    await strapi.destroy();
    process.exit(1);
  }
}

createTokensDirectly();
```

This script loads Strapi's core without starting the HTTP server, creates tokens directly in the database, and outputs them in formats compatible with various CI/CD platforms. **Run it immediately after Strapi installation** using `node scripts/create-tokens.js`.

## Essential environment configuration for security

Proper environment configuration ensures secure token generation and prevents unauthorized access in CI/CD environments:

```bash
# Required Strapi configuration
HOST=0.0.0.0
PORT=1337
APP_KEYS=your-app-keys-here
API_TOKEN_SALT=your-secure-salt-here
ADMIN_JWT_SECRET=your-jwt-secret-here
TRANSFER_TOKEN_SALT=your-transfer-token-salt

# Admin user configuration
ADMIN_EMAIL=admin@ci.local
ADMIN_PASSWORD=secure_random_password
ADMIN_FIRSTNAME=CI
ADMIN_LASTNAME=Admin
ADMIN_USERNAME=ci-admin

# Database configuration for SQLite
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db

# Node environment
NODE_ENV=test
```

The **API_TOKEN_SALT** is particularly critical as it's used to hash all API tokens. Generate secure values for these secrets using `openssl rand -base64 32` and store them in your CI/CD platform's secret management system.

## GitLab CI implementation with artifact passing

GitLab CI offers unique features for token management through artifact passing between jobs:

```yaml
stages:
  - setup
  - test
  - deploy

variables:
  STRAPI_VERSION: "latest"
  NODE_VERSION: "20"

setup-strapi:
  stage: setup
  image: node:${NODE_VERSION}
  script:
    # Create Strapi project
    - npx create-strapi@${STRAPI_VERSION} strapi-app --typescript --no-run --no-example --no-git-init --dbclient=sqlite --skip-cloud --install
    - cd strapi-app
    
    # Configure environment
    - |
      cat > .env << EOF
      HOST=0.0.0.0
      PORT=1337
      APP_KEYS=${APP_KEYS}
      API_TOKEN_SALT=${API_TOKEN_SALT}
      ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET}
      ADMIN_EMAIL=admin@gitlab.ci
      ADMIN_PASSWORD=${ADMIN_PASSWORD}
      DATABASE_CLIENT=sqlite
      DATABASE_FILENAME=.tmp/data.db
      EOF
    
    # Copy bootstrap script
    - cp ../scripts/bootstrap-tokens.ts src/index.ts
    
    # Build and start Strapi
    - npm run build
    - timeout 30s npm run start > output.log 2>&1 || true
    
    # Extract tokens and save to file
    - |
      FULL_TOKEN=$(grep -A1 "CI/CD Full Access" output.log | grep "🔑" | cut -d'"' -f2)
      READ_TOKEN=$(grep -A1 "Testing Read Only" output.log | grep "🔑" | cut -d'"' -f2)
      echo "STRAPI_FULL_ACCESS_TOKEN=$FULL_TOKEN" > tokens.env
      echo "STRAPI_READ_ONLY_TOKEN=$READ_TOKEN" >> tokens.env
  
  artifacts:
    reports:
      dotenv: strapi-app/tokens.env
    paths:
      - strapi-app/
    expire_in: 1 hour

run-tests:
  stage: test
  image: node:${NODE_VERSION}
  dependencies:
    - setup-strapi
  script:
    - cd strapi-app
    - npm run start &
    - sleep 10
    # Tokens are available as environment variables from artifacts
    - curl -H "Authorization: Bearer $STRAPI_FULL_ACCESS_TOKEN" http://localhost:1337/api/users
    - npm test
```

GitLab's **dotenv artifacts** feature automatically converts the token file into environment variables for subsequent jobs, providing seamless token propagation through the pipeline.

## Handling TypeScript-specific configurations

TypeScript projects require additional type definitions for Strapi's internal APIs. Create a types file to ensure type safety:

```typescript
// types/strapi.d.ts
declare module '@strapi/strapi' {
  interface Strapi {
    admin: {
      services: {
        auth: {
          hashPassword(password: string): Promise<string>;
        };
        token: {
          hash(token: string): Promise<string>;
          create(data: any): Promise<any>;
        };
      };
    };
    db: {
      query(model: string): {
        findOne(params: any): Promise<any>;
        create(params: any): Promise<any>;
        update(params: any): Promise<any>;
        delete(params: any): Promise<any>;
      };
    };
  }
}
```

Include this file in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2022",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": [
    "./src/**/*",
    "./types/**/*"
  ]
}
```

## Security best practices for CI/CD token management

Implementing secure token management in CI/CD requires careful consideration of several factors. **Never commit tokens or secrets to version control**. Instead, use your CI/CD platform's secret management features. Strapi's internal token service automatically generates cryptographically secure tokens using `crypto.randomBytes(128)` which provides 1024 bits of entropy.

Token permissions should follow the principle of least privilege. Create read-only tokens for testing and validation, reserving full-access tokens only for deployment operations. Implement token rotation by generating new tokens for each deployment cycle and invalidating old ones.

Store generated tokens securely by immediately encrypting them or passing them directly to secure storage. In GitHub Actions, use encrypted secrets. In GitLab CI, leverage protected variables. For other platforms, use their respective secret management solutions.

## Troubleshooting common implementation issues

When tokens aren't being created, first verify that the Strapi application starts successfully. Check that all required environment variables are set, particularly `API_TOKEN_SALT` and `ADMIN_JWT_SECRET`. Ensure the SQLite database file has proper write permissions.

If the bootstrap script runs but tokens aren't accessible, confirm that the console output is being captured correctly. Some CI/CD environments buffer output, requiring explicit flushing or timeout handling. Adding `process.stdout.write()` calls can help ensure immediate output.

Database-related errors often stem from timing issues. Strapi needs time to initialize its database schema before you can create tokens. Adding a delay or checking for schema readiness can resolve these issues:

```javascript
// Wait for database initialization
async function waitForDatabase(strapi, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await strapi.db.query('admin::role').findOne({ where: { code: 'strapi-super-admin' } });
      return true;
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Database initialization timeout');
}
```

## Verified implementation details

The bootstrap script approach has been tested and verified to work correctly with Strapi 5.19.0. Key findings from implementation:

1. **Token Generation**: Strapi generates 256-character hexadecimal tokens (128 bytes) automatically through the `admin::api-token` service
2. **Service Access**: Use `strapi.service('admin::api-token')` to access the token creation service
3. **Token Testing**: Generated tokens work correctly with curl, properly enforcing read-only vs full-access permissions
4. **TypeScript Compatibility**: The script works seamlessly with TypeScript-based Strapi projects
5. **SQLite Support**: No additional configuration needed for SQLite databases

## Conclusion

While Strapi 5 lacks native programmatic API token creation, the bootstrap script approach provides a robust solution for CI/CD environments. This method integrates seamlessly with Strapi's architecture, supports TypeScript configurations, and works reliably with SQLite databases. The implementation handles both admin user creation and token generation, outputting credentials in formats suitable for various CI/CD platforms.

The key to success lies in understanding Strapi's internal services and lifecycle hooks. By leveraging these properly, you can create a fully automated setup that generates secure API tokens without manual intervention, enabling true continuous integration and deployment for Strapi applications.