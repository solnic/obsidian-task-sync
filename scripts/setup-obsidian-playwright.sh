#!/bin/bash

# Setup script to download and unpack Obsidian for e2e testing
# This script downloads the Obsidian AppImage and extracts it for Playwright testing

set -e

echo "🔧 Setting up Obsidian for e2e testing..."

# Configuration
DOWNLOAD_DIR="./tmp"
UNPACKED_DIR="./.obsidian-unpacked"

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
        echo "❌ Error: Could not fetch latest version. Using fallback version 1.8.7" >&2
        LATEST_VERSION="1.8.7"
    fi

    echo "$LATEST_VERSION"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
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

# Verify extraction
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
echo "🚀 Obsidian setup complete!"
echo ""
echo "📍 Unpacked Obsidian location: ${UNPACKED_DIR}"
echo "🧪 You can now run e2e tests with: npm run test:e2e"
echo ""
echo "💡 Note: The unpacked Obsidian is only for testing purposes"
echo "   and should not be used as your main Obsidian installation."
