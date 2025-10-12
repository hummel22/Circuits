import { reactive, ref, watch, useToast } from "../app.js";
import TaskEditor from "../components/task-editor.js";
import { http } from "../app.js";

const normalizeCircuit = (circuit) => ({
  ...circuit,
  name: circuit.name || "",
  description: circuit.description || "",
  tasks: (circuit.tasks || []).map((task) => ({
    name: task.name || "",
    description: task.description || "",
    duration: Number(task.duration) || 0,
  })),
});

export default {
  name: "CircuitEditorPage",
  components: {
    TaskEditor,
  },
  props: {
    circuit: {
      type: Object,
      required: true,
    },
    error: {
      type: String,
      default: "",
    },
  },
  setup(props) {
    const toast = useToast();
    const saving = ref(false);
    const form = reactive(normalizeCircuit(props.circuit));

    const showError = (message) => {
      toast.add({ severity: "error", summary: "Validation", detail: message, life: 3500 });
    };

    const validate = () => {
      if (!form.name.trim()) {
        showError("Give your circuit a name.");
        return false;
      }
      if (!Array.isArray(form.tasks) || !form.tasks.length) {
        showError("Add at least one step.");
        return false;
      }
      for (const [index, task] of form.tasks.entries()) {
        if (!task.name.trim()) {
          showError(`Step ${index + 1} is missing a name.`);
          return false;
        }
        if (!Number.isFinite(Number(task.duration)) || Number(task.duration) <= 0) {
          showError(`Step ${index + 1} needs a positive duration.`);
          return false;
        }
      }
      return true;
    };

    const submit = async () => {
      if (!validate()) {
        return;
      }
      saving.value = true;
      try {
        await http.request(`/api/circuits/${form.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim(),
            tasks: form.tasks.map((task) => ({
              name: task.name.trim(),
              description: task.description.trim(),
              duration: Number(task.duration) || 0,
            })),
          }),
        });
        toast.add({ severity: "success", summary: "Saved", detail: "Circuit updated", life: 2500 });
        setTimeout(() => {
          window.location.href = `/circuits/${form.id}`;
        }, 600);
      } catch (error) {
        showError(error.message || "Unable to save circuit");
      } finally {
        saving.value = false;
      }
    };

    const cancel = () => {
      window.location.href = `/circuits/${form.id}`;
    };

    if (props.error) {
      showError(props.error);
    }

    watch(
      () => props.circuit,
      (value) => {
        if (value) {
          Object.assign(form, normalizeCircuit(value));
        }
      }
    );

    return {
      form,
      saving,
      submit,
      cancel,
    };
  },
  template: `
    <div class="surface-card">
      <Toast />
      <div class="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-3 mb-4">
        <div>
          <h1 class="app-section-title mb-2">Edit circuit</h1>
          <p class="text-600 m-0">Update steps and descriptions, changes save to SQLite instantly.</p>
        </div>
        <Button label="Back" icon="pi pi-arrow-left" class="p-button-text" @click="cancel" />
      </div>

      <div class="p-fluid grid formgrid">
        <div class="field col-12">
          <label for="circuit-name">Name</label>
          <InputText id="circuit-name" v-model="form.name" autofocus />
        </div>
        <div class="field col-12">
          <label for="circuit-description">Description</label>
          <Textarea id="circuit-description" v-model="form.description" rows="3" auto-resize />
        </div>
      </div>

      <TaskEditor v-model="form.tasks" />

      <div class="flex justify-content-end gap-2 mt-4">
        <Button label="Cancel" class="p-button-text" @click="cancel" />
        <Button label="Save changes" icon="pi pi-check" :loading="saving" @click="submit" />
      </div>
    </div>
  `,
};
