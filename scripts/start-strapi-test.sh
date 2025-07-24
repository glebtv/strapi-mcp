#!/bin/bash

# Load nvm and use Node 22
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

# Check if strapi-test directory exists
if [ ! -d "strapi-test" ]; then
  echo "Error: strapi-test directory not found. Run setup-strapi-test.sh first."
  exit 1
fi

cd strapi-test

# Start Strapi in background
echo "Starting Strapi..."
npm run develop > strapi.log 2>&1 &
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

echo ""
echo "========================================="
echo "Strapi test instance is running!"
echo "========================================="
echo "Strapi URL: http://localhost:1337"
echo "Admin Panel: http://localhost:1337/admin"
echo "Strapi PID: $STRAPI_PID"
echo ""
echo "To stop Strapi, run: kill $STRAPI_PID"
echo ""
echo "To create admin user and API token, run: ./scripts/create-strapi-admin.sh"