import { ref } from 'vue';

const currentCircuitTitle = ref('');
const currentCircuitId = ref(null);

export function useCircuitTitle() {
  function setCircuitContext(title = '', id = null) {
    currentCircuitTitle.value = title ?? '';
    currentCircuitId.value = id ?? null;
  }

  function clearCircuitContext() {
    currentCircuitTitle.value = '';
    currentCircuitId.value = null;
  }

  return {
    currentCircuitTitle,
    currentCircuitId,
    setCircuitContext,
    clearCircuitContext,
  };
}
