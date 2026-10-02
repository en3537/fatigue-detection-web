function toggle_fullscreen() {
  const fd_video = document.querySelector(".fd-video");

  if (!is_fullscreen_active()) {
    enter_fullscreen(fd_video);
  } else {
    exit_fullscreen();
  }
}

function is_fullscreen_active() {
  return Boolean(
    document.fullscreenElement || document.webkitFullscreenElement,
  );
}

function enter_fullscreen(element) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  }
}

function exit_fullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
}

function update_fullscreen_btn_icon() {
  const btn = document.getElementById("fullscreen-btn");
  btn.classList.toggle("is-fullscreen", is_fullscreen_active());
}

document.addEventListener("DOMContentLoaded", () => {
  const fullscreen_btn = document.getElementById("fullscreen-btn");
  fullscreen_btn.addEventListener("click", toggle_fullscreen);

  document.addEventListener("fullscreenchange", update_fullscreen_btn_icon);
  document.addEventListener(
    "webkitfullscreenchange",
    update_fullscreen_btn_icon,
  );
});
