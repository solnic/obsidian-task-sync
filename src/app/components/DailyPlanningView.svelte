<script lang="ts">
  /**
   * Daily Planning View - Step-by-step wizard for daily planning
   * Simplified version for initial implementation
   */

  import { onMount, onDestroy } from "svelte";
  import type { DailyPlanningExtension } from "../extensions/DailyPlanningExtension";

  interface Props {
    dailyPlanningExtension?: DailyPlanningExtension;
  }

  let { dailyPlanningExtension }: Props = $props();

  // Wizard state
  let currentStep = $state(1);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    // Set daily planning as active if extension is available
    if (dailyPlanningExtension) {
      dailyPlanningExtension.setPlanningActive(true);
    }
    isLoading = false;
  });

  onDestroy(() => {
    // Set daily planning as inactive
    if (dailyPlanningExtension) {
      dailyPlanningExtension.setPlanningActive(false);
    }
  });

  function nextStep() {
    if (currentStep < 3) {
      currentStep++;
    } else if (currentStep === 3) {
      // Confirm plan
      confirmPlan();
    }
  }

  function confirmPlan() {
    // TODO: Implement plan confirmation logic
    console.log("Plan confirmed!");
    // For now, just show a success message
    alert("Daily plan confirmed successfully!");
  }

  function previousStep() {
    if (currentStep > 1) {
      currentStep--;
    }
  }

  function cancelDailyPlanning() {
    // TODO: Implement cancellation logic
    console.log("Daily planning cancelled");
  }

  function getStepTitle(step: number): string {
    switch (step) {
      case 1:
        return "Review Yesterday";
      case 2:
        return "Today's Agenda";
      case 3:
        return "Plan Summary";
      default:
        return "Daily Planning";
    }
  }

  function getStepDescription(step: number): string {
    switch (step) {
      case 1:
        return "Review yesterday's tasks and move unfinished items to today";
      case 2:
        return "Plan your agenda for today with tasks and calendar events";
      case 3:
        return "Review and confirm your daily plan";
      default:
        return "Daily planning wizard";
    }
  }
</script>

<div class="daily-planning-view" data-testid="daily-planning-view">
  <div class="daily-planning-header">
    <h1>Daily Planning Wizard</h1>
    <div class="step-indicator">
      Step {currentStep} of 3: {getStepTitle(currentStep)}
    </div>
  </div>

  <div class="daily-planning-content">
    {#if isLoading}
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Loading daily planning data...</p>
      </div>
    {:else if error}
      <div class="error-state">
        <p class="error-message">{error}</p>
        <button onclick={() => (error = null)}>Dismiss</button>
      </div>
    {:else}
      <div class="step-content">
        <h2>{getStepTitle(currentStep)}</h2>
        <p class="step-description">{getStepDescription(currentStep)}</p>

        {#if currentStep === 1}
          <div class="review-yesterday-step" data-testid="step-1-content">
            <p>Yesterday's tasks will be displayed here.</p>
            <!-- TODO: Implement ReviewYesterdayStep component -->
          </div>
        {:else if currentStep === 2}
          <div class="today-agenda-step" data-testid="step-2-content">
            <p>Today's agenda will be displayed here.</p>
            <!-- TODO: Implement TodayAgendaStep component -->
          </div>
        {:else if currentStep === 3}
          <div class="plan-summary-step" data-testid="step-3-content">
            <p>Plan summary will be displayed here.</p>
            <!-- TODO: Implement PlanSummaryStep component -->
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="daily-planning-footer">
    <div class="step-navigation">
      <button
        onclick={previousStep}
        disabled={currentStep === 1}
        class="nav-button previous"
      >
        Previous
      </button>

      <button onclick={cancelDailyPlanning} class="nav-button cancel">
        Cancel
      </button>

      <button
        onclick={nextStep}
        class="nav-button next"
        data-testid={currentStep === 3 ? "confirm-button" : "next-button"}
      >
        {currentStep === 3 ? "Confirm Plan" : "Next"}
      </button>
    </div>
  </div>
</div>

<style>
  .daily-planning-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 1rem;
    background: var(--background-primary);
  }

  .daily-planning-header {
    margin-bottom: 1.5rem;
  }

  .daily-planning-header h1 {
    margin: 0 0 0.5rem 0;
    color: var(--text-normal);
    font-size: 1.5rem;
  }

  .step-indicator {
    color: var(--text-muted);
    font-size: 0.9rem;
  }

  .daily-planning-content {
    flex: 1;
    overflow-y: auto;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    gap: 1rem;
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid var(--background-modifier-border);
    border-top: 2px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .error-state {
    padding: 1rem;
    background: var(--background-modifier-error);
    border-radius: 0.5rem;
    text-align: center;
  }

  .error-message {
    color: var(--text-error);
    margin-bottom: 1rem;
  }

  .step-content h2 {
    margin: 0 0 0.5rem 0;
    color: var(--text-normal);
  }

  .step-description {
    color: var(--text-muted);
    margin-bottom: 1.5rem;
  }

  .daily-planning-footer {
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--background-modifier-border);
  }

  .step-navigation {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .nav-button {
    padding: 0.5rem 1rem;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    color: var(--text-normal);
    border-radius: 0.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .nav-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .nav-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .nav-button.next {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .nav-button.cancel {
    color: var(--text-error);
    border-color: var(--text-error);
  }

  .nav-button.cancel:hover {
    background: var(--background-modifier-error);
  }
</style>
