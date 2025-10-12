<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <h1 class="app-title">Circuits</h1>
        <p class="subtitle">Design, manage, and launch timeboxed flows.</p>
      </div>
      <nav class="app-nav">
        <RouterLink to="/">Circuits</RouterLink>
        <RouterLink to="/circuits/new" class="primary">Create Circuit</RouterLink>
        <RouterLink
          v-if="showCircuitLink"
          :to="circuitLinkTarget"
          class="circuit-pill"
        >
          <span class="pill-label" :title="circuitNavTitle">{{ circuitNavTitle }}</span>
        </RouterLink>
        <span v-else-if="showCircuitPlaceholder" class="circuit-pill pill-placeholder">Loading…</span>
      </nav>
    </header>
    <main class="app-main">
      <div class="app-container">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { useCircuitTitle } from './composables/useCircuitTitle';

const route = useRoute();
const { currentCircuitTitle, currentCircuitId } = useCircuitTitle();

const isCircuitContext = computed(() =>
  route.name === 'circuit-detail' || route.name === 'circuit-run'
);

const circuitNavTitle = computed(() => currentCircuitTitle.value);

const showCircuitLink = computed(
  () => isCircuitContext.value && Boolean(currentCircuitTitle.value)
);

const showCircuitPlaceholder = computed(
  () =>
    isCircuitContext.value &&
    !currentCircuitTitle.value &&
    typeof route.params.id === 'string'
);

const circuitLinkTarget = computed(() => {
  if (!isCircuitContext.value || !currentCircuitId.value) {
    return { name: 'circuits' };
  }
  if (route.name === 'circuit-run') {
    return { name: 'circuit-run', params: { id: currentCircuitId.value } };
  }
  return { name: 'circuit-detail', params: { id: currentCircuitId.value } };
});
</script>

<style scoped>
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 40%, #f8fafc 100%);
  color: #0f172a;
}

.app-header {
  padding: clamp(1.5rem, 3vw, 2.5rem) clamp(1.25rem, 4vw, 3rem);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.25);
  box-shadow: 0 16px 32px -28px rgba(15, 23, 42, 0.35);
}

.brand {
  display: grid;
  gap: 0.35rem;
}

.app-title {
  font-size: clamp(1.75rem, 4vw, 2.6rem);
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.03em;
  color: #312e81;
}

.subtitle {
  margin: 0;
  color: rgba(71, 85, 105, 0.85);
  font-weight: 500;
  font-size: 0.95rem;
}

.app-nav { 
  display: flex;
  gap: 0.75rem;
  align-items: center;
  border-radius: 999px;
  padding: 0.35rem;
  background: rgba(226, 232, 240, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.35);
}

.app-nav a {
  color: #475569;
  text-decoration: none;
  font-weight: 600;
  padding: 0.45rem 1.15rem;
  border-radius: 999px;
  transition: all 0.2s ease;
}

.app-nav a:hover,
.app-nav a.router-link-active:not(.primary) {
  background: rgba(255, 255, 255, 0.9);
  color: #312e81;
  box-shadow: 0 6px 16px -12px rgba(79, 70, 229, 0.4);
}

.app-nav a.primary {
  background: linear-gradient(135deg, #7c3aed, #0d9488);
  color: #ffffff;
  box-shadow: 0 12px 24px -18px rgba(124, 58, 237, 0.65);
}

.app-nav .circuit-pill {
  max-width: 18rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  padding: 0.45rem 1.15rem;
  font-weight: 600;
  color: #312e81;
  background: rgba(124, 58, 237, 0.15);
  border: 1px solid rgba(124, 58, 237, 0.3);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.25);
}

.app-nav .circuit-pill .pill-label {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-nav .circuit-pill:hover {
  text-decoration: none;
  background: rgba(124, 58, 237, 0.22);
  border-color: rgba(124, 58, 237, 0.45);
}

.app-nav .pill-placeholder {
  cursor: default;
  color: rgba(49, 46, 129, 0.65);
  background: rgba(124, 58, 237, 0.1);
  border-style: dashed;
}

.app-main {
  flex: 1 1 auto;
  padding: clamp(2rem, 5vw, 3.5rem) clamp(1.25rem, 5vw, 3rem) 4rem;
  display: flex;
  justify-content: center;
}

.app-container {
  width: min(1100px, 100%);
}

@media (max-width: 640px) {
  .app-nav {
    width: 100%;
    justify-content: space-between;
  }

  .app-nav a {
    flex: 1 1 auto;
    text-align: center;
  }
}
</style>
