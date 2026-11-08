# Calibration & Safe Testing Plan

This document outlines how to calibrate BLE RSSI values for your specific ESP32 antenna and phone casing, and how to safely simulate snatch attacks without risking hardware damage.

---

## 1. BLE RSSI Distance Calibration Protocol

BLE signal strength (RSSI) varies based on phone casing (aluminum, glass, polycarbonate), antenna geometry, and environment. We use the **Log-Distance Path Loss Model**:

$$RSSI(d) = - (10 \cdot n \cdot \log_{10}(d) - A)$$

Where:
* $d$: Distance in meters.
* $A$: Measured RSSI at exactly **1.0 meter** (Reference RSSI).
* $n$: Path loss exponent ($2.0$ for open outdoor space, $2.7 - 3.5$ in urban/indoor streets).

### Step-by-Step Measurement Procedure
1. Flash the ESP32 tag with `Marshmello-Tag` firmware (TX power set to `+9 dBm`).
2. Power the ESP32 via a 1S LiPo or battery pack and place it at waist height (e.g., on a wooden table or in your pocket).
3. Open the Marshmello app on the Android phone.
4. Measure distances with a tape measure along a line of sight:

| Distance | Expected Raw RSSI Range | Expected Kalman Smoothed RSSI | Suggested Sensitivity Level |
| :--- | :--- | :--- | :--- |
| **1.0 meter** (Baseline $A$) | $-58\text{ dBm}$ to $-64\text{ dBm}$ | $-60.5\text{ dBm}$ | Intimate range |
| **5.0 meters** | $-72\text{ dBm}$ to $-78\text{ dBm}$ | $-75.0\text{ dBm}$ | **Near Mode** (Cafes, crowded subways) |
| **10.0 meters** | $-82\text{ dBm}$ to $-88\text{ dBm}$ | $-85.0\text{ dBm}$ | **Medium Mode** (Default street walking) |
| **20.0 meters** | $-89\text{ dBm}$ to $-95\text{ dBm}$ | $-92.0\text{ dBm}$ | **Far Mode** (Jogging, open parks, cycling) |

### Fine-Tuning the C++ Thresholds
If your phone has thick armor casing or metal bumper:
* In `SettingsScreen.tsx` or `snatch_detector.h`:
  * If false range alarms occur too frequently in pocket: **Lower the threshold by 3–5 dBm** (e.g. change Medium from `-85.0f` to `-88.0f`).
  * If the alarm takes too long to trigger when moving away: **Raise the threshold by 3–5 dBm** (e.g. change Medium to `-82.0f`).

---

## 2. Safe Snatch Simulation Protocols

Never throw or drop an unprotected phone on hard concrete. Follow these controlled testing methods:

### Test Scenario A: Two-Person Separation Test (Range Breach & Grace Period)
1. **Setup**:
   * Person A holds the ESP32 tag at their waist.
   * Person B holds the phone with Marshmello armed.
   * Grace period set to `3 seconds` in Settings.
2. **Execution**:
   * Person B begins walking away from Person A at normal walking speed (~1.3 m/s).
3. **Verification**:
   * At approximately 10–12 meters, the phone status transitions to **Range Warning** (orange).
   * After exactly 3 seconds below `-85 dBm`, the siren and camera flash engage at maximum volume.
   * Person B touches the fingerprint sensor: alarm stops immediately.

### Test Scenario B: Safe Motion Jerk & Sprint Simulation (Snatch Theft)
1. **Safety Setup**:
   * Conduct over a grass lawn, soft sofa, or thick gym mat.
   * Attach a secure wrist lanyard to the phone if possible.
2. **Execution**:
   * Hold the phone in your hand as if reading an SMS.
   * Partner (wearing running shoes) swiftly grasps the phone from your hand with a sudden pulling jerk ($Jerk > 28\text{ m/s}^3$) and sprints 5–10 steps away from you (tag remains with you).
3. **Verification**:
   * Within **< 1.5 seconds**, the C++ core fuses the peak jerk with the rapid acceleration variance ($Var > 5.0$) and the collapsing RSSI, immediately triggering `STATE_ALARM_SNATCH` before the standard range grace period expires.
   * Both the phone siren and the ESP32 tag buzzer chirp.

### Test Scenario C: False Alarm Rejection (Pocket Jogging & Dropping)
1. **Jogging / Running with Tag**: Put both phone and tag in pockets. Run for 1 minute.
   * **Expected Result**: Jerk is low ($< 15\text{ m/s}^3$) and RSSI remains steady at $-62\text{ dBm}$. **No alarm**.
2. **Dropping Phone onto Sofa**: Drop phone from 1 meter onto soft cushions while tag is nearby.
   * **Expected Result**: A sudden jerk occurs on impact, but motion variance immediately drops to zero ($Var \approx 0$) and tag RSSI remains $-60\text{ dBm}$. Confirmation window times out after 3.5 seconds. **No alarm**.

