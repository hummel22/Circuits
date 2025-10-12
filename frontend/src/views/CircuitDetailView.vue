<template>
  <div class="stack">
    <section class="card" v-if="loaded">
      <header class="inline" style="justify-content: space-between; align-items: center;">
        <div>
          <h2 class="section-title" style="margin: 0;">Edit circuit</h2>
          <p class="muted">Update the circuit information or tasks.</p>
        </div>
        <div class="inline">
          <RouterLink to="/" class="ghost">Back</RouterLink>
          <RouterLink :to="`/circuits/${id}/run`" class="primary">Run circuit</RouterLink>
          <button
            type="button"
            class="ghost danger"
            :disabled="submitting"
            @click="handleDelete"
          >
            Delete
          </button>
        </div>
      </header>
      <CircuitForm
        v-if="circuit"
        :model-value="circuit"
        :submitting="submitting"
        :error="error"
        @submit="handleSubmit"
      />
      <p v-else class="empty-state">Circuit not found.</p>
    </section>
    <section class="card" v-else>
      <div class="empty-state">Loading circuit…</div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import CircuitForm from '../components/CircuitForm.vue';
import { getCircuit, updateCircuit, deleteCircuit } from '../api';
import { useCircuitTitle } from '../composables/useCircuitTitle';

const props = defineProps({
  id: {
    type: String,
    required: true,
  }
});

const route = useRoute();
const router = useRouter();
const { setCircuitContext, clearCircuitContext } = useCircuitTitle();

const circuit = ref(null);
const loaded = ref(false);
const submitting = ref(false);
const error = ref('');

async function loadCircuit(circuitId) {
  loaded.value = false;
  try {
    circuit.value = await getCircuit(circuitId);
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
    error.value = err instanceof Error ? err.message : 'Failed to load circuit';
    clearCircuitContext();
  } finally {
    loaded.value = true;
  }
}

async function handleSubmit(payload) {
  submitting.value = true;
  error.value = '';
  try {
    const updated = await updateCircuit(props.id, payload);
    circuit.value = updated;
    if (updated?.name) {
      const circuitId =
        updated?.id !== undefined && updated?.id !== null
          ? String(updated.id)
          : props.id;
      setCircuitContext(updated.name, circuitId);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update circuit';
  } finally {
    submitting.value = false;
  }
}

async function handleDelete() {
  if (!confirm('Delete this circuit?')) {
    return;
  }
  submitting.value = true;
  try {
    await deleteCircuit(props.id);
    router.push({ name: 'circuits' });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to delete circuit';
  } finally {
    submitting.value = false;
  }
}

onMounted(() => loadCircuit(props.id));

watch(
  () => route.params.id,
  (newId) => {
    if (typeof newId === 'string') {
      loadCircuit(newId);
    }
  }
);

onBeforeUnmount(() => {
  clearCircuitContext();
});
</script>
