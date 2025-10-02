<script lang="ts">
  /**
   * Daily Planning View - Step-by-step wizard for daily planning
   * Integrated with Step components and DailyPlanningExtension
   */

  import { onMount, onDestroy } from "svelte";
  import type { DailyPlanningExtension } from "../extensions/DailyPlanningExtension";
  import type { Task, CalendarEvent } from "../core/entities";

  // Step components
  import Step from "./daily-planning/Step.svelte";
  import ReviewYesterdayStep from "./daily-planning/ReviewYesterdayStep.svelte";
  import TodayAgendaStep from "./daily-planning/TodayAgendaStep.svelte";
  import PlanSummaryStep from "./daily-planning/PlanSummaryStep.svelte";

  interface Props {
    dailyPlanningExtension?: DailyPlanningExtension;
  }

  let { dailyPlanningExtension }: Props = $props();

  // Wizard state
  let currentStep = $state(1);
  let isLoading = $state(false);
  let error = $state<string | null>(null);

  // Data state
  let yesterdayTasks = $state<{ done: Task[]; notDone: Task[] }>({
    done: [],
    notDone: [],
  });
  let todayTasks = $state<Task[]>([]);
  let todayEvents = $state<CalendarEvent[]>([]);
  let unscheduledTasks = $state<Task[]>([]);

  // Planning state - staging changes without modifying actual tasks
  let tasksToMoveToToday = $state<Task[]>([]);

  // Computed state for step 2 - combines existing today tasks with staged tasks
  let allTodayTasksForStep2 = $derived([...todayTasks, ...tasksToMoveToToday]);
  let finalPlan = $state<{ tasks: Task[]; events: CalendarEvent[] }>({
    tasks: [],
    events: [],
  });

  onMount(async () => {
    await loadInitialData();
  });

  onDestroy(() => {
    // Set daily planning as inactive
    if (dailyPlanningExtension) {
      dailyPlanningExtension.setPlanningActive(false);
    }
  });

  async function loadInitialData() {
    try {
      isLoading = true;
      error = null;

      if (!dailyPlanningExtension) {
        throw new Error("Daily planning extension not available");
      }

      // Set daily planning as active
      dailyPlanningExtension.setPlanningActive(true);

      // Load yesterday's tasks
      yesterdayTasks = await dailyPlanningExtension.getYesterdayTasksGrouped();

      // Load today's tasks
      const todayTasksGrouped =
        await dailyPlanningExtension.getTodayTasksGrouped();
      todayTasks = [...todayTasksGrouped.done, ...todayTasksGrouped.notDone];

      // Load today's calendar events
      todayEvents = await dailyPlanningExtension.getTodayEvents();

      // Load unscheduled tasks
      unscheduledTasks = await dailyPlanningExtension.getUnscheduledTasks();

      // Initialize final plan with current today's tasks
      finalPlan = {
        tasks: [...todayTasks],
        events: [...todayEvents],
      };
    } catch (err: any) {
      console.error("Error loading daily planning data:", err);
      error = err.message || "Failed to load planning data";
    } finally {
      isLoading = false;
    }
  }

  function nextStep() {
    if (currentStep < 3) {
      currentStep++;
    }
  }

  function previousStep() {
    if (currentStep > 1) {
      currentStep--;
    }
  }

  async function cancelDailyPlanning() {
    if (dailyPlanningExtension) {
      // Clear any staged changes
      dailyPlanningExtension.clearStaging();
      await dailyPlanningExtension.cancelDailyPlanning();
    }
  }

  async function confirmPlan() {
    try {
      isLoading = true;

      if (!dailyPlanningExtension) {
        throw new Error("Daily planning extension not available");
      }

      // Apply all staged changes (this will move tasks and update schedules)
      await dailyPlanningExtension.applyStaging();

      // Apply all the planned task movements from the wizard
      for (const task of tasksToMoveToToday) {
        await dailyPlanningExtension.moveTaskToTodayImmediate(task);
      }

      // Ensure today's schedule exists and update it with the final plan
      const todaySchedule =
        await dailyPlanningExtension.ensureTodayScheduleExists();

      // Update the schedule with the final plan (tasks and events)
      const scheduleOperations = new (
        await import("../entities/Schedules")
      ).Schedules.Operations();
      await scheduleOperations.update(todaySchedule.id, {
        tasks: finalPlan.tasks,
        events: finalPlan.events,
        isPlanned: true,
        planningCompletedAt: new Date(),
      });

      // Add tasks to today's daily note and open it
      await dailyPlanningExtension.addTasksToTodayDailyNote(finalPlan.tasks);

      // Complete the daily planning
      await dailyPlanningExtension.completeDailyPlanning();

      // Show success message
      alert("Daily plan confirmed successfully!");

      // Close the daily planning view
      // TODO: Implement proper view closing mechanism
    } catch (err: any) {
      console.error("Error confirming plan:", err);
      error = err.message || "Failed to confirm plan";
    } finally {
      isLoading = false;
    }
  }

  // Task movement handlers

  async function moveUnfinishedToToday() {
    try {
      if (!dailyPlanningExtension) return;

      // Add all unfinished tasks to the staging area
      tasksToMoveToToday = [...tasksToMoveToToday, ...yesterdayTasks.notDone];

      // Update final plan
      finalPlan = {
        ...finalPlan,
        tasks: [...finalPlan.tasks, ...yesterdayTasks.notDone],
      };
    } catch (err: any) {
      console.error("Error moving unfinished tasks:", err);
      error = err.message || "Failed to move tasks";
    }
  }

  async function moveTaskToToday(task: Task) {
    try {
      if (!dailyPlanningExtension) return;

      // Add task to staging area if not already there
      if (!tasksToMoveToToday.some((t) => t.id === task.id)) {
        tasksToMoveToToday = [...tasksToMoveToToday, task];
      }

      // Update final plan
      if (!finalPlan.tasks.some((t) => t.id === task.id)) {
        finalPlan = {
          ...finalPlan,
          tasks: [...finalPlan.tasks, task],
        };
      }
    } catch (err: any) {
      console.error("Error moving task to today:", err);
      error = err.message || "Failed to move task";
    }
  }

  async function unscheduleTaskFromYesterday(task: Task) {
    try {
      if (!dailyPlanningExtension) return;

      await dailyPlanningExtension.unscheduleTask(task);

      // Remove from staging area if present
      tasksToMoveToToday = tasksToMoveToToday.filter((t) => t.id !== task.id);

      // Remove from final plan
      finalPlan = {
        ...finalPlan,
        tasks: finalPlan.tasks.filter((t) => t.id !== task.id),
      };

      // Reload yesterday's tasks to reflect the change
      yesterdayTasks = await dailyPlanningExtension.getYesterdayTasksGrouped();
    } catch (err: any) {
      console.error("Error unscheduling task:", err);
      error = err.message || "Failed to unschedule task";
    }
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
  <div class="daily-planning-container">
    <div class="daily-planning-title">
      <h1>Daily Planning Wizard</h1>
    </div>

    <!-- Step Components -->
    {#if currentStep === 1}
      <Step
        title={getStepTitle(1)}
        description={getStepDescription(1)}
        stepNumber={1}
        totalSteps={3}
        {isLoading}
        {error}
        onNext={nextStep}
        onPrevious={previousStep}
        onCancel={cancelDailyPlanning}
      >
        <ReviewYesterdayStep
          {yesterdayTasks}
          {isLoading}
          onMoveUnfinishedToToday={moveUnfinishedToToday}
          onMoveTaskToToday={moveTaskToToday}
          onUnscheduleTask={unscheduleTaskFromYesterday}
        />
      </Step>
    {:else if currentStep === 2}
      <Step
        title={getStepTitle(2)}
        description={getStepDescription(2)}
        stepNumber={2}
        totalSteps={3}
        {isLoading}
        {error}
        onNext={nextStep}
        onPrevious={previousStep}
        onCancel={cancelDailyPlanning}
      >
        <TodayAgendaStep
          todayTasks={allTodayTasksForStep2}
          {todayEvents}
          {unscheduledTasks}
        />
      </Step>
    {:else if currentStep === 3}
      <Step
        title={getStepTitle(3)}
        description={getStepDescription(3)}
        stepNumber={3}
        totalSteps={3}
        {isLoading}
        {error}
        nextButtonText="Confirm Plan"
        onNext={confirmPlan}
        onPrevious={previousStep}
        onCancel={cancelDailyPlanning}
      >
        <PlanSummaryStep {finalPlan} {tasksToMoveToToday} />
      </Step>
    {/if}
  </div>
</div>

<style>
  .daily-planning-view {
    padding: 20px;
    height: 100%;
    overflow-y: auto;
  }

  .daily-planning-container {
    max-width: 800px;
    margin: 0 auto;
  }

  .daily-planning-title {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 30px;
    color: var(--text-normal);
    text-align: center;
  }
</style>
