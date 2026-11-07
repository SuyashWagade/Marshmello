/**
 * Marshmello-Tag Firmware
 * 
 * Hardware: ESP32-WROOM-32 / ESP32-S3 / ESP32-C3
 * Framework: Arduino + NimBLE-Arduino
 * 
 * Role: BLE Peripheral carried by phone owner (keychain / pocket).
 * Broadcasts as "Marshmello-Tag" with max TX power.
 * Reports battery percentage and button state to connected phone.
 * Alerts locally via buzzer and LED when BLE connection to phone is lost.
 */

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <esp_bt.h>

// ======================== HARDWARE PIN DEFINITIONS ========================
#define LED_PIN             2    // Built-in LED on ESP32 DevKit
#define BUZZER_PIN          4    // Active buzzer or PWM buzzer pin
#define BUTTON_PIN          0    // Boot button on GPIO 0 (active LOW)
#define BATTERY_ADC_PIN     34   // ADC pin connected to voltage divider (optional)

// ======================== BLE GATT UUID DEFINITIONS =======================
// Service: Marshmello Anti-Theft Service
#define SERVICE_UUID        "19B10000-E8F2-537E-4F6C-D104768A1214"
// Characteristic: Battery Level (0 - 100%) [Read, Notify]
#define CHAR_BATTERY_UUID   "19B10001-E8F2-537E-4F6C-D104768A1214"
// Characteristic: Tag Status & Button State [Read, Notify, Write]
// Bits: [0] = Button Pressed, [1] = Armed State, [2] = Tag Buzzer Request
#define CHAR_STATUS_UUID    "19B10002-E8F2-537E-4F6C-D104768A1214"
// Characteristic: Command from Phone (Buzzer trigger / Configuration) [Write]
#define CHAR_CMD_UUID       "19B10003-E8F2-537E-4F6C-D104768A1214"

// ======================== CONSTANTS & TIMINGS =============================
#define DEVICE_NAME         "Marshmello-Tag"
#define ADV_INTERVAL_MIN    80    // 80 * 0.625ms = 50ms
#define ADV_INTERVAL_MAX    160   // 160 * 0.625ms = 100ms
#define BATTERY_POLL_MS     15000 // 15 seconds
#define BUTTON_DEBOUNCE_MS  50    // 50ms
#define LOST_BUZZER_DURATION_MS 30000 // Buzz for max 30s upon unexpected loss

// ======================== STATE VARIABLES =================================
static NimBLEServer* pServer = nullptr;
static NimBLECharacteristic* pBatteryChar = nullptr;
static NimBLECharacteristic* pStatusChar = nullptr;
static NimBLECharacteristic* pCmdChar = nullptr;

static bool deviceConnected = false;
static bool oldDeviceConnected = false;
static bool isArmed = false;
static bool buzzerActive = false;

static uint8_t batteryLevel = 100;
static uint8_t tagStatusByte = 0x00;

static unsigned long lastBatteryReadTime = 0;
static unsigned long buzzerStartTime = 0;
static unsigned long lastBlinkTime = 0;

static int lastButtonState = HIGH;
static int buttonState = HIGH;
static unsigned long lastDebounceTime = 0;

// ======================== LED & BUZZER PATTERNS ===========================
enum TagLedMode {
    LED_MODE_ADVERTISING, // Fast flash (100ms on, 900ms off)
    LED_MODE_CONNECTED,   // Gentle heartbeat (solid or slow breathing)
    LED_MODE_ALERT        // Rapid flashing (100ms on, 100ms off)
};

static TagLedMode currentLedMode = LED_MODE_ADVERTISING;

void setBuzzer(bool state) {
    buzzerActive = state;
    digitalWrite(BUZZER_PIN, state ? HIGH : LOW);
}

void triggerLostPhoneAlert() {
    // If connection is lost, alert owner immediately with rapid strobe
    Serial.println("[MARSHMELLO] WARNING: Connection to phone LOST! Triggering rapid alert strobe.");
    currentLedMode = LED_MODE_ALERT;
    buzzerStartTime = millis();
    setBuzzer(true);
}

// ======================== BATTERY CALCULATION =============================
uint8_t readBatteryLevel() {
    // Read analog pin if wired with voltage divider (e.g. 100k / 100k to LiPo 3.7V - 4.2V)
    // Formula for 2:1 divider: V_batt = (ADC / 4095.0) * 3.3 * 2.0
    // If pin is floating or uncalibrated, return a safe simulated/default value.
    int raw = analogRead(BATTERY_ADC_PIN);
    if (raw < 500) {
        // Floating pin / USB powered default
        return 100;
    }
    float voltage = ((float)raw / 4095.0f) * 3.3f * 2.0f; // V_batt
    // Standard LiPo discharge curve approximation
    float pct = ((voltage - 3.3f) / (4.2f - 3.3f)) * 100.0f;
    if (pct > 100.0f) pct = 100.0f;
    if (pct < 0.0f) pct = 0.0f;
    return (uint8_t)pct;
}

// ======================== NIMBLE SERVER CALLBACKS =========================
class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer, ble_gap_conn_desc* desc) override {
        deviceConnected = true;
        isArmed = true; // Auto-arm protection whenever phone connects!
        currentLedMode = LED_MODE_CONNECTED;
        setBuzzer(false); // Stop alert buzzer if reconnected
        Serial.printf("[BLE] Client connected: %s\n", NimBLEAddress(desc->peer_ota_addr).toString().c_str());
        
        // Update status byte: bit 1 indicates phone connected, bit 2 armed
        tagStatusByte |= (1 << 1) | (1 << 2);
        pStatusChar->setValue(&tagStatusByte, 1);
        pStatusChar->notify();
    }

    void onDisconnect(NimBLEServer* pServer) override {
        deviceConnected = false;
        Serial.println("[BLE] Client disconnected.");
        
        tagStatusByte &= ~(1 << 1);
        pStatusChar->setValue(&tagStatusByte, 1);

        triggerLostPhoneAlert();

        // Restart advertising so phone can auto-reconnect
        NimBLEDevice::startAdvertising();
        Serial.println("[BLE] Restarted advertising.");
    }
};

// ======================== CHARACTERISTIC CALLBACKS =======================
class CommandCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pCharacteristic) override {
        std::string rxVal = pCharacteristic->getValue();
        if (rxVal.length() > 0) {
            uint8_t cmd = (uint8_t)rxVal[0];
            Serial.printf("[BLE] Command received from phone: 0x%02X\n", cmd);
            
            // Command 0x01: Armed state updated from phone
            // Command 0x02: Disarmed state updated from phone
            // Command 0x03: Trigger Tag Alarm (Find my tag or phone alarm sync)
            // Command 0x04: Silence Tag Alarm
            switch (cmd) {
                case 0x01:
                    isArmed = true;
                    tagStatusByte |= (1 << 2);
                    Serial.println("[STATE] Tag state: ARMED");
                    break;
                case 0x02:
                    isArmed = false;
                    tagStatusByte &= ~(1 << 2);
                    setBuzzer(false);
                    currentLedMode = LED_MODE_CONNECTED;
                    Serial.println("[STATE] Tag state: DISARMED");
                    break;
                case 0x03:
                    // Sound tag buzzer
                    buzzerStartTime = millis();
                    setBuzzer(true);
                    currentLedMode = LED_MODE_ALERT;
                    Serial.println("[ALERT] Tag buzzer activated by phone!");
                    break;
                case 0x04:
                    setBuzzer(false);
                    currentLedMode = isArmed ? LED_MODE_CONNECTED : LED_MODE_ADVERTISING;
                    Serial.println("[ALERT] Tag buzzer silenced by phone.");
                    break;
                default:
                    break;
            }
            pStatusChar->setValue(&tagStatusByte, 1);
            pStatusChar->notify();
        }
    }
};

// ======================== SETUP ===========================================
void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n===========================================");
    Serial.println("  Marshmello Anti-Snatch BLE Tag v1.0.0");
    Serial.println("===========================================");

    pinMode(LED_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    pinMode(BATTERY_ADC_PIN, INPUT);

    digitalWrite(LED_PIN, LOW);
    digitalWrite(BUZZER_PIN, LOW);

    // Initial chirp to indicate power-on
    digitalWrite(BUZZER_PIN, HIGH);
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
    digitalWrite(LED_PIN, LOW);

    // Initialize NimBLE
    NimBLEDevice::init(DEVICE_NAME);

    // Set BLE TX Power to MAX (+9dBm on ESP32) for strongest propagation and stable RSSI
    NimBLEDevice::setPower(ESP_PWR_LVL_P9);
    esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_DEFAULT, ESP_PWR_LVL_P9);
    esp_ble_tx_power_set(ESP_BLE_PWR_TYPE_ADV, ESP_PWR_LVL_P9);

    pServer = NimBLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());

    // Create Marshmello GATT Service
    NimBLEService* pService = pServer->createService(SERVICE_UUID);

    // Battery Characteristic
    pBatteryChar = pService->createCharacteristic(
        CHAR_BATTERY_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
    );
    batteryLevel = readBatteryLevel();
    pBatteryChar->setValue(&batteryLevel, 1);

    // Status Characteristic
    pStatusChar = pService->createCharacteristic(
        CHAR_STATUS_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::WRITE
    );
    pStatusChar->setValue(&tagStatusByte, 1);

    // Command Characteristic
    pCmdChar = pService->createCharacteristic(
        CHAR_CMD_UUID,
        NIMBLE_PROPERTY::WRITE
    );
    pCmdChar->setCallbacks(new CommandCallbacks());

    pService->start();

    // Configure Advertising
    NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinInterval(ADV_INTERVAL_MIN);
    pAdvertising->setMaxInterval(ADV_INTERVAL_MAX);
    pAdvertising->setMinPreferred(0x06); // functions that help with iPhone connections
    pAdvertising->setMaxPreferred(0x12);

    NimBLEDevice::startAdvertising();
    Serial.println("[BLE] Advertising started as 'Marshmello-Tag' at max TX (+9dBm).");
}

// ======================== BUTTON HANDLER ==================================
void handleButton() {
    int reading = digitalRead(BUTTON_PIN);
    if (reading != lastButtonState) {
        lastDebounceTime = millis();
    }

    if ((millis() - lastDebounceTime) > BUTTON_DEBOUNCE_MS) {
        if (reading != buttonState) {
            buttonState = reading;
            if (buttonState == LOW) {
                // Button pressed (Active LOW)
                Serial.println("[BUTTON] Tag button pressed!");
                tagStatusByte |= 0x01; // Bit 0 = button pressed
                pStatusChar->setValue(&tagStatusByte, 1);
                pStatusChar->notify();

                // If buzzer was sounding or alert blinking, manual button press silences it
                if (buzzerActive || currentLedMode == LED_MODE_ALERT) {
                    setBuzzer(false);
                    currentLedMode = deviceConnected ? LED_MODE_CONNECTED : LED_MODE_ADVERTISING;
                    Serial.println("[BUTTON] Alert buzzer and rapid strobe silenced by owner button press.");
                }
            } else {
                // Button released
                tagStatusByte &= ~0x01;
                pStatusChar->setValue(&tagStatusByte, 1);
                pStatusChar->notify();
            }
        }
    }
    lastButtonState = reading;
}

// ======================== LED / BUZZER TIMERS =============================
void updateVisualsAndBuzzer() {
    unsigned long now = millis();

    // Auto-silence buzzer after LOST_BUZZER_DURATION_MS to avoid draining battery
    if (buzzerActive && (now - buzzerStartTime > LOST_BUZZER_DURATION_MS)) {
        setBuzzer(false);
        Serial.println("[BUZZER] Alert buzzer timed out after 30 seconds.");
    }

    // Toggle buzzer pulsed chirp when active
    if (buzzerActive) {
        bool buzzPulse = ((now / 200) % 2) == 0;
        digitalWrite(BUZZER_PIN, buzzPulse ? HIGH : LOW);
    }

    // LED Pattern handler
    switch (currentLedMode) {
        case LED_MODE_ADVERTISING: {
            // Standby / Advertising: Blink once every 3 seconds (100ms ON, 2900ms OFF)
            bool ledOn = (now % 3000) < 100;
            digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
            break;
        }
        case LED_MODE_CONNECTED: {
            // Connected normal state: Blink once every 3 seconds (100ms ON, 2900ms OFF)
            bool ledOn = (now % 3000) < 100;
            digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
            break;
        }
        case LED_MODE_ALERT: {
            // Phone snatched or out of Bluetooth range: Rapid strobe (100ms ON, 100ms OFF)
            bool ledOn = (now % 200) < 100;
            digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
            break;
        }
    }
}

// ======================== MAIN LOOP =======================================
void loop() {
    handleButton();
    updateVisualsAndBuzzer();

    // Periodic battery level check
    unsigned long now = millis();
    if (now - lastBatteryReadTime > BATTERY_POLL_MS) {
        lastBatteryReadTime = now;
        uint8_t newBat = readBatteryLevel();
        if (newBat != batteryLevel) {
            batteryLevel = newBat;
            pBatteryChar->setValue(&batteryLevel, 1);
            if (deviceConnected) {
                pBatteryChar->notify();
            }
            Serial.printf("[BATTERY] Level: %u%%\n", batteryLevel);
        }
    }

    delay(10); // Low-power friendly tick
}

