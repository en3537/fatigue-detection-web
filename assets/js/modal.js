document.addEventListener("DOMContentLoaded", () => {
  const settingsBtn = document.getElementById("settings-btn");
  const settingModal = document.querySelector(".setting-overlay-modal");
  const fdOverlay = document.querySelector(".fd-overlay");

  if (settingsBtn && settingModal && fdOverlay) {
    settingsBtn.addEventListener("click", (event) => {
      event.stopPropagation();

      settingModal.classList.toggle("active");

      if (settingModal.classList.contains("active")) {
        fdOverlay.classList.add("is-active");
      }
    });

    document.addEventListener("click", (event) => {
      if (!settingModal.contains(event.target)) {
        settingModal.classList.remove("active");
      }
    });

    fdOverlay.addEventListener("mouseenter", () => {
      if (!settingModal.classList.contains("active")) {
        fdOverlay.classList.remove("is-active");
      }
    });

    fdOverlay.addEventListener("mouseleave", () => {
      if (!settingModal.classList.contains("active")) {
        fdOverlay.classList.remove("is-active");
      }
    });
  }
});
