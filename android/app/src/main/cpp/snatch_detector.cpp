#include "include/snatch_detector.h"
#include <cmath>
#include <algorithm>

namespace marshmello {

SnatchDetector::SnatchDetector(const DetectionConfig& config)
    : config_(config),
      state_(STATE_DISARMED),
      rssiFilter_(0.12f, 4.0f, 2.0f),
      isArmed_(false),
      bleConnected_(false),
      lastRssiTimestampMs_(0),
      rangeBreachStartMs_(0),
      jerkDetectedTimeMs_(0),
      lastImuTimestampMs_(0),
      prevAccelMag_(9.81f),
      lastCalculatedJerk_(0.0f),
      recentVariance_(0.0f),
      windowIndex_(0),
      windowCount_(0),
      inRangeRecoveryCount_(0) {
    for (size_t i = 0; i < ACCEL_WINDOW_SIZE; ++i) {
        accelMagWindow_[i] = 9.81f;
    }
}

void SnatchDetector::setArmed(bool armed) {
    isArmed_ = armed;
    if (armed) {
        if (state_ == STATE_DISARMED) {
            state_ = STATE_IDLE_ARMED;
        }
    } else {
        state_ = STATE_DISARMED;
    }
    reset();
}

bool SnatchDetector::isArmed() const {
    return isArmed_;
}

void SnatchDetector::updateConfig(const DetectionConfig& config) {
    config_ = config;
}

const DetectionConfig& SnatchDetector::getConfig() const {
    return config_;
}

void SnatchDetector::disarm() {
    isArmed_ = false;
    state_ = STATE_DISARMED;
    reset();
}

void SnatchDetector::reset() {
    rangeBreachStartMs_ = 0;
    jerkDetectedTimeMs_ = 0;
    inRangeRecoveryCount_ = 0;
    lastCalculatedJerk_ = 0.0f;
    recentVariance_ = 0.0f;
    windowIndex_ = 0;
    windowCount_ = 0;
    if (isArmed_) {
        state_ = STATE_IDLE_ARMED;
    }
}

DetectorState SnatchDetector::processRssi(float rawRssi, int64_t timestampMs) {
    lastRssiTimestampMs_ = timestampMs;
    bleConnected_ = true;

    float filtered = rssiFilter_.update(rawRssi);

    if (!isArmed_) {
        return state_;
    }

    // 1. Recovery Check: Is tag back in close range?
    if (filtered >= (config_.rssiThreshold + config_.recoveryHysteresisDb)) {
        inRangeRecoveryCount_++;
        if (inRangeRecoveryCount_ >= 3) {
            // Signal has stably returned
            rangeBreachStartMs_ = 0;
            if (state_ == STATE_RANGE_WARNING ||
               ((state_ == STATE_ALARM_RANGE || state_ == STATE_ALARM_SNATCH) && config_.autoDisarmOnReturn)) {
                state_ = STATE_IDLE_ARMED;
                return state_;
            }
        }
    } else {
        inRangeRecoveryCount_ = 0;
    }

    // If alarm is already triggered, remain in alarm unless auto-disarmed above
    if (state_ == STATE_ALARM_SNATCH || state_ == STATE_ALARM_RANGE) {
        return state_;
    }

    // 2. Range Breach Detection
    if (filtered < config_.rssiThreshold) {
        if (rangeBreachStartMs_ == 0) {
            rangeBreachStartMs_ = timestampMs;
        }

        int64_t breachDuration = timestampMs - rangeBreachStartMs_;

        // If a sudden jerk was recently detected AND RSSI is dropping below threshold -> SNATCH ALARM!
        if (state_ == STATE_MOTION_SUSPICIOUS || (timestampMs - jerkDetectedTimeMs_ < config_.snatchConfirmWindowMs)) {
            state_ = STATE_ALARM_SNATCH;
            return state_;
        }

        // Grace period check for pure range loss
        if (breachDuration >= config_.gracePeriodMs) {
            state_ = STATE_ALARM_RANGE;
        } else {
            state_ = STATE_RANGE_WARNING;
        }
    } else {
        // RSSI is above threshold
        rangeBreachStartMs_ = 0;
        if (state_ == STATE_RANGE_WARNING) {
            state_ = STATE_IDLE_ARMED;
        }
    }

    return state_;
}

DetectorState SnatchDetector::processImu(float ax, float ay, float az,
                                        float gx, float gy, float gz,
                                        int64_t timestampMs) {
    if (lastImuTimestampMs_ == 0) {
        lastImuTimestampMs_ = timestampMs;
        prevAccelMag_ = std::sqrt(ax * ax + ay * ay + az * az);
        return state_;
    }

    float dt = (timestampMs - lastImuTimestampMs_) / 1000.0f;
    lastImuTimestampMs_ = timestampMs;

    if (dt <= 0.0001f || dt > 0.5f) {
        // Discard invalid or interrupted intervals
        return state_;
    }

    float currentMag = std::sqrt(ax * ax + ay * ay + az * az);
    float gyroMag = std::sqrt(gx * gx + gy * gy + gz * gz);

    // Jerk = d|a|/dt
    float deltaA = std::fabs(currentMag - prevAccelMag_);
    lastCalculatedJerk_ = deltaA / dt;
    prevAccelMag_ = currentMag;

    // Push into sliding window for variance computation
    accelMagWindow_[windowIndex_] = currentMag;
    windowIndex_ = (windowIndex_ + 1) % ACCEL_WINDOW_SIZE;
    if (windowCount_ < ACCEL_WINDOW_SIZE) {
        windowCount_++;
    }
    calculateVariance();

    if (!isArmed_) {
        return state_;
    }

    // Already in alarm state
    if (state_ == STATE_ALARM_SNATCH || state_ == STATE_ALARM_RANGE) {
        return state_;
    }

    // High jerk detection (snatch jerk)
    bool highJerk = (lastCalculatedJerk_ >= config_.jerkThreshold && currentMag >= config_.accelMagnitudeThreshold);
    bool violentTwist = (lastCalculatedJerk_ >= (config_.jerkThreshold * 0.75f) && gyroMag >= config_.gyroRateThreshold);

    if (highJerk || violentTwist) {
        jerkDetectedTimeMs_ = timestampMs;

        // If the tag is already in range warning, disconnected, or low RSSI -> immediate snatch alarm!
        if (state_ == STATE_RANGE_WARNING || !bleConnected_ || rssiFilter_.getState() < config_.rssiThreshold) {
            state_ = STATE_ALARM_SNATCH;
        } else {
            state_ = STATE_MOTION_SUSPICIOUS;
        }
    }

    // If in suspicious motion state, check confirmation window
    if (state_ == STATE_MOTION_SUSPICIOUS) {
        int64_t elapsedSinceJerk = timestampMs - jerkDetectedTimeMs_;

        if (elapsedSinceJerk > config_.snatchConfirmWindowMs) {
            // Confirmation window timed out without range drop -> false alarm, return to armed idle
            state_ = STATE_IDLE_ARMED;
        } else {
            // Sustained running / displacement motion while RSSI begins dropping
            if (recentVariance_ >= config_.sustainedMotionVarianceMin && 
                (!bleConnected_ || rssiFilter_.getState() < (config_.rssiThreshold + 3.0f))) {
                state_ = STATE_ALARM_SNATCH;
            }
        }
    }

    return state_;
}

DetectorState SnatchDetector::notifyBleDisconnected(int64_t timestampMs) {
    bleConnected_ = false;

    if (!isArmed_) {
        return state_;
    }

    if (state_ == STATE_ALARM_SNATCH || state_ == STATE_ALARM_RANGE) {
        return state_;
    }

    // If jerk occurred in the last 3.5 seconds and BLE disconnects -> definite snatch!
    if (state_ == STATE_MOTION_SUSPICIOUS || (timestampMs - jerkDetectedTimeMs_ < config_.snatchConfirmWindowMs)) {
        state_ = STATE_ALARM_SNATCH;
        return state_;
    }

    // Immediate alarm if grace period is 0, otherwise range warning
    if (config_.gracePeriodMs == 0) {
        state_ = STATE_ALARM_RANGE;
    } else {
        if (rangeBreachStartMs_ == 0) {
            rangeBreachStartMs_ = timestampMs;
        }
        state_ = STATE_RANGE_WARNING;
    }

    return state_;
}

DetectorState SnatchDetector::notifyBleConnected(int64_t timestampMs) {
    (void)timestampMs;
    bleConnected_ = true;
    inRangeRecoveryCount_ = 0;
    return state_;
}

void SnatchDetector::calculateVariance() {
    if (windowCount_ == 0) {
        recentVariance_ = 0.0f;
        return;
    }

    float sum = 0.0f;
    for (size_t i = 0; i < windowCount_; ++i) {
        sum += accelMagWindow_[i];
    }
    float mean = sum / windowCount_;

    float varSum = 0.0f;
    for (size_t i = 0; i < windowCount_; ++i) {
        float diff = accelMagWindow_[i] - mean;
        varSum += diff * diff;
    }
    recentVariance_ = varSum / windowCount_;
}

DetectorState SnatchDetector::getState() const {
    return state_;
}

float SnatchDetector::getFilteredRssi() const {
    return rssiFilter_.getState();
}

float SnatchDetector::getLastJerk() const {
    return lastCalculatedJerk_;
}

float SnatchDetector::getRecentMotionVariance() const {
    return recentVariance_;
}

} // namespace marshmello
