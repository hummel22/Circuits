<template>
  <div class="stack">
    <section class="card" v-if="loading">
      <div class="empty-state">Loading circuit…</div>
    </section>
    <section class="card" v-else-if="!circuit">
      <div class="empty-state">Circuit not found.</div>
    </section>
    <section class="card" v-else>
      <header class="inline" style="justify-content: space-between; align-items: center;">
        <div>
          <h2 class="section-title" style="margin: 0;">{{ circuit.name }}</h2>
          <p class="muted">{{ circuit.description || 'No description provided.' }}</p>
        </div>
        <RouterLink :to="`/circuits/${circuit.id}`" class="ghost">Back to edit</RouterLink>
      </header>
      <div class="stack">
        <div class="card" style="background: rgba(37, 99, 235, 0.2); border-color: rgba(37,99,235,0.4);">
          <h3 style="margin-top: 0;">{{ activeTask ? activeTask.name : 'Circuit complete!' }}</h3>
          <p v-if="activeTask" style="margin-bottom: 0.5rem;">{{ activeTask.description }}</p>
          <p v-if="activeTask" class="badge">{{ remaining }} sec remaining</p>
          <div class="inline" style="margin-top: 1rem;">
            <button v-if="!running && !completed" class="primary" @click="start">Start</button>
            <button v-if="running" class="ghost" @click="pause">Pause</button>
            <button v-if="!running && !completed && hasStarted" class="ghost" @click="resume">Resume</button>
            <button v-if="running || hasStarted" class="ghost" @click="next">Skip</button>
            <button v-if="completed" class="primary" @click="restart">Restart</button>
          </div>
        </div>

        <div class="stack">
          <article
            v-for="(task, index) in circuit.tasks"
            :key="`${task.name}-${index}`"
            class="task-card"
            :class="{ active: index === currentIndex, completed: index < currentIndex }"
          >
            <header class="inline" style="justify-content: space-between; align-items: baseline;">
              <h3 style="margin: 0;">{{ task.name }}</h3>
              <span class="badge">{{ task.duration }} sec</span>
            </header>
            <p style="margin-bottom: 0;">{{ task.description }}</p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink } from 'vue-router';
import { getCircuit } from '../api';

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

const completed = computed(() => circuit.value && currentIndex.value >= circuit.value.tasks.length);

const activeTask = computed(() => {
  if (!circuit.value || completed.value) {
    return null;
  }
  return circuit.value.tasks[currentIndex.value];
});

async function loadCircuit() {
  loading.value = true;
  try {
    circuit.value = await getCircuit(props.id);
    resetTimer();
  } catch (err) {
    circuit.value = null;
    console.error(err);
  } finally {
    loading.value = false;
  }
}

function resetTimer() {
  currentIndex.value = 0;
  remaining.value = circuit.value?.tasks?.[0]?.duration ?? 0;
  running.value = false;
  hasStarted.value = false;
  clearInterval(timer.value);
  timer.value = null;
}

function start() {
  if (!activeTask.value) return;
  hasStarted.value = true;
  running.value = true;
  clearInterval(timer.value);
  tick();
  timer.value = setInterval(tick, 1000);
}

function pause() {
  running.value = false;
  clearInterval(timer.value);
  timer.value = null;
}

function resume() {
  if (completed.value) return;
  running.value = true;
  clearInterval(timer.value);
  timer.value = setInterval(tick, 1000);
}

function next() {
  advance();
  if (running.value) {
    clearInterval(timer.value);
    timer.value = setInterval(tick, 1000);
  }
}

function restart() {
  resetTimer();
}

function advance() {
  currentIndex.value += 1;
  if (completed.value) {
    pause();
    remaining.value = 0;
    return;
  }
  remaining.value = circuit.value.tasks[currentIndex.value].duration;
}

function tick() {
  if (!running.value) return;
  if (remaining.value <= 1) {
    advance();
  } else {
    remaining.value -= 1;
  }
}

onMounted(loadCircuit);

onBeforeUnmount(() => {
  clearInterval(timer.value);
});
</script>

<style scoped>
.task-card.active {
  border-color: rgba(37, 99, 235, 0.6);
  box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.4);
}

.task-card.completed {
  opacity: 0.6;
}
</style>
