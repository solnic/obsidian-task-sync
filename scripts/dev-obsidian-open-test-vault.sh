#!/bin/bash

# Development script to open Obsidian with a test vault
# This creates a test vault similar to e2e tests and opens it in Obsidian

set -e

echo "🔧 Setting up test vault for development..."

# Configuration
TEST_VAULT_DIR="./tmp/dev-test-vault"
OBSIDIAN_DATA_DIR="./tmp/dev-test-vault/.obsidian"
PLUGIN_NAME="obsidian-task-sync"

# Check if test vault exists and is properly set up
VAULT_EXISTS=false
VAULT_NEEDS_BOOTSTRAP=false

if [ -d "$TEST_VAULT_DIR" ]; then
    echo "📂 Test vault directory exists: $TEST_VAULT_DIR"
    VAULT_EXISTS=true

    # Check if vault has basic structure
    if [ ! -d "$TEST_VAULT_DIR/Tasks" ] || [ ! -d "$TEST_VAULT_DIR/Projects" ] || [ ! -d "$TEST_VAULT_DIR/Areas" ]; then
        echo "⚠️  Vault exists but missing basic folder structure - will bootstrap"
        VAULT_NEEDS_BOOTSTRAP=true
    elif [ ! -f "$TEST_VAULT_DIR/Tasks"/*.md ] 2>/dev/null && [ ! -f "$TEST_VAULT_DIR/Projects"/*.md ] 2>/dev/null; then
        echo "⚠️  Vault exists but appears empty - will add sample content"
        VAULT_NEEDS_BOOTSTRAP=true
    else
        echo "✅ Vault exists and appears to be set up - preserving existing content"
    fi
else
    echo "📂 Creating new test vault directory: $TEST_VAULT_DIR"
    VAULT_EXISTS=false
    VAULT_NEEDS_BOOTSTRAP=true
fi

# Create directories if they don't exist
mkdir -p "$TEST_VAULT_DIR"
mkdir -p "$OBSIDIAN_DATA_DIR"

if [ "$VAULT_NEEDS_BOOTSTRAP" = true ]; then
    echo "📋 Bootstrapping test vault structure..."
else
    echo "📋 Vault already set up, skipping content creation..."
fi

# Bootstrap vault content only if needed
if [ "$VAULT_NEEDS_BOOTSTRAP" = true ]; then
    # Copy pristine vault if it exists (for basic structure and welcome files)
    PRISTINE_VAULT_PATH="./tests/vault/Test.pristine"
    if [ -d "$PRISTINE_VAULT_PATH" ]; then
        echo "📂 Copying pristine vault structure from $PRISTINE_VAULT_PATH..."
        cp -r "$PRISTINE_VAULT_PATH"/* "$TEST_VAULT_DIR/"
    fi

    # Always create/ensure basic vault structure exists
    echo "📝 Creating test vault structure and sample content..."
    mkdir -p "$TEST_VAULT_DIR/Tasks"
    mkdir -p "$TEST_VAULT_DIR/Projects"
    mkdir -p "$TEST_VAULT_DIR/Areas"
    mkdir -p "$TEST_VAULT_DIR/Templates"
    mkdir -p "$TEST_VAULT_DIR/Bases"

    # Create sample areas first (projects and tasks will reference them)
    cat > "$TEST_VAULT_DIR/Areas/Work.md" << 'EOF'
---
Name: Work
Type: Area
Status: Active
tags: [professional, career]
---

Professional work and career development area.

## Goals
- Deliver high-quality projects on time
- Improve technical skills
- Build strong team relationships

## Tasks
![[Bases/Work Tasks.base]]
EOF

    cat > "$TEST_VAULT_DIR/Areas/Personal Development.md" << 'EOF'
---
Name: Personal Development
Type: Area
Status: Active
tags: [learning, growth, skills]
---

Continuous learning and personal growth area.

## Goals
- Learn new technologies
- Improve productivity
- Maintain work-life balance

## Tasks
![[Bases/Personal Development Tasks.base]]
EOF

    # Create sample projects
    cat > "$TEST_VAULT_DIR/Projects/Task Sync Plugin.md" << 'EOF'
---
Name: Task Sync Plugin
Type: Project
Status: Active
Areas: [Work, Personal Development]
tags: [obsidian, plugin, development]
---

Development of the Obsidian Task Sync plugin to synchronize tasks between Obsidian and external systems.

## Overview
This project involves creating a robust plugin that allows users to sync their tasks with various external systems while maintaining the flexibility of Obsidian's markdown format.

## Tasks
![[Bases/Task Sync Plugin Tasks.base]]
EOF

    cat > "$TEST_VAULT_DIR/Projects/Home Organization.md" << 'EOF'
---
Name: Home Organization
Type: Project
Status: Planning
Areas: [Personal Development]
tags: [home, organization, productivity]
---

Organizing and optimizing the home environment for better productivity and comfort.

## Overview
A comprehensive project to declutter, organize, and optimize living spaces for improved daily routines and productivity.

## Tasks
![[Bases/Home Organization Tasks.base]]
EOF

    # Create diverse sample tasks
    cat > "$TEST_VAULT_DIR/Tasks/Fix authentication bug.md" << 'EOF'
---
Title: Fix authentication bug
Type: Bug
Priority: High
Areas: [Work]
Project: Task Sync Plugin
Done: false
Status: In Progress
tags: [bug, authentication, urgent]
---

Users are experiencing authentication failures when connecting to GitHub API. Need to investigate and fix the token refresh mechanism.

## Steps to Reproduce
1. Connect to GitHub API
2. Wait for token to expire
3. Try to sync tasks
4. Authentication fails

## Expected Behavior
Token should refresh automatically and sync should continue.
EOF

    cat > "$TEST_VAULT_DIR/Tasks/Implement dark mode support.md" << 'EOF'
---
Title: Implement dark mode support
Type: Feature
Priority: Medium
Areas: [Work]
Project: Task Sync Plugin
Done: false
Status: Backlog
tags: [feature, ui, accessibility]
---

Add support for dark mode in the plugin interface to match Obsidian's theme.

## Requirements
- Detect Obsidian's current theme
- Apply appropriate colors for dark/light modes
- Ensure good contrast and readability
- Test with popular community themes
EOF

    cat > "$TEST_VAULT_DIR/Tasks/Write plugin documentation.md" << 'EOF'
---
Title: Write plugin documentation
Type: Task
Priority: Medium
Areas: [Work]
Project: Task Sync Plugin
Done: false
Status: Todo
tags: [documentation, user-guide]
---

Create comprehensive documentation for the Task Sync plugin including installation, configuration, and usage instructions.

## Sections Needed
- Installation guide
- Configuration options
- Usage examples
- Troubleshooting
- API reference
EOF

    cat > "$TEST_VAULT_DIR/Tasks/Set up home office.md" << 'EOF'
---
Title: Set up home office
Type: Task
Priority: High
Areas: [Personal Development]
Project: Home Organization
Done: true
Status: Done
tags: [home, office, productivity]
---

Create a dedicated workspace at home for better focus and productivity.

## Completed Items
- ✅ Choose location for office
- ✅ Purchase desk and chair
- ✅ Set up lighting
- ✅ Organize cables and equipment
- ✅ Add plants for better air quality
EOF

    cat > "$TEST_VAULT_DIR/Tasks/Learn TypeScript advanced patterns.md" << 'EOF'
---
Title: Learn TypeScript advanced patterns
Type: Task
Priority: Low
Areas: [Personal Development, Work]
Done: false
Status: Backlog
tags: [learning, typescript, programming]
---

Study advanced TypeScript patterns and techniques to improve code quality and type safety.

## Topics to Cover
- Generic constraints and conditional types
- Template literal types
- Mapped types and utility types
- Decorators and metadata
- Advanced module patterns
EOF

    cat > "$TEST_VAULT_DIR/Tasks/Organize kitchen pantry.md" << 'EOF'
---
Title: Organize kitchen pantry
Type: Chore
Priority: Medium
Areas: [Personal Development]
Project: Home Organization
Done: false
Status: Todo
tags: [home, kitchen, organization]
---

Sort through pantry items, discard expired products, and implement a better organization system.

## Steps
1. Remove all items from pantry
2. Check expiration dates
3. Clean shelves thoroughly
4. Group similar items together
5. Label shelves and containers
6. Create inventory system
EOF

    # Create Welcome file
    cat > "$TEST_VAULT_DIR/Welcome.md" << 'EOF'
# Welcome to Task Sync Development Vault

This is a development vault for testing the Task Sync plugin with realistic sample data.

## What's Included

### 📁 Folders
- **Tasks**: Individual task files with various statuses and types
- **Projects**: Project management files with task references
- **Areas**: Areas of responsibility for organizing work
- **Templates**: Templates for creating new tasks, projects, and areas
- **Bases**: Database views for task management (auto-generated)

### 📋 Sample Data
- **2 Areas**: Work and Personal Development
- **2 Projects**: Task Sync Plugin and Home Organization
- **6 Tasks**: Various types (Bug, Feature, Task, Chore) with different statuses

### 🔧 Plugin Features to Test
- Task creation and editing
- Project and area management
- Task status updates
- Cross-references between tasks, projects, and areas
- Different task types and priorities

## Getting Started

1. Open the Task Sync plugin panel
2. Explore the sample tasks in different statuses
3. Try creating new tasks, projects, or areas
4. Test the synchronization features
5. Experiment with the various plugin settings

Happy testing! 🚀
EOF

    # Create basic templates
    cat > "$TEST_VAULT_DIR/Templates/Task.md" << 'EOF'
---
Title:
Type: Task
Priority: Medium
Areas: []
Project:
Done: false
Status: Backlog
tags: []
---

## Description

## Acceptance Criteria

- [ ]
- [ ]
- [ ]
EOF

    cat > "$TEST_VAULT_DIR/Templates/Project.md" << 'EOF'
---
Name:
Type: Project
Status: Planning
Areas: []
tags: []
---

## Overview

## Goals

## Tasks

![[Bases/{{title}} Tasks.base]]
EOF

    cat > "$TEST_VAULT_DIR/Templates/Area.md" << 'EOF'
---
Name:
Type: Area
Status: Active
tags: []
---

## Purpose

## Goals

## Tasks

![[Bases/{{title}} Tasks.base]]
EOF
fi

# Get absolute path to test vault
TEST_VAULT_ABS_PATH=$(cd "$TEST_VAULT_DIR" && pwd)

# Copy pristine Obsidian data if it exists
PRISTINE_DATA_PATH="./tests/e2e/obsidian-data.pristine"
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

# Create plugin configuration with proper settings
PLUGIN_DATA_JSON="$PLUGIN_DIR/data.json"
cat > "$PLUGIN_DATA_JSON" << 'EOF'
{
  "tasksFolder": "Tasks",
  "projectsFolder": "Projects",
  "areasFolder": "Areas",
  "templateFolder": "Templates",
  "useTemplater": false,
  "defaultTaskTemplate": "Task.md",
  "defaultProjectTemplate": "Project.md",
  "defaultAreaTemplate": "Area.md",
  "basesFolder": "Bases",
  "tasksBaseFile": "Tasks.base",
  "autoGenerateBases": true,
  "autoUpdateBaseViews": true,
  "taskTypes": [
    {
      "name": "Task",
      "color": "blue"
    },
    {
      "name": "Bug",
      "color": "red"
    },
    {
      "name": "Feature",
      "color": "green"
    },
    {
      "name": "Improvement",
      "color": "purple"
    },
    {
      "name": "Chore",
      "color": "gray"
    }
  ],
  "taskStatuses": [
    "Backlog",
    "Todo",
    "In Progress",
    "Review",
    "Done",
    "Cancelled"
  ],
  "taskPriorities": [
    "Low",
    "Medium",
    "High",
    "Urgent"
  ],
  "projectStatuses": [
    "Planning",
    "Active",
    "On Hold",
    "Completed",
    "Cancelled"
  ],
  "areaStatuses": [
    "Active",
    "Inactive",
    "Archived"
  ]
}
EOF

echo "⚙️ Plugin configuration created with sample settings"

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
echo "   - The plugin is already installed, enabled, and configured"
echo "   - Sample content includes 6 tasks, 2 projects, and 2 areas"
echo "   - Tasks have different types (Bug, Feature, Task, Chore) and statuses"
echo "   - The vault preserves existing content on subsequent runs"
echo "   - Templates are available for creating new content"
echo "   - You can test all plugin features immediately"
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
