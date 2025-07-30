#!/bin/bash

# Create test content types needed for the test suite

set -e

# Configuration
STRAPI_URL="${STRAPI_URL:-http://localhost:1337}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@test.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Login to get JWT token
log_info "Logging in to Strapi admin..."
LOGIN_RESPONSE=$(curl -s -X POST "$STRAPI_URL/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

JWT_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$JWT_TOKEN" ]; then
    log_error "Failed to get JWT token"
    log_error "Response: $LOGIN_RESPONSE"
    exit 1
fi

log_info "Successfully logged in"

# Function to create a content type
create_content_type() {
    local display_name=$1
    local singular_name=$2
    local plural_name=$3
    local attributes=$4
    
    log_info "Creating content type: $display_name"
    
    RESPONSE=$(curl -s -X POST "$STRAPI_URL/content-type-builder/content-types" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{
            \"contentType\": {
                \"displayName\": \"$display_name\",
                \"singularName\": \"$singular_name\",
                \"pluralName\": \"$plural_name\",
                \"kind\": \"collectionType\",
                \"draftAndPublish\": true,
                \"attributes\": $attributes
            }
        }")
    
    # Check if successful
    if echo "$RESPONSE" | grep -q "error"; then
        log_error "Failed to create $display_name: $RESPONSE"
    else
        log_info "Created $display_name successfully"
    fi
    
    # Wait for Strapi to reload
    sleep 3
}

# Create Project content type (used by many tests)
create_content_type "Project" "project" "projects" '{
    "name": {
        "type": "string",
        "required": true
    },
    "description": {
        "type": "text"
    },
    "projectStatus": {
        "type": "enumeration",
        "enum": ["active", "completed", "pending"]
    },
    "startDate": {
        "type": "date"
    },
    "priority": {
        "type": "integer",
        "min": 1,
        "max": 10
    }
}'

# Create Tag content type (for relation tests)
create_content_type "Tag" "tag" "tags" '{
    "name": {
        "type": "string",
        "required": true,
        "unique": true
    },
    "color": {
        "type": "string"
    }
}'

# Create Article content type (for other tests)
create_content_type "Article" "article" "articles" '{
    "title": {
        "type": "string",
        "required": true
    },
    "content": {
        "type": "richtext"
    },
    "slug": {
        "type": "uid",
        "targetField": "title"
    },
    "author": {
        "type": "relation",
        "relation": "manyToOne",
        "target": "plugin::users-permissions.user"
    }
}'

# Create Speaker content type (for component tests)
create_content_type "Speaker" "speaker" "speakers" '{
    "name": {
        "type": "string",
        "required": true
    },
    "bio": {
        "type": "text"
    },
    "email": {
        "type": "email"
    },
    "photo": {
        "type": "media",
        "allowedTypes": ["images"]
    }
}'

# Wait for all content types to be ready
log_info "Waiting for Strapi to finish reloading..."
sleep 10

# Check health
if curl -s "$STRAPI_URL/_health" > /dev/null; then
    log_info "Strapi is healthy"
else
    log_error "Strapi health check failed"
fi

log_info "Test content types created successfully!"

# Update test-tokens.json with new timestamp to indicate content types are created
if [ -f "test-tokens.json" ]; then
    # Add contentTypesCreated timestamp
    jq '. + {"contentTypesCreated": true}' test-tokens.json > test-tokens.tmp && mv test-tokens.tmp test-tokens.json
fi