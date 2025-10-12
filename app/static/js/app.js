import {
  createApp,
  ref,
  reactive,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
} from "https://unpkg.com/vue@3/dist/vue.esm-browser.js";
import PrimeVue from "https://unpkg.com/primevue@3.52.0/config/config.esm.js";
import Button from "https://unpkg.com/primevue@3.52.0/button/button.esm.js";
import Card from "https://unpkg.com/primevue@3.52.0/card/card.esm.js";
import Dialog from "https://unpkg.com/primevue@3.52.0/dialog/dialog.esm.js";
import InputText from "https://unpkg.com/primevue@3.52.0/inputtext/inputtext.esm.js";
import Textarea from "https://unpkg.com/primevue@3.52.0/textarea/textarea.esm.js";
import DataTable from "https://unpkg.com/primevue@3.52.0/datatable/datatable.esm.js";
import Column from "https://unpkg.com/primevue@3.52.0/column/column.esm.js";
import Toolbar from "https://unpkg.com/primevue@3.52.0/toolbar/toolbar.esm.js";
import Tag from "https://unpkg.com/primevue@3.52.0/tag/tag.esm.js";
import Toast from "https://unpkg.com/primevue@3.52.0/toast/toast.esm.js";
import ConfirmDialog from "https://unpkg.com/primevue@3.52.0/confirmdialog/confirmdialog.esm.js";
import ToastService from "https://unpkg.com/primevue@3.52.0/toastservice/toastservice.esm.js";
import ConfirmationService from "https://unpkg.com/primevue@3.52.0/confirmationservice/confirmationservice.esm.js";
import Ripple from "https://unpkg.com/primevue@3.52.0/ripple/ripple.esm.js";
import InputNumber from "https://unpkg.com/primevue@3.52.0/inputnumber/inputnumber.esm.js";
import Divider from "https://unpkg.com/primevue@3.52.0/divider/divider.esm.js";
import Checkbox from "https://unpkg.com/primevue@3.52.0/checkbox/checkbox.esm.js";
import Dropdown from "https://unpkg.com/primevue@3.52.0/dropdown/dropdown.esm.js";
import ProgressBar from "https://unpkg.com/primevue@3.52.0/progressbar/progressbar.esm.js";
import Chip from "https://unpkg.com/primevue@3.52.0/chip/chip.esm.js";
import { useToast } from "https://unpkg.com/primevue@3.52.0/usetoast/usetoast.esm.js";
import { useConfirm } from "https://unpkg.com/primevue@3.52.0/useconfirm/useconfirm.esm.js";

const registerComponents = (app) => {
  app.component("Button", Button);
  app.component("Card", Card);
  app.component("Dialog", Dialog);
  app.component("InputText", InputText);
  app.component("Textarea", Textarea);
  app.component("DataTable", DataTable);
  app.component("Column", Column);
  app.component("Toolbar", Toolbar);
  app.component("Tag", Tag);
  app.component("Toast", Toast);
  app.component("ConfirmDialog", ConfirmDialog);
  app.component("InputNumber", InputNumber);
  app.component("Divider", Divider);
  app.component("Checkbox", Checkbox);
  app.component("Dropdown", Dropdown);
  app.component("ProgressBar", ProgressBar);
  app.component("Chip", Chip);
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
