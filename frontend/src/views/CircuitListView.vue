<template>
  <div class="stack">
    <section class="card">
      <header class="inline" style="justify-content: space-between; align-items: center;">
        <div>
          <h2 class="section-title" style="margin: 0;">Your circuits</h2>
          <p class="muted">Manage and launch your timeboxed circuits.</p>
        </div>
        <RouterLink to="/circuits/new" class="primary">Create circuit</RouterLink>
      </header>
      <div v-if="loading" class="empty-state">Loading circuits…</div>
      <div v-else-if="error" class="empty-state">{{ error }}</div>
      <div v-else-if="!circuits.length" class="empty-state">
        No circuits yet. Click <strong>Create circuit</strong> to get started.
      </div>
      <div v-else class="stack">
        <CircuitCard v-for="circuit in circuits" :key="circuit.id" :circuit="circuit" />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import CircuitCard from '../components/CircuitCard.vue';
import { listCircuits } from '../api';

const circuits = ref([]);
const loading = ref(true);
const error = ref('');

async function loadCircuits() {
  loading.value = true;
  error.value = '';
  try {
    circuits.value = await listCircuits();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load circuits';
  } finally {
    loading.value = false;
  }
}

onMounted(loadCircuits);
</script>
