import { createRouter, createWebHistory } from 'vue-router';
import CircuitListView from '../views/CircuitListView.vue';
import CircuitDetailView from '../views/CircuitDetailView.vue';
import CircuitRunView from '../views/CircuitRunView.vue';
import CircuitCreateView from '../views/CircuitCreateView.vue';
import RunCalendarView from '../views/RunCalendarView.vue';

const routes = [
  {
    path: '/',
    name: 'circuits',
    component: CircuitListView,
  },
  {
    path: '/circuits/new',
    name: 'circuit-new',
    component: CircuitCreateView,
  },
  {
    path: '/circuits/:id',
    name: 'circuit-detail',
    component: CircuitDetailView,
    props: true,
  },
  {
    path: '/circuits/:id/run',
    name: 'circuit-run',
    component: CircuitRunView,
    props: true,
  },
  {
    path: '/calendar',
    name: 'calendar',
    component: RunCalendarView,
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  }
});

export default router;
