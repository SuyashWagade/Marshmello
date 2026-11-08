# Marshmello: Anti-Snatch-Theft System for Android & ESP32

**Marshmello** is a production-grade, anti-snatch-theft safety system designed to protect smartphones in urban environments. It pairs an Android smartphone with an ultra-portable ESP32 BLE hardware tag carried by the owner (in a pocket, keychain, or belt clip).

When a thief snatches the phone from your hand or pocket and runs, Marshmello detects the signature physical jerk, rapid displacement motion, and RF range collapse—immediately blasting a maximum-volume alarm siren, strobing the camera LED flashlight, flashing the display, and chirping the ESP32 tag buzzer. Disarming requires owner authentication via biometric fingerprint/PIN or returning within close proximity of the tag.

---

## Repository Structure

```
Marshmello/
├── firmware/                              # ESP32 BLE Peripheral Firmware
│   ├── platformio.ini                     # PlatformIO configuration & NimBLE dependencies
│   ├── README.md                          # Pinout wiring & hardware flashing instructions
│   └── src/
│       └── main.cpp                       # NimBLE peripheral, +9dBm TX, battery ADC, buzzer & button
├── android/                               # Native Android Subproject
│   ├── build.gradle                       # Top-level Gradle script
│   ├── settings.gradle                    # Module settings
│   ├── gradle.properties                  # JVM & Hermes configuration
│   └── app/
│       ├── build.gradle                   # Android app Gradle, NDK & CMake binding
│       ├── CMakeLists.txt                 # NDK CMake build script for libmarshmello_core.so
│       └── src/
│           └── main/
│               ├── AndroidManifest.xml    # Permissions, service type connectedDevice, lockscreen flags
│               ├── cpp/                   # High-Performance C++ Core
│               │   ├── include/
│               │   │   ├── kalman_filter.h    # 1D Kalman Filter for RSSI smoothing
│               │   │   └── snatch_detector.h  # Multi-sensor fusion snatch state machine
│               │   ├── kalman_filter.cpp
│               │   ├── snatch_detector.cpp
│               │   └── marshmello_jni.cpp     # JNI bridge binding C++ to Kotlin
│               ├── java/com/marshmello/
│               │   ├── MainActivity.kt        # Entry activity waking & showing over lockscreen
│               │   ├── MainApplication.kt    # React Native application setup
│               │   ├── MarshmelloPackage.kt   # Native module package registry
│               │   ├── MarshmelloModule.kt    # React Native JNI bridge & BiometricPrompt
│               │   ├── alarm/
│               │   │   ├── AlarmController.kt # USAGE_ALARM max volume audio & vibrator
│               │   │   └── TorchController.kt # 11Hz camera flashlight strobe thread
│               │   ├── ble/
│               │   │   ├── BleConstants.kt    # Custom Service & Characteristic UUIDs
│               │   │   └── BleManager.kt      # GATT client, 1Hz RSSI poller, auto-reconnect
│               │   ├── core/
│               │   │   └── NativeDetectorCore.kt # Kotlin JNI wrapper
│               │   ├── sensors/
│               │   │   └── MotionSensorManager.kt # 50Hz Accel + Gyro sensor listener
│               │   ├── service/
│               │   │   └── MarshmelloForegroundService.kt # Persistent connectedDevice service
│               │   └── wear/
│               │       └── WearProtocolBridge.kt # Broadcast & data protocol for Wear OS
│               └── res/
│                   ├── raw/
│                   │   └── siren.wav          # High-decibel emergency siren audio asset
│                   └── values/
│                       └── strings.xml
├── src/                                   # React Native UI (TypeScript)
│   ├── App.tsx                            # Root component with runtime permissions
│   ├── native/
│   │   └── MarshmelloNative.ts            # Typed TypeScript bridge to NativeModule
│   ├── state/
│   │   └── AppStateContext.tsx            # Global state, persistence & settings
│   ├── theme/
│   │   └── colors.ts                      # Cyber-safety dark theme palette
│   ├── navigation/
│   │   └── AppNavigator.tsx               # Stack navigator with auto-alarm redirection
│   └── screens/
│       ├── HomeScreen.tsx                 # Arm/disarm toggle, RSSI signal gauge, battery status
│       ├── PairTagScreen.tsx              # BLE peripheral discovery, signal meter, tag pairing
│       ├── SettingsScreen.tsx             # Range sensitivity, grace period, backup PIN
│       └── AlarmScreen.tsx                # Emergency flashing strobe screen & disarm prompt
├── docs/
│   ├── ARCHITECTURE.md                    # In-depth architectural blueprint & math formulas
│   ├── PERMISSIONS_AND_BATTERY.md         # Android permissions & Xiaomi/Samsung/Oppo guide
│   ├── CALIBRATION_AND_TEST_PLAN.md       # RSSI tuning & safe snatch simulation protocol
│   └── WEAR_OS_INTEGRATION.md             # Wear OS companion app protocol & guide
├── package.json                           # Minimal React Native dependencies
├── tsconfig.json                          # Strict TypeScript configuration
├── metro.config.js                        # Metro bundler config
└── index.js                               # Application entry point
```

---

## Prerequisites & Exact Versions

* **Node.js**: `v18+` or `v20+` (`v22` supported)
* **React Native**: `0.74.5`
* **React**: `18.3.1`
* **TypeScript**: `5.5.4`
* **Android SDK**: Compile SDK `34`, Min SDK `26` (Android 8.0+), Target SDK `34`
* **Android NDK**: `26.1.10909125` (or compatible NDK r25+)
* **CMake**: `3.22.1+`
* **ESP32 Toolchain**: PlatformIO Core `6.x` or Arduino IDE `2.x` with `NimBLE-Arduino @ ^1.4.2`

---

## 1. Flash the ESP32 Hardware Tag

1. Connect your ESP32 board (ESP32-DevKitC, ESP32-C3, or ESP32-S3) via USB.
2. Build and flash using PlatformIO:
   ```bash
   cd firmware
   pio run --target upload
   pio device monitor -b 115200
   ```
3. Observe the Serial Monitor:
   ```
   ===========================================
     Marshmello Anti-Snatch BLE Tag v1.0.0
   ===========================================
   [BLE] Advertising started as 'Marshmello-Tag' at max TX (+9dBm).
   ```
4. Built-in LED on GPIO 2 will flash briefly once per second indicating advertising mode.

---

## 2. Compile & Run the Android Application

1. Install Node dependencies:
   ```bash
   npm install
   ```
2. Connect your Android test phone via USB with **USB Debugging** enabled:
   ```bash
   adb devices
   ```
3. Build and install the React Native app with native C++ NDK library:
   ```bash
   npm run android
   ```
   *(Alternatively: Open the `/android` directory in Android Studio and click Run).*

---

## 3. How to Use Marshmello

1. **Grant Permissions**:
   * On first launch, approve **Nearby Devices (Bluetooth)**, **Location**, **Notifications**, and **Camera** permissions.
2. **Pair Your Tag**:
   * Tap **"Pair"** or navigate to the Pair Tag screen.
   * Tap **Scan**. When `Marshmello-Tag` appears with signal strength, tap **Pair**. The tag MAC address is permanently remembered in encrypted storage.
3. **Arm the System**:
   * On the Home screen, tap **ARM SYSTEM NOW**.
   * A persistent foreground notification appears: `"Marshmello ARMED - Monitoring Active"`.
   * The ESP32 LED turns solid ON, indicating an armed, secure BLE link.
4. **Snatch Protection in Action**:
   * **Sudden Snatch**: If someone rips the phone from your hand and sprints away, the phone senses the sudden acceleration jerk combined with running motion and dropping RSSI, triggering the alarm within **< 1.5 seconds**.
   * **Distance Separation**: If you leave your phone behind in a cafe or on a bench, when the filtered RSSI stays below your configured threshold (e.g. `-85 dBm`) for the configured grace period (e.g. 3 seconds), the siren activates.
5. **Disarming**:
   * Touch the fingerprint sensor or enter your 4-digit backup PIN on the Alarm screen.
   * Alternatively, if **Auto-Disarm on Tag Return** is enabled, bringing the phone back within 2–3 meters of the tag automatically silences the siren.

---

## Known Limitations & Next Steps

### Known Limitations
1. **RF Multipath Interference in Dense Crowds**: Dense bodies of water (including human crowds) attenuate 2.4 GHz RF signals by 3–8 dBm. In extremely packed trains, a user holding the phone in front while the tag is in the back pocket might experience momentary RSSI attenuation (mitigated by setting sensitivity to `Medium` or `Far` with a 3–5s grace period).
2. **Aggressive OEM Task Killers**: On Xiaomi/MIUI, Samsung/OneUI, and Oppo/ColorOS, users must manually grant "No restrictions" under Battery settings to ensure the background service is never killed. Direct intent shortcuts are provided in [`docs/PERMISSIONS_AND_BATTERY.md`](file:///home/suyash/Marshmello/docs/PERMISSIONS_AND_BATTERY.md).
3. **Bluetooth Radio Hardware Resets**: On certain budget chipsets, the BLE stack may occasionally drop GATT connections; Marshmello's automatic reconnect engine handles this within 2.5 seconds.

### Next Steps & Roadmap
1. **Ultra-Wideband (UWB) Support**: Incorporate FiRa / Android UWB API (Android 12+) for centimeter-accurate distance and angle-of-arrival (AoA) tracking on supported phones (Pixel Pro, Galaxy Ultra).
2. **Wear OS Smartwatch Companion Module**: Add the standalone `:wear` module implementing the pre-built protocol defined in [`docs/WEAR_OS_INTEGRATION.md`](file:///home/suyash/Marshmello/docs/WEAR_OS_INTEGRATION.md).
3. **Cellular GSM / GPS Fallback**: Trigger silent background SMS/cloud GPS dispatch to emergency contacts if the alarm is not disarmed within 60 seconds of theft.
4. **Hardware Miniaturization**: Custom PCB design for the tag using a coin-cell powered Nordic nRF52840 or ESP32-C3 in a 3D-printable keychain enclosure.

