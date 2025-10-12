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
  background: radial-gradient(circle at top, #1e293b 0%, #0f172a 45%, #020617 100%);
  color: #f8fafc;
}

.app-header {
  padding: clamp(1.25rem, 2.5vw, 2rem) clamp(1.25rem, 4vw, 3rem);
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(24px);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow: 0 12px 24px -18px rgba(15, 23, 42, 0.7);
}

.brand {
  display: grid;
  gap: 0.35rem;
}

.app-title {
  font-size: clamp(1.75rem, 4vw, 2.5rem);
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.03em;
}

.subtitle {
  margin: 0;
  color: rgba(226, 232, 240, 0.72);
  font-weight: 500;
  font-size: 0.95rem;
}

.app-nav {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  border-radius: 999px;
  padding: 0.25rem;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.app-nav a {
  color: rgba(226, 232, 240, 0.85);
  text-decoration: none;
  font-weight: 600;
  padding: 0.35rem 1rem;
  border-radius: 999px;
  transition: all 0.2s ease;
}

.app-nav a:hover,
.app-nav a.router-link-active {
  background: rgba(148, 163, 184, 0.12);
  color: #f8fafc;
}

.app-nav a.primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #f8fafc;
  box-shadow: 0 8px 16px -12px rgba(37, 99, 235, 0.8);
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
