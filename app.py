# 載入套件
import cv2
import os
import numpy as np
import time
from datetime import datetime
from flask import Flask, render_template, Response, jsonify, request
from process import DriverFatigueDetector
from config import Config
from state import State

app = Flask(
    __name__,
    static_folder="assets",
    template_folder="templates"
)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


# 載入模型
engine = DriverFatigueDetector(
    model_path=str(Config.MODEL_PATH)
)

# 全域狀態
state = State(
    fps=Config.FPS,
    window_sec=Config.WINDOWS_SEC
)

# 全域變數
FLIP_IMAGE = True


def reset_detection_state():
    engine.clear_log(state)

    state.reset_metrics()


def cancel_calibration_state():
    state.is_calibrating = False
    state.calibration_ear_samples = []
    state.calibration_mar_samples = []


# 路徑設定
@app.route("/")
@app.route("/index")
@app.route("/index.html")
def index():
    return render_template("index.html")


@app.route("/process_frame", methods=["POST"])
def process_browser_frame():
    frame_data = request.get_data()
    frame = cv2.imdecode(
        np.frombuffer(frame_data, dtype=np.uint8),
        cv2.IMREAD_COLOR
    )

    if frame is None:
        return jsonify({
            "status": "error",
            "message": "Invalid camera frame"
        }), 400

    if FLIP_IMAGE:
        frame = cv2.flip(frame, 1)

    frame_time = time.perf_counter()
    result = None
    if state.started:
        result = engine.process_frame(
            frame,
            state,
            draw_landmarks=True
        )

    if state.browser_last_frame_time is not None:
        elapsed = frame_time - state.browser_last_frame_time
        if elapsed > 0:
            state.frame_times.append(elapsed)
            average_frame_time = sum(state.frame_times) / len(state.frame_times)
            state.camera_fps = round(1 / average_frame_time, 1)
    state.browser_last_frame_time = frame_time
    state.latency = round((time.perf_counter() - frame_time) * 1000)

    return jsonify({
        "status": "ok",
        "landmarks": result["landmarks"] if result else [],
    })


# Data API
@app.route("/api/data")
def get_data():
    if not state.started:
        return jsonify({
            "fps": state.camera_fps,
            "latency": round(state.latency),
            "faces": 0,
            "left_ear": None,
            "right_ear": None,
            "ear": None,
            "mar": None,
            "blink_times": 0,
            "yawn_times": 0,
            "eye_closure_dur": 0.0,
            "yawn_dur": 0.0,
            "perclos": 0.0,
            "fatigue_level": "Normal",
            "fatigue_score": 0,
            "ear_threshold": state.ear_threshold,
            "mar_threshold": state.mar_threshold,
            "default_ear_threshold": Config.EAR_CLOSED_THRESHOLD,
            "default_mar_threshold": Config.YAWN_THRESHOLD,
            "baseline_ear_threshold": state.baseline_ear,
            "baseline_mar_threshold": state.baseline_mar,
        })

    return jsonify({
        "fps": state.camera_fps,
        "latency": round(state.latency),
        "faces": state.face_count,
        "left_ear": state.left_ear,
        "right_ear": state.right_ear,
        "ear": state.ear,
        "mar": state.mar,
        "blink_times": state.blink_times,
        "yawn_times": state.yawn_times,
        "eye_closure_dur": state.eye_closure_dur,
        "yawn_dur": state.yawn_dur,
        "perclos": state.perclos,
        "fatigue_level": state.fatigue_level,
        "fatigue_score": state.fatigue_score,
        "ear_threshold": state.ear_threshold,
        "mar_threshold": state.mar_threshold,
        "default_ear_threshold": Config.EAR_CLOSED_THRESHOLD,
        "default_mar_threshold": Config.YAWN_THRESHOLD,
        "baseline_ear_threshold": state.baseline_ear,
        "baseline_mar_threshold": state.baseline_mar,
    })


@app.route("/start_calibration", methods=["POST"])
def start_calibration():
    if not state.started:
        return jsonify({
            "status": "error",
            "message": "Detection not started"
        }), 400

    state.is_calibrating = True
    state.is_calibrated = False
    state.calibration_ear_samples = []
    state.calibration_mar_samples = []

    return jsonify({
        "status": "calibrating",
        "target_frames": Config.CALIBRATION_FRAMES
    })


@app.route("/calibration_status")
def calibration_status():
    resp = jsonify({
        "is_calibrating": state.is_calibrating,
        "is_calibrated": state.is_calibrated,
        "progress": len(state.calibration_ear_samples),
        "target": Config.CALIBRATION_FRAMES,
        "baseline_ear_threshold": state.baseline_ear,
        "baseline_mar_threshold": state.baseline_mar,
        "ear_threshold": state.ear_threshold,
        "mar_threshold": state.mar_threshold,
    })

    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"

    return resp


@app.route("/cancel_calibration", methods=["POST"])
def cancel_calibration():
    cancel_calibration_state()

    return jsonify({
        "status": "cancelled"
    })


@app.route("/select_calibration", methods=["POST"])
def select_calibration():
    mode = (request.get_json(silent=True) or {}).get("mode")

    if mode == "baseline":
        if not state.is_calibrated:
            return jsonify({
                "status": "error",
                "message": "Not calibrated yet"
            }), 400

        state.ear_threshold = round(
            state.baseline_ear * Config.CALIBRATION_EAR_RATIO, 4
        )

        if state.baseline_mar is not None:
            state.mar_threshold = round(
                state.baseline_mar + Config.CALIBRATION_MAR_OFFSET, 4
            )

    elif mode == "default":
        state.ear_threshold = Config.EAR_CLOSED_THRESHOLD
        state.mar_threshold = Config.YAWN_THRESHOLD

    else:
        return jsonify({
            "status": "error",
            "message": "Invalid mode"
        }), 400

    return jsonify({
        "status": "ok",
        "ear_threshold": state.ear_threshold,
        "mar_threshold": state.mar_threshold,
    })


# Start Detection
@app.route("/start_detection", methods=["POST"])
def start_detection():
    if state.started:
        return jsonify({
            "started": True,
            "status": "already_started"
        })

    reset_detection_state()

    state.started = True

    print("[DETECTION] Started")

    return jsonify({
        "started": True,
        "status": "started"
    })


# Stop Detection
@app.route("/stop_detection", methods=["POST"])
def stop_detection():
    if not state.started:
        return jsonify({
            "started": False,
            "status": "already_stopped"
        })

    engine.record_log(
        state,
        {
            "ear": state.ear,
            "mar": state.mar,
            "left_ear": state.left_ear,
            "right_ear": state.right_ear
        },
        state.face_count,
        event="pause"
    )

    state.started = False

    state.reset_metrics()

    cancel_calibration_state()

    return jsonify({
        "started": False,
        "status": "stopped"
    })


# Reset Detection
@app.route("/reset", methods=["POST"])
def reset_detection():
    reset_detection_state()

    print("[DETECTION] Reset")

    return jsonify({
        "status": "reset",
        "started": state.started,
        "ear_threshold": Config.EAR_CLOSED_THRESHOLD,
        "mar_threshold": Config.YAWN_THRESHOLD,
    })


# Detection Status
@app.route("/detection_status")
def detection_status():
    return jsonify({
        "started": state.started
    })


# Export CSV
@app.route("/export_csv")
def export_csv():
    csv_data = engine.export_csv(state)

    filename = (
        f"log_"
        f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    )

    return Response(
        csv_data,
        mimetype="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

# localhost test
if __name__ == "__main__":
       app.run(host="0.0.0.0",
               port=int(os.environ.get("PORT", 4000)),
               debug=os.environ.get("FLASK_DEBUG") == "1",
               use_reloader=False, threaded=True)