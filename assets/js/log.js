function addSystemLog(message, type = "info") {
  const logArea = document.querySelector(".log-scroll");

  if (!logArea) {
    console.error("[LOG] .log-area not found");
    return;
  }

  const log = document.createElement("div");
  log.className = `log ${type}`;

  const timestamp = document.createElement("span");
  timestamp.className = "log-timestamp";

  const messageElement = document.createElement("span");
  messageElement.className = "log-message";

  const now = new Date();

  timestamp.textContent = now.toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  messageElement.textContent = message;

  log.appendChild(timestamp);
  log.appendChild(messageElement);

  logArea.appendChild(log);

  logArea.scrollTop = logArea.scrollHeight;
}

//  ========== PREVIEW ==========
//
//   <div class="log">
//     <span class="log-timestamp"></span>
//     <span class="log-message"></span>
//   </div>
//
// ==============================
