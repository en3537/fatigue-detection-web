document.addEventListener("DOMContentLoaded", () => {
  const resetBtns = [
    document.getElementById("reset-e-data-btn"),
    document.getElementById("reset-m-data-btn"),
    document.getElementById("reset-h-data-btn"),
  ].filter(Boolean);

  resetBtns.forEach((resetBtn) => {
    resetBtn.addEventListener("click", async () => {
      if (resetBtn.disabled) return;

      try {
        resetBtn.disabled = true;

        const response = await fetch("/reset", { method: "POST" });
        if (!response.ok) throw new Error("Failed to reset data");

        const data = await response.json();

        resetCharts();

        updateData({
          fps: 0,
          latency: null,
          faces: 0,
          ear: null,
          mar: null,
          blink_times: 0,
          yawn_times: 0,
          eye_closure_dur: null,
          yawn_dur: null,
          perclos: null,
          ear_threshold: data.ear_threshold,
          mar_threshold: data.mar_threshold,
          default_ear_threshold: data.default_ear_threshold,
          default_mar_threshold: data.default_mar_threshold,
          fatigue_level: "Normal",
          fatigue_score: null,
        });

        addSystemLog("[RESET] Data Cleared", "info");
      } catch (error) {
        console.error("[ERROR]", error);
        addSystemLog(`[ERROR] ${error.message}`, "warning");
      } finally {
        resetBtn.disabled = false;
      }
    });
  });
});
