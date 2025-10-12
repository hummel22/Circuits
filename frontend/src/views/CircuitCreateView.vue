<template>
  <div class="stack">
    <section class="card">
      <header class="inline" style="justify-content: space-between; align-items: center;">
        <div>
          <h2 class="section-title" style="margin: 0;">Create a circuit</h2>
          <p class="muted">Build a new circuit by defining its tasks and durations.</p>
        </div>
        <div class="inline actions">
          <button type="button" class="ghost" @click="showUpload = true">Upload circuits</button>
          <RouterLink to="/" class="ghost">Back</RouterLink>
        </div>
      </header>
      <p v-if="uploadMessage" class="success-message">{{ uploadMessage }}</p>
      <CircuitForm
        :model-value="model"
        :submitting="submitting"
        :error="error"
        @submit="handleSubmit"
      />
    </section>
    <CircuitUploadModal :open="showUpload" @close="showUpload = false" @imported="handleImported" />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, RouterLink } from 'vue-router';
import CircuitForm from '../components/CircuitForm.vue';
import CircuitUploadModal from '../components/CircuitUploadModal.vue';
import { createCircuit } from '../api';

const router = useRouter();
const submitting = ref(false);
const error = ref('');
const showUpload = ref(false);
const uploadMessage = ref('');

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

function handleImported(count) {
  showUpload.value = false;
  uploadMessage.value =
    count === 1 ? 'Circuit imported successfully.' : `${count} circuits imported successfully.`;
}
</script>

<style scoped>
.actions {
  gap: 0.5rem;
}

.success-message {
  background: rgba(13, 148, 136, 0.12);
  border: 1px solid rgba(13, 148, 136, 0.35);
  color: #0f766e;
  padding: 0.75rem 1rem;
  border-radius: 0.85rem;
  margin: 0 0 1.5rem;
}
</style>
