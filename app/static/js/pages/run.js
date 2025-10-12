import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
} from "../app.js";

const normalizeCircuit = (circuit) => ({
  ...circuit,
  tasks: (circuit.tasks || []).map((task) => ({
    name: task.name || "",
    description: task.description || "",
    duration: Number(task.duration) || 0,
  })),
});

const toTime = (seconds) => {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(total % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${secs}`;
};

const finishOptions = [
  { label: "Sound", value: "sound" },
  { label: "Vibration", value: "vibration" },
  { label: "Sound + Vibration", value: "both" },
  { label: "Silent", value: "none" },
];

const playTone = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (error) {
    console.warn("Unable to play tone", error);
  }
};

const vibrate = (pattern) => {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

export default {
  name: "CircuitRunPage",
  props: {
    circuit: {
      type: Object,
      required: true,
    },
  },
  setup(props) {
    const circuit = ref(normalizeCircuit(props.circuit));
    const currentIndex = ref(0);
    const isRunning = ref(false);
    const isPaused = ref(false);
    const remainingSeconds = ref(circuit.value.tasks[0] ? circuit.value.tasks[0].duration : 0);
    const countdownSound = ref(true);
    const countdownVibration = ref(false);
    const finishAction = ref("sound");
    let timerId = null;

    const currentTask = computed(() => circuit.value.tasks[currentIndex.value] || null);
    const nextTask = computed(() => circuit.value.tasks[currentIndex.value + 1] || null);
    const formattedRemaining = computed(() => toTime(remainingSeconds.value));
    const progress = computed(() => {
      if (!currentTask.value || !currentTask.value.duration) {
        return 0;
      }
      const elapsed = currentTask.value.duration - remainingSeconds.value;
      return Math.min(100, Math.max(0, Math.round((elapsed / currentTask.value.duration) * 100)));
    });
    const upcoming = computed(() =>
      circuit.value.tasks.map((task, index) => ({
        ...task,
        index,
        active: index === currentIndex.value,
      }))
    );

    const reset = () => {
      isRunning.value = false;
      isPaused.value = false;
      currentIndex.value = 0;
      remainingSeconds.value = circuit.value.tasks[0] ? circuit.value.tasks[0].duration : 0;
    };

    const ensureTimer = () => {
      if (timerId) {
        return;
      }
      timerId = setInterval(() => {
        if (!isRunning.value || isPaused.value) {
          return;
        }
        remainingSeconds.value -= 1;
        if (remainingSeconds.value <= 5 && remainingSeconds.value > 0) {
          if (countdownSound.value) {
            playTone();
          }
          if (countdownVibration.value) {
            vibrate(120);
          }
        }
        if (remainingSeconds.value <= 0) {
          handleFinish();
        }
      }, 1000);
    };

    const handleFinish = () => {
      if (finishAction.value === "sound" || finishAction.value === "both") {
        playTone();
      }
      if (finishAction.value === "vibration" || finishAction.value === "both") {
        vibrate([180, 60, 180]);
      }
      currentIndex.value += 1;
      if (currentIndex.value >= circuit.value.tasks.length) {
        stop();
        return;
      }
      remainingSeconds.value = circuit.value.tasks[currentIndex.value].duration;
    };

    const start = () => {
      if (!circuit.value.tasks.length) {
        return;
      }
      if (!isRunning.value) {
        if (!currentTask.value) {
          reset();
        }
        if (!remainingSeconds.value && currentTask.value) {
          remainingSeconds.value = currentTask.value.duration;
        }
        isRunning.value = true;
        isPaused.value = false;
        ensureTimer();
      }
    };

    const togglePause = () => {
      if (!isRunning.value || !currentTask.value) {
        return;
      }
      isPaused.value = !isPaused.value;
    };

    const stop = () => {
      isRunning.value = false;
      isPaused.value = false;
      currentIndex.value = circuit.value.tasks.length;
      remainingSeconds.value = 0;
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
    };

    const resetTimer = () => {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      reset();
    };

    watch(
      () => currentTask.value,
      (task) => {
        if (task && !isRunning.value) {
          remainingSeconds.value = task.duration;
        }
      }
    );

    onMounted(() => {
      reset();
    });

    onBeforeUnmount(() => {
      if (timerId) {
        clearInterval(timerId);
      }
    });

    return {
      circuit,
      currentTask,
      nextTask,
      formattedRemaining,
      progress,
      upcoming,
      isRunning,
      isPaused,
      countdownSound,
      countdownVibration,
      finishOptions,
      finishAction,
      start,
      togglePause,
      resetTimer,
      stop,
    };
  },
  template: `
    <div class="surface-card">
      <div class="mb-4">
        <h1 class="app-section-title mb-1">{{ circuit.name }}</h1>
        <p class="text-600 m-0">{{ circuit.description || 'Stay focused and move through each step with clarity.' }}</p>
      </div>
      <div class="timer-shell">
        <div class="timer-panel">
          <div class="timer-display">
            <span class="text-600">Current step</span>
            <h2 class="mt-2 mb-1">{{ currentTask ? currentTask.name : 'Finished' }}</h2>
            <div class="timer-display__value">{{ formattedRemaining }}</div>
            <p class="text-500">{{ currentTask ? currentTask.description : 'Great job! Circuit complete.' }}</p>
            <ProgressBar v-if="currentTask" :value="progress" class="mt-3" />
          </div>
          <div class="timer-controls">
            <Button label="Start" icon="pi pi-play" :disabled="isRunning || !circuit.tasks.length" @click="start" />
            <Button
              :label="isPaused ? 'Resume' : 'Pause'"
              :icon="isPaused ? 'pi pi-play' : 'pi pi-pause'"
              :disabled="!isRunning"
              @click="togglePause"
            />
            <Button label="Reset" icon="pi pi-refresh" class="p-button-outlined" @click="resetTimer" />
          </div>
        </div>
        <div class="timer-panel timer-meta">
          <div>
            <h3 class="mt-0">Up next</h3>
            <div class="text-600">{{ nextTask ? nextTask.name : 'Last step in progress' }}</div>
          </div>
          <ul>
            <li
              v-for="task in upcoming"
              :key="task.index"
              :class="{ active: task.active }"
            >
              <span>{{ task.name }}</span>
              <span>{{ task.duration }}s</span>
            </li>
          </ul>
          <Divider />
          <div class="grid formgrid p-fluid">
            <div class="field col-12">
              <label for="finish-action">When a step ends</label>
              <Dropdown
                id="finish-action"
                :options="finishOptions"
                optionLabel="label"
                optionValue="value"
                v-model="finishAction"
              />
            </div>
            <div class="field col-12">
              <div class="flex align-items-center gap-2">
                <Checkbox inputId="countdown-sound" v-model="countdownSound" binary />
                <label for="countdown-sound" class="m-0">Countdown beep (last 5s)</label>
              </div>
            </div>
            <div class="field col-12">
              <div class="flex align-items-center gap-2">
                <Checkbox inputId="countdown-vibration" v-model="countdownVibration" binary />
                <label for="countdown-vibration" class="m-0">Countdown vibration</label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
