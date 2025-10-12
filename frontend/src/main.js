import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/main.css';

const app = createApp(App);
app.use(router);
app.mount('#app');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      const scopePrefix = `${window.location.origin}/`;
      registrations
        .filter((registration) => registration.scope.startsWith(scopePrefix))
        .forEach((registration) => {
          registration.unregister().catch(() => {
            /* ignore */
          });
        });
    })
    .catch(() => {
      /* ignore */
    });

  if (window.caches?.keys) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {
        /* ignore */
      });
  }
}
