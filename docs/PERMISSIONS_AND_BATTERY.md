# Android Permissions & OEM Battery Optimization Guide

Marshmello is a real-time safety and anti-theft system. To operate reliably, it must remain running with low BLE latency even when the screen is turned off and the phone has been idle for hours.

---

## 1. Required Android Permissions Matrix

| Permission | Android API Level | Protection Level | Purpose in Marshmello |
| :--- | :--- | :--- | :--- |
| `BLUETOOTH_SCAN` | API 31+ (Android 12+) | Runtime (`dangerous`) | Continuous background BLE discovery and beacon monitoring (`neverForLocation` flag declared). |
| `BLUETOOTH_CONNECT` | API 31+ (Android 12+) | Runtime (`dangerous`) | GATT connection, RSSI polling (`readRemoteRssi`), and tag command transmission. |
| `ACCESS_FINE_LOCATION` | All (Fallback API <31) | Runtime (`dangerous`) | Required on Android 6–11 to perform BLE scans. |
| `FOREGROUND_SERVICE` | API 28+ (Android 9+) | Normal | Runs `MarshmelloForegroundService` continuously in the background. |
| `FOREGROUND_SERVICE_CONNECTED_DEVICE` | API 34+ (Android 14+) | Normal | Required declaration for foreground services interacting with BLE peripherals. |
| `POST_NOTIFICATIONS` | API 33+ (Android 13+) | Runtime (`dangerous`) | Displays ongoing security status and instant snatch breach alerts. |
| `USE_FULL_SCREEN_INTENT` | API 29+ (Android 10+) | Normal / Special | Illuminates screen and launches emergency alarm interface over the lockscreen. |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | API 23+ (Android 6+) | Normal / Intent prompt | Excludes the app from Android Doze mode and App Standby buckets. |
| `WAKE_LOCK` | All | Normal | Prevents CPU sleep while alarm siren is sounding and siren loop is active. |
| `MODIFY_AUDIO_SETTINGS` | All | Normal | Overrides volume to 100% on `STREAM_ALARM`. |
| `CAMERA` / `FLASHLIGHT` | All | Runtime / Normal | Rapidly strobes the rear camera LED during active theft alarms. |
| `USE_BIOMETRIC` | API 28+ | Normal | Secure fingerprint/face authentication for owner disarm. |

---

## 2. Surviving OEM Aggressive Task Killers

Android OEMs (Xiaomi, Samsung, Oppo, Vivo, OnePlus) enforce aggressive proprietary battery managers that terminate background foreground services after 10–30 minutes unless explicit manufacturer-specific exemptions are granted.

### A. Xiaomi / POCO / Redmi (MIUI & HyperOS)
Xiaomi kills background BLE polling aggressively via "MIUI Battery Saver".
* **Required Actions**:
  1. **Autostart**: `Settings -> Apps -> Manage Apps -> Marshmello -> Autostart -> Allow`.
  2. **Battery Saver**: Set to **"No restrictions"** (default is "MIUI Battery saver (recommended)", which kills BLE services after 10 minutes of screen-off).
  3. **Lock in Recents**: Open App Switcher, long-press Marshmello card, tap the **Padlock icon**.
* **Direct Intent Trigger in Kotlin**:
  ```kotlin
  val intent = Intent().apply {
      component = ComponentName(
          "com.miui.securitycenter",
          "com.miui.permcenter.autostart.AutoStartManagementActivity"
      )
  }
  context.startActivity(intent)
  ```

### B. Samsung Galaxy (OneUI 4.0 / 5.0 / 6.0)
Samsung automatically places apps into "Sleeping apps" or "Deep sleeping apps" after 3 days of non-interactive use.
* **Required Actions**:
  1. `Settings -> Apps -> Marshmello -> Battery -> Select "Unrestricted"` (default is "Optimized").
  2. `Settings -> Battery -> Background usage limits -> Never sleeping apps -> Add Marshmello`.
  3. Disable "Put unused apps to sleep".
* **Direct Intent Trigger in Kotlin**:
  ```kotlin
  val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
  context.startActivity(intent)
  ```

### C. Oppo / Realme / OnePlus (ColorOS / OxygenOS)
ColorOS restricts background sensor sampling and BLE scan intervals when the phone is locked.
* **Required Actions**:
  1. `Settings -> Battery -> Advanced Settings -> Optimize battery use -> Marshmello -> Don't optimize`.
  2. `App Info -> Battery Usage -> Allow background activity` AND `Allow auto-launch`.
  3. Pin app in Recent Tasks.
* **Direct Intent Trigger in Kotlin**:
  ```kotlin
  val intent = Intent().apply {
      component = ComponentName(
          "com.coloros.safecenter",
          "com.coloros.safecenter.permission.startup.StartupAppListActivity"
      )
  }
  context.startActivity(intent)
  ```

---

## 3. Stock Android Doze Mode Exemption Prompt

To request system-level Doze exemption directly in-app:
```kotlin
val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
if (!powerManager.isIgnoringBatteryOptimizations(context.packageName)) {
    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
        data = Uri.parse("package:${context.packageName}")
    }
    context.startActivity(intent)
}
```

