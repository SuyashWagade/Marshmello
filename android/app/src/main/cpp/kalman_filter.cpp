#include "include/kalman_filter.h"
#include <cmath>

namespace marshmello {

RssiKalmanFilter::RssiKalmanFilter(float processNoise, float measurementNoise,
                                   float estimationError)
    : q_(processNoise), r_(measurementNoise), p_(estimationError), x_(-60.0f),
      k_(0.0f), initialized_(false) {}

void RssiKalmanFilter::reset(float initialValue) {
  x_ = initialValue;
  p_ = 2.0f;
  k_ = 0.0f;
  initialized_ = true;
}

float RssiKalmanFilter::update(float measurement) {
  if (!initialized_) {
    reset(measurement);
    return x_;
  }

  // 1. Time Update (Prediction)
  // For 1D random walk: x_{k|k-1} = x_{k-1|k-1}
  // P_{k|k-1} = P_{k-1|k-1} + Q
  p_ = p_ + q_;

  // Outlier rate-limiting: clamp extreme momentary RF spikes (> 25 dBm jump)
  float diff = measurement - x_;
  if (std::fabs(diff) > 25.0f) {
    measurement = x_ + (diff > 0.0f ? 25.0f : -25.0f);
  }

  // 2. Measurement Update (Correction)
  // K_k = P_{k|k-1} / (P_{k|k-1} + R)
  k_ = p_ / (p_ + r_);

  // x_{k|k} = x_{k|k-1} + K_k * (z_k - x_{k|k-1})
  x_ = x_ + k_ * (measurement - x_);

  // P_{k|k} = (1 - K_k) * P_{k|k-1}
  p_ = (1.0f - k_) * p_;

  return x_;
}

float RssiKalmanFilter::getState() const { return x_; }

bool RssiKalmanFilter::isInitialized() const { return initialized_; }

void RssiKalmanFilter::setParameters(float processNoise,
                                     float measurementNoise) {
  q_ = processNoise;
  r_ = measurementNoise;
}

} // namespace marshmello
