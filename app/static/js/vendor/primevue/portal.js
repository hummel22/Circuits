import { defineComponent, h, Teleport } from "vue";

const isHTMLElement = (value) => {
  if (typeof HTMLElement === "undefined") {
    return false;
  }

  return value instanceof HTMLElement;
};

const resolveTarget = (appendTo) => {
  if (!appendTo || appendTo === "body") {
    return typeof document !== "undefined" ? document.body : null;
  }

  if (appendTo === "self") {
    return "self";
  }

  if (typeof appendTo === "string") {
    if (typeof document === "undefined") {
      return null;
    }
    const node = document.querySelector(appendTo);
    return node || document.body;
  }

  return isHTMLElement(appendTo) ? appendTo : null;
};

const Portal = defineComponent({
  name: "Portal",
  props: {
    appendTo: {
      type: [String, Object],
      default: "body",
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["mount", "unmount"],
  mounted() {
    this.$emit("mount");
  },
  unmounted() {
    this.$emit("unmount");
  },
  methods: {
    getTarget() {
      return resolveTarget(this.appendTo);
    },
  },
  render() {
    const content = this.$slots.default ? this.$slots.default() : null;
    const target = this.getTarget();

    if (this.disabled || !target || target === "self") {
      return content;
    }

    return h(
      Teleport,
      {
        to: target,
      },
      content,
    );
  },
});

export default Portal;
export { Portal };
