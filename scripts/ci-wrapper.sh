#!/bin/bash

# Simple CI wrapper that sets extended timeouts

# Exit on error
set -e

echo "🚀 CI Wrapper: Setting up environment for CI"

# Set CI environment variables for extended timeouts
export CI=true
export FORCE_COLOR=0

# Run the regular setup script
./scripts/setup-strapi-test.sh

# The setup script handles everything including token creation