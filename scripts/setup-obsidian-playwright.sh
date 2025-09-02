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

# Set up URLs and paths
OBSIDIAN_URL="https://github.com/obsidianmd/obsidian-releases/releases/download/v${OBSIDIAN_VERSION}/Obsidian-${OBSIDIAN_VERSION}.AppImage"
APPIMAGE_PATH="${DOWNLOAD_DIR}/Obsidian-${OBSIDIAN_VERSION}.AppImage"

# Create download directory
mkdir -p "$DOWNLOAD_DIR"

# Check if already unpacked
if [ -f "${UNPACKED_DIR}/main.js" ]; then
    CURRENT_VERSION=$(cat ${UNPACKED_DIR}/package.json | grep '"version"' | cut -d'"' -f4)
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

# Download Obsidian AppImage if not already downloaded
if [ ! -f "$APPIMAGE_PATH" ]; then
    echo "📥 Downloading Obsidian v${OBSIDIAN_VERSION}..."

    if command_exists curl; then
        curl -L -o "$APPIMAGE_PATH" "$OBSIDIAN_URL"
    elif command_exists wget; then
        wget -O "$APPIMAGE_PATH" "$OBSIDIAN_URL"
    else
        echo "❌ Error: Neither curl nor wget is available for downloading"
        echo "   Please install curl or wget and try again"
        exit 1
    fi

    echo "✅ Downloaded Obsidian AppImage"
else
    echo "✅ Obsidian AppImage already downloaded"
fi

# Make AppImage executable
chmod +x "$APPIMAGE_PATH"

# Extract AppImage
echo "📦 Extracting Obsidian AppImage..."

# Create temporary extraction directory
TEMP_EXTRACT_DIR="${DOWNLOAD_DIR}/obsidian-extract"
rm -rf "$TEMP_EXTRACT_DIR"
mkdir -p "$TEMP_EXTRACT_DIR"

# Extract AppImage
cd "$TEMP_EXTRACT_DIR"
"../../$APPIMAGE_PATH" --appimage-extract >/dev/null 2>&1

# Move the extracted content to the unpacked directory
cd ../..
rm -rf "$UNPACKED_DIR"
mv "${TEMP_EXTRACT_DIR}/squashfs-root" "$UNPACKED_DIR"

# Clean up temporary directory
rm -rf "$TEMP_EXTRACT_DIR"

echo "✅ Obsidian extracted to ${UNPACKED_DIR}"

# Verify extraction
if [ -f "${UNPACKED_DIR}/main.js" ]; then
    echo "✅ Extraction successful!"
    echo "   Main file: ${UNPACKED_DIR}/main.js"
    echo "   Version: $(cat ${UNPACKED_DIR}/package.json | grep '"version"' | cut -d'"' -f4)"
else
    echo "❌ Error: Extraction failed - main.js not found"
    exit 1
fi

# Clean up AppImage if extraction was successful
if [ -f "$APPIMAGE_PATH" ]; then
    echo "🧹 Cleaning up AppImage file..."
    rm "$APPIMAGE_PATH"
fi

echo ""
echo "🚀 Obsidian setup complete!"
echo ""
echo "📍 Unpacked Obsidian location: ${UNPACKED_DIR}"
echo "🧪 You can now run e2e tests with: npm run test:e2e"
echo ""
echo "💡 Note: The unpacked Obsidian is only for testing purposes"
echo "   and should not be used as your main Obsidian installation."
