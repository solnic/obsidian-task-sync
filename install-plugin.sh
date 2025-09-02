#!/bin/bash

# Task Sync Plugin Installation Script
# This script installs the Task Sync plugin to your Obsidian vault

set -e

# Configuration
PLUGIN_NAME="obsidian-task-sync"
PLUGIN_SOURCE_DIR="."
# Use environment variable if set, otherwise default path
OBSIDIAN_PLUGINS_DIR="${OBSIDIAN_PLUGINS_DIR:-$HOME/Documents/Obsidian/Main/.obsidian/plugins}"
PLUGIN_TARGET_DIR="$OBSIDIAN_PLUGINS_DIR/$PLUGIN_NAME"

echo "🔧 Installing Task Sync Plugin for Obsidian..."

# Check if source directory exists
if [ ! -d "$PLUGIN_SOURCE_DIR" ]; then
    echo "❌ Error: Plugin source directory '$PLUGIN_SOURCE_DIR' not found"
    exit 1
fi

# Check if Obsidian plugins directory exists
if [ ! -d "$OBSIDIAN_PLUGINS_DIR" ]; then
    echo "❌ Error: Obsidian plugins directory '$OBSIDIAN_PLUGINS_DIR' not found"
    echo "💡 Make sure Obsidian is installed and you have opened a vault"
    echo "💡 You can also set a custom path: OBSIDIAN_PLUGINS_DIR=/path/to/vault/.obsidian/plugins ./install-plugin.sh"
    exit 1
fi

# Create plugin directory
echo "📁 Creating plugin directory..."
mkdir -p "$PLUGIN_TARGET_DIR"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "💡 Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed"
    echo "💡 Please install npm (usually comes with Node.js)"
    exit 1
fi

# Build the plugin in source directory first
echo "🔨 Building plugin in source directory..."
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

# Install or reinstall dependencies if needed
if [ ! -d "node_modules" ] || [ "$NEEDS_REINSTALL" = true ]; then
    echo "📦 Installing dependencies for current platform..."
    if [ "$NEEDS_REINSTALL" = true ]; then
        rm -rf node_modules package-lock.json
    fi
    npm install
fi

# Build the plugin
npm run build

# Go back to original directory
cd - > /dev/null

# Copy built files to plugin directory
echo "📋 Copying plugin files..."
mkdir -p "$PLUGIN_TARGET_DIR"

# Copy only the essential files for the plugin
cp "$PLUGIN_SOURCE_DIR/main.js" "$PLUGIN_TARGET_DIR/"
cp "$PLUGIN_SOURCE_DIR/manifest.json" "$PLUGIN_TARGET_DIR/"
cp "$PLUGIN_SOURCE_DIR/styles.css" "$PLUGIN_TARGET_DIR/"

# Check if required files exist in source directory
if [ ! -f "$PLUGIN_SOURCE_DIR/main.js" ]; then
    echo "❌ Error: main.js was not generated in $PLUGIN_SOURCE_DIR"
    echo "💡 Check the build output above for errors"
    exit 1
fi

if [ ! -f "$PLUGIN_SOURCE_DIR/manifest.json" ]; then
    echo "❌ Error: manifest.json not found in $PLUGIN_SOURCE_DIR"
    exit 1
fi

echo "✅ Plugin installed successfully!"
echo ""
echo "📍 Plugin location: $PLUGIN_TARGET_DIR"
echo ""
echo "🔄 Next steps:"
echo "1. Restart Obsidian"
echo "2. Go to Settings → Community Plugins"
echo "3. Turn off 'Safe mode' if it's on"
echo "4. Find 'Task Sync' in the installed plugins list"
echo "5. Enable the plugin"
echo "6. Configure the plugin settings for your task management system"
echo ""
echo "🧪 Test the setup:"
echo "   cd '$PLUGIN_SOURCE_DIR' && npm test"
echo ""
echo "🛠️  To rebuild after making changes:"
echo "   cd '$PLUGIN_SOURCE_DIR' && npm run build"
echo ""
echo "🔍 To watch for changes during development:"
echo "   cd '$PLUGIN_SOURCE_DIR' && npm run dev"
