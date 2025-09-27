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
  // Since we hide the button when imported, we only need to check for disabled and isImporting
  let isDisabled = $derived(disabled || isImporting);

  // Hide the button completely when imported - we don't want to show button states
  // The button should only appear when it can perform an action
  let shouldHideButton = $derived(isImported);

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

{#if !shouldHideButton}
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
