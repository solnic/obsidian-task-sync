#!/bin/bash

# Development setup script for Task Sync Plugin
# This script sets up the development environment and handles cross-platform dependencies

set -e

echo "🔧 Setting up Task Sync Plugin development environment..."

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

# Display platform information
CURRENT_PLATFORM=$(uname -s)
CURRENT_ARCH=$(uname -m)
echo "🖥️  Platform: $CURRENT_PLATFORM ($CURRENT_ARCH)"

# Clean any existing dependencies to avoid platform conflicts
echo "🧹 Cleaning existing dependencies..."
rm -rf node_modules package-lock.json

# Install dependencies fresh for current platform
echo "📦 Installing dependencies for current platform..."
npm install

# Verify esbuild platform-specific package is installed
echo "🔍 Verifying platform-specific dependencies..."
if [ "$CURRENT_PLATFORM" = "Darwin" ]; then
    if [ ! -d "node_modules/@esbuild/darwin-arm64" ] && [ ! -d "node_modules/@esbuild/darwin-x64" ]; then
        echo "⚠️  Warning: esbuild platform package for macOS not found"
        echo "🔄 Attempting to install esbuild manually..."
        npm install esbuild --force
    else
        echo "✅ macOS esbuild package found"
    fi
elif [ "$CURRENT_PLATFORM" = "Linux" ]; then
    if [ ! -d "node_modules/@esbuild/linux-arm64" ] && [ ! -d "node_modules/@esbuild/linux-x64" ]; then
        echo "⚠️  Warning: esbuild platform package for Linux not found"
        echo "🔄 Attempting to install esbuild manually..."
        npm install esbuild --force
    else
        echo "✅ Linux esbuild package found"
    fi
fi

# Run tests to verify setup
echo "🧪 Running tests to verify setup..."
npm run test

# Build the plugin to verify everything works
echo "🔨 Building plugin to verify setup..."
npm run build

# Check if build was successful
if [ ! -f "main.js" ]; then
    echo "❌ Error: Build failed - main.js not generated"
    echo "💡 Check the build output above for errors"
    exit 1
fi

echo "✅ Development environment setup complete!"
echo ""
echo "🚀 Available commands:"
echo "   npm run dev        - Start development mode with file watching"
echo "   npm run build      - Build the plugin"
echo "   npm run test       - Run unit tests"
echo "   npm run test:e2e   - Run end-to-end tests"
echo ""
echo "📋 Installation commands:"
echo "   ./install-plugin.sh  - Install plugin to Obsidian"
echo "   ./update-plugin.sh   - Update installed plugin after changes"
echo ""
echo "💡 Tips:"
echo "   - Use './update-plugin.sh' for quick updates during development"
echo "   - Run this script again if you switch between platforms"
echo "   - The scripts automatically handle platform-specific dependencies"
