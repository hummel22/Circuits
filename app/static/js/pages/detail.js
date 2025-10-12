import { ref, computed, useToast, useConfirm } from "../app.js";
import { http } from "../app.js";

const normalizeCircuit = (circuit) => ({
  ...circuit,
  tasks: (circuit.tasks || []).map((task) => ({
    name: task.name,
    description: task.description || "",
    duration: Number(task.duration) || 0,
  })),
});

const toJson = (circuit) => JSON.stringify({
  name: circuit.name,
  description: circuit.description,
  tasks: circuit.tasks.map((task) => ({
    name: task.name,
    description: task.description,
    duration: task.duration,
  })),
}, null, 2);

const formatSeconds = (value) => {
  const total = Number(value) || 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  const minLabel = minutes ? `${minutes}m` : "";
  const secLabel = seconds ? `${seconds}s` : minutes ? "" : "0s";
  return `${minLabel}${minLabel && secLabel ? " " : ""}${secLabel}`.trim();
};

export default {
  name: "CircuitDetailPage",
  props: {
    circuit: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const toast = useToast();
    const confirm = useConfirm();
    const circuit = ref(normalizeCircuit(props.circuit));

    const totalDuration = computed(() =>
      circuit.value.tasks.reduce((sum, task) => sum + (Number(task.duration) || 0), 0)
    );

    const copyJson = async () => {
      try {
        await navigator.clipboard.writeText(toJson(circuit.value));
        toast.add({ severity: "success", summary: "Copied", detail: "Circuit JSON copied", life: 2500 });
      } catch (error) {
        toast.add({ severity: "warn", summary: "Clipboard", detail: "Unable to copy JSON", life: 2500 });
      }
    };

    const downloadJson = () => {
      const blob = new Blob([toJson(circuit.value)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${circuit.value.name || "circuit"}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    const deleteCircuit = () => {
      confirm.require({
        message: "Delete this circuit? This action cannot be undone.",
        header: "Delete circuit",
        icon: "pi pi-exclamation-triangle",
        acceptLabel: "Delete",
        rejectLabel: "Cancel",
        acceptClass: "p-button-danger",
        accept: async () => {
          try {
            await http.request(`/api/circuits/${circuit.value.id}`, { method: "DELETE" });
            toast.add({ severity: "info", summary: "Deleted", detail: "Circuit removed", life: 2000 });
            setTimeout(() => {
              window.location.href = "/";
            }, 400);
          } catch (error) {
            toast.add({ severity: "error", summary: "Error", detail: error.message || "Unable to delete", life: 3000 });
          }
        },
      });
    };

    const goTo = (path) => {
      window.location.href = path;
    };

    return {
      circuit,
      totalDuration,
      copyJson,
      downloadJson,
      deleteCircuit,
      goTo,
      formatSeconds,
    };
  },
  template: `
    <div class="surface-card">
      <Toast />
      <ConfirmDialog />
      <div class="flex flex-column md:flex-row md:justify-content-between md:align-items-center gap-3 mb-4">
        <div>
          <h1 class="app-section-title mb-2">{{ circuit.name }}</h1>
          <p class="text-600 mb-0">{{ circuit.description || 'No description provided.' }}</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <Button label="Run" icon="pi pi-play" @click="goTo(`/circuits/${circuit.id}/run`)" />
          <Button label="Edit" icon="pi pi-pencil" class="p-button-outlined" @click="goTo(`/circuits/${circuit.id}/edit`)" />
          <Button label="Delete" icon="pi pi-trash" class="p-button-text p-button-danger" @click="deleteCircuit" />
        </div>
      </div>

      <div class="flex gap-2 flex-wrap mb-3">
        <Chip icon="pi pi-clone" :label="circuit.tasks.length + ' steps'" />
        <Chip icon="pi pi-clock" :label="formatSeconds(totalDuration)" />
      </div>

      <DataTable :value="circuit.tasks" responsiveLayout="stack" dataKey="name" class="shadow-2 border-round">
        <Column field="name" header="Step">
          <template #body="slotProps">
            <div class="font-medium">{{ slotProps.data.name }}</div>
            <small class="text-600">{{ slotProps.data.description }}</small>
          </template>
        </Column>
        <Column header="Duration" class="w-8rem text-center">
          <template #body="slotProps">
            {{ formatSeconds(slotProps.data.duration) }}
          </template>
        </Column>
      </DataTable>

      <div class="flex flex-column sm:flex-row gap-2 justify-content-between align-items-center mt-4">
        <div class="text-600">Export or share this circuit</div>
        <div class="flex gap-2">
          <Button label="Copy JSON" icon="pi pi-copy" class="p-button-text" @click="copyJson" />
          <Button label="Download" icon="pi pi-download" class="p-button-text" @click="downloadJson" />
        </div>
      </div>
    </div>
  `,
};
