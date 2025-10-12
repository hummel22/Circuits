import { ref, reactive, computed, watch, useToast } from "../app.js";
import TaskEditor from "../components/task-editor.js";
import { http } from "../app.js";

const defaultCircuit = () => ({
  name: "",
  description: "",
  tasks: [
    {
      name: "Warm up",
      description: "Get ready",
      duration: 60,
    },
  ],
});

const normalizeCircuit = (circuit) => ({
  ...circuit,
  tasks: (circuit.tasks || []).map((task) => ({
    name: task.name,
    description: task.description || "",
    duration: Number(task.duration) || 0,
  })),
});

const parseInitialPayload = (raw) => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === "object") {
      return {
        name: parsed.name || "",
        description: parsed.description || "",
        tasks: Array.isArray(parsed.tasks) && parsed.tasks.length ? parsed.tasks : defaultCircuit().tasks,
      };
    }
  } catch (error) {
    console.warn("Unable to parse initial payload", error);
  }
  return null;
};

const formatSeconds = (value) => {
  const total = Number(value) || 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const minLabel = minutes ? `${minutes}m` : "";
  const secLabel = seconds ? `${seconds}s` : minutes ? "" : "0s";
  return `${minLabel}${minLabel && secLabel ? " " : ""}${secLabel}`.trim();
};

export default {
  name: "HomePage",
  components: {
    TaskEditor,
  },
  props: {
    circuits: {
      type: Array,
      default: () => [],
    },
    error: {
      type: String,
      default: "",
    },
    payload: {
      type: [String, Object],
      default: "",
    },
  },
  setup(props) {
    const toast = useToast();
    const circuits = ref((props.circuits || []).map(normalizeCircuit));
    const createDialogVisible = ref(false);
    const importDialogVisible = ref(false);
    const saving = ref(false);
    const importText = ref(typeof props.payload === "string" ? props.payload : "");
    const form = reactive(parseInitialPayload(props.payload) || defaultCircuit());
    const fileInput = ref(null);

    const stats = computed(() => {
      const totalCircuits = circuits.value.length;
      const totalSteps = circuits.value.reduce((sum, item) => sum + (item.tasks ? item.tasks.length : 0), 0);
      const totalSeconds = circuits.value.reduce(
        (sum, item) =>
          sum + (item.tasks || []).reduce((acc, task) => acc + (Number(task.duration) || 0), 0),
        0
      );
      return {
        totalCircuits,
        totalSteps,
        totalSeconds,
      };
    });

    const showError = (message) => {
      toast.add({ severity: "error", summary: "Validation", detail: message, life: 4000 });
    };

    const validateCircuit = (data) => {
      if (!data.name || !data.name.trim()) {
        showError("Please provide a name for the circuit.");
        return false;
      }
      if (!Array.isArray(data.tasks) || !data.tasks.length) {
        showError("Add at least one step to the circuit.");
        return false;
      }
      for (const [index, task] of data.tasks.entries()) {
        if (!task.name || !task.name.trim()) {
          showError(`Step ${index + 1} is missing a name.`);
          return false;
        }
        const duration = Number(task.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
          showError(`Step ${index + 1} needs a duration greater than zero.`);
          return false;
        }
      }
      return true;
    };

    const resetForm = () => {
      const template = defaultCircuit();
      form.name = template.name;
      form.description = template.description;
      form.tasks = template.tasks.map((task) => ({ ...task }));
    };

    const submitPayload = async (payload) => {
      if (!validateCircuit(payload)) {
        return;
      }
      saving.value = true;
      try {
        const result = await http.request("/api/circuits", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        circuits.value = [normalizeCircuit(result), ...circuits.value];
        toast.add({
          severity: "success",
          summary: "Circuit saved",
          detail: `${result.name} is ready to run`,
          life: 3000,
        });
        createDialogVisible.value = false;
        importDialogVisible.value = false;
        importText.value = "";
        resetForm();
      } catch (error) {
        showError(error.message || "Unable to save circuit");
      } finally {
        saving.value = false;
      }
    };

    const submitCreate = () => {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        tasks: form.tasks.map((task) => ({
          name: task.name.trim(),
          description: task.description.trim(),
          duration: Number(task.duration) || 0,
        })),
      };
      submitPayload(payload);
    };

    const submitImport = () => {
      if (!importText.value) {
        showError("Paste a JSON payload to import.");
        return;
      }
      try {
        const parsed = JSON.parse(importText.value);
        submitPayload({
          name: parsed.name || "",
          description: parsed.description || "",
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        });
      } catch (error) {
        showError("The provided JSON is invalid.");
      }
    };

    const openCreate = () => {
      createDialogVisible.value = true;
    };

    const openImport = () => {
      importDialogVisible.value = true;
    };

    const openFilePicker = () => {
      if (fileInput.value) {
        fileInput.value.click();
      }
    };

    const handleFile = async (event) => {
      const files = event.target.files || [];
      const file = files[0];
      if (!file) {
        return;
      }
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        await submitPayload({
          name: parsed.name || "",
          description: parsed.description || "",
          tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        });
      } catch (error) {
        showError("Unable to import the selected file.");
      } finally {
        event.target.value = "";
      }
    };

    const navigate = (url) => {
      window.location.href = url;
    };

    if (props.error) {
      showError(props.error);
    }

    watch(
      () => props.circuits,
      (value) => {
        if (value) {
          circuits.value = value.map(normalizeCircuit);
        }
      }
    );

    return {
      circuits,
      stats,
      createDialogVisible,
      importDialogVisible,
      form,
      saving,
      importText,
      openCreate,
      openImport,
      openFilePicker,
      handleFile,
      submitCreate,
      submitImport,
      navigate,
      formatSeconds,
      fileInput,
    };
  },
  template: `
    <div class="surface-card">
      <Toast />
      <ConfirmDialog />
      <div class="flex flex-column md:flex-row md:align-items-center md:justify-content-between gap-3 mb-4">
        <div>
          <h1 class="app-section-title mb-1">Reusable training circuits</h1>
          <p class="text-600 m-0">Organize your routines, share JSON definitions, and run beautiful timers.</p>
        </div>
        <div class="flex gap-2">
          <Button label="Import JSON" icon="pi pi-upload" class="p-button-outlined" @click="openImport" />
          <Button label="New circuit" icon="pi pi-plus" @click="openCreate" />
        </div>
      </div>

      <div class="flex gap-2 flex-wrap mb-4">
        <Chip icon="pi pi-list" :label="stats.totalCircuits + ' circuits'" />
        <Chip icon="pi pi-clone" :label="stats.totalSteps + ' steps'" />
        <Chip icon="pi pi-clock" :label="formatSeconds(stats.totalSeconds)" />
      </div>

      <DataTable
        v-if="circuits.length"
        :value="circuits"
        responsiveLayout="stack"
        dataKey="id"
        class="shadow-2 border-round"
      >
        <Column field="name" header="Circuit">
          <template #body="slotProps">
            <div class="flex align-items-start gap-3">
              <span class="pi pi-bolt text-primary text-xl"></span>
              <div>
                <div class="font-medium">{{ slotProps.data.name }}</div>
                <small class="text-600">{{ slotProps.data.description }}</small>
              </div>
            </div>
          </template>
        </Column>
        <Column header="Steps" class="w-6rem text-center">
          <template #body="slotProps">
            <Tag :value="slotProps.data.tasks.length" severity="info" />
          </template>
        </Column>
        <Column header="Duration" class="w-6rem text-center">
          <template #body="slotProps">
            {{ formatSeconds(slotProps.data.tasks.reduce((total, task) => total + (Number(task.duration) || 0), 0)) }}
          </template>
        </Column>
        <Column header="Actions" class="text-right">
          <template #body="slotProps">
            <div class="flex gap-2 justify-content-end">
              <Button
                label="Run"
                icon="pi pi-play"
                class="p-button-sm p-button-rounded p-button-text"
                @click="navigate(`/circuits/${slotProps.data.id}/run`)"
              />
              <Button
                label="Open"
                icon="pi pi-external-link"
                class="p-button-sm"
                @click="navigate(`/circuits/${slotProps.data.id}`)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
      <div v-else class="text-center py-6">
        <i class="pi pi-compass text-400 text-4xl mb-3"></i>
        <p class="text-600 mb-4">No circuits yet. Create or import one to get started.</p>
        <Button label="Create your first circuit" icon="pi pi-plus" @click="openCreate" />
      </div>

      <Dialog
        header="New circuit"
        v-model:visible="createDialogVisible"
        :style="{ width: 'min(640px, 92vw)' }"
        modal
        dismissableMask
      >
        <div class="p-fluid grid formgrid">
          <div class="field col-12">
            <label for="circuit-name">Name</label>
            <InputText id="circuit-name" v-model="form.name" placeholder="Morning focus" autofocus />
          </div>
          <div class="field col-12">
            <label for="circuit-description">Description</label>
            <Textarea id="circuit-description" v-model="form.description" rows="3" auto-resize placeholder="Describe the circuit" />
          </div>
        </div>
        <TaskEditor v-model="form.tasks" />
        <template #footer>
          <Button label="Cancel" class="p-button-text" @click="createDialogVisible = false" />
          <Button label="Save" icon="pi pi-check" :loading="saving" @click="submitCreate" />
        </template>
      </Dialog>

      <Dialog
        header="Import circuit JSON"
        v-model:visible="importDialogVisible"
        :style="{ width: 'min(520px, 90vw)' }"
        modal
        dismissableMask
      >
        <p class="text-600 mb-3">Paste a JSON definition that matches the circuit schema.</p>
        <Textarea v-model="importText" rows="8" auto-resize placeholder='{"name": "Flow", "tasks": [{"name": "Stretch", "duration": 120}]}' />
        <input
          type="file"
          ref="fileInput"
          accept="application/json"
          class="hidden"
          @change="handleFile"
        />
        <div class="flex justify-content-between align-items-center mt-3">
          <span class="text-600">Or choose a JSON file to import</span>
          <Button label="Browse" icon="pi pi-file" class="p-button-text" @click="openFilePicker" />
        </div>
        <template #footer>
          <Button label="Cancel" class="p-button-text" @click="importDialogVisible = false" />
          <Button label="Import" icon="pi pi-download" :loading="saving" @click="submitImport" />
        </template>
      </Dialog>
    </div>
  `,
};
