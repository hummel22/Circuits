import { bootstrapPrimeVueApp, http } from "./app.js";
import HomePage from "./pages/home.js";
import CircuitDetailPage from "./pages/detail.js";
import CircuitEditorPage from "./pages/editor.js";
import CircuitRunPage from "./pages/run.js";
import NotFoundPage from "./pages/not-found.js";

const resolvePayloadParam = (value) => {
  if (!value) {
    return "";
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const routes = [
  {
    name: "home",
    match: (pathname) => pathname === "/" || pathname === "",
    resolve: async (searchParams) => {
      const circuits = await http.request("/api/circuits");
      return {
        component: HomePage,
        props: {
          circuits,
          error: searchParams.get("error") || "",
          payload: resolvePayloadParam(searchParams.get("payload")),
        },
      };
    },
  },
  {
    name: "circuit-detail",
    match: (pathname) => /^\/circuits\/\d+\/?$/.test(pathname),
    resolve: async () => {
      const id = window.location.pathname.split("/")[2];
      const circuit = await http.request(`/api/circuits/${id}`);
      return {
        component: CircuitDetailPage,
        props: { circuit },
      };
    },
  },
  {
    name: "circuit-edit",
    match: (pathname) => /^\/circuits\/\d+\/edit\/?$/.test(pathname),
    resolve: async () => {
      const id = window.location.pathname.split("/")[2];
      const circuit = await http.request(`/api/circuits/${id}`);
      return {
        component: CircuitEditorPage,
        props: { circuit },
      };
    },
  },
  {
    name: "circuit-run",
    match: (pathname) => /^\/circuits\/\d+\/run\/?$/.test(pathname),
    resolve: async () => {
      const id = window.location.pathname.split("/")[2];
      const circuit = await http.request(`/api/circuits/${id}`);
      return {
        component: CircuitRunPage,
        props: { circuit },
      };
    },
  },
];

const loadApp = async () => {
  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);
  for (const route of routes) {
    if (route.match(pathname)) {
      try {
        const { component, props } = await route.resolve(searchParams);
        bootstrapPrimeVueApp("#app", component, props);
        return;
      } catch (error) {
        console.error("Failed to resolve route", error);
        bootstrapPrimeVueApp("#app", NotFoundPage, {
          title: "Circuit unavailable",
          message: error?.message || "We couldn't load this circuit.",
        });
        return;
      }
    }
  }
  bootstrapPrimeVueApp("#app", NotFoundPage, {
    title: "Page not found",
    message: `The page "${pathname}" does not exist.`,
  });
};

loadApp();
