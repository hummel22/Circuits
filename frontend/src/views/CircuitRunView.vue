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
          <button v-if="running || hasStarted" class="ghost" @click="next">Skip</button>
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
          :class="{ active: index === highlightIndex, completed: index < currentIndex }"
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
              <button type="button" class="task-play" @click="startFrom(index)">
                <span aria-hidden="true">▶</span>
                <span class="sr-only">Start from {{ task.name }}</span>
              </button>
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
import { getCircuit } from '../api';
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
const taskRefs = ref([]);
const taskRunner = ref(null);
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
}

function start() {
  if (!activeTask.value) return;
  ensureAudioContext();
  hasStarted.value = true;
  running.value = true;
  lastBeepSecond.value = null;
  startTimer();
}

function pause() {
  running.value = false;
  clearTimer();
}

function resume() {
  if (completed.value) return;
  ensureAudioContext();
  running.value = true;
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
  startTimer();
}

function next() {
  advance(false);
}

function restart() {
  resetTimer();
}

function advance(triggeredByTimer = false) {
  if (!circuit.value) return;
  const tasks = circuit.value.tasks;
  const nextIndex = currentIndex.value + 1;
  const willComplete = nextIndex >= tasks.length;
  if (triggeredByTimer) {
    playCompletionSound(willComplete);
  }
  currentIndex.value = nextIndex;
  lastBeepSecond.value = null;
  if (willComplete) {
    clearTimer();
    running.value = false;
    remaining.value = 0;
  } else {
    remaining.value = tasks[nextIndex].duration;
  }
}

function tick() {
  if (!running.value) return;
  if (remaining.value <= 1) {
    advance(true);
    return;
  }
  const nextRemaining = remaining.value - 1;
  maybePlayCountdown(nextRemaining);
  remaining.value = nextRemaining;
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
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      loadCircuit();
    }
  }
);

onMounted(loadCircuit);

onBeforeUnmount(() => {
  clearTimer();
  if (audioContext.value && typeof audioContext.value.close === 'function') {
    audioContext.value.close();
  }
  clearCircuitContext();
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
