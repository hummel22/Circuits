<template>
  <form class="stack" @submit.prevent="handleSubmit">
    <section class="card">
      <h2 class="section-title">Circuit details</h2>
      <div class="form-grid">
        <div>
          <label for="circuit-name">Name</label>
          <input
            id="circuit-name"
            v-model="form.name"
            placeholder="Morning flow"
            required
          />
        </div>
        <div>
          <label for="circuit-description">Description</label>
          <textarea
            id="circuit-description"
            v-model="form.description"
            placeholder="A short summary of what this circuit is about"
          />
        </div>
      </div>
    </section>

    <section class="card">
      <header class="inline" style="justify-content: space-between; align-items: center;">
        <h2 class="section-title" style="margin: 0;">Tasks</h2>
        <button type="button" class="ghost" @click="addTask">Add task</button>
      </header>
      <div class="stack" v-if="form.tasks.length">
        <article
          v-for="(task, index) in form.tasks"
          :key="task.id"
          class="task-card"
        >
          <div class="form-grid">
            <div>
              <label :for="`task-name-${index}`">Task name</label>
              <input
                :id="`task-name-${index}`"
                v-model="task.name"
                placeholder="Warmup"
                required
              />
            </div>
            <div>
              <label :for="`task-duration-${index}`">Duration (seconds)</label>
              <input
                type="number"
                min="1"
                :id="`task-duration-${index}`"
                v-model.number="task.duration"
                required
              />
            </div>
            <div>
              <label :for="`task-description-${index}`">Description</label>
              <textarea
                :id="`task-description-${index}`"
                v-model="task.description"
                placeholder="Optional notes"
              />
            </div>
          </div>
          <div class="task-actions">
            <span class="badge">{{ task.duration }} sec</span>
            <button type="button" class="ghost" @click="removeTask(index)">Remove</button>
          </div>
        </article>
      </div>
      <p v-else class="empty-state">No tasks yet. Add your first task to build the circuit.</p>
    </section>

    <footer class="inline" style="justify-content: flex-end;">
      <button type="submit" class="primary">{{ submitLabel }}</button>
      <button v-if="showDelete" type="button" class="ghost" @click="onDelete">Delete</button>
    </footer>

    <p v-if="error" class="error">{{ error }}</p>
  </form>
</template>

<script setup>
import { reactive, watch, computed } from 'vue';

const emit = defineEmits(['submit', 'delete']);

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      name: '',
      description: '',
      tasks: [],
    }),
  },
  submitting: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  showDelete: {
    type: Boolean,
    default: false,
  }
});

const form = reactive({
  name: '',
  description: '',
  tasks: [],
});

watch(
  () => props.modelValue,
  (value) => {
    form.name = value?.name ?? '';
    form.description = value?.description ?? '';
    form.tasks = (value?.tasks ?? []).map((task, index) => ({
      id: `${index}-${task.name}`,
      name: task.name ?? '',
      description: task.description ?? '',
      duration: task.duration ?? 1,
    }));
    if (!form.tasks.length) {
      addTask();
    }
  },
  { immediate: true, deep: true }
);

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function addTask() {
  form.tasks.push({
    id: generateId(),
    name: '',
    description: '',
    duration: 60,
  });
}

function removeTask(index) {
  form.tasks.splice(index, 1);
  if (form.tasks.length === 0) {
    addTask();
  }
}

const submitLabel = computed(() => (props.submitting ? 'Saving…' : 'Save circuit'));

function handleSubmit() {
  const payload = {
    name: form.name.trim(),
    description: form.description.trim(),
    tasks: form.tasks.map((task) => ({
      name: task.name.trim(),
      description: task.description.trim(),
      duration: Number(task.duration) || 0,
    })),
  };
  emit('submit', payload);
}

function onDelete() {
  emit('delete');
}
</script>

<style scoped>
.error {
  color: #fca5a5;
  text-align: right;
}
</style>
