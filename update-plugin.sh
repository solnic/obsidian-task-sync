#!/bin/bash

# Quick plugin update script for development
# This script rebuilds and updates the plugin without full reinstallation

set -e

PLUGIN_SOURCE_DIR="."
PLUGIN_NAME="obsidian-task-sync"
# Use environment variable if set, otherwise default path
OBSIDIAN_PLUGINS_DIR="${OBSIDIAN_PLUGINS_DIR:-$HOME/Documents/Obsidian/Main/.obsidian/plugins}"
PLUGIN_TARGET_DIR="$OBSIDIAN_PLUGINS_DIR/$PLUGIN_NAME"

echo "🔄 Updating Task Sync Plugin..."

# Check if source directory exists
if [ ! -d "$PLUGIN_SOURCE_DIR" ]; then
    echo "❌ Error: Plugin source directory '$PLUGIN_SOURCE_DIR' not found"
    exit 1
fi

# Check if target directory exists
if [ ! -d "$PLUGIN_TARGET_DIR" ]; then
    echo "❌ Error: Plugin not installed. Run ./install-plugin.sh first"
    exit 1
fi

# Build the plugin in source directory
echo "🔨 Building plugin..."
cd "$PLUGIN_SOURCE_DIR"

# Check if we need to reinstall dependencies for the current platform
CURRENT_PLATFORM=$(uname -s)
NEEDS_REINSTALL=false

if [ -d "node_modules" ]; then
    # Check if esbuild platform-specific package exists for current platform
    if [ "$CURRENT_PLATFORM" = "Darwin" ]; then
        if [ ! -d "node_modules/@esbuild/darwin-arm64" ] && [ ! -d "node_modules/@esbuild/darwin-x64" ]; then
            echo "🔄 Platform-specific dependencies not found for macOS, reinstalling..."
            NEEDS_REINSTALL=true
        fi
    elif [ "$CURRENT_PLATFORM" = "Linux" ]; then
        if [ ! -d "node_modules/@esbuild/linux-arm64" ] && [ ! -d "node_modules/@esbuild/linux-x64" ]; then
            echo "🔄 Platform-specific dependencies not found for Linux, reinstalling..."
            NEEDS_REINSTALL=true
        fi
    fi
fi

# Reinstall dependencies if needed
if [ "$NEEDS_REINSTALL" = true ]; then
    echo "📦 Reinstalling dependencies for current platform..."
    rm -rf node_modules package-lock.json
    npm install
fi

# Run tests first
# echo "🧪 Running tests..."
# npm run test

echo "🔨 Building plugin..."
npm run build

# Check if build was successful
if [ ! -f "main.js" ]; then
    echo "❌ Error: Build failed - main.js not generated"
    exit 1
fi

# Copy updated files
echo "📋 Copying updated files..."
cp main.js "$PLUGIN_TARGET_DIR/"
cp manifest.json "$PLUGIN_TARGET_DIR/"
cp styles.css "$PLUGIN_TARGET_DIR/"

echo "✅ Plugin updated successfully!"
echo ""
echo "🔄 Next steps:"
echo "1. Reload the plugin in Obsidian (Ctrl+Shift+P → 'Reload app without saving')"
echo "2. Or restart Obsidian to pick up changes"
echo ""
echo "📍 Plugin location: $PLUGIN_TARGET_DIR"
