<template>
  <article
    class="card circuit-card"
    role="link"
    tabindex="0"
    @click="goToRun"
    @keydown.enter.prevent="goToRun"
    @keydown.space.prevent="goToRun"
  >
    <header class="card-header">
      <div>
        <h2>{{ circuit.name }}</h2>
        <p class="muted">{{ circuit.description || 'No description provided.' }}</p>
      </div>
      <div class="badge">
        <span>{{ totalDurationMinutes }}</span>
        <span>min</span>
      </div>
    </header>
    <footer class="card-footer">
      <RouterLink :to="`/circuits/${circuit.id}`" class="ghost" @click.stop>Edit</RouterLink>
      <RouterLink :to="`/circuits/${circuit.id}/run`" class="primary" @click.stop>Run</RouterLink>
    </footer>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, useRouter } from 'vue-router';

const props = defineProps({
  circuit: {
    type: Object,
    required: true,
  }
});

const router = useRouter();

const totalSeconds = computed(() => {
  if (!props.circuit.tasks?.length) {
    return 0;
  }
  return props.circuit.tasks.reduce((total, task) => total + normaliseSeconds(task.duration), 0);
});

const totalDurationMinutes = computed(() => formatMinutesValue(totalSeconds.value));

function normaliseSeconds(value) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function formatMinutesValue(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return '0';
  }
  const minutes = seconds / 60;
  const decimals = minutes >= 10 || Number.isInteger(minutes) ? 0 : 1;
  const formatted = Number(minutes.toFixed(decimals));
  return formatted.toString();
}

function goToRun() {
  if (!props.circuit?.id) {
    return;
  }
  router.push({ name: 'circuit-run', params: { id: props.circuit.id } });
}
</script>

<style scoped>
.circuit-card {
  display: grid;
  gap: 1.5rem;
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
}

.circuit-card::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(140deg, rgba(124, 58, 237, 0.25), rgba(13, 148, 136, 0.15));
  opacity: 0;
  transition: opacity 0.2s ease;
}

.circuit-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 40px -28px rgba(15, 118, 110, 0.35);
}

.circuit-card:hover::after {
  opacity: 1;
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  align-items: flex-start;
}

.card-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #1f2937;
}

.card-header .muted {
  color: rgba(100, 116, 139, 0.95);
  margin-top: 0.5rem;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid rgba(226, 232, 240, 0.9);
  padding-top: 0.75rem;
}
</style>
