# Strapi Test Fixtures

This directory contains template files for setting up a test Strapi instance with:

## Content Types

### Project
- **name** (string, required) - Project name
- **description** (text) - Project description  
- **slug** (uid) - Auto-generated from name
- **technologies** (relation) - Many-to-many relation with Technology

### Technology
- **name** (string, required) - Technology name
- **projects** (relation) - Many-to-many relation with Project

## Configuration

- **config/plugins.js** - JWT secret configuration for users-permissions
- **config/admin.js** - Admin panel and API token configuration

## Usage

These fixtures are automatically copied when running the test setup script:
```bash
./scripts/setup-strapi-test.sh
```

The script will:
1. Create a new Strapi TypeScript project
2. Copy these fixtures to set up content types and configuration
3. Build and start Strapi
4. Create admin user and API tokens