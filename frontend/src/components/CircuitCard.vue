<template>
  <article class="card circuit-card">
    <header class="card-header">
      <div>
        <h2>{{ circuit.name }}</h2>
        <p class="muted">{{ circuit.description || 'No description provided.' }}</p>
      </div>
      <div class="badge">
        <span>{{ totalDuration }}</span>
        <span>sec</span>
      </div>
    </header>
    <footer class="card-footer">
      <RouterLink :to="`/circuits/${circuit.id}`" class="ghost">Edit</RouterLink>
      <RouterLink :to="`/circuits/${circuit.id}/run`" class="primary">Run</RouterLink>
    </footer>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

const props = defineProps({
  circuit: {
    type: Object,
    required: true,
  }
});

const totalDuration = computed(() => {
  if (!props.circuit.tasks) {
    return 0;
  }
  return props.circuit.tasks.reduce((total, task) => total + (task.duration || 0), 0);
});
</script>

<style scoped>
.circuit-card {
  display: grid;
  gap: 1.5rem;
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.circuit-card::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(140deg, rgba(59, 130, 246, 0.2), transparent 60%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.circuit-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 24px 40px -34px rgba(37, 99, 235, 0.75);
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
}

.card-header .muted {
  color: rgba(148, 163, 184, 0.85);
  margin-top: 0.5rem;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.18);
  padding-top: 0.75rem;
}
</style>
