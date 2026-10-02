async function start_detection() {
  try {
    await startBrowserCamera();

    const response = await fetch("/start_detection", {
      method: "POST",
    });

    if (!response.ok) {
      stopCapture();
      throw new Error("Failed to start detection");
    }

    const data = await response.json();

    const button = document.getElementById("toggle_detection_button");
    const exportBtn = document.getElementById("export-log-btn");

    const baselineRadio = document.querySelector(
      'input[name="cali-option"][value="baseline"]',
    );

    const startCalibrationBtn = document.getElementById(
      "start-calibration-btn",
    );

    if (data.started === true) {
      button.innerText = "Stop";
      button.classList.add("toggle_detection_button_active");

      if (exportBtn) {
        exportBtn.disabled = true;
      }

      if (baselineRadio) {
        baselineRadio.disabled = false;
      }

      if (startCalibrationBtn) {
        startCalibrationBtn.disabled = false;
      }

      addSystemLog("[DETECTION] Started", "start");

      console.log("[DETECTION] Started");
    }
  } catch (error) {
    console.error("[ERROR]", error);
    addSystemLog(`[ERROR] ${error.message}`, "warning");
  }
}

async function stop_detection() {
  try {
    const response = await fetch("/stop_detection", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to stop detection");
    }

    const data = await response.json();

    const button = document.getElementById("toggle_detection_button");
    const exportBtn = document.getElementById("export-log-btn");

    const baselineRadio = document.querySelector(
      'input[name="cali-option"][value="baseline"]',
    );

    const startCalibrationBtn = document.getElementById(
      "start-calibration-btn",
    );

    if (data.started === false) {
      button.innerText = "Start";
      button.classList.remove("toggle_detection_button_active");

      if (exportBtn) {
        exportBtn.disabled = false;
      }

      // Detection 關閉後
      // Baseline disabled
      if (baselineRadio) {
        baselineRadio.disabled = true;
      }

      // Detection 關閉後
      // Start Calibration disabled
      if (startCalibrationBtn) {
        startCalibrationBtn.disabled = true;
      }

      stopCapture();

      addPauseLine();
      addSystemLog("[DETECTION] Stopped", "stop");

      console.log("[DETECTION] Stopped");
    }
  } catch (error) {
    console.error("[ERROR]", error);
    addSystemLog(`[ERROR] ${error.message}`, "warning");
  }
}

async function handle_detection_toggle() {
  const button = document.getElementById("toggle_detection_button");

  if (!button) {
    return;
  }

  if (
    button.classList.contains("toggle_detection_button_active") &&
    isBrowserCameraActive()
  ) {
    await stop_detection();
  } else {
    button.classList.remove("toggle_detection_button_active");
    await start_detection();
  }
}

window.addEventListener("pagehide", () => {
  fetch("/stop_detection", {
    method: "POST",
    keepalive: true,
  }).catch(() => {});
});

document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("toggle_detection_button");

  if (!button) {
    return;
  }

  button.addEventListener("click", handle_detection_toggle);
});
