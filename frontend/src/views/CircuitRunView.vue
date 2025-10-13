<template>
  <div class="stack">
    <section class="card" v-if="loading">
      <div class="empty-state">Loading circuit…</div>
    </section>
    <section class="card" v-else-if="!circuit">
      <div class="empty-state">Circuit not found.</div>
    </section>
    <section class="card run-shell" v-else>
      <header class="inline" style="justify-content: space-between; align-items: center;">
        <div>
          <h2 class="section-title" style="margin: 0;">{{ circuit.name }}</h2>
          <p class="muted">{{ circuit.description || 'No description provided.' }}</p>
        </div>
        <RouterLink :to="`/circuits/${circuit.id}`" class="ghost">Back to edit</RouterLink>
      </header>

      <div class="run-toolbar">
        <div class="inline button-group">
          <button v-if="!running && !completed" class="primary" @click="start">Start</button>
          <button v-if="running" class="ghost" @click="pause">Pause</button>
          <button v-if="!running && !completed && hasStarted" class="ghost" @click="resume">Resume</button>
          <button v-if="running || hasStarted" class="ghost" @click="completeActiveTask">Complete</button>
          <button v-if="running || hasStarted" class="ghost" @click="skipCurrentTask">Skip</button>
          <button v-if="completed" class="primary" @click="restart">Restart</button>
        </div>
        <div class="sound-toggles">
          <label class="toggle">
            <input type="checkbox" v-model="countdownSoundEnabled" />
            <span>Countdown beeps</span>
          </label>
          <label class="toggle">
            <input type="checkbox" v-model="completionSoundEnabled" />
            <span>Completion chime</span>
          </label>
        </div>
      </div>

      <div class="task-runner" ref="taskRunner">
        <article
          v-for="(task, index) in circuit.tasks"
          :key="`${task.name}-${index}`"
          class="task-card run-task"
          :class="{
            active: index === highlightIndex,
            completed: taskStatuses[index] === 'completed',
            skipped: taskStatuses[index] === 'skipped'
          }"
          :ref="(el) => setTaskRef(el, index)"
        >
          <header class="inline task-header">
            <div>
              <h3>{{ task.name }}</h3>
              <p v-if="task.description" class="muted task-description">{{ task.description }}</p>
              <p v-else class="muted task-description">No description provided.</p>
            </div>
            <div class="task-meta">
              <span class="badge">{{ formatMinutesLabel(task.duration) }} min</span>
              <div class="task-actions">
                <button
                  type="button"
                  class="task-complete"
                  :disabled="index !== currentIndex || completed"
                  @click="completeTask(index)"
                >
                  <span aria-hidden="true">✓</span>
                  <span class="sr-only">Complete {{ task.name }}</span>
                </button>
                <button type="button" class="task-play" @click="startFrom(index)">
                  <span aria-hidden="true">▶</span>
                  <span class="sr-only">Start from {{ task.name }}</span>
                </button>
              </div>
              <span
                v-if="taskStatuses[index] && taskStatuses[index] !== 'pending'"
                class="status-chip"
                :class="taskStatuses[index]"
              >
                {{ taskStatusLabel(taskStatuses[index]) }}
              </span>
            </div>
          </header>
          <div v-if="index === currentIndex && !completed" class="task-timer" aria-live="polite">
            {{ formattedRemaining }}
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { RouterLink } from 'vue-router';
import { getCircuit, createCircuitRun } from '../api';
import { useCircuitTitle } from '../composables/useCircuitTitle';

const props = defineProps({
  id: {
    type: String,
    required: true,
  }
});

const circuit = ref(null);
const loading = ref(true);
const currentIndex = ref(0);
const remaining = ref(0);
const timer = ref(null);
const running = ref(false);
const hasStarted = ref(false);
const countdownSoundEnabled = ref(true);
const completionSoundEnabled = ref(true);
const audioContext = ref(null);
const lastBeepSecond = ref(null);
const taskStartedAt = ref(null);
const remainingAtStart = ref(0);
const taskRefs = ref([]);
const taskRunner = ref(null);
const taskStatuses = ref([]);
const runStartedAt = ref(null);
const submittingRun = ref(false);
const hasRecordedRun = ref(false);
const { setCircuitContext, clearCircuitContext } = useCircuitTitle();

const completed = computed(() => circuit.value && currentIndex.value >= circuit.value.tasks.length);

const activeTask = computed(() => {
  if (!circuit.value || completed.value) {
    return null;
  }
  return circuit.value.tasks[currentIndex.value];
});

const highlightIndex = computed(() => {
  if (!circuit.value || !circuit.value.tasks?.length) {
    return -1;
  }
  if (completed.value) {
    return Math.max(0, currentIndex.value - 1);
  }
  return currentIndex.value;
});

const formattedRemaining = computed(() => {
  const total = Math.max(0, remaining.value || 0);
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
});

function formatMinutesLabel(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return '0';
  }
  const minutes = numeric / 60;
  const decimals = minutes >= 10 || Number.isInteger(minutes) ? 0 : 1;
  const formatted = Number(minutes.toFixed(decimals));
  return formatted.toString();
}

function initializeTaskStatuses() {
  const count = circuit.value?.tasks?.length ?? 0;
  taskStatuses.value = Array.from({ length: count }, () => 'pending');
}

function setTaskStatus(index, status) {
  if (!Array.isArray(taskStatuses.value)) {
    taskStatuses.value = [];
  }
  if (index < 0) return;
  if (index >= taskStatuses.value.length) return;
  taskStatuses.value[index] = status;
}

function markRunStarted() {
  if (!runStartedAt.value) {
    runStartedAt.value = new Date();
  }
}

function taskStatusLabel(status) {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'skipped':
      return 'Skipped';
    case 'not_done':
      return 'Not done';
    default:
      return '';
  }
}

async function loadCircuit() {
  loading.value = true;
  try {
    circuit.value = await getCircuit(props.id);
    taskRefs.value = [];
    resetTimer();
    if (circuit.value?.name) {
      const circuitId =
        circuit.value?.id !== undefined && circuit.value?.id !== null
          ? String(circuit.value.id)
          : props.id;
      setCircuitContext(circuit.value.name, circuitId);
    } else {
      clearCircuitContext();
    }
  } catch (err) {
    circuit.value = null;
    taskStatuses.value = [];
    console.error(err);
    clearCircuitContext();
  } finally {
    loading.value = false;
  }
}

function clearTimer() {
  if (timer.value) {
    clearInterval(timer.value);
    timer.value = null;
  }
}

function startTimer() {
  clearTimer();
  remainingAtStart.value = remaining.value || 0;
  taskStartedAt.value = Date.now();
  timer.value = setInterval(tick, 1000);
}

function ensureAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) {
    return null;
  }
  if (!audioContext.value) {
    audioContext.value = new AudioCtor();
  }
  if (audioContext.value.state === 'suspended') {
    audioContext.value.resume();
  }
  return audioContext.value;
}

function playTone(frequency, duration, volume = 0.22) {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  oscillator.connect(gainNode).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

function playCompletionSound(final = false) {
  if (!completionSoundEnabled.value) return;
  const baseVolume = final ? 0.32 : 0.26;
  playTone(final ? 600 : 540, 0.18, baseVolume);
  setTimeout(() => playTone(final ? 880 : 760, 0.28, baseVolume + 0.06), 120);
}

function maybePlayCountdown(nextRemaining) {
  if (!countdownSoundEnabled.value) return;
  if (nextRemaining < 1 || nextRemaining > 5) return;
  if (lastBeepSecond.value === nextRemaining) return;
  lastBeepSecond.value = nextRemaining;
  const frequency = 820 + (5 - nextRemaining) * 70;
  playTone(frequency, 0.12, 0.22);
}

function resetTimer() {
  clearTimer();
  currentIndex.value = 0;
  remaining.value = circuit.value?.tasks?.[0]?.duration ?? 0;
  running.value = false;
  hasStarted.value = false;
  lastBeepSecond.value = null;
  taskStartedAt.value = null;
  remainingAtStart.value = remaining.value || 0;
  runStartedAt.value = null;
  hasRecordedRun.value = false;
  submittingRun.value = false;
  initializeTaskStatuses();
}

async function finalizeRun(options = {}) {
  const { markCurrentAs } = options;
  if (
    !circuit.value ||
    !circuit.value.id ||
    !runStartedAt.value ||
    hasRecordedRun.value ||
    submittingRun.value
  ) {
    return;
  }

  const tasks = Array.isArray(circuit.value.tasks) ? circuit.value.tasks : [];
  const statuses = Array.isArray(taskStatuses.value)
    ? taskStatuses.value.slice()
    : Array.from({ length: tasks.length }, () => 'pending');
  if (
    typeof markCurrentAs === 'string' &&
    currentIndex.value < tasks.length &&
    (!statuses[currentIndex.value] || statuses[currentIndex.value] === 'pending')
  ) {
    statuses[currentIndex.value] = markCurrentAs;
  }

  const normalized = tasks.map((_, index) => {
    const status = statuses[index] || 'pending';
    return {
      index,
      status: status === 'pending' ? 'not_done' : status,
    };
  });

  const payload = {
    started_at: runStartedAt.value.toISOString(),
    ended_at: new Date().toISOString(),
    tasks: normalized,
  };

  submittingRun.value = true;
  try {
    await createCircuitRun(circuit.value.id, payload);
    hasRecordedRun.value = true;
  } catch (error) {
    console.error('Failed to record circuit run history', error);
  } finally {
    submittingRun.value = false;
  }
}

function start() {
  if (!activeTask.value) return;
  ensureAudioContext();
  hasStarted.value = true;
  running.value = true;
  lastBeepSecond.value = null;
  markRunStarted();
  startTimer();
}

function pause() {
  syncRemainingWithClock();
  running.value = false;
  clearTimer();
  taskStartedAt.value = null;
  remainingAtStart.value = remaining.value || 0;
}

function resume() {
  if (completed.value) return;
  ensureAudioContext();
  running.value = true;
  lastBeepSecond.value = null;
  markRunStarted();
  startTimer();
}

function startFrom(index) {
  if (!circuit.value) return;
  if (index < 0 || index >= circuit.value.tasks.length) return;
  ensureAudioContext();
  clearTimer();
  currentIndex.value = index;
  remaining.value = circuit.value.tasks[index].duration;
  hasStarted.value = true;
  running.value = true;
  lastBeepSecond.value = null;
  remainingAtStart.value = remaining.value || 0;
  markRunStarted();
  startTimer();
}

function skipCurrentTask() {
  advance(false, 'skipped');
}

function completeTask(index) {
  if (!circuit.value) return;
  if (completed.value) return;
  if (index !== currentIndex.value) return;
  advance(false, 'completed');
}

function completeActiveTask() {
  completeTask(currentIndex.value);
}

async function restart() {
  await finalizeRun({ markCurrentAs: 'not_done' });
  resetTimer();
}

function advance(triggeredByTimer = false, statusOverride = null) {
  if (!circuit.value) return;
  const tasks = circuit.value.tasks;
  const current = currentIndex.value;
  if (current < tasks.length) {
    const status = statusOverride || (triggeredByTimer ? 'completed' : 'skipped');
    setTaskStatus(current, status);
  }
  const nextIndex = current + 1;
  const willComplete = nextIndex >= tasks.length;
  if (triggeredByTimer || (statusOverride === 'completed' && willComplete)) {
    playCompletionSound(willComplete);
  }
  currentIndex.value = nextIndex;
  lastBeepSecond.value = null;
  if (willComplete) {
    clearTimer();
    running.value = false;
    remaining.value = 0;
    taskStartedAt.value = null;
    remainingAtStart.value = 0;
    Promise.resolve()
      .then(() => finalizeRun())
      .catch((error) => console.error('Failed to finalize run', error));
  } else {
    remaining.value = tasks[nextIndex].duration;
    remainingAtStart.value = remaining.value || 0;
    if (running.value) {
      startTimer();
    } else {
      taskStartedAt.value = null;
    }
  }
}

function tick() {
  if (!running.value) return;
  if (!taskStartedAt.value) {
    taskStartedAt.value = Date.now();
    remainingAtStart.value = remaining.value || 0;
  }
  const elapsed = Math.floor((Date.now() - taskStartedAt.value) / 1000);
  const nextRemaining = Math.max(remainingAtStart.value - elapsed, 0);
  if (nextRemaining <= 0) {
    remaining.value = 0;
    advance(true);
    return;
  }
  if (nextRemaining !== remaining.value) {
    maybePlayCountdown(nextRemaining);
    remaining.value = nextRemaining;
  }
}

function syncRemainingWithClock() {
  if (!running.value || !taskStartedAt.value) {
    return remaining.value || 0;
  }
  const elapsed = Math.floor((Date.now() - taskStartedAt.value) / 1000);
  const nextRemaining = Math.max(remainingAtStart.value - elapsed, 0);
  if (nextRemaining !== remaining.value) {
    remaining.value = nextRemaining;
  }
  return nextRemaining;
}

function handleVisibilityReturn() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return;
  }
  const remainingNow = syncRemainingWithClock();
  if (running.value && remainingNow <= 0 && activeTask.value) {
    advance(true);
  }
}

function setTaskRef(el, index) {
  if (el) {
    taskRefs.value[index] = el;
  } else {
    delete taskRefs.value[index];
  }
}

watch(
  () => highlightIndex.value,
  async (index) => {
    if (index < 0) return;
    await nextTick();
    const el = taskRefs.value[index];
    const container = taskRunner.value;
    if (container && el) {
      const paddingTop = parseFloat(getComputedStyle(container).paddingTop || '0');
      const target = el.offsetTop - paddingTop;
      container.scrollTo({ top: target, behavior: 'smooth' });
    } else if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
    }
  },
  { immediate: true }
);

watch(
  () => props.id,
  async (newId, oldId) => {
    if (newId && newId !== oldId) {
      await finalizeRun({ markCurrentAs: 'not_done' });
      await loadCircuit();
    }
  }
);

onMounted(loadCircuit);

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityReturn);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', handleVisibilityReturn);
  }
});

onBeforeUnmount(() => {
  finalizeRun({ markCurrentAs: 'not_done' }).catch((error) =>
    console.error('Failed to finalize run', error)
  );
  clearTimer();
  if (audioContext.value && typeof audioContext.value.close === 'function') {
    audioContext.value.close();
  }
  clearCircuitContext();
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityReturn);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('focus', handleVisibilityReturn);
  }
});
</script>

<style scoped>
.run-shell {
  display: grid;
  gap: 1.75rem;
}

.run-toolbar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
}

.button-group {
  gap: 0.75rem;
}

.sound-toggles {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #334155;
}

.toggle input[type='checkbox'] {
  accent-color: #7c3aed;
  width: 1.1rem;
  height: 1.1rem;
}

.task-runner {
  position: relative;
  max-height: 60vh;
  overflow-y: auto;
  padding: 1rem 0.75rem;
  display: grid;
  gap: 1rem;
  scroll-behavior: smooth;
}

.run-task {
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, opacity 0.2s ease;
  z-index: 1;
  scroll-margin-top: 0.75rem;
}

.run-task.active {
  border-width: 3px;
  border-color: rgba(124, 58, 237, 0.7);
  box-shadow: 0 20px 32px -20px rgba(124, 58, 237, 0.5);
  transform: translateY(-2px);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.16), rgba(13, 148, 136, 0.12));
}

.run-task.completed {
  opacity: 0.75;
}

.run-task.active.completed {
  opacity: 1;
}

.run-task.skipped {
  opacity: 0.55;
  border-style: dashed;
}

.task-header {
  justify-content: space-between;
  align-items: flex-start;
}

.task-header h3 {
  margin: 0 0 0.35rem;
  color: #1f2937;
  font-size: 1.15rem;
  transition: font-size 0.2s ease;
}

.task-header .muted {
  margin: 0;
  transition: font-size 0.2s ease;
}

.run-task.active .task-header h3 {
  font-size: 1.7rem;
}

.run-task.active .task-header .muted,
.run-task.active .task-description {
  font-size: 1.1rem;
}

.task-meta {
  display: grid;
  justify-items: end;
  gap: 0.5rem;
}

.task-description {
  margin: 0;
}

.task-actions {
  display: flex;
  gap: 0.5rem;
}

.task-complete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  border: 1px solid rgba(13, 148, 136, 0.35);
  background: #ecfdf5;
  color: #047857;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.task-complete:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px -16px rgba(4, 120, 87, 0.55);
  background: rgba(16, 185, 129, 0.12);
}

.task-complete:disabled {
  opacity: 0.4;
  cursor: default;
  box-shadow: none;
}

.task-play {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 999px;
  border: 1px solid rgba(124, 58, 237, 0.35);
  background: #ffffff;
  color: #7c3aed;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.task-play:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px -16px rgba(124, 58, 237, 0.55);
  background: rgba(124, 58, 237, 0.08);
}

.task-play span[aria-hidden='true'] {
  font-size: 1rem;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid transparent;
}

.status-chip.completed {
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
  border-color: rgba(59, 130, 246, 0.25);
}

.status-chip.skipped {
  background: rgba(248, 113, 113, 0.12);
  color: #b91c1c;
  border-color: rgba(248, 113, 113, 0.25);
}

.task-timer {
  margin-top: 1.5rem;
  font-size: clamp(2.75rem, 6vw, 4rem);
  font-weight: 700;
  color: #312e81;
  text-align: right;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
