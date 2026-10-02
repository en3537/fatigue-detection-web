const cameraSource = document.getElementById("camera_source");
const landmarkOverlay = document.getElementById("landmark-overlay");
const captureCanvas = document.createElement("canvas");
const captureContext = captureCanvas.getContext("2d");
const landmarkContext = landmarkOverlay?.getContext("2d");

const DETECTION_MAX_WIDTH = 640;
const JPEG_QUALITY = 0.6;
const EYE_LANDMARKS = new Set([
  33, 160, 158, 133, 153, 144,
  362, 385, 387, 263, 373, 380,
]);
const NOSE_LANDMARKS = new Set([1]);
const MOUTH_LANDMARKS = new Set([
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291,
  185, 40, 39, 37, 0, 267, 269, 270, 409,
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308,
  95, 88, 178, 87, 14, 317, 402, 318, 324,
]);

let cameraStream = null;
let captureRunning = false;
let previewPromise = null;

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function isBrowserCameraActive() {
  return Boolean(
    cameraStream?.getVideoTracks().some((track) => track.readyState === "live"),
  );
}

function updateCameraRatio() {
  if (cameraSource.videoWidth && cameraSource.videoHeight) {
    cameraSource.style.aspectRatio = `${cameraSource.videoWidth} / ${cameraSource.videoHeight}`;
  }
}

function drawLandmarks(faces) {
  if (!landmarkOverlay || !landmarkContext) return;

  const videoRect = cameraSource.getBoundingClientRect();
  const containerRect = landmarkOverlay.parentElement.getBoundingClientRect();
  const scaleX = videoRect.width / cameraSource.videoWidth;
  const scaleY = videoRect.height / cameraSource.videoHeight;
  const offsetX = videoRect.left - containerRect.left;
  const offsetY = videoRect.top - containerRect.top;

  landmarkOverlay.width = Math.max(1, Math.round(containerRect.width));
  landmarkOverlay.height = Math.max(1, Math.round(containerRect.height));
  landmarkOverlay.style.left = "0";
  landmarkOverlay.style.top = "0";
  landmarkContext.clearRect(
    0,
    0,
    landmarkOverlay.width,
    landmarkOverlay.height,
  );

  landmarkContext.fillStyle = "#ffffff";
  for (const face of faces || []) {
    for (const [index, point] of face.entries()) {
      if (
        !EYE_LANDMARKS.has(index) &&
        !NOSE_LANDMARKS.has(index) &&
        !MOUTH_LANDMARKS.has(index)
      ) {
        continue;
      }

      const x =
        offsetX + (1 - point.x) * cameraSource.videoWidth * scaleX;
      const y = offsetY + point.y * cameraSource.videoHeight * scaleY;

      landmarkContext.fillStyle = NOSE_LANDMARKS.has(index)
        ? "#00e5ff"
        : "#ffffff";
      landmarkContext.beginPath();
      landmarkContext.arc(x, y, NOSE_LANDMARKS.has(index) ? 3 : 2, 0, Math.PI * 2);
      landmarkContext.fill();
    }
  }

}

function clearLandmarks() {
  if (!landmarkOverlay || !landmarkContext) return;

  landmarkContext.clearRect(
    0,
    0,
    landmarkOverlay.width,
    landmarkOverlay.height,
  );
}

function describeCameraError(error) {
  const messages = {
    NotAllowedError: "Camera permission was denied.",
    NotFoundError: "No camera was found.",
    NotReadableError:
      "The camera is already being used by another application.",
    OverconstrainedError: "The requested camera constraints are not available.",
    SecurityError: "Camera access is blocked by the browser security policy.",
  };

  return messages[error.name] || error.message || "Unknown camera error.";
}

async function waitForVideoMetadata() {
  if (cameraSource.videoWidth && cameraSource.videoHeight) return;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("The camera did not provide video metadata."));
    }, 5000);
    const onLoadedMetadata = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("The camera video metadata could not be loaded."));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      cameraSource.removeEventListener("loadedmetadata", onLoadedMetadata);
      cameraSource.removeEventListener("error", onError);
    };

    cameraSource.addEventListener("loadedmetadata", onLoadedMetadata, {
      once: true,
    });
    cameraSource.addEventListener("error", onError, { once: true });
  });
}

async function openCameraStream() {
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  });

  const metadataReady = waitForVideoMetadata();
  cameraSource.srcObject = cameraStream;
  await cameraSource.play();
  await metadataReady;
  updateCameraRatio();
}

async function sendCameraFrame() {
  if (!captureRunning || !isBrowserCameraActive()) return;

  if (!cameraSource.videoWidth || !cameraSource.videoHeight) {
    await wait(100);
    return;
  }

  const scale = Math.min(1, DETECTION_MAX_WIDTH / cameraSource.videoWidth);
  captureCanvas.width = Math.round(cameraSource.videoWidth * scale);
  captureCanvas.height = Math.round(cameraSource.videoHeight * scale);
  captureContext.drawImage(
    cameraSource,
    0,
    0,
    captureCanvas.width,
    captureCanvas.height,
  );

  const frame = await new Promise((resolve) =>
    captureCanvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );

  if (!frame || !captureRunning) return;

  const response = await fetch("/process_frame", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: frame,
  });

  if (!response.ok) {
    throw new Error(`Frame processing failed (${response.status}).`);
  }

  const result = await response.json();
  if (captureRunning) {
    drawLandmarks(result.landmarks);
  }
}

async function runCaptureLoop() {
  while (captureRunning) {
    try {
      await sendCameraFrame();
    } catch (error) {
      console.error("[CAMERA] Frame upload failed:", error);
      await wait(500);
    }

    await wait(100);
  }
}

// 只開鏡頭預覽(不傳影像給後端)
function startBrowserPreview() {
  if (previewPromise) return previewPromise;

  previewPromise = (async () => {
    if (!cameraSource) {
      throw new Error("Camera video element is missing.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        window.isSecureContext
          ? "Browser camera access is unavailable."
          : "Camera needs HTTPS or localhost. Open http://localhost:4000 or use an https:// URL.",
      );
    }

    if (isBrowserCameraActive()) {
      return;
    }

    try {
      console.log("[CAMERA] Requesting camera permission.");
      await openCameraStream();

      console.log(
        "[CAMERA] Preview started:",
        cameraStream.getVideoTracks()[0]?.label || "Unknown camera",
      );
    } catch (error) {
      stopBrowserCamera();
      throw new Error(`Unable to start camera: ${describeCameraError(error)}`, {
        cause: error,
      });
    }
  })();

  // 無論成功或失敗都清掉,之後可以重試
  const clearPreviewPromise = () => {
    previewPromise = null;
  };
  previewPromise.then(clearPreviewPromise, clearPreviewPromise);

  return previewPromise;
}

// 開鏡頭預覽 + 開始傳影像給後端偵測
async function startBrowserCamera() {
  await startBrowserPreview();

  if (captureRunning) return;

  clearLandmarks();
  captureRunning = true;
  runCaptureLoop();

  console.log("[CAMERA] Capture started.");
}

// 只停止傳影像,鏡頭預覽保留
function stopCapture() {
  captureRunning = false;
  clearLandmarks();
}

function stopBrowserCamera() {
  captureRunning = false;
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;

  if (cameraSource) {
    cameraSource.pause();
    cameraSource.srcObject = null;
  }
}

window.isBrowserCameraActive = isBrowserCameraActive;
window.startBrowserPreview = startBrowserPreview;
window.startBrowserCamera = startBrowserCamera;
window.stopBrowserCamera = stopBrowserCamera;
window.stopCapture = stopCapture;
window.clearLandmarks = clearLandmarks;

window.addEventListener("pagehide", stopBrowserCamera);

document.addEventListener("DOMContentLoaded", () => {
  startBrowserPreview().catch((error) => {
    console.error("[CAMERA]", error);
    if (typeof addSystemLog === "function") {
      addSystemLog(`[ERROR] ${error.message}`, "warning");
    }
  });
});
