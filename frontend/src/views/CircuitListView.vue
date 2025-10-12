<template>
  <div class="stack">
    <section class="card upload-card">
      <header class="inline upload-header">
        <div>
          <h2 class="section-title" style="margin: 0;">Upload circuits</h2>
          <p class="muted">Import a single circuit or a collection using JSON. Paste raw JSON or load a file and we&apos;ll do the rest.</p>
        </div>
        <RouterLink to="/circuits/new" class="primary">Create manually</RouterLink>
      </header>
      <div class="upload-grid">
        <div class="upload-inputs">
          <div class="stack">
            <div>
              <label for="circuit-file">Upload JSON file</label>
              <input id="circuit-file" type="file" accept="application/json,.json" @change="handleFile" />
            </div>
            <div>
              <label for="circuit-json">Paste JSON</label>
              <textarea
                id="circuit-json"
                v-model="upload.jsonText"
                placeholder="Paste a circuit JSON definition here"
                rows="8"
              ></textarea>
            </div>
          </div>
          <div class="inline upload-actions" style="justify-content: flex-end; gap: 0.75rem;">
            <button type="button" class="ghost" @click="resetUpload" :disabled="upload.loading">Clear</button>
            <button
              type="button"
              class="primary"
              @click="submitUpload"
              :disabled="upload.loading || !upload.jsonText.trim()"
            >
              {{ upload.loading ? 'Importing…' : 'Import circuits' }}
            </button>
          </div>
          <p v-if="upload.error" class="error">{{ upload.error }}</p>
          <p v-else-if="upload.status" class="success">{{ upload.status }}</p>
        </div>
        <div class="upload-schema">
          <h3>JSON schema</h3>
          <p class="muted">
            Provide either a single circuit object or an array of circuits matching this schema.
          </p>
          <pre>{{ schema }}</pre>
        </div>
      </div>
    </section>

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
import { ref, reactive, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import CircuitCard from '../components/CircuitCard.vue';
import { listCircuits, createCircuit } from '../api';

const circuits = ref([]);
const loading = ref(true);
const error = ref('');
const upload = reactive({
  jsonText: '',
  status: '',
  error: '',
  loading: false,
});

const schema = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Circuit",
  "type": "object",
  "required": ["name", "tasks"],
  "properties": {
    "name": { "type": "string", "minLength": 1, "description": "Human readable name" },
    "description": { "type": "string", "description": "Optional summary" },
    "tasks": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["name", "duration"],
        "properties": {
          "name": { "type": "string", "minLength": 1 },
          "description": { "type": "string" },
          "duration": { "type": "integer", "minimum": 1, "description": "Seconds" }
        }
      }
    }
  }
}`;

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

function resetUpload() {
  upload.jsonText = '';
  upload.status = '';
  upload.error = '';
}

function handleFile(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }
  upload.error = '';
  upload.status = '';
  const reader = new FileReader();
  reader.onload = () => {
    upload.jsonText = typeof reader.result === 'string' ? reader.result : '';
    upload.status = `Loaded ${file.name}`;
    event.target.value = '';
  };
  reader.onerror = () => {
    upload.error = 'Unable to read the selected file.';
    upload.status = '';
    event.target.value = '';
  };
  reader.readAsText(file);
}

async function submitUpload() {
  upload.error = '';
  upload.status = '';
  let parsed;
  try {
    parsed = JSON.parse(upload.jsonText);
  } catch (err) {
    upload.error = 'Invalid JSON. Please check your input and try again.';
    return;
  }

  const payloads = Array.isArray(parsed) ? parsed : [parsed];
  if (!payloads.length) {
    upload.error = 'Provide at least one circuit definition.';
    return;
  }

  const normalizedPayloads = payloads.map((item) => {
    if (!item || typeof item !== 'object') {
      return { name: '', description: '', tasks: [] };
    }

    const base = { ...item };
    delete base.id;
    delete base.tasks;
    const tasksInput = Array.isArray(item.tasks) ? item.tasks : [];
    const tasks = tasksInput.map((task) => {
      if (!task || typeof task !== 'object') {
        return { name: '', description: '', duration: Number.NaN };
      }
      const duration = Number(task.duration);
      return {
        name: typeof task.name === 'string' ? task.name : '',
        description: typeof task.description === 'string' ? task.description : '',
        duration,
      };
    });

    return {
      ...base,
      name: typeof item.name === 'string' ? item.name : '',
      description: typeof item.description === 'string' ? item.description : '',
      tasks,
    };
  });

  const invalid = normalizedPayloads.find(
    (item) =>
      !item.name ||
      item.tasks.length === 0 ||
      item.tasks.some((task) => !task.name || Number.isNaN(task.duration) || task.duration <= 0)
  );

  if (invalid) {
    upload.error = 'Each circuit must include a name and at least one task with a positive numeric duration.';
    return;
  }

  upload.loading = true;
  try {
    for (const payload of normalizedPayloads) {
      await createCircuit(payload);
    }
    upload.status = payloads.length === 1 ? 'Circuit imported successfully.' : `${payloads.length} circuits imported successfully.`;
    upload.jsonText = '';
    await loadCircuits();
  } catch (err) {
    upload.error = err instanceof Error ? err.message : 'Failed to import circuits.';
  } finally {
    upload.loading = false;
  }
}
</script>

<style scoped>
.upload-card {
  display: grid;
  gap: 1.5rem;
}

.upload-header {
  align-items: flex-start !important;
}

.upload-grid {
  display: grid;
  gap: clamp(1.5rem, 4vw, 2rem);
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.upload-inputs {
  display: grid;
  gap: 1rem;
}

.upload-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.upload-schema {
  display: grid;
  gap: 0.75rem;
  align-content: start;
}

.upload-schema h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.upload-schema .muted {
  margin: 0;
  font-size: 0.95rem;
}

.upload-schema pre {
  max-height: 320px;
}

@media (max-width: 640px) {
  .upload-actions {
    width: 100%;
  }

  .upload-actions button {
    flex: 1 1 auto;
  }
}
</style>
