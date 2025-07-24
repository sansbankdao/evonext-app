#!/bin/bash

# Script to sync wasm-sdk files from platform repository to yappr project
# Usage: ./sync-wasm-sdk.sh [platform_directory]
# If no directory is provided, it will use ../platform

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the script directory (yappr root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Set platform directory (use argument or default to ../platform)
PLATFORM_DIR="${1:-${SCRIPT_DIR}/../platform}"

# Validate platform directory exists
if [ ! -d "$PLATFORM_DIR" ]; then
    echo -e "${RED}Error: Platform directory not found at: $PLATFORM_DIR${NC}"
    echo "Usage: $0 [platform_directory]"
    exit 1
fi

# Validate wasm-sdk source exists
WASM_SDK_SOURCE="${PLATFORM_DIR}/packages/wasm-sdk"
if [ ! -d "$WASM_SDK_SOURCE" ]; then
    echo -e "${RED}Error: wasm-sdk not found at: $WASM_SDK_SOURCE${NC}"
    exit 1
fi

# Check if pkg directory exists in source
if [ ! -d "${WASM_SDK_SOURCE}/pkg" ]; then
    echo -e "${RED}Error: wasm-sdk pkg directory not found. Please build the wasm-sdk first.${NC}"
    echo "Run 'wasm-pack build' in ${WASM_SDK_SOURCE}"
    exit 1
fi

echo -e "${GREEN}=== WASM SDK Sync Script ===${NC}"
echo -e "Source: ${YELLOW}${WASM_SDK_SOURCE}${NC}"
echo -e "Target: ${YELLOW}${SCRIPT_DIR}${NC}"
echo ""

# Create necessary directories
echo -e "${GREEN}Creating directories...${NC}"
mkdir -p "${SCRIPT_DIR}/public/dash-wasm"
mkdir -p "${SCRIPT_DIR}/lib/wasm-sdk"

# Copy files to public/dash-wasm (for browser access)
echo -e "${GREEN}Copying wasm-sdk files to public/dash-wasm...${NC}"
cp -f "${WASM_SDK_SOURCE}/pkg/wasm_sdk_bg.wasm" "${SCRIPT_DIR}/public/dash-wasm/"
cp -f "${WASM_SDK_SOURCE}/pkg/wasm_sdk.js" "${SCRIPT_DIR}/public/dash-wasm/"
cp -f "${WASM_SDK_SOURCE}/pkg/wasm_sdk_bg.wasm.d.ts" "${SCRIPT_DIR}/public/dash-wasm/"
cp -f "${WASM_SDK_SOURCE}/pkg/wasm_sdk.d.ts" "${SCRIPT_DIR}/public/dash-wasm/"
cp -f "${WASM_SDK_SOURCE}/pkg/package.json" "${SCRIPT_DIR}/public/dash-wasm/"

# Check for optimized wasm file
if [ -f "${WASM_SDK_SOURCE}/pkg/optimized.wasm" ]; then
    echo -e "${GREEN}Copying optimized.wasm...${NC}"
    cp -f "${WASM_SDK_SOURCE}/pkg/optimized.wasm" "${SCRIPT_DIR}/public/dash-wasm/"
fi

# Copy README if it exists
if [ -f "${WASM_SDK_SOURCE}/pkg/README.md" ]; then
    cp -f "${WASM_SDK_SOURCE}/pkg/README.md" "${SCRIPT_DIR}/public/dash-wasm/"
fi

# Copy necessary files to lib/wasm-sdk (for potential Node.js/build usage)
echo -e "${GREEN}Setting up lib/wasm-sdk directory...${NC}"

# Create a minimal package.json for the lib/wasm-sdk directory
cat > "${SCRIPT_DIR}/lib/wasm-sdk/package.json" << 'EOF'
{
  "name": "wasm-sdk",
  "version": "1.0.0",
  "description": "Dash Platform WASM SDK",
  "main": "wasm_sdk.js",
  "type": "module"
}
EOF

# Copy the built files
cp -f "${WASM_SDK_SOURCE}/pkg/wasm_sdk.js" "${SCRIPT_DIR}/lib/wasm-sdk/"
cp -f "${WASM_SDK_SOURCE}/pkg/wasm_sdk_bg.wasm" "${SCRIPT_DIR}/lib/wasm-sdk/"
cp -f "${WASM_SDK_SOURCE}/pkg/wasm_sdk.d.ts" "${SCRIPT_DIR}/lib/wasm-sdk/"
cp -f "${WASM_SDK_SOURCE}/pkg/wasm_sdk_bg.wasm.d.ts" "${SCRIPT_DIR}/lib/wasm-sdk/"

# Create a .gitignore in lib/wasm-sdk to ignore large files
cat > "${SCRIPT_DIR}/lib/wasm-sdk/.gitignore" << 'EOF'
# Ignore build artifacts and large files
target/
node_modules/
pkg/
*.log
packages/

# Keep only the essential built files
!wasm_sdk.js
!wasm_sdk_bg.wasm
!wasm_sdk.d.ts
!wasm_sdk_bg.wasm.d.ts
!package.json
!.gitignore
EOF

# Summary
echo ""
echo -e "${GREEN}✅ Sync completed successfully!${NC}"
echo ""
echo "Files copied to:"
echo "  - public/dash-wasm/ (for browser access)"
echo "  - lib/wasm-sdk/ (for build tools)"
echo ""
echo -e "${YELLOW}Note: The wasm files in public/dash-wasm/ are already tracked by git.${NC}"
echo -e "${YELLOW}      The lib/wasm-sdk/ files are gitignored due to size.${NC}"
echo ""
echo "To update in the future, run: ./sync-wasm-sdk.sh [platform_directory]"