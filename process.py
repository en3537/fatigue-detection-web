# 載入套件
import cv2
import csv
import io
import time
import mediapipe as mp
import numpy as np
from datetime import datetime
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from config import Config


# Mediapipe Face Landmarker
BaseOptions = python.BaseOptions
FaceLandmarker = vision.FaceLandmarker
FaceLandmarkerOptions = vision.FaceLandmarkerOptions
VisionRunningMode = vision.RunningMode


# Fatigue Detector Logic
class DriverFatigueDetector:
    def __init__(
        self,
        model_path=Config.MODEL_PATH
    ):
        self.model_path = model_path

        self.base_options = BaseOptions(
            model_asset_path=model_path
        )

        self.options = FaceLandmarkerOptions(
            base_options=self.base_options,
            running_mode=VisionRunningMode.VIDEO,
            num_faces=1
        )

        self.detector = FaceLandmarker.create_from_options(
            self.options
        )

    def _distance(self, p1, p2):
        return np.linalg.norm(
            np.array([p1.x, p1.y]) -
            np.array([p2.x, p2.y])
        )

    def _calculate_ear(
        self,
        landmarks,
        eye_indices
    ):
        p1 = landmarks[eye_indices[0]]
        p2 = landmarks[eye_indices[1]]
        p3 = landmarks[eye_indices[2]]
        p4 = landmarks[eye_indices[3]]
        p5 = landmarks[eye_indices[4]]
        p6 = landmarks[eye_indices[5]]

        vertical_1 = self._distance(
            p2,
            p6
        )

        vertical_2 = self._distance(
            p3,
            p5
        )

        horizontal = self._distance(
            p1,
            p4
        )

        if horizontal == 0:
            return 0.0

        ear = (
            vertical_1 +
            vertical_2
        ) / (
            2.0 *
            horizontal
        )

        return float(ear)

    def _calculate_mar(
        self,
        landmarks
    ):
        left = landmarks[
            Config.MAR_POINTS["left"]
        ]

        right = landmarks[
            Config.MAR_POINTS["right"]
        ]

        top = landmarks[
            Config.MAR_POINTS["top"]
        ]

        bottom = landmarks[
            Config.MAR_POINTS["bottom"]
        ]

        horizontal = self._distance(
            left,
            right
        )

        vertical = self._distance(
            top,
            bottom
        )

        if horizontal == 0:
            return 0.0

        mar = (
            vertical /
            horizontal
        )

        return float(mar)

    def _calculate_metrics(
        self,
        face_landmarks
    ):
        left_ear = self._calculate_ear(
            face_landmarks,
            Config.LEFT_EAR_POINTS
        )

        right_ear = self._calculate_ear(
            face_landmarks,
            Config.RIGHT_EAR_POINTS
        )

        ear = (
            left_ear +
            right_ear
        ) / 2.0

        mar = self._calculate_mar(
            face_landmarks
        )

        return {
            "left_ear": round(
                left_ear,
                4
            ),
            "right_ear": round(
                right_ear,
                4
            ),
            "ear": round(
                ear,
                4
            ),
            "mar": round(
                mar,
                4
            )
        }

    def record_log(
        self,
        state,
        metrics,
        face_count,
        event="data"
    ):
        now = time.time()

        if event == "data":
            if (
                now -
                state.last_log_time
                < Config.LOG_INTERVAL_SEC
            ):
                return

            state.last_log_time = now

        state.log_history.append({
            "timestamp": now,
            "event": event,
            "ear": metrics.get("ear"),
            "mar": metrics.get("mar"),
            "left_ear": metrics.get("left_ear"),
            "right_ear": metrics.get("right_ear"),
            "blink_times":
                state.blink_times,
            "yawn_times":
                state.yawn_times,
            "perclos":
                state.perclos,
            "faces":
                face_count,
            "fatigue_level":
                state.fatigue_level,
            "fatigue_score":
                state.fatigue_score,

        })

    def export_csv(
        self,
        state
    ):
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "datetime",
            "event",
            "ear",
            "mar",
            "left_ear",
            "right_ear",
            "blink_times",
            "yawn_times",
            "perclos",
            "faces",
            "fatigue_level",
            "fatigue_score",
            "is_beep"
        ])

        for row in state.log_history:
            dt_str = datetime.fromtimestamp(
                row["timestamp"]
            ).strftime(
                "%Y-%m-%d %H:%M:%S"
            )

            writer.writerow([
                dt_str,
                row.get(
                    "event",
                    "data"
                ),
                row.get("ear"),
                row.get("mar"),
                row.get("left_ear"),
                row.get("right_ear"),
                row.get("blink_times"),
                row.get("yawn_times"),
                row.get("perclos"),
                row.get("faces"),
                row.get("fatigue_level"),
                row.get("fatigue_score"),
                row.get("is_beep")
            ])

        csv_data = output.getvalue()
        output.close()

        return csv_data

    def clear_log(
        self,
        state
    ):
        state.log_history = []
        state.last_log_time = 0.0

        state.blink_times = 0
        state.yawn_times = 0

        state.is_eye_closed = False
        state.is_yawning = False

        state.yawning_start_time = None

        state.eye_closure_dur = 0.0
        state.yawn_dur = 0.0

        state.eye_closure_frames = 0

        state.eye_closure_history.clear()

        state.perclos = 0.0

        state.fatigue_level = "Normal"
        state.fatigue_score = 0

        # 新增：雙重保險 —— 就算之後有地方只呼叫 clear_log()
        # 而沒呼叫 state.reset_metrics()，校準的「進行中」狀態
        # 也不會殘留卡死，避免下次進頁面誤判為自動開始校準
        state.is_calibrating = False
        state.calibration_ear_samples = []
        state.calibration_mar_samples = []

    def process_frame(
        self,
        frame,
        state,
        draw_landmarks=True,
        draw_full_mesh=False
    ):
        start_time = time.time()

        try:
            rgb_frame = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb_frame
            )

            detection_result = self.detector.detect_for_video(
                mp_image,
                timestamp_ms=int(
                    start_time * 1000
                )
            )

            face_count = (
                len(
                    detection_result.face_landmarks
                )
                if detection_result.face_landmarks
                else 0
            )

            metrics = {
                "left_ear": None,
                "right_ear": None,
                "ear": None,
                "mar": None,
            }

            if face_count > 0:
                face_landmarks = (
                    detection_result.face_landmarks[0]
                )

                metrics = (
                    self._calculate_metrics(
                        face_landmarks
                    )
                )

                self._update_state(
                    state,
                    metrics["ear"],
                    metrics["mar"]
                )

                self.collect_calibration_sample(
                    state,
                    metrics["ear"],
                    metrics["mar"]
                )

                self._update_fatigue(
                    state
                )


            state.face_count = face_count

            state.left_ear = (
                metrics["left_ear"]
            )

            state.right_ear = (
                metrics["right_ear"]
            )

            state.ear = (
                metrics["ear"]
            )

            state.mar = (
                metrics["mar"]
            )

            self.record_log(
                state,
                metrics,
                face_count,
                event="data"
            )

            if draw_landmarks:
                annotated_frame = (
                    self._draw_detections(
                        frame,
                        detection_result,
                        draw_full_mesh=
                        draw_full_mesh
                    )
                )
            else:
                annotated_frame = (
                    frame.copy()
                )

            processing_time_ms = (
                time.time() -
                start_time
            ) * 1000

            state.latency = round(
                processing_time_ms,
                2
            )

            return {
                "frame":
                    annotated_frame,
                "processing_time_ms":
                    state.latency,
                "face_count":
                    face_count,
                "left_ear":
                    metrics["left_ear"],
                "right_ear":
                    metrics["right_ear"],
                "ear":
                    metrics["ear"],
                "mar":
                    metrics["mar"],
                "blink_times":
                    state.blink_times,
                "yawn_times":
                    state.yawn_times,
                "perclos":
                    state.perclos,
                "fatigue_score":
                    state.fatigue_score,
                "fatigue_level":
                    state.fatigue_level,
                "landmarks":
                    self._landmarks_to_dict(
                        detection_result
                    )
            }

        except Exception as e:
            print(
                f"[IMAGE]: {e}"
            )

            return {
                "frame":
                    frame,
                "processing_time_ms":
                    0,
                "face_count":
                    0,
                "left_ear":
                    None,
                "right_ear":
                    None,
                "ear":
                    None,
                "mar":
                    None,
                "blink_times":
                    state.blink_times,
                "yawn_times":
                    state.yawn_times,
                "perclos":
                    state.perclos,
                "fatigue_score":
                    state.fatigue_score,
                "fatigue_level":
                    state.fatigue_level,
                "landmarks":
                    []
            }

    def collect_calibration_sample(
        self,
        state,
        ear,
        mar
    ):
        if not state.is_calibrating:
            return

        if ear is not None:
            state.calibration_ear_samples.append(
                ear
            )

        if mar is not None:
            state.calibration_mar_samples.append(
                mar
            )

        if (
            len(
                state.calibration_ear_samples
            )
            >=
            Config.CALIBRATION_FRAMES
        ):
            state.baseline_ear = round(
                sum(
                    state.calibration_ear_samples
                ) /
                len(
                    state.calibration_ear_samples
                ),
                4
            )

            state.baseline_mar = (
                round(
                    sum(
                        state.calibration_mar_samples
                    ) /
                    len(
                        state.calibration_mar_samples
                    ),
                    4
                )
                if state.calibration_mar_samples
                else None
            )

            state.ear_threshold = round(
                state.baseline_ear *
                Config.CALIBRATION_EAR_RATIO,
                4
            )

            if state.baseline_mar is not None:
                state.mar_threshold = round(
                    state.baseline_mar +
                    Config.CALIBRATION_MAR_OFFSET,
                    4
                )

            state.is_calibrated = True
            state.is_calibrating = False

    def _update_state(
        self,
        state,
        ear,
        mar
    ):
        now = time.time()

        ear_threshold = (
            state.ear_threshold
            if state.ear_threshold is not None
            else Config.EAR_CLOSED_THRESHOLD
        )

        mar_threshold = (
            state.mar_threshold
            if state.mar_threshold is not None
            else Config.YAWN_THRESHOLD
        )

        # EAR 閉眼偵測
        is_closed_frame = (
            ear is not None and
            ear < ear_threshold
        )

        state.eye_closure_history.append(
            1 if is_closed_frame else 0
        )

        if state.eye_closure_history:
            state.perclos = round(
                sum(
                    state.eye_closure_history
                ) /
                len(
                    state.eye_closure_history
                ),
                4
            )

        if is_closed_frame:
            state.is_eye_closed = True

            state.eye_closure_frames += 1

            state.eye_closure_dur = round(
                state.eye_closure_frames /
                Config.FPS,
                3
            )
        else:
            if state.is_eye_closed:
                if (
                    state.eye_closure_frames
                    >=
                    Config.BLINK_MIN_FRAMES
                ):
                    state.blink_times += 1
                else:
                    state.eye_closure_dur = 0.0

                state.eye_closure_frames = 0
                state.is_eye_closed = False

        # MAR 打哈欠偵測
        if (
            mar is not None and
            mar >
            mar_threshold
        ):
            if not state.is_yawning:
                state.is_yawning = True
                state.yawning_start_time = now

            state.yawn_dur = round(
                now -
                state.yawning_start_time,
                3
            )
        else:
            if state.is_yawning:
                duration = (
                    now -
                    (
                        state.yawning_start_time
                        or
                        now
                    )
                )

                if (
                    duration
                    >=
                    Config.YAWN_MIN_DURATION
                ):
                    state.yawn_times += 1

                state.yawn_dur = 0.0
                state.is_yawning = False
                state.yawning_start_time = None

    def _update_fatigue(
        self,
        state
    ):
        elapsed_min = max(
            (
                time.time() -
                state.start_record_time
            ) / 60.0,
            1 / 60.0
        )

        yawn_rate = (
            state.yawn_times /
            elapsed_min
        )

        # PERCLOS 疲勞分數
        perclos_score = min(
            state.perclos /
            Config.PERCLOS_SEVERE_RATIO,
            1.0
        )

        # 連續閉眼疲勞分數
        eye_closure_score = min(
            state.eye_closure_frames /
            Config.EYE_CLOSURE_MIN_FRAMES,
            1.0
        )

        # 打哈欠疲勞分數
        yawn_score = min(
            yawn_rate /
            Config.YAWN_RATE_SEVERE_PER_MIN,
            1.0
        )

        score = (
            perclos_score *
            Config.FATIGUE_WEIGHT_PERCLOS
            +
            eye_closure_score *
            Config.FATIGUE_WEIGHT_EYE_CLOSURE
            +
            yawn_score *
            Config.FATIGUE_WEIGHT_YAWN
        ) * 100

        state.fatigue_score = round(
            min(
                score,
                100
            ),
            1
        )

        if (
            state.fatigue_score
            >=
            Config.FATIGUE_SCORE_SEVERE
        ):
            state.fatigue_level = (
                "Severe"
            )
        elif (
            state.fatigue_score
            >=
            Config.FATIGUE_SCORE_MILD
        ):
            state.fatigue_level = (
                "Mild"
            )
        else:
            state.fatigue_level = (
                "Normal"
            )

    def _landmarks_to_dict(
        self,
        detection_result
    ):
        landmarks_data = []

        if not detection_result.face_landmarks:
            return landmarks_data

        for face_landmarks in (
            detection_result.face_landmarks
        ):
            points = []

            for landmark in face_landmarks:
                points.append({
                    "x": float(
                        landmark.x
                    ),
                    "y": float(
                        landmark.y
                    ),
                    "z": float(
                        landmark.z
                    )
                })

            landmarks_data.append(
                points
            )

        return landmarks_data

    def _draw_detections(
        self,
        frame,
        detection_result,
        draw_full_mesh=False
    ):
        annotated_image = frame.copy()
        h, w = frame.shape[:2]

        if not detection_result.face_landmarks:
            return annotated_image

        for face_landmarks in (
            detection_result.face_landmarks
        ):
            if draw_full_mesh:
                for connection in (
                    vision.FaceLandmarksConnections
                    .FACE_LANDMARKS_TESSELATION
                ):
                    start_idx = connection.start
                    end_idx = connection.end

                    if (
                        start_idx >= len(face_landmarks)
                        or
                        end_idx >= len(face_landmarks)
                    ):
                        continue

                    start = face_landmarks[start_idx]
                    end = face_landmarks[end_idx]

                    x1 = int(start.x * w)
                    y1 = int(start.y * h)
                    x2 = int(end.x * w)
                    y2 = int(end.y * h)

                    cv2.line(
                        annotated_image,
                        (x1, y1),
                        (x2, y2),
                        (255, 204, 153),
                        1
                    )

            for idx, landmark in enumerate(
                face_landmarks
            ):
                point_color = None
                point_radius = 0
                point_thickness = 0

                # 左眼
                if idx in Config.LEFT_EAR_POINTS:
                    point_color = (255, 255, 255)
                    point_radius = 2
                    point_thickness = -1

                # 右眼
                elif idx in Config.RIGHT_EAR_POINTS:
                    point_color = (255, 255, 255)
                    point_radius = 2
                    point_thickness = -1

                # 嘴巴
                elif (hasattr(Config, 'MOUTH') and idx in Config.MOUTH) or \
                     (hasattr(Config, 'MAR_POINTS') and idx in Config.MAR_POINTS.values()):
                    point_color = (255, 255, 255)
                    point_radius = 2
                    point_thickness = -1

                # 鼻子
                elif hasattr(Config, 'NOSE') and idx in Config.NOSE:
                    point_color = (255, 255, 255)
                    point_radius = 2
                    point_thickness = -1

                if point_color is None:
                    continue

                x = int(landmark.x * w)
                y = int(landmark.y * h)

                x = max(0, min(x, w - 1))
                y = max(0, min(y, h - 1))

                cv2.circle(
                    annotated_image,
                    (x, y),
                    point_radius,
                    point_color,
                    point_thickness,
                    lineType=cv2.LINE_AA
                )

        return annotated_image

    def get_face_landmarks(
        self,
        frame
    ):
        try:
            rgb_frame = cv2.cvtColor(
                frame,
                cv2.COLOR_BGR2RGB
            )

            mp_image = mp.Image(
                image_format=mp.ImageFormat.SRGB,
                data=rgb_frame
            )

            detection_result = self.detector.detect(
                mp_image
            )

            data = {
                "face_count": 0,
                "left_ear": None,
                "right_ear": None,
                "ear": None,
                "mar": None,
                "landmarks": []
            }

            if detection_result.face_landmarks:
                data["face_count"] = len(
                    detection_result.face_landmarks
                )

                for face_landmarks in (
                    detection_result.face_landmarks
                ):
                    metrics = (
                        self._calculate_metrics(
                            face_landmarks
                        )
                    )

                    data["left_ear"] = (
                        metrics["left_ear"]
                    )

                    data["right_ear"] = (
                        metrics["right_ear"]
                    )

                    data["ear"] = (
                        metrics["ear"]
                    )

                    data["mar"] = (
                        metrics["mar"]
                    )

                    points = []

                    for landmark in (
                        face_landmarks
                    ):
                        points.append({
                            "x": float(
                                landmark.x
                            ),
                            "y": float(
                                landmark.y
                            ),
                            "z": float(
                                landmark.z
                            )
                        })

                    data["landmarks"].append(
                        points
                    )

            return data

        except Exception as e:
            print(
                f"[LANDMARKS]: {e}"
            )

            return {
                "face_count": 0,
                "left_ear": None,
                "right_ear": None,
                "ear": None,
                "mar": None,
                "landmarks": []
            }