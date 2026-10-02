function initializeAlert() {
  if (window.__alertInitialized) return;

  const overlay = document.querySelector(".fd-alert-overlay");
  const message = document.querySelector(".fd-alert-message");
  const messageText = message?.querySelector("span");
  const alertToggle = document.getElementById("alert-toggle");

  if (!overlay || !message || !messageText) {
    console.error("[ALERT] Alert elements not found");
    return;
  }

  window.__alertInitialized = true;

  function hideAlert() {
    message.classList.add("hidden");
    overlay.classList.remove("active");
  }

  window.updateFatigueAlert = function updateFatigueAlert(data) {
    if (alertToggle && !alertToggle.checked) {
      hideAlert();
      return;
    }

    if (!data) {
      hideAlert();
      return;
    }

    const eyeClosureDur = Number(data.eye_closure_dur ?? 0);

    const yawnDur = Number(data.yawn_dur ?? 0);

    let alertText = "";

    // 1. 長時間閉眼
    if (eyeClosureDur >= 1.7) {
      alertText = "偵測到長時間閉眼";
    }

    // 2. 打哈欠
    else if (yawnDur >= 1.0) {
      alertText = "偵測到打哈欠";
    }

    if (alertText) {
      messageText.textContent = alertText;

      message.classList.remove("hidden");
      overlay.classList.add("active");
    } else {
      hideAlert();
    }
  };

  if (alertToggle) {
    alertToggle.addEventListener("change", () => {
      if (!alertToggle.checked) {
        hideAlert();
      }
    });
  }

  hideAlert();
}

initializeAlert();
document.addEventListener("DOMContentLoaded", initializeAlert, { once: true });
