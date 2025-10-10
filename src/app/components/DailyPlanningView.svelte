<script lang="ts">
  /**
   * Daily Planning View - Step-by-step wizard for daily planning
   * Integrated with Step components and DailyPlanningExtension
   */

  import { onMount, onDestroy, untrack } from "svelte";
  import type { DailyPlanningExtension } from "../extensions/DailyPlanningExtension";
  import type { Task, CalendarEvent } from "../core/entities";
  import { taskStore } from "../stores/taskStore";

  // Step components
  import Step from "./daily-planning/Step.svelte";
  import ReviewYesterdayStep from "./daily-planning/ReviewYesterdayStep.svelte";
  import TodayAgendaStep from "./daily-planning/TodayAgendaStep.svelte";
  import PlanSummaryStep from "./daily-planning/PlanSummaryStep.svelte";

  interface Props {
    dailyPlanningExtension?: DailyPlanningExtension;
    onClose?: () => void;
  }

  let { dailyPlanningExtension, onClose }: Props = $props();

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

  // Staged changes from extension
  let stagedChanges = $state<{
    toSchedule: Set<string>;
    toUnschedule: Set<string>;
  }>({
    toSchedule: new Set(),
    toUnschedule: new Set(),
  });

  // Subscribe to staged changes from daily planning extension
  // Use untrack to prevent infinite loops when updating state
  $effect(() => {
    if (!dailyPlanningExtension) {
      stagedChanges = { toSchedule: new Set(), toUnschedule: new Set() };
      return;
    }

    // Subscribe and return cleanup function directly
    return dailyPlanningExtension.getStagedChanges().subscribe((changes) => {
      // Use untrack to prevent this state update from triggering the effect again
      untrack(() => {
        stagedChanges = changes;
      });
    });
  });

  // Derive display lists from staged changes
  let displayLists = $derived.by(() => {
    // Tasks that are scheduled for today (not staged for unscheduling)
    const todayVisible = todayTasks.filter(
      (t) => !stagedChanges.toUnschedule.has(t.id)
    );

    // Tasks from unscheduled list that are staged for scheduling
    const stagingTasksFromUnscheduled = unscheduledTasks.filter((t) =>
      stagedChanges.toSchedule.has(t.id)
    );

    // Get freshly staged tasks that might not be in any existing list yet
    // This handles the case where a task is created and immediately staged
    const allExistingTaskIds = new Set([
      ...todayTasks.map((t) => t.id),
      ...unscheduledTasks.map((t) => t.id),
      ...yesterdayTasks.done.map((t) => t.id),
      ...yesterdayTasks.notDone.map((t) => t.id),
    ]);

    const freshStagedTasks: Task[] = [];
    for (const taskId of stagedChanges.toSchedule) {
      if (!allExistingTaskIds.has(taskId)) {
        // This is a freshly created task that's not in our existing lists
        // We need to get it from the task store
        const task = taskStore.findById(taskId);
        if (task) {
          freshStagedTasks.push(task);
        }
      }
    }

    // Combine staging tasks from unscheduled list and fresh staged tasks
    const stagingTasks = [...stagingTasksFromUnscheduled, ...freshStagedTasks];

    // Tasks from unscheduled list that are NOT staged
    const unscheduledVisible = unscheduledTasks.filter(
      (t) => !stagedChanges.toSchedule.has(t.id)
    );

    // Tasks that are staged for unscheduling (from both today and yesterday)
    // This includes tasks from Step 1 (yesterday) and Step 2 (today)
    const allTasks = [
      ...todayTasks,
      ...yesterdayTasks.done,
      ...yesterdayTasks.notDone,
    ];
    const stagedForUnscheduling = allTasks.filter((t) =>
      stagedChanges.toUnschedule.has(t.id)
    );

    return {
      today: todayVisible,
      staging: stagingTasks,
      unscheduled: unscheduledVisible,
      stagedForUnscheduling,
    };
  });

  // Computed state for step 2 - combines today tasks, staging tasks, and yesterday tasks
  let allTodayTasksForStep2 = $derived([
    ...displayLists.today,
    ...displayLists.staging,
    ...tasksToMoveToToday,
  ]);

  // Use $derived to compute final plan (excludes tasks staged for unscheduling)
  let finalPlan = $derived.by(() => {
    // Filter out tasks that are staged for unscheduling
    const finalTasks = allTodayTasksForStep2.filter(
      (task) => !stagedChanges.toUnschedule.has(task.id)
    );

    return {
      tasks: finalTasks,
      events: todayEvents,
    };
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

      // finalPlan is now a $derived value, so it will automatically update
      // when todayTasks and todayEvents are set
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

    // Close the view
    if (onClose) {
      onClose();
    }
  }

  async function confirmPlan() {
    try {
      isLoading = true;

      if (!dailyPlanningExtension) {
        throw new Error("Daily planning extension not available");
      }

      // Apply all staged changes first (this will schedule/unschedule tasks)
      await dailyPlanningExtension.applyStaging();

      // Filter tasksToMoveToToday to exclude tasks that were staged for unscheduling
      // This prevents re-scheduling tasks that the user explicitly unscheduled
      const tasksToActuallyMove = tasksToMoveToToday.filter(
        (task) => !stagedChanges.toUnschedule.has(task.id)
      );

      // Apply all the planned task movements from the wizard
      for (const task of tasksToActuallyMove) {
        await dailyPlanningExtension.moveTaskToTodayImmediate(task);
      }

      // Get the current schedule state after all tasks have been added
      // This ensures we include tasks that were imported during planning
      const scheduleQueries = new (
        await import("../entities/Schedules")
      ).Schedules.Queries();
      const todaySchedule = await scheduleQueries.getToday();

      if (!todaySchedule) {
        throw new Error("Today's schedule not found after applying changes");
      }

      // Merge tasks from finalPlan with tasks already in the schedule (from applyStaging)
      // Use a Map to deduplicate by task ID
      const taskMap = new Map<string, Task>();

      // First add tasks from the schedule (these include imported tasks from applyStaging)
      for (const task of todaySchedule.tasks) {
        taskMap.set(task.id, task);
      }

      // Then add/update with tasks from finalPlan (these include all visible tasks in the wizard)
      for (const task of finalPlan.tasks) {
        taskMap.set(task.id, task);
      }

      const mergedTasks = Array.from(taskMap.values());

      // Update the schedule with merged tasks, events, and mark as planned
      const scheduleOperations = new (
        await import("../entities/Schedules")
      ).Schedules.Operations();
      await scheduleOperations.update(todaySchedule.id, {
        tasks: mergedTasks,
        events: finalPlan.events,
        isPlanned: true,
        planningCompletedAt: new Date(),
      });

      // Complete the daily planning
      await dailyPlanningExtension.completeDailyPlanning();

      // Get the host to show notice and open daily note
      const host = dailyPlanningExtension.host;

      // Show success notice
      host.showNotice(
        "Daily plan confirmed successfully! Opening today's note..."
      );

      // Open today's daily note
      await dailyPlanningExtension.openTodayDailyNote();

      // Close the daily planning view
      if (onClose) {
        onClose();
      }
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

      // finalPlan will automatically update via $derived when tasksToMoveToToday changes
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

      // finalPlan will automatically update via $derived when tasksToMoveToToday changes
    } catch (err: any) {
      console.error("Error moving task to today:", err);
      error = err.message || "Failed to move task";
    }
  }

  async function unscheduleTaskFromYesterday(task: Task) {
    try {
      if (!dailyPlanningExtension) return;

      // Stage the task for unscheduling (don't apply immediately!)
      dailyPlanningExtension.unscheduleTaskFromToday(task.id);

      // Remove from staging area if present
      tasksToMoveToToday = tasksToMoveToToday.filter((t) => t.id !== task.id);

      // finalPlan will automatically update via $derived when tasksToMoveToToday changes
    } catch (err: any) {
      console.error("Error unscheduling task:", err);
      error = err.message || "Failed to unschedule task";
    }
  }

  async function rescheduleTaskForToday(task: Task, _date: Date) {
    try {
      if (!dailyPlanningExtension) {
        throw new Error("Daily planning extension not available");
      }

      // Stage the task for today
      dailyPlanningExtension.scheduleTaskForToday(task.id);
    } catch (err: any) {
      console.error("Error rescheduling task for today:", err);
      error = err.message || "Failed to reschedule task";
    }
  }

  async function unscheduleTaskFromToday(task: Task) {
    try {
      if (!dailyPlanningExtension) {
        throw new Error("Daily planning extension not available");
      }

      // Stage the task for unscheduling
      dailyPlanningExtension.unscheduleTaskFromToday(task.id);
    } catch (err: any) {
      console.error("Error unscheduling task from today:", err);
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
          scheduledTasks={tasksToMoveToToday}
          unscheduledTasks={displayLists.stagedForUnscheduling}
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
          unscheduledTasks={displayLists.stagedForUnscheduling}
          onRescheduleTask={rescheduleTaskForToday}
          onUnscheduleTask={unscheduleTaskFromToday}
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
