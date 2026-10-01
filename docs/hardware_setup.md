# Smart Waste Management — hardware setup

One physical sensor only: **ESP32 DevKit** + **HC-SR04**. No GPS, LoRa, load cell, or second sensor.

## Wiring

```
ESP32 5V  ----------------  HC-SR04 VCC
ESP32 GND ----------------  HC-SR04 GND
ESP32 GPIO 5  ------------  HC-SR04 TRIG
ESP32 GPIO 18 --[1k]--+
                     [2k to GND]  (divider if ECHO is 5 V)
                        +-------  HC-SR04 ECHO
ESP32 GPIO 2  ------------  on-board LED (many DevKit boards)
ESP32 GPIO 4  ------------  optional piezo buzzer (+)
```

Measure the empty bin from the sensor face to the floor of the liner and set `BIN_HEIGHT_CM` in `firmware/bin_sensor/bin_sensor.ino` to that value (default 50).

Fill percent:

\[
\text{fill} = \mathrm{clamp}\bigl( (1 - d / H) \times 100,\ 0,\ 100 \bigr)
\]

where \(d\) is the ultrasonic distance in cm and \(H\) is `BIN_HEIGHT_CM`.

## Firmware

1. Arduino IDE: install **esp32** by Espressif via Boards Manager.
2. Edit `WIFI_SSID`, `WIFI_PASS`, and `SERVER_URL` (use the laptop LAN IP, not `127.0.0.1`).
3. Upload `firmware/bin_sensor/bin_sensor.ino`.
4. Confirm `GET http://<laptop>:8000/bins/real-1` changes within 30 s when you move a board in front of the sensor.

Until the hardware arrives, mock the same POST from the laptop:

```bash
cd backend
venv\Scripts\python mock_sensor.py --fill 82
venv\Scripts\python mock_sensor.py --oscillate
```

## Scope you must not add

GPS modules, LoRa, solar, load cells, servo segregation, a second ultrasonic — out of scope for this academic build.
