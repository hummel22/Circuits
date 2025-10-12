import { ref, computed, watch, useToast } from "../app.js";
import { http } from "../app.js";

const normalizeCircuit = (circuit) => ({
  ...circuit,
  tasks: (circuit.tasks || []).map((task) => ({
    name: task.name,
    description: task.description || "",
    duration: Number(task.duration) || 0,
  })),
});

const samplePayload = JSON.stringify(
  {
    name: "Morning focus",
    description: "A quick routine to start the day",
    tasks: [
      {
        name: "Warm up",
        description: "Gentle stretches",
        duration: 60,
      },
      {
        name: "Deep work",
        description: "Focused session",
        duration: 1500,
      },
    ],
  },
  null,
  2
);

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
    const addDialogVisible = ref(Boolean(props.payload));
    const saving = ref(false);
    const jsonInput = ref(
      props.payload && typeof props.payload === "string"
        ? props.payload
        : typeof props.payload === "object" && props.payload
        ? JSON.stringify(props.payload, null, 2)
        : samplePayload
    );
    const fileInput = ref(null);
    const selectedFileName = ref("");

    const stats = computed(() => {
      const totalCircuits = circuits.value.length;
      const totalSteps = circuits.value.reduce(
        (sum, item) => sum + (item.tasks ? item.tasks.length : 0),
        0
      );
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

    const validatePayload = (data) => {
      if (!data || typeof data !== "object") {
        showError("Circuit payload must be a JSON object.");
        return false;
      }
      if (!data.name || !data.name.trim()) {
        showError("Provide a circuit name in the JSON payload.");
        return false;
      }
      if (!Array.isArray(data.tasks) || !data.tasks.length) {
        showError("Add at least one task to the circuit.");
        return false;
      }
      for (const [index, task] of data.tasks.entries()) {
        if (!task || typeof task !== "object") {
          showError(`Task ${index + 1} must be an object.`);
          return false;
        }
        if (!task.name || !task.name.trim()) {
          showError(`Task ${index + 1} is missing a name.`);
          return false;
        }
        const duration = Number(task.duration);
        if (!Number.isFinite(duration) || duration <= 0) {
          showError(`Task ${index + 1} needs a duration greater than zero.`);
          return false;
        }
      }
      return true;
    };

    const resetDialog = () => {
      jsonInput.value = samplePayload;
      selectedFileName.value = "";
      if (fileInput.value) {
        fileInput.value.value = "";
      }
    };

    const closeAddDialog = () => {
      addDialogVisible.value = false;
      resetDialog();
    };

    const openAddDialog = () => {
      addDialogVisible.value = true;
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
        jsonInput.value = text;
        selectedFileName.value = file.name;
        addDialogVisible.value = true;
      } catch (error) {
        showError("Unable to read the selected file.");
      } finally {
        event.target.value = "";
      }
    };

    const navigate = (url) => {
      if (!url) {
        return;
      }
      window.location.assign(url);
    };

    const onRowClick = (event) => {
      if (event && event.data && event.data.id) {
        navigate(`/circuits/${event.data.id}`);
      }
    };

    const saveCircuit = async () => {
      if (!jsonInput.value || !jsonInput.value.trim()) {
        showError("Paste a JSON payload or upload a file before saving.");
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(jsonInput.value);
      } catch (error) {
        showError("The provided JSON is invalid.");
        return;
      }
      if (!validatePayload(parsed)) {
        return;
      }
      saving.value = true;
      try {
        const result = await http.request("/api/circuits", {
          method: "POST",
          body: JSON.stringify(parsed),
        });
        circuits.value = [normalizeCircuit(result), ...circuits.value];
        toast.add({
          severity: "success",
          summary: "Circuit saved",
          detail: `${result.name} is ready to run`,
          life: 3000,
        });
        addDialogVisible.value = false;
        resetDialog();
      } catch (error) {
        showError(error.message || "Unable to save circuit.");
      } finally {
        saving.value = false;
      }
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

    watch(
      () => props.payload,
      (value) => {
        if (!value) {
          return;
        }
        if (typeof value === "string") {
          jsonInput.value = value;
        } else {
          jsonInput.value = JSON.stringify(value, null, 2);
        }
        selectedFileName.value = "";
        addDialogVisible.value = true;
      }
    );

    return {
      circuits,
      stats,
      addDialogVisible,
      jsonInput,
      saving,
      fileInput,
      selectedFileName,
      openAddDialog,
      closeAddDialog,
      openFilePicker,
      handleFile,
      saveCircuit,
      navigate,
      formatSeconds,
      onRowClick,
    };
  },
  template: `
    <div class="surface-card">
      <Toast />
      <div class="flex flex-column md:flex-row md:align-items-center md:justify-content-between gap-3 mb-4">
        <div>
          <h1 class="app-section-title mb-1">Reusable training circuits</h1>
          <p class="text-600 m-0">Organize JSON definitions, upload files, and launch timers in one place.</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <Chip icon="pi pi-list" :label="stats.totalCircuits + ' circuits'" />
          <Chip icon="pi pi-clone" :label="stats.totalSteps + ' tasks'" />
          <Chip icon="pi pi-clock" :label="formatSeconds(stats.totalSeconds)" />
        </div>
      </div>

      <DataTable
        v-if="circuits.length"
        :value="circuits"
        responsiveLayout="stack"
        dataKey="id"
        class="shadow-2 border-round"
        rowHover
        @row-click="onRowClick"
      >
        <Column field="name" header="Circuit">
          <template #body="slotProps">
            <div class="flex align-items-start gap-3">
              <span class="pi pi-bolt text-primary text-xl"></span>
              <div>
                <a
                  class="font-medium block text-color"
                  :href="'/circuits/' + slotProps.data.id"
                  @click.stop.prevent="navigate('/circuits/' + slotProps.data.id)"
                >
                  {{ slotProps.data.name }}
                </a>
                <small class="text-600">{{ slotProps.data.description }}</small>
              </div>
            </div>
          </template>
        </Column>
        <Column header="Tasks" class="w-6rem text-center">
          <template #body="slotProps">
            <Tag :value="slotProps.data.tasks.length" severity="info" />
          </template>
        </Column>
        <Column header="Duration" class="w-8rem text-center">
          <template #body="slotProps">
            {{ formatSeconds(slotProps.data.tasks.reduce((total, task) => total + (Number(task.duration) || 0), 0)) }}
          </template>
        </Column>
        <Column header="Start" class="w-6rem text-center">
          <template #body="slotProps">
            <Button
              icon="pi pi-play"
              class="p-button-rounded p-button-text"
              @click.stop="navigate('/circuits/' + slotProps.data.id + '/run')"
              :aria-label="'Start ' + slotProps.data.name"
            />
          </template>
        </Column>
      </DataTable>
      <div v-else class="text-center py-6">
        <i class="pi pi-compass text-400 text-4xl mb-3"></i>
        <p class="text-600 mb-3">No circuits yet. Click the plus button to import one.</p>
        <Button label="Add a circuit" icon="pi pi-plus" @click="openAddDialog" />
      </div>

      <Dialog
        header="Add circuit"
        v-model:visible="addDialogVisible"
        :style="{ width: 'min(640px, 92vw)' }"
        modal
        dismissableMask
      >
        <p class="text-600 mb-3">Paste a circuit JSON payload or upload a .json file to populate the editor.</p>
        <Textarea v-model="jsonInput" rows="12" auto-resize spellcheck="false" class="w-full" />
        <div class="flex flex-column sm:flex-row sm:align-items-center sm:justify-content-between gap-2 mt-3">
          <div class="text-600">
            <span v-if="selectedFileName">Loaded from {{ selectedFileName }}</span>
            <span v-else>Upload a file to overwrite the JSON above.</span>
          </div>
          <div class="flex gap-2 align-items-center">
            <input
              type="file"
              ref="fileInput"
              accept="application/json"
              class="hidden"
              @change="handleFile"
            />
            <Button label="Upload JSON" icon="pi pi-upload" class="p-button-text" @click="openFilePicker" />
          </div>
        </div>
        <template #footer>
          <Button label="Cancel" class="p-button-text" @click="closeAddDialog" />
          <Button label="Save circuit" icon="pi pi-check" :loading="saving" @click="saveCircuit" />
        </template>
      </Dialog>

      <div class="fab-container">
        <Button icon="pi pi-plus" class="p-button-rounded p-button-lg fab-button" @click="openAddDialog" aria-label="Add circuit" />
      </div>
    </div>
  `,
};
