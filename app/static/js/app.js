import {
  createApp,
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "vue";
import PrimeVue from "primevue/config";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import Textarea from "primevue/textarea";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Toast from "primevue/toast";
import ConfirmDialog from "primevue/confirmdialog";
import ToastService from "primevue/toastservice";
import ConfirmationService from "primevue/confirmationservice";
import Ripple from "primevue/ripple";
import InputNumber from "primevue/inputnumber";
import Divider from "primevue/divider";
import Checkbox from "primevue/checkbox";
import Dropdown from "primevue/dropdown";
import ProgressBar from "primevue/progressbar";
import { useToast } from "primevue/usetoast";
import { useConfirm } from "primevue/useconfirm";

const registerComponents = (app) => {
  app.component("Button", Button);
  app.component("Dialog", Dialog);
  app.component("InputText", InputText);
  app.component("Textarea", Textarea);
  app.component("DataTable", DataTable);
  app.component("Column", Column);
  app.component("Toast", Toast);
  app.component("ConfirmDialog", ConfirmDialog);
  app.component("InputNumber", InputNumber);
  app.component("Divider", Divider);
  app.component("Checkbox", Checkbox);
  app.component("Dropdown", Dropdown);
  app.component("ProgressBar", ProgressBar);
};

export {
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  useToast,
  useConfirm,
};

export const http = {
  async request(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!headers["Content-Type"] && options.body !== undefined && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, {
      ...options,
      headers,
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text || response.statusText;
      try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed === "object" && parsed.detail) {
          message = parsed.detail;
        }
      } catch (error) {
        // Swallow JSON parse errors; fallback to text message.
      }
      throw new Error(message || response.statusText);
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json();
    }
    return null;
  },
};

export function bootstrapPrimeVueApp(rootSelector, rootComponent, props = {}) {
  const app = createApp(rootComponent, props);
  app.use(PrimeVue, { ripple: true });
  app.use(ToastService);
  app.use(ConfirmationService);
  registerComponents(app);
  app.directive("ripple", Ripple);
  app.mount(rootSelector);
  return app;
}
