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
import { RouterLink, RouterView } from 'vue-router';
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
