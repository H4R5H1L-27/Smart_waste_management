/*
 * Smart Waste — single bin fill sensor (ESP32 + HC-SR04).
 *
 * Wiring (see docs/hardware_setup.md):
 *   HC-SR04 VCC  -> 5V (or 3V3 if your module is 3.3V-safe)
 *   HC-SR04 GND  -> GND
 *   HC-SR04 TRIG -> GPIO 5
 *   HC-SR04 ECHO -> GPIO 18  (if the module is 5V, use a voltage divider)
 *   Status LED   -> GPIO 2  (on-board LED on many DevKit boards)
 *   Buzzer       -> GPIO 4  (optional Tier-3 polish)
 *
 * Edit WIFI_SSID / WIFI_PASS / SERVER_URL before flashing.
 * Fill % = (1 - distance_cm / BIN_HEIGHT_CM) * 100, clamped to 0–100.
 * POSTs JSON {"fill_percent": 72.5} to /bins/real-1/update every 30 s.
 */

#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Laptop running uvicorn must be reachable on the same LAN.
const char* SERVER_URL = "http://192.168.1.10:8000/bins/real-1/update";

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int LED_PIN = 2;
const int BUZZER_PIN = 4;

const float BIN_HEIGHT_CM = 50.0;
const unsigned long POST_EVERY_MS = 30000;
const unsigned long PULSE_TIMEOUT_US = 30000;

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  unsigned long duration = pulseIn(ECHO_PIN, HIGH, PULSE_TIMEOUT_US);
  if (duration == 0) {
    return -1.0;
  }
  return (duration * 0.0343f) / 2.0f;
}

float distanceToFill(float cm) {
  if (cm < 0) {
    return -1.0;
  }
  float fill = (1.0f - (cm / BIN_HEIGHT_CM)) * 100.0f;
  if (fill < 0) fill = 0;
  if (fill > 100) fill = 100;
  return fill;
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void printAsciiBar(float fill, float cm) {
  const int barWidth = 24;
  int pos = (int)((fill / 100.0f) * barWidth);
  if (pos < 0) pos = 0;
  if (pos > barWidth) pos = barWidth;

  Serial.print("  [");
  for (int i = 0; i < barWidth; i++) {
    if (i < pos) Serial.print("=");
    else if (i == pos && pos < barWidth) Serial.print(">");
    else Serial.print(" ");
  }
  const char* tag = (fill >= 90.0f) ? " [CRITICAL BUZZER]" : (fill >= 70.0f ? " [URGENT PICKUP]" : " [NORMAL]");
  Serial.printf("] %5.1f%% | Dist: %5.1f cm %s\n", fill, cm, tag);
}

bool postFill(float fill) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
  }
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  String body = "{\"fill_percent\":" + String(fill, 1) + "}";
  int code = http.POST(body);
  Serial.printf("  Telemetry POST -> %d %s\n", code, (code >= 200 && code < 300) ? "(OK)" : "(FAILED)");
  http.end();
  return code >= 200 && code < 300;
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);

  Serial.println("\n=======================================================");
  Serial.println("  Chennai Smart Waste IoT Node — ESP32 + HC-SR04");
  Serial.println("  Academic Build · Single Node Telemetry Transmitter");
  Serial.println("=======================================================");
  Serial.printf("  Bin ID: real-1 | Height: %.1f cm | Cycle: %lu ms\n", BIN_HEIGHT_CM, POST_EVERY_MS);

  connectWifi();
}

void loop() {
  float cm = readDistanceCm();
  float fill = distanceToFill(cm);

  Serial.println("--- Ultrasonic Pulse Measurement ---");
  if (fill >= 0) {
    printAsciiBar(fill, cm);
    postFill(fill);

    if (fill >= 90.0f) {
      digitalWrite(LED_PIN, HIGH);
      tone(BUZZER_PIN, 2000, 200);
    } else {
      digitalWrite(LED_PIN, LOW);
      noTone(BUZZER_PIN);
    }
  } else {
    Serial.println("  Sensor pulse timeout: check HC-SR04 wiring.");
  }

  delay(POST_EVERY_MS);
}
