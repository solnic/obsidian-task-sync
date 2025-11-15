#!/bin/bash

# Consolidated e2e testing setup script
# Sets up both headless testing and Obsidian Playwright e2e infrastructure

set -e

echo "🚀 Setting up e2e testing environment..."
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if running as root
is_root() {
    [ "$(id -u)" -eq 0 ]
}

# Function to run command with sudo if not root
run_with_sudo() {
    if is_root; then
        "$@"
    else
        sudo "$@"
    fi
}

# Step 1: Setup headless testing (xvfb and dependencies)
echo "📦 Step 1/2: Setting up headless testing environment..."
echo ""

# Check if we're on a Debian-based system
if command_exists apt-get; then
    # Update package list
    echo "Updating package list..."
    run_with_sudo apt-get update -qq

    # Install xvfb if not already installed
    if ! command_exists xvfb-run; then
        echo "Installing Xvfb (X Virtual Framebuffer)..."
        run_with_sudo apt-get install -y xvfb
    else
        echo "✅ Xvfb is already installed"
    fi

    # Install additional dependencies that might be needed for Electron
    echo "Installing additional dependencies for Electron..."
    run_with_sudo apt-get install -y \
        libnss3 \
        libatk-bridge2.0-0 \
        libdrm2 \
        libxcomposite1 \
        libxdamage1 \
        libxrandr2 \
        libgbm1 \
        libxss1 \
        libasound2 \
        libatspi2.0-0 \
        libgtk-3-0 \
        2>/dev/null || echo "Some packages may already be installed"
else
    echo "⚠️ Not a Debian-based system. Skipping headless setup."
    echo "   For other systems, please install xvfb manually:"
    echo "   - RHEL/CentOS: yum install xorg-x11-server-Xvfb"
    echo "   - Arch: pacman -S xorg-server-xvfb"
    echo "   - Alpine: apk add xvfb"
fi

echo ""
echo "✅ Step 1/2 complete: Headless environment ready"
echo ""

# Step 2: Setup Obsidian for Playwright
echo "📦 Step 2/2: Setting up Obsidian for Playwright..."
echo ""

# Configuration
DOWNLOAD_DIR="./tmp"
UNPACKED_DIR="./tests/e2e/.obsidian-unpacked"

# Function to get latest Obsidian version from GitHub API
get_latest_version() {
    if command_exists curl; then
        LATEST_VERSION=$(curl -s https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | sed 's/^v//')
    elif command_exists wget; then
        LATEST_VERSION=$(wget -qO- https://api.github.com/repos/obsidianmd/obsidian-releases/releases/latest | grep '"tag_name"' | cut -d'"' -f4 | sed 's/^v//')
    else
        echo "❌ Error: Neither curl nor wget is available for fetching version info" >&2
        exit 1
    fi

    if [ -z "$LATEST_VERSION" ]; then
        echo "⚠️ Could not fetch latest version. Using fallback version 1.10.3" >&2
        LATEST_VERSION="1.10.3"
    fi

    echo "$LATEST_VERSION"
}

# Get latest version
echo "🔍 Fetching latest Obsidian version..."
OBSIDIAN_VERSION=$(get_latest_version)
echo "📋 Latest Obsidian version: $OBSIDIAN_VERSION"

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        ARCH_SUFFIX=""
        ;;
    aarch64|arm64)
        ARCH_SUFFIX="-arm64"
        ;;
    *)
        echo "❌ Error: Unsupported architecture: $ARCH"
        echo "   Supported architectures: x86_64, aarch64/arm64"
        exit 1
        ;;
esac

echo "🏗️ Detected architecture: $ARCH (using suffix: ${ARCH_SUFFIX:-none})"

# Set up URLs and paths - use tar.gz for proper Electron structure
OBSIDIAN_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/obsidian-${OBSIDIAN_VERSION}${ARCH_SUFFIX}.tar.gz"
ARCHIVE_PATH="${DOWNLOAD_DIR}/obsidian-${OBSIDIAN_VERSION}${ARCH_SUFFIX}.tar.gz"

# Create download directory
mkdir -p "$DOWNLOAD_DIR"

# Check if already unpacked (check for both main.js and obsidian binary)
if [ -f "${UNPACKED_DIR}/main.js" ] || [ -f "${UNPACKED_DIR}/obsidian" ]; then
    # Try to get version from package.json if it exists
    if [ -f "${UNPACKED_DIR}/package.json" ]; then
        CURRENT_VERSION=$(cat ${UNPACKED_DIR}/package.json | grep '"version"' | cut -d'"' -f4)
    else
        # For AppImage extractions, we might not have package.json, so assume different version
        CURRENT_VERSION="unknown"
    fi

    echo "✅ Obsidian is already unpacked at ${UNPACKED_DIR}"
    echo "   Current version: $CURRENT_VERSION"
    echo "   Latest version: $OBSIDIAN_VERSION"

    if [ "$CURRENT_VERSION" = "$OBSIDIAN_VERSION" ]; then
        echo "   Already up to date!"
        echo ""
        echo "✅ Step 2/2 complete: Obsidian already set up"
        echo ""
        echo "🎉 All e2e testing setup complete!"
        echo ""
        echo "🧪 You can now run e2e tests with: npm run test:e2e"
        exit 0
    else
        echo "   Updating to latest version..."
        rm -rf "$UNPACKED_DIR"
    fi
fi

# Download Obsidian tar.gz if not already downloaded
if [ ! -f "$ARCHIVE_PATH" ]; then
    echo "📥 Downloading Obsidian v${OBSIDIAN_VERSION}..."

    if command_exists curl; then
        curl -L -o "$ARCHIVE_PATH" "$OBSIDIAN_URL"
    elif command_exists wget; then
        wget -O "$ARCHIVE_PATH" "$OBSIDIAN_URL"
    else
        echo "❌ Error: Neither curl nor wget is available for downloading"
        echo "   Please install curl or wget and try again"
        exit 1
    fi

    echo "✅ Downloaded Obsidian archive"
else
    echo "✅ Obsidian archive already downloaded"
fi

# Extract tar.gz
echo "📦 Extracting Obsidian archive..."

# Create temporary extraction directory
TEMP_EXTRACT_DIR="${DOWNLOAD_DIR}/obsidian-extract"
rm -rf "$TEMP_EXTRACT_DIR"
mkdir -p "$TEMP_EXTRACT_DIR"

# Extract tar.gz
cd "$TEMP_EXTRACT_DIR"
tar -xzf "../../$ARCHIVE_PATH"

# Move the extracted content to the unpacked directory
cd ../..
rm -rf "$UNPACKED_DIR"
# The tar.gz contains a directory named after the version
mv "${TEMP_EXTRACT_DIR}/Obsidian-${OBSIDIAN_VERSION}${ARCH_SUFFIX}" "$UNPACKED_DIR" 2>/dev/null || \
mv "${TEMP_EXTRACT_DIR}/obsidian-${OBSIDIAN_VERSION}${ARCH_SUFFIX}" "$UNPACKED_DIR" 2>/dev/null || \
mv "${TEMP_EXTRACT_DIR}"/* "$UNPACKED_DIR" 2>/dev/null

# Clean up temporary directory
rm -rf "$TEMP_EXTRACT_DIR"

echo "✅ Obsidian extracted to ${UNPACKED_DIR}"

# Verify extraction and handle app.asar for Playwright
if [ -f "${UNPACKED_DIR}/main.js" ] || [ -f "${UNPACKED_DIR}/obsidian" ]; then
    echo "✅ Extraction successful!"
    if [ -f "${UNPACKED_DIR}/main.js" ]; then
        echo "   Main file: ${UNPACKED_DIR}/main.js"
        if [ -f "${UNPACKED_DIR}/package.json" ]; then
            echo "   Version: $(cat ${UNPACKED_DIR}/package.json | grep '"version"' | cut -d'"' -f4)"
        fi
    elif [ -f "${UNPACKED_DIR}/obsidian" ]; then
        echo "   Main file: ${UNPACKED_DIR}/obsidian"
        echo "   Architecture: $(file ${UNPACKED_DIR}/obsidian | cut -d',' -f2 | xargs)"

        # For Playwright Electron testing, we need to extract app.asar
        if [ -f "${UNPACKED_DIR}/resources/app.asar" ]; then
            echo "🔧 Extracting app.asar for Playwright compatibility..."

            # Check if asar is available
            if command_exists npx; then
                # Extract app.asar to get main.js for Playwright
                cd "${UNPACKED_DIR}"
                npx asar extract resources/app.asar app-extracted 2>/dev/null || {
                    echo "⚠️ Could not extract app.asar with npx asar, trying manual approach..."
                    # Create a simple main.js that launches the binary
                    cat > main.js << 'EOF'
const { spawn } = require('child_process');
const path = require('path');

// Launch the Obsidian binary
const obsidianPath = path.join(__dirname, 'obsidian');
const args = process.argv.slice(2);

const child = spawn(obsidianPath, args, {
  stdio: 'inherit',
  detached: false
});

child.on('exit', (code) => {
  process.exit(code);
});
EOF
                    echo "   Created wrapper main.js"
                }

                # If extraction worked, copy main.js
                if [ -f "app-extracted/main.js" ]; then
                    cp app-extracted/main.js ./main.js
                    echo "   Extracted main.js from app.asar"
                fi

                # Copy obsidian.asar to app-extracted directory for Playwright compatibility
                if [ -f "resources/obsidian.asar" ] && [ -d "app-extracted" ]; then
                    cp resources/obsidian.asar app-extracted/
                    echo "   Copied obsidian.asar to app-extracted directory"
                fi

                # Create package.json if it doesn't exist
                if [ ! -f "package.json" ] && [ -f "app-extracted/package.json" ]; then
                    cp app-extracted/package.json ./package.json
                    echo "   Extracted package.json from app.asar"
                fi

                cd - > /dev/null
            else
                echo "⚠️ npx not available, creating wrapper main.js..."
                # Create a simple main.js that launches the binary
                cat > "${UNPACKED_DIR}/main.js" << 'EOF'
const { spawn } = require('child_process');
const path = require('path');

// Launch the Obsidian binary
const obsidianPath = path.join(__dirname, 'obsidian');
const args = process.argv.slice(2);

const child = spawn(obsidianPath, args, {
  stdio: 'inherit',
  detached: false
});

child.on('exit', (code) => {
  process.exit(code);
});
EOF
                echo "   Created wrapper main.js"
            fi
        fi
    fi
else
    echo "❌ Error: Extraction failed - neither main.js nor obsidian binary found"
    exit 1
fi

# Clean up archive if extraction was successful
if [ -f "$ARCHIVE_PATH" ]; then
    echo "🧹 Cleaning up archive file..."
    rm "$ARCHIVE_PATH"
fi

echo ""
echo "✅ Step 2/2 complete: Obsidian setup complete"
echo ""
echo "🎉 All e2e testing setup complete!"
echo ""
echo "📍 Unpacked Obsidian location: ${UNPACKED_DIR}"
echo "🧪 You can now run e2e tests with: npm run test:e2e"
echo ""
echo "💡 Note: The unpacked Obsidian is only for testing purposes"
echo "   and should not be used as your main Obsidian installation."
