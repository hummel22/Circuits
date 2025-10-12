<template>
  <div class="app-shell">
    <header class="app-header">
      <h1 class="app-title">Circuits</h1>
      <nav class="app-nav">
        <RouterLink to="/">Circuits</RouterLink>
        <RouterLink to="/circuits/new" class="primary">Create Circuit</RouterLink>
      </nav>
    </header>
    <main class="app-main">
      <RouterView />
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
  background: linear-gradient(180deg, #111827 0%, #1f2937 100%);
  color: #f9fafb;
}

.app-header {
  padding: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid rgba(249, 250, 251, 0.1);
}

.app-title {
  font-size: 2rem;
  font-weight: 700;
  margin: 0;
}

.app-nav {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.app-nav a {
  color: #d1d5db;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.2s ease;
}

.app-nav a:hover,
.app-nav a.router-link-active {
  color: #f9fafb;
}

.app-nav a.primary {
  background: #2563eb;
  color: #f9fafb;
  padding: 0.5rem 1rem;
  border-radius: 9999px;
  font-weight: 600;
}

.app-main {
  flex: 1 1 auto;
  padding: 2rem clamp(1rem, 5vw, 3rem);
}
</style>
