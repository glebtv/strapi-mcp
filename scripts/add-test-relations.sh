#!/bin/bash

# Add relations between content types after they are created

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
    exit 1
fi

log_info "Successfully logged in"

# Add relation field to Project for Tags
log_info "Adding tags relation to Project content type..."
curl -s -X PUT "$STRAPI_URL/content-type-builder/content-types/api::project.project" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "contentType": {
            "draftAndPublish": true,
            "singularName": "project",
            "pluralName": "projects",
            "displayName": "Project",
            "kind": "collectionType",
            "attributes": {
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
                },
                "tags": {
                    "type": "relation",
                    "relation": "manyToMany",
                    "target": "api::tag.tag",
                    "inversedBy": "projects"
                }
            }
        }
    }' > /dev/null

sleep 5

# Add relation field to Tag for Projects
log_info "Adding projects relation to Tag content type..."
curl -s -X PUT "$STRAPI_URL/content-type-builder/content-types/api::tag.tag" \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
        "contentType": {
            "draftAndPublish": true,
            "singularName": "tag",
            "pluralName": "tags",
            "displayName": "Tag",
            "kind": "collectionType",
            "attributes": {
                "name": {
                    "type": "string",
                    "required": true,
                    "unique": true
                },
                "color": {
                    "type": "string"
                },
                "projects": {
                    "type": "relation",
                    "relation": "manyToMany",
                    "target": "api::project.project",
                    "mappedBy": "tags"
                }
            }
        }
    }' > /dev/null

log_info "Relations added successfully!"
log_info "Waiting for Strapi to reload..."
sleep 10