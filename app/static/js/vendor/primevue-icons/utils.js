import { h } from "vue";

export function createIconComponent(name, iconClass) {
  return {
    name,
    inheritAttrs: false,
    render() {
      const iconClasses = ["p-icon", "pi", ...iconClass.split(/\s+/).filter(Boolean)];
      return h("span", {
        class: iconClasses,
        role: "presentation",
        "aria-hidden": "true",
      });
    },
  };
}
