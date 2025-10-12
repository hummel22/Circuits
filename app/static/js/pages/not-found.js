export default {
  name: "NotFoundPage",
  props: {
    title: {
      type: String,
      default: "Page not found",
    },
    message: {
      type: String,
      default: "The requested page could not be found.",
    },
  },
  methods: {
    goHome() {
      window.location.href = "/";
    },
  },
  template: `
    <div class="surface-card">
      <div class="text-center py-6">
        <i class="pi pi-compass text-400 text-5xl mb-3"></i>
        <h1 class="app-section-title mb-2">{{ title }}</h1>
        <p class="text-600 mb-4">{{ message }}</p>
        <Button label="Go home" icon="pi pi-home" @click="goHome" />
      </div>
    </div>
  `,
};
