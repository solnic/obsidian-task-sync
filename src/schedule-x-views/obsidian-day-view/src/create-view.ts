import {createPreactView, setRangeForDay} from '@schedule-x/calendar'
import {addDays} from '@schedule-x/shared'
import {ObsidianDayViewWrapper} from './components/obsidian-day-view-wrapper'
import {Signal} from '@preact/signals'

type PreactView = ReturnType<typeof createPreactView>

type ViewFactory = () => PreactView;

export type PreactViewComponent = ReturnType<
  typeof createPreactView
>['Component']

export const createObsidianDayView: ViewFactory = () => createPreactView({
  name: 'obsidian-day',
  label: 'Day',
  Component: ObsidianDayViewWrapper,
  hasWideScreenCompat: true,
  hasSmallScreenCompat: true,
  backwardForwardFn: addDays,
  backwardForwardUnits: 1,
  setDateRange: setRangeForDay,
})
