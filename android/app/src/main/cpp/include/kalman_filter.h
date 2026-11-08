#ifndef KALMAN_FILTER_H
#define KALMAN_FILTER_H

namespace marshmello {

/**
 * 1D Kalman Filter for Bluetooth Low Energy RSSI smoothing.
 * Filters out high-frequency multipath RF noise, reflections, and antenna fade
 * while responding promptly to true tag distance changes.
 */
class RssiKalmanFilter {
public:
    /**
     * @param processNoise Q: Process noise covariance (expected rate of physical change)
     * @param measurementNoise R: Measurement noise covariance (RF sensor jitter)
     * @param estimationError P: Initial estimation error covariance
     */
    RssiKalmanFilter(float processNoise = 0.12f, float measurementNoise = 4.0f, float estimationError = 2.0f);

    void reset(float initialValue = -60.0f);
    float update(float measurement);
    float getState() const;
    bool isInitialized() const;

    void setParameters(float processNoise, float measurementNoise);

private:
    float q_;         // Process noise covariance
    float r_;         // Measurement noise covariance
    float p_;         // Estimation error covariance
    float x_;         // Current filtered state estimate
    float k_;         // Kalman gain
    bool initialized_;
};

} // namespace marshmello

#endif // KALMAN_FILTER_H

