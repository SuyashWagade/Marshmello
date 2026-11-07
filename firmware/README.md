# Marshmello ESP32 Tag Firmware

## Hardware Wiring & Bill of Materials

| Component | ESP32 Pin | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| **LED** | GPIO 2 | Status visual indicator | Built-in DevKit LED or external blue/green LED (220Ω resistor) |
| **Buzzer** | GPIO 4 | Acoustic alarm when phone is snatched/lost | Active 3.3V or 5V buzzer (transistor driver recommended) |
| **Push Button** | GPIO 0 | Manual ping / silence / disarm confirmation | Built-in `BOOT` button or external tactile switch (active LOW) |
| **Battery ADC** | GPIO 34 | 1S LiPo voltage divider (100kΩ / 100kΩ) | Optional: 0–3.3V input range for battery percentage |

## Flashing & Build Instructions

### Method 1: Using PlatformIO CLI
```bash
cd firmware
pio run --target upload
pio device monitor -b 115200
```

### Method 2: Using Arduino IDE
1. Install **ESP32 by Espressif Systems** via Boards Manager (v2.0.14+).
2. Install the **NimBLE-Arduino** library (v1.4.2) via Library Manager.
3. Open `firmware/src/main.cpp` (save as `Marshmello_Tag.ino`).
4. Select board: `ESP32 Dev Module` (or `ESP32-C3 Dev Module`).
5. Upload and open Serial Monitor at `115200 baud`.

## BLE GATT Protocol Specification

- **Device Name**: `Marshmello-Tag`
- **TX Power**: `+9 dBm` (`ESP_PWR_LVL_P9`)
- **Service UUID**: `19B10000-E8F2-537E-4F6C-D104768A1214`
- **Characteristics**:
  - `19B10001-E8F2-537E-4F6C-D104768A1214` (Battery): uint8 `[0..100]`
  - `19B10002-E8F2-537E-4F6C-D104768A1214` (Status): uint8 bitmask
    - `Bit 0`: Button pressed (1 = pressed, 0 = released)
    - `Bit 1`: Phone connected
    - `Bit 2`: Armed state
  - `19B10003-E8F2-537E-4F6C-D104768A1214` (Command): uint8
    - `0x01`: Phone Armed
    - `0x02`: Phone Disarmed
    - `0x03`: Sound Tag Buzzer
    - `0x04`: Silence Tag Buzzer

