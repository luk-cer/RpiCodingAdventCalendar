# 🎄 Pico W Coding Advent Calendar

**▶ Open the calendar: https://luk-cer.github.io/RpiCodingAdventCalendar/**

A 24-day coding advent calendar for the **Raspberry Pi Pico W** and the
**AZ-Delivery 35-in-1 sensor kit** (KY-001 … KY-040 + LED traffic light), written in
**MicroPython**. Three bonus days add an SSD1306 OLED, a BME280 and an MPU6050.

Each day is one self-contained HTML page with:

- **Step-by-step breadboard wiring**: an interactive diagram you click through one part or
  wire at a time, plus a hole-by-hole checklist (`i21 → h31`).
- **Notebook-style code**: short cells interleaved with explanations, building up to a
  full program (gold frame) you can save as `main.py`.
- **An exercise** that goes further, with a hint and a **hidden solution**.

Open `index.html` in a browser to start. No build step and no server needed. Works offline.

## Days

| Day | Project | Parts |
|----:|---------|-------|
| 0 | Setup & safety | MicroPython, Thonny, pinout |
| 1 | Traffic Light | LED traffic light |
| 2 | Press the Button | KY-004, traffic light |
| 3 | Two-Colour Glow (PWM) | KY-011, KY-029 |
| 4 | Rainbow Mixer (classes, HSV) | KY-016, KY-009 |
| 5 | Morse Code Elf | KY-012, KY-004 |
| 6 | Jingle Bells | KY-006 |
| 7 | Shake the Snow Globe (interrupts) | KY-020, KY-002, KY-034 |
| 8 | Night Light (ADC) | KY-018, KY-016 |
| 9 | Thermistor Thermometer | KY-013, traffic light |
| 10 | Digital Thermometer (1-Wire) | KY-001, KY-012 |
| 11 | Temperature & Humidity | KY-015, traffic light |
| 12 | Click! The Thermostat (relay, hysteresis) | KY-028, KY-019, KY-034 |
| 13 | Present Door Alarm (state machine) | KY-021, KY-025, KY-012 |
| 14 | Magnet Detective (Hall effect) | KY-003, KY-024, KY-035 |
| 15 | Cookie Jar Guard | KY-010, KY-032, KY-012 |
| 16 | Candy-Cane Barcodes | KY-033, KY-006 |
| 17 | Advent Candle Watch | KY-026, KY-012 |
| 18 | Secret Knock | KY-036, KY-031, traffic light |
| 19 | Clap Your Hands | KY-037, KY-038, traffic light |
| 20 | Joystick Colour Wheel | KY-023, KY-016 |
| 21 | Safe Cracker (rotary encoder) | KY-040, KY-006, traffic light |
| 22 | Infrared Remote (NEC decode/encode) | KY-022, KY-005 |
| 23 | Heartbeat (signal processing) | KY-039, KY-006 |
| 24 | Wi-Fi Christmas Tree (web server) | Pico W Wi-Fi, KY-001, KY-016, KY-006 |
| 25 | Bonus: OLED Display (I2C) | SSD1306 128×64, KY-018 |
| 26 | Bonus: Weather Station (own driver) | BME280, OLED |
| 27 | Bonus: Digital Snow Globe | MPU6050, OLED |

All 35 modules of the kit are used at least once.

## Extra things you need

Breadboard, ~20 male-to-male jumper wires, four 220 Ω resistors, a magnet, any IR remote
control, a tea light (with an adult), and a micro-USB **data** cable.

## Calendar doors

On the front page, door *n* unlocks on *n* December (in the browser's local date). In
November the doors are locked, and **🔓 Unlock all doors** opens them (handy for organisers).
Outside the season everything is open. Opened doors are remembered in the browser.

## Repository layout

```
index.html            calendar front page (doors)
days/day00.html       setup & safety
days/dayNN.html       one page per day (01–24, bonus 25–27)
assets/style.css      shared styles (light + dark mode)
assets/site.js        day list, navigation, notebook cells, syntax highlighting, copy buttons
assets/breadboard.js  renders the step-by-step wiring diagrams from a JSON spec
```

### Writing or changing a day

Code cells are written as `<script type="text/x-python">…</script>` (no HTML escaping
needed). `data-title="…"` marks a full-program cell, and `text/x-output` shows example
output. Wiring diagrams are a JSON block inside `<div class="breadboard">`:

```json
{
  "modules": [ { "id": "btn", "name": "KY-004 Button", "col": 38, "pins": ["S", "+", "-"], "icon": "button" } ],
  "resistors": [ { "id": "R1", "col": 30 } ],
  "wires": [ { "from": "GP16", "to": "btn.S", "color": "blue" }, { "from": "btn.+", "to": "+" }, { "from": "btn.-", "to": "-" } ]
}
```

Modules plug into row `j`. Free holes, power-rail wires and step texts are worked out
automatically. Endpoints can be Pico pins (`GP15`, `3V3`, `VBUS`, …), `module.PIN`,
`R1.a`/`R1.b`, relay terminals (`relay.COM`), or rails `+`, `-`, `+top`, `-top`.

## Safety

The Pico is a 3.3 V device: power the modules from **3V3**, never put 5 V on a GPIO, wire
with USB unplugged, and follow the labels on *your* modules. Pin order varies between
batches. The relay is for low voltages only.
