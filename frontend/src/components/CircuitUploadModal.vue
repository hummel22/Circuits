<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="modal-backdrop"
      @click.self="handleClose"
    >
      <div class="modal-shell" role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <section class="card upload-card">
          <header class="inline upload-header">
            <div>
              <h2 id="upload-title" class="section-title" style="margin-bottom: 0.25rem;">Upload circuits</h2>
              <p class="muted">Import a single circuit or a collection using JSON.</p>
            </div>
            <button type="button" class="ghost" @click="handleClose">Close</button>
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
              <div class="inline upload-actions">
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
              <p class="muted">Provide either a single circuit object or an array of circuits matching this schema.</p>
              <pre>{{ schema }}</pre>
            </div>
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, watch, onMounted, onBeforeUnmount } from 'vue';
import { createCircuit } from '../api';

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['close', 'imported']);

const upload = reactive({
  jsonText: '',
  status: '',
  error: '',
  loading: false,
});

const schema = `{\n  "${'$'}schema": "https://json-schema.org/draft/2020-12/schema",\n  "title": "Circuit",\n  "type": "object",\n  "required": ["name", "tasks"],\n  "properties": {\n    "name": { "type": "string", "minLength": 1, "description": "Human readable name" },\n    "description": { "type": "string", "description": "Optional summary" },\n    "tasks": {\n      "type": "array",\n      "minItems": 1,\n      "items": {\n        "type": "object",\n        "required": ["name", "duration"],\n        "properties": {\n          "name": { "type": "string", "minLength": 1 },\n          "description": { "type": "string" },\n          "duration": { "type": "integer", "minimum": 1, "description": "Seconds" }\n        }\n      }\n    }\n  }\n}`;

function lockScroll(active) {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = active ? 'hidden' : '';
}

onMounted(() => {
  if (props.open) {
    lockScroll(true);
  }
});

onBeforeUnmount(() => {
  lockScroll(false);
});

watch(
  () => props.open,
  (value) => {
    lockScroll(value);
    if (!value) {
      resetUpload();
    }
  }
);

function handleClose() {
  emit('close');
}

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
    upload.status =
      payloads.length === 1
        ? 'Circuit imported successfully.'
        : `${payloads.length} circuits imported successfully.`;
    upload.jsonText = '';
    emit('imported', payloads.length);
  } catch (err) {
    upload.error = err instanceof Error ? err.message : 'Failed to import circuits.';
  } finally {
    upload.loading = false;
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  padding: 1.5rem;
  z-index: 1000;
}

.modal-shell {
  width: min(960px, 100%);
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
}

.upload-card {
  display: grid;
  gap: 1.5rem;
}

.upload-header {
  align-items: flex-start !important;
  justify-content: space-between;
}

.upload-grid {
  display: grid;
  gap: clamp(1.25rem, 4vw, 2rem);
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.upload-inputs {
  display: grid;
  gap: 1rem;
}

.upload-actions {
  justify-content: flex-end;
  gap: 0.75rem;
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

.upload-schema pre {
  max-height: 320px;
}

@media (max-width: 640px) {
  .modal-backdrop {
    padding: 1rem;
  }

  .upload-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .upload-actions button {
    flex: 1 1 auto;
  }
}
</style>
