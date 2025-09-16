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
    dailyPlanningStore,
    setDailyPlanningActive,
    getScheduledTasks,
    clearScheduledTasks,
  } from "../../stores/dailyPlanningStore";
  import { DailyNoteService } from "../../services/DailyNoteService";
  import type { TaskSyncSettings } from "../../main";
  import type { Task } from "../../types/entities";
  import type { CalendarEvent } from "../../types/calendar";
  import { DailySchedule } from "../../types/schedule";
  import { getTodayString, getTomorrowString } from "../../utils/dateFiltering";

  // Step components
  import Step from "./daily-planning/Step.svelte";
  import ReviewYesterdayStep from "./daily-planning/ReviewYesterdayStep.svelte";
  import TodayAgendaStep from "./daily-planning/TodayAgendaStep.svelte";
  import PlanSummaryStep from "./daily-planning/PlanSummaryStep.svelte";

  interface Props {
    appleCalendarService: AppleCalendarService;
    dailyNoteService: DailyNoteService;
    settings: {
      appleCalendarIntegration: TaskSyncSettings["appleCalendarIntegration"];
    };
  }

  let { appleCalendarService, dailyNoteService, settings }: Props = $props();

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

  // Planning state
  let tasksToMoveToToday = $state<Task[]>([]);
  let finalPlan = $state<{ tasks: Task[]; events: CalendarEvent[] }>({
    tasks: [],
    events: [],
  });

  onMount(async () => {
    // Set daily planning as active
    setDailyPlanningActive(true);
    await loadInitialData();
  });

  // Subscribe to task store changes using proper Svelte store subscription
  let taskStoreState = $state();

  // Subscribe to the task store
  $effect(() => {
    const unsubscribe = taskStore.subscribe((state) => {
      taskStoreState = state;

      // Only update if we're not currently loading to avoid conflicts
      if (!isLoading && !state.loading) {
        // Update today's tasks when task store changes
        const newTodayTasks = taskStore.getTasksForToday();
        todayTasks = newTodayTasks;

        // Update yesterday's tasks as well in case they changed
        const yesterdayTasksGrouped = taskStore.getYesterdayTasksGrouped();
        yesterdayTasks = yesterdayTasksGrouped;
      }
    });

    return unsubscribe;
  });

  onDestroy(() => {
    // Set daily planning as inactive and clear scheduled tasks
    setDailyPlanningActive(false);
  });

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

      // Update Do Date for unfinished tasks
      for (const task of unfinishedTasks) {
        if (task.filePath) {
          await plugin.taskFileManager.updateProperty(
            task.filePath,
            "Do Date",
            getTodayString()
          );
        }
      }

      // Add to tasks to move list
      tasksToMoveToToday = [...unfinishedTasks];

      // Task store will be updated automatically via file change listeners
      // The reactive effect will update todayTasks automatically
    } catch (err: any) {
      console.error("Error moving tasks to today:", err);
      error = err.message || "Failed to move tasks";
    } finally {
      isLoading = false;
    }
  }

  async function unscheduleTask(task: Task) {
    try {
      if (task.filePath) {
        await plugin.taskFileManager.updateProperty(
          task.filePath,
          "Do Date",
          ""
        );
        // Task store will be updated automatically via file change listeners
        // The reactive effect will update todayTasks automatically
      }
    } catch (err: any) {
      console.error("Error unscheduling task:", err);
      error = err.message || "Failed to unschedule task";
    }
  }

  async function rescheduleTask(task: Task, newDate: string) {
    try {
      if (task.filePath) {
        await plugin.taskFileManager.updateProperty(
          task.filePath,
          "Do Date",
          newDate
        );
        // Task store will be updated automatically via file change listeners
        // The reactive effect will update todayTasks automatically
      }
    } catch (err: any) {
      console.error("Error rescheduling task:", err);
      error = err.message || "Failed to reschedule task";
    }
  }

  function prepareFinalPlan() {
    // Get scheduled tasks from the store
    const scheduledTasks = getScheduledTasks();

    finalPlan = {
      tasks: [...todayTasks, ...tasksToMoveToToday, ...scheduledTasks],
      events: todayEvents,
    };
  }

  async function confirmPlan() {
    try {
      isLoading = true;

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
      >
        <ReviewYesterdayStep
          {yesterdayTasks}
          {isLoading}
          onMoveUnfinishedToToday={moveUnfinishedToToday}
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
      >
        <TodayAgendaStep
          {todayTasks}
          {todayEvents}
          onUnscheduleTask={unscheduleTask}
          onRescheduleTask={rescheduleTask}
          {getTomorrowString}
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
