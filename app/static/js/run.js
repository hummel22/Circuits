let timerInterval = null;
let currentIndex = 0;
let remainingSeconds = 0;
let isRunning = false;
let isPaused = false;

const tasks = (circuitData?.tasks || []).map((task, index) => ({
  ...task,
  index,
}));

const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const stopButton = document.getElementById("stop-button");
const currentStepName = document.getElementById("current-step-name");
const timeRemaining = document.getElementById("time-remaining");
const nextStep = document.getElementById("next-step");
const upcomingList = document.getElementById("upcoming-list");
const finishAction = document.getElementById("finish-action");
const countdownSound = document.getElementById("countdown-sound");
const countdownVibration = document.getElementById("countdown-vibration");

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${secs}`;
}

function updateUpcomingList() {
  upcomingList.innerHTML = "";
  tasks.forEach((task, index) => {
    const li = document.createElement("li");
    li.className = "collection-item" + (index === currentIndex ? " active" : "");
    li.innerHTML = `<span class="title">${task.name}</span><p>${task.description}</p><span class="secondary-content">${task.duration}s</span>`;
    upcomingList.appendChild(li);
  });
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (error) {
    console.warn("Unable to play beep", error);
  }
}

function vibrate(duration) {
  if (navigator.vibrate) {
    navigator.vibrate(duration);
  }
}

function handleFinishAction() {
  const action = finishAction.value;
  if (action === "sound" || action === "both") {
    playBeep();
  }
  if (action === "vibration" || action === "both") {
    vibrate([200, 100, 200]);
  }
}

function handleCountdown(secondRemaining) {
  if (secondRemaining <= 5 && secondRemaining > 0) {
    if (countdownSound.checked) {
      playBeep();
    }
    if (countdownVibration.checked) {
      vibrate(100);
    }
  }
}

function updateDisplay() {
  if (tasks.length === 0) {
    currentStepName.textContent = "No steps";
    timeRemaining.textContent = "00:00";
    nextStep.textContent = "";
    return;
  }

  const currentTask = tasks[currentIndex];
  currentStepName.textContent = currentTask ? currentTask.name : "Finished";
  timeRemaining.textContent = formatTime(remainingSeconds);
  const upcomingTask = tasks[currentIndex + 1];
  nextStep.textContent = upcomingTask
    ? `Next: ${upcomingTask.name} (${upcomingTask.duration}s)`
    : "Final step";
}

function resetTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  currentIndex = 0;
  remainingSeconds = tasks[0] ? Number(tasks[0].duration) : 0;
  isRunning = false;
  isPaused = false;
  startButton.disabled = tasks.length === 0;
  pauseButton.disabled = true;
  stopButton.disabled = true;
  startButton.textContent = "Start";
  startButton.innerHTML = '<i class="material-icons left">play_arrow</i>Start';
  pauseButton.innerHTML = '<i class="material-icons left">pause</i>Pause';
  updateUpcomingList();
  updateDisplay();
}

function tick() {
  timerInterval = setInterval(() => {
    if (!isRunning || isPaused) {
      return;
    }
    remainingSeconds -= 1;
    handleCountdown(remainingSeconds);
    if (remainingSeconds <= 0) {
      handleFinishAction();
      currentIndex += 1;
      if (currentIndex >= tasks.length) {
        clearInterval(timerInterval);
        currentStepName.textContent = "Circuit complete";
        timeRemaining.textContent = "00:00";
        nextStep.textContent = "Great job!";
        isRunning = false;
        startButton.disabled = false;
        pauseButton.disabled = true;
        stopButton.disabled = true;
        startButton.textContent = "Restart";
        startButton.innerHTML = '<i class="material-icons left">replay</i>Restart';
        updateUpcomingList();
        return;
      }
      remainingSeconds = Number(tasks[currentIndex].duration);
      updateUpcomingList();
    }
    updateDisplay();
  }, 1000);
}

startButton?.addEventListener("click", () => {
  if (!isRunning) {
    isRunning = true;
    isPaused = false;
    startButton.disabled = true;
    pauseButton.disabled = false;
    stopButton.disabled = false;
    remainingSeconds = Number(tasks[currentIndex]?.duration || 0);
    updateDisplay();
    updateUpcomingList();
    if (!timerInterval) {
      tick();
    }
  } else if (!isPaused) {
    // restart when already finished
    resetTimer();
  }
});

pauseButton?.addEventListener("click", () => {
  if (!isRunning) {
    return;
  }
  isPaused = !isPaused;
  if (isPaused) {
    pauseButton.innerHTML = '<i class="material-icons left">play_arrow</i>Resume';
  } else {
    pauseButton.innerHTML = '<i class="material-icons left">pause</i>Pause';
  }
});

stopButton?.addEventListener("click", () => {
  resetTimer();
});

window.addEventListener("load", () => {
  resetTimer();
});
