#ifndef SNATCH_DETECTOR_H
#define SNATCH_DETECTOR_H

#include "kalman_filter.h"
#include <cstdint>
#include <vector>

namespace marshmello {

enum DetectorState {
    STATE_DISARMED = 0,
    STATE_IDLE_ARMED = 1,
    STATE_MOTION_SUSPICIOUS = 2,
    STATE_RANGE_WARNING = 3,
    STATE_ALARM_SNATCH = 4,
    STATE_ALARM_RANGE = 5
};

struct DetectionConfig {
    float rssiThreshold = -85.0f;       // dBm (Medium default)
    int64_t gracePeriodMs = 3000;       // Grace period before range alarm fires
    float jerkThreshold = 18.0f;        // m/s^3 (quick snatch pull)
    float accelMagnitudeThreshold = 16.0f; // m/s^2 (~1.6g grab)
    float gyroRateThreshold = 3.0f;     // rad/s (~170 deg/s twist)
    float sustainedMotionVarianceMin = 5.0f; // m^2/s^4 (running/cycling vs static drop)
    int64_t snatchConfirmWindowMs = 3500; // Time window after jerk to confirm snatch
    bool autoDisarmOnReturn = true;      // Auto-disarm if tag returns strongly in range
    float recoveryHysteresisDb = 5.0f;   // RSSI must be (threshold + hysteresis) to recover
};

class SnatchDetector {
public:
    explicit SnatchDetector(const DetectionConfig& config = DetectionConfig());

    void setArmed(bool armed);
    bool isArmed() const;

    void updateConfig(const DetectionConfig& config);
    const DetectionConfig& getConfig() const;

    // Feeds BLE RSSI measurement (called ~1Hz or on read Remote RSSI)
    DetectorState processRssi(float rawRssi, int64_t timestampMs);

    // Feeds IMU sample (called ~50Hz)
    DetectorState processImu(float ax, float ay, float az,
                            float gx, float gy, float gz,
                            int64_t timestampMs);

    // Called when BLE link drops unexpectedly
    DetectorState notifyBleDisconnected(int64_t timestampMs);

    // Called when BLE reconnects
    DetectorState notifyBleConnected(int64_t timestampMs);

    // Manual disarm (PIN/Biometric)
    void disarm();

    // Reset detector state without changing armed status
    void reset();

    DetectorState getState() const;
    float getFilteredRssi() const;
    float getLastJerk() const;
    float getRecentMotionVariance() const;

private:
    DetectionConfig config_;
    DetectorState state_;
    RssiKalmanFilter rssiFilter_;

    bool isArmed_;
    bool bleConnected_;

    // Timing tracking
    int64_t lastRssiTimestampMs_;
    int64_t rangeBreachStartMs_;
    int64_t jerkDetectedTimeMs_;
    int64_t lastImuTimestampMs_;

    // IMU state & sliding window for variance
    float prevAccelMag_;
    float lastCalculatedJerk_;
    float recentVariance_;

    static constexpr size_t ACCEL_WINDOW_SIZE = 40; // ~0.8s window at 50Hz
    float accelMagWindow_[ACCEL_WINDOW_SIZE];
    size_t windowIndex_;
    size_t windowCount_;

    // Recovery tracking
    int inRangeRecoveryCount_;

    void calculateVariance();
};

} // namespace marshmello

#endif // SNATCH_DETECTOR_H

