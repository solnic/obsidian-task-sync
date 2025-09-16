<script lang="ts">
  /**
   * Abstract Step component for Daily Planning wizard
   * Provides consistent layout and navigation for each step
   */

  import type { Snippet } from "svelte";

  interface Props {
    title: string;
    description: string;
    stepNumber: number;
    totalSteps: number;
    isLoading?: boolean;
    error?: string | null;
    canGoNext?: boolean;
    canGoPrevious?: boolean;
    nextButtonText?: string;
    onNext?: () => void;
    onPrevious?: () => void;
    children: Snippet;
  }

  let {
    title,
    description,
    stepNumber,
    totalSteps,
    isLoading = false,
    error = null,
    canGoNext = true,
    canGoPrevious = true,
    nextButtonText = "Next",
    onNext,
    onPrevious,
    children,
  }: Props = $props();

  function handleNext() {
    if (canGoNext && !isLoading && onNext) {
      onNext();
    }
  }

  function handlePrevious() {
    if (canGoPrevious && !isLoading && onPrevious) {
      onPrevious();
    }
  }
</script>

<div class="step-container" data-testid="step-{stepNumber}-content">
  <!-- Step Header -->
  <div class="step-header">
    <div class="step-progress">
      <div class="step-indicator">
        {#each Array(totalSteps) as _, index}
          <div 
            class="step-dot {stepNumber === index + 1 ? 'active' : ''} {stepNumber > index + 1 ? 'completed' : ''}"
            data-testid="step-{index + 1}"
          >
            {index + 1}
          </div>
        {/each}
      </div>
      <div class="step-info">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  </div>

  <!-- Error Display -->
  {#if error}
    <div class="step-error" data-testid="error-message">
      <p>Error: {error}</p>
    </div>
  {/if}

  <!-- Step Content -->
  <div class="step-content">
    {#if isLoading}
      <div class="step-loading" data-testid="loading-indicator">
        <div class="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    {:else}
      {@render children()}
    {/if}
  </div>

  <!-- Navigation -->
  <div class="step-navigation">
    {#if stepNumber > 1}
      <button 
        class="nav-button prev"
        onclick={handlePrevious}
        disabled={isLoading || !canGoPrevious}
        data-testid="previous-button"
      >
        Previous
      </button>
    {/if}
    
    {#if stepNumber < totalSteps}
      <button 
        class="nav-button next"
        onclick={handleNext}
        disabled={isLoading || !canGoNext}
        data-testid="next-button"
      >
        {nextButtonText}
      </button>
    {:else}
      <button 
        class="nav-button confirm"
        onclick={handleNext}
        disabled={isLoading || !canGoNext}
        data-testid="confirm-button"
      >
        {nextButtonText}
      </button>
    {/if}
  </div>
</div>

<style>
  .step-container {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .step-header {
    margin-bottom: 30px;
  }

  .step-progress {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .step-indicator {
    display: flex;
    gap: 10px;
  }

  .step-dot {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    background: var(--background-modifier-border);
    color: var(--text-muted);
    transition: all 0.2s ease;
  }

  .step-dot.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .step-dot.completed {
    background: var(--color-green);
    color: white;
  }

  .step-info h3 {
    margin: 0 0 5px 0;
    font-size: 18px;
    color: var(--text-normal);
  }

  .step-info p {
    margin: 0;
    color: var(--text-muted);
    font-size: 14px;
  }

  .step-error {
    background: var(--background-modifier-error);
    border: 1px solid var(--color-red);
    border-radius: 6px;
    padding: 15px;
    margin-bottom: 20px;
    color: var(--text-error);
  }

  .step-content {
    flex: 1;
    margin-bottom: 30px;
  }

  .step-loading {
    text-align: center;
    padding: 40px;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--background-modifier-border);
    border-top: 3px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 10px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .step-navigation {
    display: flex;
    justify-content: space-between;
    padding-top: 20px;
    border-top: 1px solid var(--background-modifier-border);
    margin-top: auto;
  }

  .nav-button {
    padding: 10px 20px;
    border-radius: 6px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    color: var(--text-normal);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .nav-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
  }

  .nav-button.next,
  .nav-button.confirm {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .nav-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
