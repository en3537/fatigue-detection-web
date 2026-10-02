document.addEventListener("DOMContentLoaded", () => {
  const exportBtn = document.getElementById("export-log-btn");

  if (!exportBtn) return;

  exportBtn.addEventListener("click", () => {
    if (exportBtn.disabled) return;

    window.location.href = "/export_csv";

    if (typeof addSystemLog === "function") {
      addSystemLog("[EXPORT] Download Data", "start");
    }
  });
});
