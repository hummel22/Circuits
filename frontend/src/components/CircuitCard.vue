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
}

.card-header {
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
}

.card-header h2 {
  margin: 0;
  font-size: 1.5rem;
}

.card-header .muted {
  color: #9ca3af;
  margin-top: 0.5rem;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}
</style>
