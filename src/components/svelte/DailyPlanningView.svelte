<script lang="ts">
  /**
   * Daily Planning View - Step-by-step wizard for daily planning
   * Guides user through reviewing yesterday's tasks, planning today's agenda, and confirming the plan
   */

  import { onMount, onDestroy } from "svelte";
  import { getPluginContext } from "./context";
  import { taskStore } from "../../stores/taskStore";
  import { scheduleStore } from "../../stores/scheduleStore";
  import { AppleCalendarService } from "../../services/AppleCalendarService";
  import {
    setDailyPlanningActive,
    getScheduledTasks,
    clearScheduledTasks,
    scheduleTaskForToday,
    unscheduleTask,
    dailyPlanningStore,
  } from "../../stores/dailyPlanningStore";
  import { get } from "svelte/store";
  import { DailyNoteService } from "../../services/DailyNoteService";

  import type { Task } from "../../types/entities";
  import type { CalendarEvent } from "../../types/calendar";
  import { DailySchedule } from "../../types/schedule";

  // Step components
  import Step from "./daily-planning/Step.svelte";
  import ReviewYesterdayStep from "./daily-planning/ReviewYesterdayStep.svelte";
  import TodayAgendaStep from "./daily-planning/TodayAgendaStep.svelte";
  import PlanSummaryStep from "./daily-planning/PlanSummaryStep.svelte";

  interface Props {
    appleCalendarService: AppleCalendarService;
    dailyNoteService: DailyNoteService;
  }

  let { appleCalendarService, dailyNoteService }: Props = $props();

  const { plugin } = getPluginContext();

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
  let todaySchedule = $state<DailySchedule | null>(null);

  // Planning state - staging changes without modifying actual tasks
  let tasksToMoveToToday = $state<Task[]>([]);
  let finalPlan = $state<{ tasks: Task[]; events: CalendarEvent[] }>({
    tasks: [],
    events: [],
  });

  // Track original task states for cancellation
  let originalTaskStates = $state<Map<string, { doDate?: Date }>>(new Map());

  onMount(async () => {
    // Set daily planning as active
    setDailyPlanningActive(true);
    await loadInitialData();
  });

  // Subscribe to task store changes using proper Svelte store subscription
  $effect(() => {
    const unsubscribe = taskStore.subscribe((state) => {
      // Only update if we're not currently loading to avoid conflicts
      if (!isLoading && !state.loading) {
        // Update today's tasks when task store changes
        const newTodayTasks = taskStore.getTasksForToday();
        todayTasks = newTodayTasks;

        // Update yesterday's tasks as well in case they changed
        const yesterdayTasksGrouped = taskStore.getYesterdayTasksGrouped();
        yesterdayTasks = yesterdayTasksGrouped;

        // Sync daily planning store with new today tasks if planning is active
        const planningState = get(dailyPlanningStore);
        if (planningState.isActive) {
          syncDailyPlanningWithTodayTasks(newTodayTasks);
        }
      }
    });

    return unsubscribe;
  });

  onDestroy(() => {
    // Set daily planning as inactive and clear scheduled tasks
    setDailyPlanningActive(false);
  });

  /**
   * Sync the daily planning store with current today tasks
   * This handles cases where tasks get their Do Date changed to today while planning is active
   */
  function syncDailyPlanningWithTodayTasks(newTodayTasks: Task[]) {
    const planningState = get(dailyPlanningStore);

    // Find tasks that are now scheduled for today but weren't in our planning store
    const newlyScheduledTasks = newTodayTasks.filter((task) => {
      const isInAlreadyScheduled = planningState.alreadyScheduledTasks.some(
        (t) => t.filePath === task.filePath
      );
      const isInToBeScheduled = planningState.tasksToBeScheduled.some(
        (t) => t.filePath === task.filePath
      );
      const isInScheduled = planningState.scheduledTasks.some(
        (t) => t.filePath === task.filePath
      );

      return !isInAlreadyScheduled && !isInToBeScheduled && !isInScheduled;
    });

    // Add newly detected tasks to alreadyScheduledTasks
    if (newlyScheduledTasks.length > 0) {
      dailyPlanningStore.update((state) => ({
        ...state,
        alreadyScheduledTasks: [
          ...state.alreadyScheduledTasks,
          ...newlyScheduledTasks,
        ],
        scheduledTasks: [...state.scheduledTasks, ...newlyScheduledTasks],
      }));
    }
  }

  async function loadInitialData() {
    try {
      isLoading = true;
      error = null;

      // Get or create today's schedule
      todaySchedule = await scheduleStore.getTodaySchedule();

      // Load yesterday's tasks
      const yesterdayTasksGrouped = taskStore.getYesterdayTasksGrouped();
      yesterdayTasks = yesterdayTasksGrouped;

      // Load today's tasks
      todayTasks = taskStore.getTasksForToday();

      // Load today's calendar events if calendar service is enabled
      if (appleCalendarService.isEnabled()) {
        todayEvents = await appleCalendarService.getTodayEvents();
      }
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

  async function moveUnfinishedToToday() {
    try {
      isLoading = true;
      const unfinishedTasks = yesterdayTasks.notDone;

      // Stage tasks to be moved (don't modify them yet)
      tasksToMoveToToday = [...unfinishedTasks];

      // Add tasks to daily planning store so they appear in step 2 with unschedule buttons
      // But skip tasks that have already been individually unscheduled
      const currentState = get(dailyPlanningStore);
      unfinishedTasks.forEach((task) => {
        // Only schedule if not already unscheduled
        const isAlreadyUnscheduled = currentState.unscheduledTasks.some(
          (t) => t.filePath === task.filePath
        );
        if (!isAlreadyUnscheduled) {
          scheduleTaskForToday(task);
        }
      });

      // Proceed to step 2 - tasks will be modified only on confirmation
      nextStep();
    } catch (err: any) {
      console.error("Error staging tasks to move:", err);
      error = err.message || "Failed to stage tasks";
    } finally {
      isLoading = false;
    }
  }

  async function moveTaskToToday(task: Task) {
    try {
      // Track original state for cancellation
      trackOriginalTaskState(task);

      // Add task to the staging list if not already there
      if (!tasksToMoveToToday.some((t) => t.filePath === task.filePath)) {
        tasksToMoveToToday = [...tasksToMoveToToday, task];
      }

      // Add task to daily planning store so it appears in step 2 with unschedule button
      scheduleTaskForToday(task);
    } catch (err: any) {
      console.error("Error moving task to today:", err);
      error = err.message || "Failed to move task";
    }
  }

  async function unscheduleTaskFromYesterday(task: Task) {
    try {
      // Remove task from staging list
      tasksToMoveToToday = tasksToMoveToToday.filter(
        (t) => t.filePath !== task.filePath
      );

      // Remove task from daily planning store (this will move it to unscheduled)
      unscheduleTask(task);
    } catch (err: any) {
      console.error("Error unscheduling task:", err);
      error = err.message || "Failed to unschedule task";
    }
  }

  function prepareFinalPlan() {
    // Get scheduled tasks from the store
    const scheduledTasks = getScheduledTasks();

    // Combine all tasks and remove duplicates based on file path
    // Prioritize tasks from tasksToMoveToToday to preserve "moved" badge logic
    const allTasks = [...tasksToMoveToToday, ...todayTasks, ...scheduledTasks];
    const uniqueTasks = allTasks.filter((task, index, array) => {
      // Keep only the first occurrence of each task based on file path
      return array.findIndex((t) => t.filePath === task.filePath) === index;
    });

    finalPlan = {
      tasks: uniqueTasks,
      events: todayEvents,
    };
  }

  async function confirmPlan() {
    try {
      isLoading = true;

      // Get tasks that need to be unscheduled (Do Date cleared)
      const currentState = get(dailyPlanningStore);
      const tasksToUnschedule = currentState.tasksToUnschedule;

      // Clear Do Date for tasks that need to be unscheduled
      for (const task of tasksToUnschedule) {
        if (task.filePath) {
          await plugin.taskFileManager.updateProperty(
            task.filePath,
            "Do Date",
            null
          );
        }
      }

      // Ensure today's daily note exists
      const dailyNoteResult = await dailyNoteService.ensureTodayDailyNote();

      // Add tasks to today's daily note
      for (const task of finalPlan.tasks) {
        if (task.filePath) {
          await dailyNoteService.addTaskToToday(task.filePath);
        }
      }

      // Update schedule
      if (todaySchedule) {
        // Clear existing tasks and add new ones
        todaySchedule.tasks = [];
        finalPlan.tasks.forEach((task) => todaySchedule!.addTask(task));
        todaySchedule.addEvents(finalPlan.events);
        todaySchedule.setDailyNotePath(dailyNoteResult.path);
        todaySchedule.markAsPlanned();

        await scheduleStore.upsertSchedule(todaySchedule);
      }

      // Clear scheduled tasks since they've been added to the plan
      clearScheduledTasks();

      // Open and focus on today's daily note
      if (dailyNoteResult.file) {
        await plugin.app.workspace.openLinkText(
          dailyNoteResult.file.path,
          "",
          true // Open in new leaf and focus
        );
      }

      // Close the daily planning view
      plugin.app.workspace.detachLeavesOfType("daily-planning");

      console.log("Daily planning completed successfully");
    } catch (err: any) {
      console.error("Error confirming plan:", err);
      error = err.message || "Failed to confirm plan";
    } finally {
      isLoading = false;
    }
  }

  // Track original task state when scheduling
  function trackOriginalTaskState(task: Task) {
    if (!originalTaskStates.has(task.filePath)) {
      originalTaskStates.set(task.filePath, {
        doDate: task.doDate,
      });
    }
  }

  // Cancel daily planning and revert all changes
  async function cancelDailyPlanning() {
    try {
      isLoading = true;

      // Revert any task changes that were made during planning
      for (const [filePath, originalState] of originalTaskStates.entries()) {
        const task = taskStore
          .getEntities()
          .find((t: Task) => t.filePath === filePath);
        if (task && task.doDate !== originalState.doDate) {
          // Revert the Do Date property
          await plugin.taskFileManager.updateProperty(
            task.filePath,
            "Do Date",
            originalState.doDate || null
          );
        }
      }

      // Clear daily planning store
      clearScheduledTasks();

      // Set daily planning as inactive
      setDailyPlanningActive(false);

      // Close the daily planning view
      plugin.app.workspace.detachLeavesOfType("daily-planning");

      console.log("Daily planning cancelled, changes reverted");
    } catch (err: any) {
      console.error("Error cancelling daily planning:", err);
      error = err.message || "Failed to cancel daily planning";
    } finally {
      isLoading = false;
    }
  }

  function getStepTitle(step: number): string {
    switch (step) {
      case 1:
        return "Review Yesterday";
      case 2:
        return "Today's Agenda";
      case 3:
        return "Confirm Plan";
      default:
        return "Daily Planning";
    }
  }

  function getStepDescription(step: number): string {
    switch (step) {
      case 1:
        return "Review tasks from yesterday and move unfinished items to today";
      case 2:
        return "Review today's calendar and scheduled tasks";
      case 3:
        return "Confirm your plan and add tasks to daily note";
      default:
        return "";
    }
  }

  // Prepare final plan when moving to step 3
  $effect(() => {
    if (currentStep === 3) {
      prepareFinalPlan();
    }
  });
</script>

<div class="daily-planning-view" data-testid="daily-planning-view">
  <div class="daily-planning-container">
    <h2 class="daily-planning-title">Daily Planning</h2>

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
        <TodayAgendaStep {todayTasks} {todayEvents} />
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
