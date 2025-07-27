#!/bin/bash
# Wrapper script to ensure nvm is loaded before running commands

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use the correct Node version
nvm use 22

# Run the command passed as arguments
exec "$@"