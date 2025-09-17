#!/bin/bash

# Setup script for headless e2e testing on Debian/Ubuntu systems
# This script installs necessary dependencies and configures the environment
# for running Electron-based tests in headless mode

set -e

echo "🔧 Setting up headless testing environment for Debian/Ubuntu..."

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

# Check if we're on a Debian-based system
if ! command_exists apt-get; then
    echo "❌ This script is designed for Debian/Ubuntu systems with apt-get"
    echo "   For other systems, please install xvfb manually:"
    echo "   - RHEL/CentOS: yum install xorg-x11-server-Xvfb"
    echo "   - Arch: pacman -S xorg-server-xvfb"
    echo "   - Alpine: apk add xvfb"
    exit 1
fi

# Update package list
echo "📦 Updating package list..."
run_with_sudo apt-get update

# Install xvfb if not already installed
if ! command_exists xvfb-run; then
    echo "📦 Installing Xvfb (X Virtual Framebuffer)..."
    run_with_sudo apt-get install -y xvfb
else
    echo "✅ Xvfb is already installed"
fi

# Install additional dependencies that might be needed for Electron
echo "📦 Installing additional dependencies for Electron..."
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
    libgtk-3-0

# Check if Node.js is installed
if ! command_exists node; then
    echo "⚠️ Node.js is not installed. Please install Node.js first."
    echo "   Visit: https://nodejs.org/ or use your package manager"
    exit 1
fi

# Check if npm is installed
if ! command_exists npm; then
    echo "⚠️ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Headless testing environment setup complete!"
echo ""
echo "🚀 You can now run e2e tests in headless mode using:"
echo "   npm run test:e2e:headless"
echo ""
echo "💡 Or use xvfb-run directly:"
echo "   xvfb-run -a --server-args=\"-screen 0 1920x1080x24 -ac -nolisten tcp -dpi 96\" npm run test:e2e"
echo ""
echo "🔍 To verify the setup, you can check:"
echo "   - Xvfb version: xvfb-run --help"
echo "   - Available displays: ls /tmp/.X*-lock 2>/dev/null || echo 'No X displays currently running'"
