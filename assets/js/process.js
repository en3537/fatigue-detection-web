function formatSeconds(value, digits = 1) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "--";
  }

  return Number(value).toFixed(digits) + "s";
}

// =========================================================
// Data Fetching and Updating
// =========================================================

function updateData(data) {
  document.getElementById("fps-info").textContent = data.fps ?? "--";

  document.getElementById("latency-info").textContent =
    data.latency != null ? data.latency + "ms" : "--";

  document.getElementById("faces-info").textContent = data.faces ?? "--";

  // =======================================================
  // Eye
  // =======================================================

  document.getElementById("ear-info").textContent =
    data.ear != null ? Number(data.ear).toFixed(2) : "--";

  document.getElementById("blink-times-info").textContent =
    data.blink_times ?? "--";

  document.getElementById("eye-closure-dur-info").textContent = formatSeconds(
    data.eye_closure_dur,
  );

  document.getElementById("perclos-info").textContent =
    data.perclos != null ? (Number(data.perclos) * 100).toFixed(1) + "%" : "--";

  document.getElementById("baseline-ear-threshold-info").textContent =
    data.baseline_ear_threshold != null
      ? Number(data.baseline_ear_threshold).toFixed(2)
      : "--";

  // =======================================================
  // Mouth
  // =======================================================

  document.getElementById("mar-info").textContent =
    data.mar != null ? Number(data.mar).toFixed(2) : "--";

  document.getElementById("yawn-times-info").textContent =
    data.yawn_times ?? "--";

  document.getElementById("yawn-dur-info").textContent = formatSeconds(
    data.yawn_dur,
  );

  document.getElementById("baseline-mar-threshold-info").textContent =
    data.baseline_mar_threshold != null
      ? Number(data.baseline_mar_threshold).toFixed(2)
      : "--";

  // =======================================================
  // Threshold
  // =======================================================

  document.getElementById("default-ear-threshold").textContent =
    data.default_ear_threshold != null
      ? Number(data.default_ear_threshold).toFixed(2)
      : "--";

  document.getElementById("default-mar-threshold").textContent =
    data.default_mar_threshold != null
      ? Number(data.default_mar_threshold).toFixed(2)
      : "--";

  // =======================================================
  // Fatigue Status
  // =======================================================

  updateFatigueStatus(data.fatigue_level, data.fatigue_score);

  updateFatigueAlert(data);
}

function updateFatigueStatus(level, score) {
  const statusEl = document.getElementById("fatigue-status");
  const scoreEl = document.getElementById("fatigue-score");

  const levelMap = {
    Normal: {
      text: "正常",
      cls: "fatigue-status-safe",
    },

    Mild: {
      text: "輕度疲勞",
      cls: "fatigue-status-warning",
    },

    Severe: {
      text: "重度疲勞",
      cls: "fatigue-status-danger",
    },
  };

  const info = levelMap[level] || levelMap.Normal;

  statusEl.textContent = info.text;
  statusEl.className = info.cls;

  scoreEl.textContent = score != null ? `${score}%` : "N/A";
}

async function fetchData() {
  try {
    const response = await fetch("/api/data");

    if (!response.ok) {
      throw new Error("HTTP " + response.status);
    }

    const data = await response.json();

    updateRealtimeCharts(data.ear, data.mar);

    updateData(data);
  } catch (error) {
    console.error("[FETCH]", error);
  }
}

fetchData();

setInterval(fetchData, 1000);
