function switchSettingsView(targetViewId) {
  const allViews = document.querySelectorAll(
    ".setting-overlay-modal .menu-view",
  );

  allViews.forEach((view) => {
    view.classList.add("hidden");
  });

  const targetView = document.getElementById(targetViewId);

  if (targetView) {
    targetView.classList.remove("hidden");
  }
}

function resetSettingsView() {
  switchSettingsView("view-main");
}

document.addEventListener("DOMContentLoaded", () => {
  const settingsBtn = document.getElementById("settings-btn");

  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      resetSettingsView();
    });
  }
});
