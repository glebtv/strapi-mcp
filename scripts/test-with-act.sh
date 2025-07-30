#!/bin/bash

# Run GitHub Actions workflow locally using act
# Requires act to be installed: https://github.com/nektos/act

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Check if act is installed
if ! command -v act &> /dev/null; then
    echo "Error: 'act' is not installed."
    echo "Please install act from: https://github.com/nektos/act"
    echo ""
    echo "Installation options:"
    echo "  - macOS: brew install act"
    echo "  - Linux: curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash"
    echo "  - Or download from: https://github.com/nektos/act/releases"
    exit 1
fi

cd "$PROJECT_ROOT"

# Run specific workflow or job
case "${1:-test}" in
    test)
        echo "Running test workflow with act..."
        act -W .github/workflows/test.yml
        ;;
    ci)
        echo "Running CI workflow with act..."
        act -W .github/workflows/ci.yml
        ;;
    push)
        echo "Simulating push event..."
        act push -W .github/workflows/test.yml
        ;;
    pr)
        echo "Simulating pull request event..."
        act pull_request -W .github/workflows/test.yml
        ;;
    list)
        echo "Available workflows:"
        act -l
        ;;
    *)
        echo "Usage: $0 {test|ci|push|pr|list}"
        echo ""
        echo "Commands:"
        echo "  test  - Run test workflow"
        echo "  ci    - Run CI workflow"  
        echo "  push  - Simulate push event"
        echo "  pr    - Simulate pull request event"
        echo "  list  - List available workflows"
        exit 1
        ;;
esac