# Schedule-X Obsidian Theme

## Overview

This document describes the custom Schedule-X theme created specifically for the Obsidian Task Sync plugin. The theme provides seamless integration with Obsidian's design system while maintaining easy maintainability.

## Problem Solved

### Previous Approach Issues
- **Brittle Overrides**: Used many `!important` declarations to override default Schedule-X styles
- **Hard to Maintain**: Scattered overrides throughout the CSS made updates difficult
- **Theme Conflicts**: Manual overrides could conflict with Schedule-X updates
- **Incomplete Coverage**: Some components weren't properly themed

### New Approach Benefits
- **Layered Integration**: Uses default Schedule-X theme as base with targeted Obsidian overrides
- **Minimal Footprint**: Only overrides what's necessary for Obsidian integration
- **Stable Foundation**: Core Schedule-X functionality remains intact
- **Easy Maintenance**: Simple override file with clear organization
- **Future-Proof**: Compatible with Schedule-X updates since it uses the official theming API

## Architecture

### Layered Theme Approach
1. **Base Layer**: Default Schedule-X theme provides core functionality and styles
2. **Override Layer**: Obsidian-specific overrides using CSS variables
3. **Integration Layer**: Plugin-specific calendar wrapper styles

### File Structure
```
src/styles/
├── main.css                        # Main entry point (imports both themes)
├── schedule-x-obsidian-theme.css   # Obsidian overrides for Schedule-X
├── custom.css                      # Plugin-specific styles
└── README-SCHEDULE-X-THEME.md      # This documentation
```

### Import Order
The styles are imported in a specific order in `main.css`:

```css
/* 1. Default Schedule-X theme (provides base functionality) */
@import '@schedule-x/theme-default/dist/index.css';

/* 2. Obsidian overrides (customizes for Obsidian) */
@import './schedule-x-obsidian-theme.css';

/* 3. Plugin-specific styles */
@import './custom.css';
```

### Theme Structure
The Obsidian override theme is organized into focused sections:

1. **Obsidian Color System** - Map Obsidian CSS variables to Schedule-X variables
2. **Design Tokens** - Essential borders, shadows, and typography overrides
3. **Essential Calendar Overrides** - Minimal wrapper and font inheritance styles

## CSS Variable Mapping

### Color Variables
The theme maps Obsidian's CSS variables to Schedule-X's color system:

```css
/* Primary colors */
--sx-color-primary: var(--interactive-accent);
--sx-color-on-primary: var(--text-on-accent);

/* Surface colors */
--sx-color-background: var(--background-primary);
--sx-color-surface: var(--background-primary);
--sx-color-surface-container: var(--background-secondary);

/* Text colors */
--sx-color-on-background: var(--text-normal);
--sx-color-neutral: var(--text-muted);
```

### Design Token Mapping
```css
/* Shadows */
--sx-box-shadow-level3: var(--shadow-s);

/* Border radius */
--sx-rounding-small: var(--radius-m);
--sx-rounding-extra-small: var(--radius-s);

/* Borders */
--sx-border: 1px solid var(--background-modifier-border);
```

## Component Coverage

### Calendar Components
- ✅ Calendar wrapper and container
- ✅ Calendar header with navigation
- ✅ Today button and view selection
- ✅ Date picker and input fields

### Grid Components
- ✅ Week grid with time axis
- ✅ Month grid with day headers
- ✅ Date grid for all-day events
- ✅ List view for agenda display

### Event Components
- ✅ Time grid events
- ✅ Month grid events
- ✅ Event modals and popups
- ✅ Event icons and color indicators

### Interactive Elements
- ✅ Hover states and transitions
- ✅ Focus indicators for accessibility
- ✅ Active states for buttons
- ✅ Dropdown menus and selections

## Responsive Design

### Breakpoints
- **Mobile**: `max-width: 480px`
- **Tablet**: `max-width: 768px`
- **Desktop**: Default styles

### Mobile Optimizations
- Reduced padding and spacing
- Smaller font sizes
- Simplified navigation
- Touch-friendly interactive elements

## Accessibility Features

### Focus Management
- Clear focus indicators using `outline: 2px solid var(--interactive-accent)`
- Proper focus order for keyboard navigation
- Skip links for screen readers

### High Contrast Support
- Enhanced borders and outlines in high contrast mode
- Stronger color differentiation
- Improved text contrast ratios

### Reduced Motion Support
- Disables animations when `prefers-reduced-motion: reduce`
- Maintains functionality while removing motion

## Maintenance Guidelines

### Adding New Styles
1. **Use CSS Variables**: Always use Obsidian CSS variables instead of hardcoded values
2. **Follow Sections**: Add styles to the appropriate section in the theme file
3. **Test Themes**: Verify styles work in both light and dark themes
4. **Check Responsiveness**: Test on mobile and tablet breakpoints

### Updating Schedule-X
1. **Check Variables**: Review if new CSS variables were added to Schedule-X
2. **Test Components**: Verify all components still render correctly
3. **Update Mappings**: Add mappings for any new Schedule-X variables
4. **Regression Test**: Ensure existing functionality isn't broken

### Debugging Issues
1. **Check Variable Mapping**: Ensure Obsidian variables are correctly mapped
2. **Inspect Specificity**: Avoid using `!important` - use proper CSS specificity
3. **Test Themes**: Issues often appear in only light or dark themes
4. **Check Console**: Look for CSS warnings or errors in browser console

## Performance Considerations

### CSS Size
- The custom theme is approximately 15KB (uncompressed)
- Uses CSS variables for efficient browser caching
- Minimal redundancy through organized structure

### Runtime Performance
- No JavaScript required for theming
- CSS variables allow efficient theme switching
- Optimized selectors for fast rendering

## Future Enhancements

### Potential Improvements
- **Theme Variants**: Support for different Obsidian theme variants
- **Custom Color Schemes**: Allow users to customize calendar colors
- **Animation Preferences**: More granular animation controls
- **Print Optimization**: Enhanced print styles for calendar views

### Compatibility
- **Obsidian Updates**: Monitor Obsidian CSS variable changes
- **Schedule-X Updates**: Track Schedule-X theming API changes
- **Browser Support**: Maintain compatibility with Obsidian's supported browsers

## Testing Checklist

When making changes to the theme, verify:

- [ ] Light theme renders correctly
- [ ] Dark theme renders correctly
- [ ] All calendar views work (day, week, month, list)
- [ ] Interactive elements respond properly
- [ ] Mobile layout is functional
- [ ] High contrast mode works
- [ ] Print styles are appropriate
- [ ] No console errors or warnings
- [ ] Performance is acceptable
- [ ] Accessibility features work

## Conclusion

The custom Schedule-X Obsidian theme provides a robust, maintainable solution for integrating Schedule-X calendar components with Obsidian's design system. By leveraging Schedule-X's official theming API and Obsidian's CSS variables, we achieve seamless visual integration while maintaining long-term maintainability.
