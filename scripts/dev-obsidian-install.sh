#!/bin/bash

# Development script to build and install plugin to a local vault
# Supports watch mode for automatic rebuilding and installation

set -e

# Default configuration
PLUGIN_NAME="obsidian-task-sync"
WATCH_MODE=false
VAULT_PATH=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --vault=*)
            VAULT_PATH="${1#*=}"
            shift
            ;;
        --vault)
            VAULT_PATH="$2"
            shift 2
            ;;
        --watch)
            WATCH_MODE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 --vault=<path> [--watch]"
            echo ""
            echo "Options:"
            echo "  --vault=<path>  Path to your Obsidian vault"
            echo "  --watch         Enable watch mode for automatic rebuilding"
            echo "  -h, --help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --vault=\"/path/to/my/vault\""
            echo "  $0 --vault=\"/path/to/my/vault\" --watch"
            exit 0
            ;;
        *)
            echo "❌ Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate vault path
if [ -z "$VAULT_PATH" ]; then
    echo "❌ Error: Vault path is required"
    echo "Usage: $0 --vault=<path> [--watch]"
    echo "Use --help for more information"
    exit 1
fi

# Check if vault path exists before converting to absolute path
if [ ! -d "$VAULT_PATH" ]; then
    echo "❌ Error: Vault directory does not exist: $VAULT_PATH"
    exit 1
fi

# Convert to absolute path
VAULT_PATH=$(cd "$VAULT_PATH" && pwd)

# Check if it looks like an Obsidian vault
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "⚠️ Warning: Directory doesn't appear to be an Obsidian vault (no .obsidian folder)"
    echo "📍 Vault path: $VAULT_PATH"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_NAME"

echo "🔧 Installing Task Sync Plugin to vault..."
echo "📍 Vault: $VAULT_PATH"
echo "🔄 Watch mode: $WATCH_MODE"

# Function to build and install plugin
install_plugin() {
    echo "🔨 Building plugin..."

    # Build the plugin
    if ! npm run build; then
        echo "❌ Build failed!"
        return 1
    fi

    # Check if build was successful
    if [ ! -f "main.js" ]; then
        echo "❌ Error: Build failed - main.js not generated"
        return 1
    fi

    # Create plugin directory
    mkdir -p "$PLUGIN_DIR"

    # Copy plugin files
    echo "📋 Installing plugin files..."
    cp main.js "$PLUGIN_DIR/"
    cp manifest.json "$PLUGIN_DIR/"
    cp styles.css "$PLUGIN_DIR/"

    echo "✅ Plugin installed successfully!"
    echo "📍 Plugin location: $PLUGIN_DIR"

    return 0
}

# Function to copy files only (for watch mode)
copy_plugin_files() {
    # Create plugin directory
    mkdir -p "$PLUGIN_DIR"

    # Copy plugin files
    echo "📋 Copying plugin files..."
    cp main.js "$PLUGIN_DIR/" 2>/dev/null || echo "⚠️ main.js not found"
    cp manifest.json "$PLUGIN_DIR/" 2>/dev/null || echo "⚠️ manifest.json not found"
    cp styles.css "$PLUGIN_DIR/" 2>/dev/null || echo "⚠️ styles.css not found"

    echo "✅ Plugin files copied!"
    echo "📍 Plugin location: $PLUGIN_DIR"

    return 0
}

# Function to enable plugin in Obsidian
enable_plugin() {
    local community_plugins_file="$VAULT_PATH/.obsidian/community-plugins.json"

    # Check if community plugins file exists
    if [ ! -f "$community_plugins_file" ]; then
        echo "📝 Creating community-plugins.json..."
        echo '[]' > "$community_plugins_file"
    fi

    # Check if plugin is already enabled
    if grep -q "\"$PLUGIN_NAME\"" "$community_plugins_file"; then
        echo "✅ Plugin already enabled in community-plugins.json"
    else
        echo "🔌 Enabling plugin in community-plugins.json..."

        # Read current plugins, add ours, and write back
        python3 -c "
import json
import sys

try:
    with open('$community_plugins_file', 'r') as f:
        plugins = json.load(f)
except:
    plugins = []

if '$PLUGIN_NAME' not in plugins:
    plugins.append('$PLUGIN_NAME')

with open('$community_plugins_file', 'w') as f:
    json.dump(plugins, f, indent=2)

print('Plugin enabled successfully')
" 2>/dev/null || {
            # Fallback if Python is not available
            echo "⚠️ Python not available, manually enabling plugin..."
            # Simple approach: replace [] with our plugin or append to existing list
            if grep -q '^\[\]$' "$community_plugins_file"; then
                echo "[\"$PLUGIN_NAME\"]" > "$community_plugins_file"
            else
                # More complex case - try to add to existing array
                echo "💡 Please manually add \"$PLUGIN_NAME\" to $community_plugins_file"
            fi
        }
    fi
}

# Initial installation
if ! install_plugin; then
    exit 1
fi

# Enable the plugin
enable_plugin

if [ "$WATCH_MODE" = true ]; then
    echo ""
    echo "👀 Starting watch mode..."
    echo "🔄 Plugin will be automatically rebuilt and installed when source files change"
    echo "⏹️  Press Ctrl+C to stop watching"
    echo ""

    # Start esbuild in watch mode in the background
    echo "🚀 Starting esbuild watch mode..."
    npm run dev &
    ESBUILD_PID=$!

    # Give esbuild a moment to start
    sleep 2

    # Function to cleanup on exit
    cleanup() {
        echo ""
        echo "🛑 Stopping watch mode..."
        kill $ESBUILD_PID 2>/dev/null || true
        exit 0
    }

    # Set up signal handlers
    trap cleanup SIGINT SIGTERM

    # Watch for changes to built files and copy them
    if command -v fswatch &> /dev/null; then
        echo "📡 Using fswatch to monitor built files..."
        # Use fswatch to monitor the built files
        # -o: print only file counts, -1: exit after first event batch
        fswatch -o main.js styles.css manifest.json 2>/dev/null | while read f; do
            echo "🔄 Built files changed, copying to plugin directory..."
            copy_plugin_files
        done
    else
        echo "📡 Using simple polling to monitor built files..."
        if [[ "$OSTYPE" == "darwin"* ]]; then
            echo "💡 For better performance on macOS, install fswatch: brew install fswatch"
        fi
        # Simple polling-based watch for built files
        # Cross-platform stat command (Linux uses -c %Y, macOS uses -f %m)
        if [[ "$OSTYPE" == "darwin"* ]]; then
            STAT_CMD="stat -f %m"
        else
            STAT_CMD="stat -c %Y"
        fi

        LAST_MAIN_CHANGE=$($STAT_CMD main.js 2>/dev/null || echo "0")
        LAST_STYLES_CHANGE=$($STAT_CMD styles.css 2>/dev/null || echo "0")
        LAST_MANIFEST_CHANGE=$($STAT_CMD manifest.json 2>/dev/null || echo "0")

        while true; do
            sleep 1
            CURRENT_MAIN_CHANGE=$($STAT_CMD main.js 2>/dev/null || echo "0")
            CURRENT_STYLES_CHANGE=$($STAT_CMD styles.css 2>/dev/null || echo "0")
            CURRENT_MANIFEST_CHANGE=$($STAT_CMD manifest.json 2>/dev/null || echo "0")

            if [ "$CURRENT_MAIN_CHANGE" != "$LAST_MAIN_CHANGE" ] || \
               [ "$CURRENT_STYLES_CHANGE" != "$LAST_STYLES_CHANGE" ] || \
               [ "$CURRENT_MANIFEST_CHANGE" != "$LAST_MANIFEST_CHANGE" ]; then
                echo "🔄 Built files changed, copying to plugin directory..."
                copy_plugin_files
                LAST_MAIN_CHANGE=$CURRENT_MAIN_CHANGE
                LAST_STYLES_CHANGE=$CURRENT_STYLES_CHANGE
                LAST_MANIFEST_CHANGE=$CURRENT_MANIFEST_CHANGE
            fi
        done
    fi
else
    echo ""
    echo "🎉 Installation complete!"
    echo ""
    echo "🔄 Next steps:"
    echo "1. Restart Obsidian or reload the app (Ctrl+Shift+P → 'Reload app without saving')"
    echo "2. Go to Settings → Community Plugins"
    echo "3. Make sure 'Safe mode' is off"
    echo "4. Find 'Task Sync' and enable it if not already enabled"
    echo ""
    echo "💡 To enable watch mode for automatic updates:"
    echo "   $0 --vault=\"$VAULT_PATH\" --watch"
fi
