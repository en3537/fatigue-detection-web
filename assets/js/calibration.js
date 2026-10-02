document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-calibration-btn");
  const statusText = document.getElementById("baseline-status-text");
  const radios = document.querySelectorAll('input[name="cali-option"]');

  const baselineRadio = document.querySelector(
    'input[name="cali-option"][value="baseline"]',
  );

  const defaultRadio = document.querySelector(
    'input[name="cali-option"][value="default"]',
  );

  if (!startBtn || !statusText) {
    console.error(
      "[CALIBRATION] Required DOM elements not found: check index.html ids",
    );
    return;
  }

  if (baselineRadio) {
    baselineRadio.disabled = true;
  }

  startBtn.disabled = true;

  let pollTimer = null;

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function setCalibrationButtonLabel(isCalibrated) {
    startBtn.textContent = isCalibrated ? "重新校準" : "開始校準";
  }

  async function fetchStatus() {
    const res = await fetch("/calibration_status", {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error("Failed to fetch calibration status");
    }

    return res.json();
  }

  function pollStatus() {
    stopPolling();

    pollTimer = setInterval(async () => {
      try {
        const data = await fetchStatus();

        if (data.is_calibrating) {
          statusText.textContent = `校準中... ${data.progress}/${data.target}`;

          startBtn.textContent = "校準中...";
          startBtn.disabled = true;

          return;
        }

        if (data.is_calibrated) {
          statusText.textContent = "已校準";

          setCalibrationButtonLabel(true);
          startBtn.disabled = false;

          if (baselineRadio) {
            baselineRadio.disabled = false;
            baselineRadio.dataset.wasCalibrated = "true";
          }

          stopPolling();

          return;
        }

        statusText.textContent = "尚未校準";
        setCalibrationButtonLabel(false);
        startBtn.disabled = false;

        stopPolling();
      } catch (error) {
        console.error("[CALIBRATION]", error);

        startBtn.disabled = false;

        stopPolling();
      }
    }, 300);
  }

  startBtn.addEventListener("click", async () => {
    try {
      startBtn.disabled = true;
      startBtn.textContent = "校準中...";

      const res = await fetch("/start_calibration", {
        method: "POST",
        cache: "no-store",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to start calibration");
      }

      statusText.textContent = `校準中... 0/${data.target_frames}`;

      pollStatus();
    } catch (error) {
      console.error("[CALIBRATION]", error);

      if (typeof addSystemLog === "function") {
        addSystemLog(`[ERROR] ${error.message}`, "warning");
      }

      setCalibrationButtonLabel(false);
      startBtn.disabled = false;
    }
  });

  radios.forEach((radio) => {
    radio.addEventListener("change", async () => {
      if (radio.value === "default") {
        try {
          const res = await fetch("/select_calibration", {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "default",
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.message || "Failed to switch calibration");
          }

          if (typeof addSystemLog === "function") {
            addSystemLog("[CALIBRATION] Default", "info");
          }
        } catch (error) {
          console.error("[CALIBRATION]", error);

          if (typeof addSystemLog === "function") {
            addSystemLog(`[ERROR] ${error.message}`, "warning");
          }
        }

        return;
      }

      if (radio.value === "baseline") {
        if (!radio.dataset.wasCalibrated) {
          statusText.textContent = "尚未校準";

          if (typeof addSystemLog === "function") {
            addSystemLog("[CALIBRATION] Baseline", "info");
          }

          return;
        }

        try {
          const res = await fetch("/select_calibration", {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mode: "baseline",
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(data.message || "Failed to switch calibration");
          }

          if (typeof addSystemLog === "function") {
            addSystemLog("[CALIBRATION] Switched to baseline", "info");
          }
        } catch (error) {
          console.error("[CALIBRATION]", error);

          if (typeof addSystemLog === "function") {
            addSystemLog(`[ERROR] ${error.message}`, "warning");
          }
        }

        return;
      }
    });
  });

  window.addEventListener("pagehide", () => {
    fetch("/cancel_calibration", {
      method: "POST",
      keepalive: true,
    }).catch(() => {});
  });

  pollStatus();
});
