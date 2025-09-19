<script lang="ts">
  /**
   * ImportButton - Reusable import button component
   * Handles different states: ready to import, importing, imported
   * Supports both "Import" and "Add to today" modes
   */

  interface Props {
    /** Whether the item is already imported */
    isImported?: boolean;
    /** Whether the item is currently being imported */
    isImporting?: boolean;
    /** Whether to show "Add to today" instead of "Import" */
    dayPlanningMode?: boolean;
    /** Whether the daily planning wizard is active (shows "Schedule for today") */
    dailyPlanningWizardMode?: boolean;
    /** Custom title for the button */
    title?: string;
    /** Test ID for the button */
    testId?: string;
    /** Click handler for the import action */
    onImport?: () => void;
    /** Whether the button should be disabled */
    disabled?: boolean;
    /** Size variant of the button */
    size?: "small" | "medium" | "large";
    /** Style variant of the button */
    variant?: "primary" | "secondary";
  }

  let {
    isImported = false,
    isImporting = false,
    dayPlanningMode = false,
    dailyPlanningWizardMode = false,
    title,
    testId,
    onImport,
    disabled = false,
    size = "medium",
    variant = "primary",
  }: Props = $props();

  // Determine button text based on state and mode
  let buttonText = $derived.by(() => {
    // If a custom title is provided, use it for the button text
    if (title) {
      return title;
    }

    if (isImported) {
      if (dailyPlanningWizardMode) {
        return "✓ Scheduled for today";
      } else if (dayPlanningMode) {
        return "✓ Added to today";
      } else {
        return "✓ Imported";
      }
    } else if (isImporting) {
      if (dailyPlanningWizardMode) {
        return "⏳ Scheduling...";
      } else if (dayPlanningMode) {
        return "⏳ Adding...";
      } else {
        return "⏳ Importing...";
      }
    } else {
      if (dailyPlanningWizardMode) {
        return "Schedule for today";
      } else if (dayPlanningMode) {
        return "Add to today";
      } else {
        return "Import";
      }
    }
  });

  // Determine default title if not provided
  let buttonTitle = $derived.by(() => {
    if (title) return title;

    if (isImported || isImporting) return "";

    return dayPlanningMode ? "Add to today" : "Import";
  });

  // Determine test ID if not provided
  let buttonTestId = $derived.by(() => {
    if (testId) return testId;

    if (dayPlanningMode) {
      return "add-to-today-button";
    } else {
      return isImported
        ? "imported-indicator"
        : isImporting
          ? "importing-indicator"
          : "import-button";
    }
  });

  // Determine if button should be disabled
  // In daily planning wizard mode, allow clicking even when imported (for scheduling/unscheduling)
  let isDisabled = $derived(
    disabled || isImporting || (isImported && !dailyPlanningWizardMode)
  );

  // Determine CSS classes
  let cssClasses = $derived.by(() => {
    const classes = ["import-button"];

    classes.push(`import-button--${size}`);
    classes.push(`import-button--${variant}`);

    if (isImported) {
      classes.push("import-button--imported");
    } else if (isImporting) {
      classes.push("import-button--importing");
    }

    if (isDisabled) {
      classes.push("import-button--disabled");
    }

    return classes.join(" ");
  });

  function handleClick() {
    if (!isDisabled && onImport) {
      onImport();
    }
  }
</script>

{#if isImported || isImporting}
  <span class={cssClasses} data-testid={buttonTestId} title={buttonTitle}>
    {buttonText}
  </span>
{:else}
  <button
    class={cssClasses}
    title={buttonTitle}
    onclick={handleClick}
    data-testid={buttonTestId}
    disabled={isDisabled}
  >
    {buttonText}
  </button>
{/if}

<style>
  .import-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    text-align: center;
    border: 1px solid transparent;
  }

  /* Size variants */
  .import-button--small {
    padding: 4px 8px;
    font-size: 11px;
  }

  .import-button--medium {
    padding: 8px 16px;
    font-size: 12px;
  }

  .import-button--large {
    padding: 12px 20px;
    font-size: 14px;
  }

  /* Primary variant (default) */
  .import-button--primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .import-button--primary:hover:not(.import-button--disabled) {
    background: var(--interactive-accent-hover);
    border-color: var(--interactive-accent-hover);
  }

  /* Secondary variant */
  .import-button--secondary {
    background: var(--background-primary);
    color: var(--text-normal);
    border-color: var(--interactive-normal);
  }

  .import-button--secondary:hover:not(.import-button--disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-hover);
  }

  /* State variants */
  .import-button--imported {
    background: var(--color-green);
    color: white;
    border-color: var(--color-green);
    cursor: default;
  }

  .import-button--importing {
    background: var(--color-yellow);
    color: var(--text-normal);
    border-color: var(--color-yellow);
    cursor: default;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .import-button--disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  /* Pulse animation for importing state */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }
</style>
