<template>
  <div class="stack">
    <section class="card">
      <header class="inline" style="justify-content: space-between; align-items: center;">
        <div>
          <h2 class="section-title" style="margin: 0;">Create a circuit</h2>
          <p class="muted">Build a new circuit by defining its tasks and durations.</p>
        </div>
        <RouterLink to="/" class="ghost">Back</RouterLink>
      </header>
      <CircuitForm
        :model-value="model"
        :submitting="submitting"
        :error="error"
        @submit="handleSubmit"
      />
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import CircuitForm from '../components/CircuitForm.vue';
import { createCircuit } from '../api';

const router = useRouter();
const submitting = ref(false);
const error = ref('');

const model = {
  name: '',
  description: '',
  tasks: [
    {
      name: 'Warmup',
      description: 'Gentle movement to get started',
      duration: 60,
    },
  ],
};

async function handleSubmit(payload) {
  submitting.value = true;
  error.value = '';
  try {
    const circuit = await createCircuit(payload);
    router.push({ name: 'circuit-detail', params: { id: circuit.id } });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create circuit';
  } finally {
    submitting.value = false;
  }
}
</script>
