class Config:

    # ========== Camera ==========
    # ========== Model ==========
    MODEL_PATH = 'model/face_landmarker.task'

    # ========== Image ==========
    DETECTION_MAX_WIDTH = 640
    JPEG_QUALITY = 60

    # ========================================================================================
    # Mediapipe Face Landmark
    #
    # https://ai.google.dev/edge/api/mediapipe/python/mp/tasks/vision/FaceLandmarksConnections
    # ========================================================================================

    # 左眼
    LEFT_EAR_POINTS = [
        33, 160, 158, 133, 153, 144
    ]

    # 右眼
    RIGHT_EAR_POINTS = [
        362, 385, 387, 263, 373, 380
    ]

    # 鼻子
    NOSE = {1}

    # 嘴巴
    MOUTH = {
        # 外嘴唇
        61, 146, 91, 181, 84, 17,
        314, 405, 321, 375, 291,

        # 外嘴唇下方 / 周圍
        185, 40, 39, 37, 0,
        267, 269, 270, 409,

        # 內嘴唇
        78, 191, 80, 81, 82,
        13,
        312, 311, 310, 415,
        308,

        # 內嘴唇下方
        95, 88, 178, 87,
        14,
        317, 402, 318, 324
    }

    MAR_POINTS = {
        "left": 61,
        "right": 291,
        "top": 13,
        "bottom": 14
    }

    # ========== 系統參數 ==========
    FPS = 30

    # 論文(https://www.mdpi.com/1424-8220/23/19/8267)
    WINDOWS_SEC = 5
    WINDOW_SIZE = FPS * WINDOWS_SEC

    # ========== 門檻設定 (系統預設值) ==========

    # 眼睛閉合率門檻
    EAR_CLOSED_THRESHOLD = 0.2

    # 連續閉眼 (https://www.mdpi.com/1424-8220/23/19/8267)
    # 連續閉眼 >= 20 frames
    EYE_CLOSURE_MIN_FRAMES = 20
    EYE_CLOSURE_MIN_DURATION = EYE_CLOSURE_MIN_FRAMES / FPS

    # 一般眨眼
    BLINK_MIN_FRAMES = 2
    BLINK_MIN_DURATION = BLINK_MIN_FRAMES / FPS

    # 打哈欠門檻
    YAWN_THRESHOLD = 0.65

    # 連續打哈欠 (https://www.mdpi.com/1424-8220/23/19/8267)
    # 連續打哈欠 >= 30 frames
    YAWN_MIN_FRAMES = 30
    YAWN_MIN_DURATION = YAWN_MIN_FRAMES / FPS

    # 低頭率門檻(disabled)
    NOD_RATIO_THRESHOLD = 0.3

    # ========== 校準 ==========
    CALIBRATION_FRAMES = 100 # 校準需要花費的時間 (幀數)

    # Baseline 校準後計算門檻的公式參數
    # ear_threshold = baseline_ear * CALIBRATION_EAR_RATIO
    CALIBRATION_EAR_RATIO = 0.75

    # mar_threshold = baseline_mar + CALIBRATION_MAR_OFFSET
    CALIBRATION_MAR_OFFSET = 0.25

    # ========== 疲勞分數 ==========
    PERCLOS_SEVERE_RATIO = 0.4
    YAWN_RATE_SEVERE_PER_MIN = 3.0

    FATIGUE_WEIGHT_PERCLOS = 0.5
    FATIGUE_WEIGHT_EYE_CLOSURE = 0.3
    FATIGUE_WEIGHT_YAWN = 0.2

    FATIGUE_SCORE_MILD = 30
    FATIGUE_SCORE_SEVERE = 60

    # ========== 警告 ==========
    ALERT_COOLDOWN_SECONDS = 5

    # ========== 日誌 ==========
    LOG_INTERVAL_SEC = 0.2