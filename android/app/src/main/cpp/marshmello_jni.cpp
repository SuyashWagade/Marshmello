#include <jni.h>
#include "include/snatch_detector.h"
#include <memory>

using namespace marshmello;

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeInit(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jfloat rssiThreshold,
    jlong gracePeriodMs,
    jfloat jerkThreshold,
    jfloat gyroThreshold,
    jboolean autoDisarmOnReturn) {
    DetectionConfig config;
    config.rssiThreshold = rssiThreshold;
    config.gracePeriodMs = gracePeriodMs;
    config.jerkThreshold = jerkThreshold;
    config.gyroRateThreshold = gyroThreshold;
    config.autoDisarmOnReturn = autoDisarmOnReturn;

    auto* detector = new SnatchDetector(config);
    return reinterpret_cast<jlong>(detector);
}

JNIEXPORT void JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeDestroy(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        delete detector;
    }
}

JNIEXPORT void JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeSetArmed(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle,
    jboolean armed) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        detector->setArmed(armed);
    }
}

JNIEXPORT void JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeUpdateConfig(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle,
    jfloat rssiThreshold,
    jlong gracePeriodMs,
    jfloat jerkThreshold,
    jfloat gyroThreshold,
    jboolean autoDisarmOnReturn) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        DetectionConfig config = detector->getConfig();
        config.rssiThreshold = rssiThreshold;
        config.gracePeriodMs = gracePeriodMs;
        config.jerkThreshold = jerkThreshold;
        config.gyroRateThreshold = gyroThreshold;
        config.autoDisarmOnReturn = autoDisarmOnReturn;
        detector->updateConfig(config);
    }
}

JNIEXPORT jint JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeProcessRssi(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle,
    jfloat rawRssi,
    jlong timestampMs) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        return static_cast<jint>(detector->processRssi(rawRssi, timestampMs));
    }
    return static_cast<jint>(STATE_DISARMED);
}

JNIEXPORT jint JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeProcessImu(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle,
    jfloat ax, jfloat ay, jfloat az,
    jfloat gx, jfloat gy, jfloat gz,
    jlong timestampMs) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        return static_cast<jint>(detector->processImu(ax, ay, az, gx, gy, gz, timestampMs));
    }
    return static_cast<jint>(STATE_DISARMED);
}

JNIEXPORT jint JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeNotifyBleDisconnected(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle,
    jlong timestampMs) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        return static_cast<jint>(detector->notifyBleDisconnected(timestampMs));
    }
    return static_cast<jint>(STATE_DISARMED);
}

JNIEXPORT jint JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeNotifyBleConnected(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle,
    jlong timestampMs) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        return static_cast<jint>(detector->notifyBleConnected(timestampMs));
    }
    return static_cast<jint>(STATE_DISARMED);
}

JNIEXPORT void JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeDisarm(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        detector->disarm();
    }
}

JNIEXPORT void JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeReset(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        detector->reset();
    }
}

JNIEXPORT jint JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeGetState(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        return static_cast<jint>(detector->getState());
    }
    return static_cast<jint>(STATE_DISARMED);
}

JNIEXPORT jfloat JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeGetFilteredRssi(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        return detector->getFilteredRssi();
    }
    return -100.0f;
}

JNIEXPORT jfloat JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeGetLastJerk(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        return detector->getLastJerk();
    }
    return 0.0f;
}

JNIEXPORT jfloat JNICALL
Java_com_marshmello_core_NativeDetectorCore_nativeGetRecentVariance(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jlong handle) {
    if (handle != 0) {
        auto* detector = reinterpret_cast<SnatchDetector*>(handle);
        return detector->getRecentMotionVariance();
    }
    return 0.0f;
}

} // extern "C"

