<template>
  <div class="stack calendar-view">
    <section class="card calendar-card">
      <header class="calendar-header">
        <div>
          <h2 class="section-title">Run Calendar</h2>
          <p class="muted summary-text">
            <span v-if="loading">Loading run history…</span>
            <span v-else-if="error">{{ error }}</span>
            <span v-else>{{ summaryMessage }}</span>
          </p>
        </div>
        <div class="calendar-controls">
          <button type="button" class="ghost" @click="goToPreviousMonth" aria-label="Previous month">
            ‹
          </button>
          <div class="month-label">{{ monthLabel }}</div>
          <button type="button" class="ghost" @click="goToNextMonth" aria-label="Next month">
            ›
          </button>
          <button type="button" class="ghost" @click="goToToday">Today</button>
        </div>
      </header>
      <div v-if="loading" class="empty-state">Loading run history…</div>
      <div v-else-if="error" class="empty-state error">{{ error }}</div>
      <div v-else class="calendar-body">
        <div class="calendar-weekdays">
          <span v-for="weekday in weekdays" :key="weekday" class="calendar-weekday">{{ weekday }}</span>
        </div>
        <div class="calendar-grid">
          <div
            v-for="day in calendarDays"
            :key="day.key"
            class="calendar-day"
            :class="{
              'other-month': !day.isCurrentMonth,
              today: day.isToday,
              'has-runs': day.runs.length > 0
            }"
          >
            <div class="day-header">
              <span class="day-number">{{ day.date.getDate() }}</span>
              <span v-if="day.isToday" class="today-pill">Today</span>
            </div>
            <div class="day-runs" v-if="day.runs.length">
              <div
                v-for="run in day.runs"
                :key="run.id"
                class="run-chip"
                role="button"
                tabindex="0"
                @click="openRunDetails(run)"
                @keydown.enter.prevent="openRunDetails(run)"
                @keydown.space.prevent="openRunDetails(run)"
              >
                <div class="run-chip-content">
                  <span class="run-time" v-if="run.startTimeLabel">{{ run.startTimeLabel }}</span>
                  <span class="run-percent">{{ formatPercent(run.completionPercent) }}</span>
                  <span class="run-duration">{{ run.completedMinutesLabel }} / {{ run.totalMinutesLabel }} min</span>
                </div>
              </div>
            </div>
            <div v-else class="day-placeholder">&nbsp;</div>
          </div>
        </div>
        <p v-if="!runs.length" class="empty-hint muted">
          No circuit runs recorded yet. Start a run to build your history.
        </p>
      </div>
    </section>
    <div
      v-if="selectedRun"
      class="run-detail-backdrop"
      role="presentation"
      @click.self="closeRunDetails"
    >
      <section
        class="run-detail-card"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="`run-detail-title-${selectedRun.id}`"
      >
        <header class="run-detail-header">
          <div class="run-detail-heading">
            <p class="run-detail-date">{{ selectedRun.fullDateLabel }}</p>
            <h3 :id="`run-detail-title-${selectedRun.id}`">{{ selectedRun.circuitName }}</h3>
            <p class="run-detail-metrics">
              <span class="detail-percent">{{ formatPercent(selectedRun.completionPercent) }}</span>
              <span class="detail-duration">{{ selectedRun.completedMinutesLabel }} / {{ selectedRun.totalMinutesLabel }} min</span>
            </p>
          </div>
          <div class="run-detail-actions">
            <button
              type="button"
              class="ghost danger"
              @click="deleteSelectedRun"
              :disabled="deletingRun"
            >
              <span v-if="deletingRun">Deleting…</span>
              <span v-else>Delete</span>
            </button>
            <button type="button" class="ghost close" @click="closeRunDetails" aria-label="Close details">×</button>
          </div>
        </header>
        <p v-if="deleteError" class="run-detail-error" role="alert">{{ deleteError }}</p>
        <div class="run-detail-counts">
          <span class="count completed">✓ {{ selectedRun.completedCount }} completed</span>
          <span class="count skipped">↷ {{ selectedRun.skippedCount }} skipped</span>
          <span class="count not-done">○ {{ selectedRun.notDoneCount }} not done</span>
        </div>
        <ul class="task-list">
          <li v-for="task in selectedRun.tasks" :key="task.index" class="task-item" :class="task.status">
            <span class="task-status" aria-hidden="true">{{ statusIcon(task.status) }}</span>
            <div class="task-info">
              <p class="task-name">{{ task.name }}</p>
              <p class="task-meta">
                <span>{{ task.minutesLabel }} min</span>
                <span>· {{ statusLabel(task.status) }}</span>
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { deleteCircuitRun, listCircuitRuns } from '../api';

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const runs = ref([]);
const loading = ref(true);
const error = ref('');
const today = new Date();
const currentMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1));
const selectedRun = ref(null);
const deletingRun = ref(false);
const deleteError = ref('');

const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric'
});

const monthLabel = computed(() => monthFormatter.format(currentMonth.value));

const runsByDate = computed(() => {
  const grouped = new Map();
  for (const run of runs.value) {
    if (!run || !run.dateKey) continue;
    if (!grouped.has(run.dateKey)) {
      grouped.set(run.dateKey, []);
    }
    grouped.get(run.dateKey).push(run);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }
  return grouped;
});

const runsForCurrentMonth = computed(() => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  return runs.value.filter((run) => run.startedAt.getFullYear() === year && run.startedAt.getMonth() === month);
});

const averageCompletion = computed(() => {
  if (!runsForCurrentMonth.value.length) {
    return 0;
  }
  const total = runsForCurrentMonth.value.reduce((sum, run) => sum + run.completionPercent, 0);
  return Math.round((total / runsForCurrentMonth.value.length) * 10) / 10;
});

const summaryMessage = computed(() => {
  if (!runs.value.length) {
    return 'No runs recorded yet. Start a run to build your history.';
  }
  if (!runsForCurrentMonth.value.length) {
    return 'No runs recorded this month yet.';
  }
  const count = runsForCurrentMonth.value.length;
  const countLabel = `${count} run${count === 1 ? '' : 's'}`;
  return `${countLabel} · Avg completion ${formatPercent(averageCompletion.value)}`;
});

const startOfCalendar = computed(() => {
  const start = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth(), 1);
  const offset = start.getDay();
  const calendarStart = new Date(start);
  calendarStart.setDate(start.getDate() - offset);
  return calendarStart;
});

const endOfCalendar = computed(() => {
  const end = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 0);
  const offset = 6 - end.getDay();
  const calendarEnd = new Date(end);
  calendarEnd.setDate(end.getDate() + offset);
  return calendarEnd;
});

const calendarDays = computed(() => {
  const days = [];
  const start = startOfCalendar.value;
  const end = endOfCalendar.value;
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const current = new Date(date);
    const key = formatDateKey(current);
    days.push({
      key,
      date: current,
      isCurrentMonth: current.getMonth() === currentMonth.value.getMonth(),
      isToday: isSameDay(current, today),
      runs: runsByDate.value.get(key) ?? []
    });
  }
  return days;
});

function formatPercent(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0%';
  }
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatMinutesLabel(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }
  const minutes = value / 60;
  const decimals = minutes >= 10 || Math.abs(minutes - Math.round(minutes)) < 1e-6 ? 0 : 1;
  return Number(minutes.toFixed(decimals)).toString();
}

function normalizeRun(raw) {
  if (!raw) {
    return null;
  }
  const startedAt = raw.started_at ? new Date(raw.started_at) : null;
  if (!startedAt || Number.isNaN(startedAt.getTime())) {
    return null;
  }
  const completionRaw = Number.isFinite(raw.completion_percentage)
    ? Number(raw.completion_percentage)
    : (Number(raw.completion_rate) || 0) * 100;
  const completionPercent = Math.round(completionRaw * 10) / 10;
  const totalSeconds = Number(raw.total_duration_seconds) || 0;
  const completedSeconds = Number(raw.completed_duration_seconds) || 0;
  const tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const normalizedTasks = tasks
    .map((task) => ({
      index: Number.isInteger(task?.index) ? task.index : 0,
      name: task?.name || `Task ${(task?.index ?? 0) + 1}`,
      status: task?.status || 'not_done',
      minutesLabel: formatMinutesLabel(task?.duration || 0)
    }))
    .sort((a, b) => a.index - b.index);
  const counts = normalizedTasks.reduce(
    (acc, task) => {
      const status = task.status;
      if (status === 'completed') acc.completed += 1;
      else if (status === 'skipped') acc.skipped += 1;
      else if (status === 'not_done') acc.notDone += 1;
      return acc;
    },
    { completed: 0, skipped: 0, notDone: 0 }
  );
  const circuitName = raw.circuit?.name || (raw.circuit_id ? `Circuit ${raw.circuit_id}` : 'Circuit');
  return {
    id: raw.id ?? `${raw.circuit_id ?? 'run'}-${startedAt.getTime()}`,
    circuitId: raw.circuit_id ?? null,
    circuitName,
    startedAt,
    dateKey: formatDateKey(startedAt),
    completionPercent,
    totalMinutesLabel: formatMinutesLabel(totalSeconds),
    completedMinutesLabel: formatMinutesLabel(completedSeconds),
    completedCount: counts.completed,
    skippedCount: counts.skipped,
    notDoneCount: counts.notDone,
    startTimeLabel: startedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    fullDateLabel: startedAt.toLocaleString([], {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    tasks: normalizedTasks
  };
}

async function loadRunHistory() {
  loading.value = true;
  error.value = '';
  try {
    const response = await listCircuitRuns();
    const normalized = Array.isArray(response)
      ? response.map(normalizeRun).filter((item) => item !== null)
      : [];
    runs.value = normalized;
  } catch (err) {
    console.error(err);
    error.value = err instanceof Error ? err.message : 'Failed to load run history.';
    runs.value = [];
  } finally {
    loading.value = false;
  }
}

function goToPreviousMonth() {
  const base = currentMonth.value;
  currentMonth.value = new Date(base.getFullYear(), base.getMonth() - 1, 1);
}

function goToNextMonth() {
  const base = currentMonth.value;
  currentMonth.value = new Date(base.getFullYear(), base.getMonth() + 1, 1);
}

function goToToday() {
  currentMonth.value = new Date(today.getFullYear(), today.getMonth(), 1);
}

function openRunDetails(run) {
  deleteError.value = '';
  selectedRun.value = run;
}

function closeRunDetails() {
  selectedRun.value = null;
  deleteError.value = '';
}

function statusLabel(status) {
  if (status === 'completed') return 'Completed';
  if (status === 'skipped') return 'Skipped';
  return 'Not done';
}

function statusIcon(status) {
  if (status === 'completed') return '✓';
  if (status === 'skipped') return '↷';
  return '○';
}

function handleKeydown(event) {
  if (event.key === 'Escape' && selectedRun.value) {
    closeRunDetails();
  }
}

async function deleteSelectedRun() {
  if (!selectedRun.value || deletingRun.value) {
    return;
  }

  const confirmed = window.confirm('Delete this run from your history?');
  if (!confirmed) {
    return;
  }

  deleteError.value = '';
  deletingRun.value = true;

  const runKey = selectedRun.value.id;
  const runId = Number(runKey);
  if (!Number.isFinite(runId)) {
    deleteError.value = 'Unable to delete this run.';
    deletingRun.value = false;
    return;
  }

  try {
    await deleteCircuitRun(runId);
    runs.value = runs.value.filter((run) => run.id !== runKey && Number(run.id) !== runId);
    closeRunDetails();
  } catch (err) {
    console.error(err);
    deleteError.value = err instanceof Error ? err.message : 'Failed to delete run.';
  } finally {
    deletingRun.value = false;
  }
}

onMounted(loadRunHistory);
onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.calendar-view {
  gap: 1.5rem;
}

.calendar-card {
  display: grid;
  gap: 1.5rem;
}

.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
}

.calendar-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.calendar-controls .ghost {
  min-width: 2.25rem;
  padding: 0.35rem 0.75rem;
  font-weight: 600;
}

.month-label {
  font-weight: 700;
  font-size: 1.1rem;
  color: #312e81;
}

.summary-text {
  margin-top: 0.35rem;
}

.calendar-body {
  display: grid;
  gap: 0.75rem;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 0.75rem;
}

.calendar-weekday {
  text-align: center;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.5rem;
}

.calendar-day {
  min-height: 8.5rem;
  border-radius: 1rem;
  padding: 0.75rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.35);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.calendar-day.has-runs {
  border-color: rgba(124, 58, 237, 0.4);
  box-shadow: 0 16px 28px -24px rgba(124, 58, 237, 0.45);
}

.calendar-day.today {
  border-color: rgba(13, 148, 136, 0.7);
  box-shadow: 0 18px 32px -26px rgba(13, 148, 136, 0.4);
}

.calendar-day.other-month {
  opacity: 0.55;
  background: rgba(255, 255, 255, 0.6);
}

.day-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.day-number {
  font-weight: 700;
  color: #1e293b;
}

.today-pill {
  font-size: 0.65rem;
  font-weight: 700;
  color: #047857;
  background: rgba(16, 185, 129, 0.16);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.day-runs {
  display: grid;
  gap: 0.5rem;
}

.run-chip {
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.15);
  border-radius: 0.85rem;
  padding: 0.6rem 0.75rem;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.run-time {
  font-size: 0.75rem;
  font-weight: 700;
  color: #6366f1;
  letter-spacing: 0.04em;
}

.run-duration {
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
}

.run-percent {
  font-weight: 700;
  color: #0f766e;
}


.run-chip-content {
  width: 100%;
  display: grid;
  gap: 0.2rem;
  justify-items: start;
}

.run-chip:focus-visible {
  outline: 2px solid rgba(79, 70, 229, 0.5);
  outline-offset: 2px;
}

.run-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px -20px rgba(79, 70, 229, 0.65);
}

.day-placeholder {
  flex: 1 1 auto;
}

.empty-hint {
  text-align: center;
  font-size: 0.85rem;
}

.empty-state.error {
  color: #b91c1c;
}

.run-detail-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  display: grid;
  place-items: center;
  padding: 1.5rem;
  z-index: 20;
}

.run-detail-card {
  background: #ffffff;
  border-radius: 1rem;
  max-width: 32rem;
  width: min(32rem, 100%);
  max-height: min(85vh, 40rem);
  box-shadow: 0 24px 55px -25px rgba(15, 23, 42, 0.55);
  padding: 1.5rem;
  display: grid;
  gap: 1rem;
  overflow-y: auto;
}

.run-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
}

.run-detail-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.run-detail-heading {
  display: grid;
  gap: 0.35rem;
}

.run-detail-date {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6366f1;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.run-detail-heading h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: #312e81;
}

.run-detail-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: #475569;
}

.detail-percent {
  font-weight: 700;
  color: #0f766e;
}

.run-detail-error {
  margin: 0;
  color: #b91c1c;
  font-size: 0.85rem;
}

.run-detail-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #475569;
}

.run-detail-counts .count.completed {
  color: #2563eb;
}

.run-detail-counts .count.skipped {
  color: #dc2626;
}

.run-detail-counts .count.not-done {
  color: #ca8a04;
}

.task-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.5rem;
}

.task-item {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.task-status {
  font-size: 1rem;
  font-weight: 700;
  color: #6366f1;
  line-height: 1.2;
}

.task-item.completed .task-status {
  color: #2563eb;
}

.task-item.skipped .task-status {
  color: #dc2626;
}

.task-item.not_done .task-status {
  color: #ca8a04;
}

.task-info {
  display: grid;
  gap: 0.25rem;
}

.task-name {
  font-weight: 600;
  color: #1e293b;
}

.task-meta {
  font-size: 0.8rem;
  color: #64748b;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.calendar-card .close {
  font-size: 1.5rem;
  line-height: 1;
  padding: 0.25rem 0.5rem;
}

.run-chip:active {
  transform: translateY(0);
}

@media (max-width: 900px) {
  .calendar-grid,
  .calendar-weekdays {
    gap: 0.35rem;
  }

  .calendar-day {
    min-height: 7.5rem;
    padding: 0.6rem;
  }

  .run-detail-card {
    padding: 1.25rem;
  }
}

@media (max-width: 640px) {
  .calendar-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .calendar-controls {
    width: 100%;
    justify-content: space-between;
  }

  .calendar-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .calendar-weekdays {
    display: none;
  }

  .run-detail-card {
    width: 100%;
  }
}
</style>
