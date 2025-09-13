# Styles Directory

This directory contains the source CSS files for the Task Sync plugin.

## Structure

- `main.css` - Main entry point that imports all other CSS files
- `custom.css` - Our custom plugin styles (copied from root styles.css)

## Build Process

The CSS build process uses PostCSS to combine:
1. Schedule-X default theme CSS from `@schedule-x/theme-default`
2. Our custom plugin styles from `custom.css`

### Commands

- `npm run build:css` - Build CSS once
- `npm run build:css:watch` - Build CSS and watch for changes
- `npm run build` - Full build including CSS
- `npm run dev` - Development mode (builds CSS first)

### Output

The build process generates `styles.css` in the root directory, which is:
- Used by Obsidian to style the plugin
- Ignored by git (it's a build artifact)
- Automatically regenerated on each build

## Adding New Styles

1. Add your custom styles to `custom.css`
2. Run `npm run build:css` to regenerate `styles.css`
3. For external CSS libraries, add them as imports in `main.css`

## External Dependencies

Currently imports:
- `@schedule-x/theme-default` - Calendar component styling
