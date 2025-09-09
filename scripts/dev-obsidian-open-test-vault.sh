#!/bin/bash

# Development script to open Obsidian with a test vault
# This creates a test vault similar to e2e tests and opens it in Obsidian

set -e

echo "🔧 Setting up test vault for development..."

# Configuration
TEST_VAULT_DIR="./dev-test-vault"
OBSIDIAN_DATA_DIR="./dev-test-vault/.obsidian"
PLUGIN_NAME="obsidian-task-sync"

# Clean up existing test vault
if [ -d "$TEST_VAULT_DIR" ]; then
    echo "🧹 Cleaning up existing test vault..."
    rm -rf "$TEST_VAULT_DIR"
fi

# Create test vault directory
mkdir -p "$TEST_VAULT_DIR"
mkdir -p "$OBSIDIAN_DATA_DIR"

echo "📋 Creating test vault structure..."

# Copy pristine vault if it exists
PRISTINE_VAULT_PATH="./tests/vault/Test.pristine"
if [ -d "$PRISTINE_VAULT_PATH" ]; then
    echo "📂 Copying pristine vault from $PRISTINE_VAULT_PATH..."
    cp -r "$PRISTINE_VAULT_PATH"/* "$TEST_VAULT_DIR/"
else
    echo "📝 Creating minimal test vault structure..."
    # Create basic vault structure
    mkdir -p "$TEST_VAULT_DIR/Tasks"
    mkdir -p "$TEST_VAULT_DIR/Projects"
    mkdir -p "$TEST_VAULT_DIR/Areas"
    mkdir -p "$TEST_VAULT_DIR/Templates"
    mkdir -p "$TEST_VAULT_DIR/Bases"

    # Create a sample task
    cat > "$TEST_VAULT_DIR/Tasks/Sample Task.md" << 'EOF'
---
Title: Sample Task
Type: Task
Priority: Medium
Areas: []
Project:
Done: false
Status: Backlog
Parent task:
Sub-tasks: []
tags: []
---

This is a sample task for testing the Task Sync plugin.
EOF

    # Create a sample project
    cat > "$TEST_VAULT_DIR/Projects/Sample Project.md" << 'EOF'
---
Name: Sample Project
Type: Project
Status: Active
Areas: []
tags: []
---

This is a sample project for testing.

## Tasks
![[Bases/Sample Project Tasks.base]]
EOF

    # Create a sample area
    cat > "$TEST_VAULT_DIR/Areas/Sample Area.md" << 'EOF'
---
Name: Sample Area
Type: Area
Status: Active
tags: []
---

This is a sample area for testing.

## Tasks
![[Bases/Sample Area Tasks.base]]
EOF
fi

# Get absolute path to test vault
TEST_VAULT_ABS_PATH=$(cd "$TEST_VAULT_DIR" && pwd)

# Copy pristine Obsidian data if it exists
PRISTINE_DATA_PATH="./e2e/obsidian-data.pristine"
if [ -d "$PRISTINE_DATA_PATH" ]; then
    echo "⚙️ Copying pristine Obsidian data..."
    cp -r "$PRISTINE_DATA_PATH"/* "$OBSIDIAN_DATA_DIR/"

    # Update obsidian.json to point to our test vault
    OBSIDIAN_JSON="$OBSIDIAN_DATA_DIR/obsidian.json"
    if [ -f "$OBSIDIAN_JSON" ]; then
        # Update vault path in obsidian.json using the pristine template
        cat > "$OBSIDIAN_JSON" << EOF
{
  "vaults": {
    "test-vault": {
      "path": "$TEST_VAULT_ABS_PATH",
      "ts": $(date +%s)000,
      "open": true
    }
  },
  "frame": {
    "x": 0,
    "y": 0,
    "width": 1920,
    "height": 1080
  },
  "theme": "obsidian",
  "enabledPlugins": [
    "obsidian-task-sync"
  ],
  "hotkeys": {},
  "workspaceLayout": {
    "type": "split",
    "direction": "vertical",
    "children": [
      {
        "type": "leaf",
        "state": {
          "type": "empty",
          "state": {}
        }
      }
    ]
  },
  "leftRibbon": {
    "hiddenItems": {}
  },
  "rightRibbon": {
    "hiddenItems": {}
  },
  "leftSidedock": {
    "children": [],
    "collapsed": true
  },
  "rightSidedock": {
    "children": [],
    "collapsed": true
  },
  "active": "test-vault",
  "lastOpenFiles": []
}
EOF
    fi
else
    echo "⚙️ Creating minimal Obsidian configuration..."

    # Create complete Obsidian configuration matching e2e setup
    cat > "$OBSIDIAN_DATA_DIR/obsidian.json" << EOF
{
  "vaults": {
    "test-vault": {
      "path": "$TEST_VAULT_ABS_PATH",
      "ts": $(date +%s)000,
      "open": true
    }
  },
  "frame": {
    "x": 0,
    "y": 0,
    "width": 1920,
    "height": 1080
  },
  "theme": "obsidian",
  "enabledPlugins": [
    "obsidian-task-sync"
  ],
  "hotkeys": {},
  "workspaceLayout": {
    "type": "split",
    "direction": "vertical",
    "children": [
      {
        "type": "leaf",
        "state": {
          "type": "empty",
          "state": {}
        }
      }
    ]
  },
  "leftRibbon": {
    "hiddenItems": {}
  },
  "rightRibbon": {
    "hiddenItems": {}
  },
  "leftSidedock": {
    "children": [],
    "collapsed": true
  },
  "rightSidedock": {
    "children": [],
    "collapsed": true
  },
  "active": "test-vault",
  "lastOpenFiles": []
}
EOF

    # Create basic app.json
    cat > "$OBSIDIAN_DATA_DIR/app.json" << 'EOF'
{
  "legacyEditor": false,
  "livePreview": true,
  "theme": "obsidian"
}
EOF
fi

# Build the plugin
echo "🔨 Building plugin..."
npm run build

# Copy plugin files to test vault
PLUGIN_DIR="$TEST_VAULT_DIR/.obsidian/plugins/$PLUGIN_NAME"
mkdir -p "$PLUGIN_DIR"

echo "📋 Installing plugin to test vault..."
cp main.js "$PLUGIN_DIR/"
cp manifest.json "$PLUGIN_DIR/"
cp styles.css "$PLUGIN_DIR/"

# Enable the plugin
COMMUNITY_PLUGINS_JSON="$TEST_VAULT_DIR/.obsidian/community-plugins.json"
echo '["obsidian-task-sync"]' > "$COMMUNITY_PLUGINS_JSON"

# Check if Obsidian is available
OBSIDIAN_PATH=""

# Try to find Obsidian executable
if command -v obsidian &> /dev/null; then
    OBSIDIAN_PATH="obsidian"
elif [ -f "/Applications/Obsidian.app/Contents/MacOS/Obsidian" ]; then
    OBSIDIAN_PATH="/Applications/Obsidian.app/Contents/MacOS/Obsidian"
elif [ -f "/usr/bin/obsidian" ]; then
    OBSIDIAN_PATH="/usr/bin/obsidian"
elif [ -f "/opt/Obsidian/obsidian" ]; then
    OBSIDIAN_PATH="/opt/Obsidian/obsidian"
elif [ -f "$HOME/.local/bin/obsidian" ]; then
    OBSIDIAN_PATH="$HOME/.local/bin/obsidian"
else
    echo "❌ Obsidian executable not found!"
    echo "💡 Please install Obsidian or add it to your PATH"
    echo "📍 Test vault created at: $(cd "$TEST_VAULT_DIR" && pwd)"
    echo "🔧 You can manually open this vault in Obsidian"
    exit 1
fi

echo "✅ Test vault created successfully!"
echo "📍 Vault location: $TEST_VAULT_ABS_PATH"
echo "📍 Data directory: $OBSIDIAN_DATA_DIR"
echo "🚀 Opening Obsidian with test vault..."
echo ""
echo "⚠️  Note: You may see some warnings in the terminal - this is normal when using URL schemes"

# Get absolute path to data directory
OBSIDIAN_DATA_ABS_PATH=$(cd "$OBSIDIAN_DATA_DIR" && pwd)

# Open Obsidian with proper arguments like e2e tests
# Use the obsidian:// URL scheme with user data directory
"$OBSIDIAN_PATH" --user-data-dir="$OBSIDIAN_DATA_ABS_PATH" "obsidian://open?path=$(echo "$TEST_VAULT_ABS_PATH" | sed 's/ /%20/g')" &

echo "🎉 Obsidian should now open directly with your test vault!"
echo ""
echo "💡 Tips:"
echo "   - The plugin is already installed and enabled"
echo "   - Sample tasks, projects, and areas are created"
echo "   - The vault is pre-configured to open automatically"
echo "   - You can test plugin features immediately"
echo ""
echo "ℹ️  Expected behavior:"
echo "   - You may see some harmless warnings in the terminal (this is normal)"
echo "   - Obsidian should open directly to the test vault without prompting"
echo "   - If prompted to select a vault, choose 'test-vault' from the list"
echo ""
echo "🔄 To rebuild and update the plugin:"
echo "   npm run dev:obsidian:install --vault=\"$TEST_VAULT_ABS_PATH\""
echo ""
echo "🧹 To clean up the test vault:"
echo "   rm -rf \"$TEST_VAULT_DIR\""
