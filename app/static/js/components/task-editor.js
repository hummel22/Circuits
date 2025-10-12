import { ref, watch } from "../app.js";

let uidCounter = 0;
const nextUid = () => {
  uidCounter += 1;
  return `task-${Date.now()}-${uidCounter}`;
};

const normalizeTask = (task = {}) => ({
  uid: task.uid || nextUid(),
  name: task.name || "",
  description: task.description || "",
  duration: Number.isFinite(Number(task.duration)) && Number(task.duration) > 0 ? Number(task.duration) : 60,
});

export default {
  name: "TaskEditor",
  props: {
    modelValue: {
      type: Array,
      default: () => [],
    },
  },
  emits: ["update:modelValue"],
  setup(props, { emit }) {
    const tasks = ref((props.modelValue && props.modelValue.length ? props.modelValue : [normalizeTask()]).map(normalizeTask));

    watch(
      () => props.modelValue,
      (value) => {
        if (!value) {
          tasks.value = [normalizeTask()];
          return;
        }
        tasks.value = value.map(normalizeTask);
      },
      { deep: true }
    );

    watch(
      tasks,
      (value) => {
        emit(
          "update:modelValue",
          value.map((task) => ({
            name: task.name,
            description: task.description,
            duration: Number(task.duration) || 60,
          }))
        );
      },
      { deep: true }
    );

    const addTask = () => {
      tasks.value = [...tasks.value, normalizeTask()];
    };

    const removeTask = (index) => {
      if (tasks.value.length <= 1) {
        return;
      }
      tasks.value = tasks.value.filter((_, idx) => idx !== index);
    };

    return {
      tasks,
      addTask,
      removeTask,
    };
  },
  template: `
    <div class="task-editor">
      <div
        v-for="(task, index) in tasks"
        :key="task.uid"
        class="task-editor__task"
      >
        <div class="task-editor__task-header">
          <span class="font-medium">Step {{ index + 1 }}</span>
          <Button
            v-if="tasks.length > 1"
            icon="pi pi-times"
            class="p-button-rounded p-button-text p-button-danger"
            @click="removeTask(index)"
            aria-label="Remove step"
          />
        </div>
        <div class="p-fluid grid formgrid">
          <div class="field col-12">
            <label :for="`task-name-${index}`">Name</label>
            <InputText :id="`task-name-${index}`" v-model="task.name" placeholder="Warm up" />
          </div>
          <div class="field col-12">
            <label :for="`task-desc-${index}`">Description</label>
            <Textarea :id="`task-desc-${index}`" v-model="task.description" rows="2" auto-resize placeholder="Describe the step" />
          </div>
          <div class="field col-12 md:col-6">
            <label :for="`task-duration-${index}`">Duration (seconds)</label>
            <InputNumber
              :id="`task-duration-${index}`"
              v-model="task.duration"
              :min="1"
              showButtons
              suffix=" s"
              buttonLayout="horizontal"
              decrementButtonClass="p-button-text"
              incrementButtonClass="p-button-text"
            />
          </div>
        </div>
      </div>
      <div class="task-editor__actions">
        <Button label="Add step" icon="pi pi-plus" class="p-button-sm" @click="addTask" />
      </div>
    </div>
  `,
};
