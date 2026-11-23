/*
 * breadboard.js — draws a step-by-step breadboard wiring diagram for a
 * Raspberry Pi Pico W from a small JSON description.
 *
 * Usage in a page:
 *   <div class="breadboard">
 *     <script type="application/json">{ ...circuit spec... }</script>
 *   </div>
 *
 * Circuit spec:
 * {
 *   "modules":   [ { "id":"btn", "name":"KY-004 Button", "col":30,
 *                    "pins":["S","+","-"], "color":"#1b2533",
 *                    "icon":"button", "terminals":["NO","COM","NC"] } ],
 *   "resistors": [ { "id":"r1", "value":"220 Ω", "col":24 } ],
 *   "wires":     [ { "from":"GP15", "to":"btn.S", "color":"yellow",
 *                    "note":"signal" } ]
 * }
 *
 * Endpoints: Pico pin names (GP0..GP28, 3V3, GND, VBUS, VSYS, AGND,
 * or "pin:NN" for a physical pin), "module.PIN", "resistor.a" / "resistor.b",
 * "module.TERMINAL", or rails "+", "-" (bottom rails) and "+top", "-top".
 * Power wires (3V3 -> rail, GND -> rail, rail bridges) are added
 * automatically when a rail is used.
 */
(function () {
  "use strict";

  const P = 16;            // hole pitch in px
  const X0 = 44;           // x of column 1
  const COLS = 60;
  const OFF = 1;           // Pico pin 1 sits in column 1+OFF
  const ROWY = { a: 80, b: 96, c: 112, d: 128, e: 144, f: 192, g: 208, h: 224, i: 240, j: 256 };
  const RAILY = { "+top": 30, "-top": 46, "+": 290, "-": 306 };
  const BODY_Y = 344;
  const SVGNS = "http://www.w3.org/2000/svg";

  const COLORS = {
    red: "#e53935", black: "#263238", yellow: "#fdd835", orange: "#fb8c00",
    green: "#43a047", blue: "#1e88e5", purple: "#8e24aa", white: "#f5f5f5",
    brown: "#795548", grey: "#9e9e9e", gray: "#9e9e9e", pink: "#ec407a", cyan: "#00acc1",
  };
  const SIGNAL_CYCLE = ["yellow", "orange", "green", "blue", "purple", "white", "brown", "pink", "cyan"];

  const PICO = {
    1: "GP0", 2: "GP1", 3: "GND", 4: "GP2", 5: "GP3", 6: "GP4", 7: "GP5", 8: "GND",
    9: "GP6", 10: "GP7", 11: "GP8", 12: "GP9", 13: "GND", 14: "GP10", 15: "GP11",
    16: "GP12", 17: "GP13", 18: "GND", 19: "GP14", 20: "GP15", 21: "GP16", 22: "GP17",
    23: "GND", 24: "GP18", 25: "GP19", 26: "GP20", 27: "GP21", 28: "GND", 29: "GP22",
    30: "RUN", 31: "GP26", 32: "GP27", 33: "AGND", 34: "GP28", 35: "VREF", 36: "3V3",
    37: "3V3_EN", 38: "GND", 39: "VSYS", 40: "VBUS",
  };
  const NAME_TO_PIN = { GND: 38, "3V3": 36, VBUS: 40, VSYS: 39, AGND: 33 };
  Object.keys(PICO).forEach((k) => {
    if (/^GP\d+$/.test(PICO[k])) NAME_TO_PIN[PICO[k]] = +k;
  });

  const colX = (c) => X0 + (c - 1) * P;
  const picoPinPos = (n) =>
    n <= 20
      ? { col: n + OFF, row: "h", free: ["i", "j"] }
      : { col: 41 - n + OFF, row: "c", free: ["b", "a"] };

  function el(name, attrs, parent) {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, attrs) {
    const t = el("text", Object.assign({ x, y }, attrs || {}), parent);
    t.textContent = str;
    return t;
  }
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const railName = (r) =>
    ({ "+top": "top <b class='plus'>+</b> rail", "-top": "top <b class='minus'>−</b> rail",
       "+": "bottom <b class='plus'>+</b> rail", "-": "bottom <b class='minus'>−</b> rail" })[r];
  const pretty = (p) => String(p).replace(/^-$/, "−");

  function build(spec) {
    const modules = (spec.modules || []).map((m) => Object.assign({}, m));
    const resistors = (spec.resistors || []).map((r, k) =>
      Object.assign({ col: 24 + 6 * k, row: "e", value: "220 Ω" }, r));
    const userWires = (spec.wires || []).map((w) => Object.assign({}, w));
    const byId = {};
    modules.forEach((m) => (byId[m.id] = { kind: "module", m }));
    resistors.forEach((r) => (byId[r.id] = { kind: "resistor", r }));

    const used = new Set(); // "row:col" holes and "rail:col"
    const errors = [];
    modules.forEach((m) => m.pins.forEach((_, i) => used.add("j:" + (m.col + i))));
    resistors.forEach((r) => { used.add(r.row + ":" + r.col); used.add(r.row + ":" + (r.col + 4)); });

    // ---- power wires
    const ends = [];
    userWires.forEach((w) => ends.push(w.from, w.to));
    const railUsed = (r) => ends.some((e) => e === r || String(e).startsWith(r + "@"));
    const wires = [];
    if (railUsed("+") || railUsed("+top")) wires.push({ from: "3V3", to: "+top", color: "red", auto: true, note: "3.3 V power" });
    if (railUsed("-top")) wires.push({ from: "GND", to: "-top", color: "black", auto: true, note: "ground" });
    if (railUsed("-")) wires.push({ from: "pin:3", to: "-", color: "black", auto: true, note: "ground" });
    if (railUsed("+")) wires.push({ from: "+top@" + (COLS - 1), to: "+@" + (COLS - 1), color: "red", auto: true, note: "bridge the + rails" });
    let cyc = 0;
    userWires.forEach((w) => {
      if (!w.color) {
        const s = [w.from, w.to].join(" ");
        if (/(^|\s)\+(top)?(@|\s|$)/.test(s) || /3V3|VBUS/.test(s)) w.color = "red";
        else if (/(^|\s)-(top)?(@|\s|$)/.test(s) || /GND/.test(s)) w.color = "black";
        else w.color = SIGNAL_CYCLE[cyc++ % SIGNAL_CYCLE.length];
      }
      wires.push(w);
    });

    // ---- endpoint resolution
    function resolve(ep) {
      ep = String(ep);
      const railM = ep.match(/^([+-](?:top)?)(?:@(\d+))?$/);
      if (railM) return { kind: "rail", rail: railM[1], col: railM[2] ? +railM[2] : null, label: railName(railM[1]) };
      let pin = null;
      const pm = ep.match(/^pin:(\d+)$/i);
      if (pm) pin = +pm[1];
      else if (NAME_TO_PIN[ep] !== undefined) pin = NAME_TO_PIN[ep];
      if (pin !== null) {
        const pos = picoPinPos(pin);
        return { kind: "hole", col: pos.col, free: pos.free, pico: pin,
                 label: "Pico pin " + pin + " (<b>" + PICO[pin] + "</b>)" };
      }
      const dot = ep.indexOf(".");
      if (dot > 0) {
        const id = ep.slice(0, dot), p = ep.slice(dot + 1);
        const o = byId[id];
        if (o && o.kind === "module") {
          const i = o.m.pins.indexOf(p);
          if (i >= 0) return { kind: "hole", col: o.m.col + i, free: ["i", "h", "g", "f"],
                               label: esc(o.m.name) + " pin <b>" + esc(pretty(p)) + "</b>" };
          const t = (o.m.terminals || []).indexOf(p);
          if (t >= 0) return { kind: "term", m: o.m, t, label: esc(o.m.name) + " screw terminal <b>" + esc(p) + "</b>" };
        }
        if (o && o.kind === "resistor" && (p === "a" || p === "b")) {
          const r = o.r;
          const top = "abcde".indexOf(r.row) >= 0;
          const free = (top ? ["d", "c", "b", "a", "e"] : ["g", "h", "i", "f", "j"]).filter((x) => x !== r.row);
          return { kind: "hole", col: p === "a" ? r.col : r.col + 4, free,
                   label: "the " + (p === "a" ? "left" : "right") + " leg of resistor " + esc(r.id) + " (" + esc(r.value) + ")" };
        }
      }
      throw new Error("Unknown endpoint '" + ep + "'");
    }
    function takeHole(e) {
      for (const r of e.free) {
        const k = r + ":" + e.col;
        if (!used.has(k)) { used.add(k); e.row = r; e.x = colX(e.col); e.y = ROWY[r]; e.hole = r + e.col; return; }
      }
      throw new Error("No free hole left in column " + e.col);
    }
    function takeRail(e, nearCol) {
      const tryCol = (c) => {
        const k = e.rail + ":" + c;
        if (c < 1 || c > COLS || used.has(k)) return false;
        used.add(k); e.c = c; e.x = colX(c); e.y = RAILY[e.rail]; return true;
      };
      if (e.col) { if (tryCol(e.col)) return; }
      for (let d = 0; d < COLS; d++) {
        if (tryCol(nearCol + d) || tryCol(nearCol - d)) return;
      }
      throw new Error("Rail full");
    }
    function placeTerm(e) {
      const m = e.m, geo = moduleGeo(m);
      const n = m.terminals.length;
      e.x = geo.x + geo.w * (e.t + 1) / (n + 1);
      e.y = geo.y + geo.h - 8;
    }

    const items = [];
    items.push({ type: "pico", text: "Press the <b>Pico W</b> into the breadboard with the USB socket on the left. Its pins go into rows <code>c</code> and <code>h</code>, columns 2–21 — pin 1 (GP0) is in hole <code>h2</code>, pin 40 (VBUS) in <code>c2</code>." });
    modules.forEach((m) => {
      const pinsTxt = m.pins.map((p, i) => "<b>" + esc(pretty(p)) + "</b> in <code>j" + (m.col + i) + "</code>").join(", ");
      items.push({ type: "module", m, text: "Plug the <b>" + esc(m.name) + "</b> into row <code>j</code>, columns " + m.col + "–" + (m.col + m.pins.length - 1) + ", components facing you: " + pinsTxt + "." + (m.placeNote ? " " + m.placeNote : "") });
    });
    resistors.forEach((r) => {
      items.push({ type: "resistor", r, text: "Put a <b>" + esc(r.value) + " resistor</b> (" + esc(r.id) + ") from hole <code>" + r.row + r.col + "</code> to <code>" + r.row + (r.col + 4) + "</code>. Resistors have no direction." });
    });
    wires.forEach((w) => {
      try {
        const A = resolve(w.from), B = resolve(w.to);
        // holes first, then rails near the other end
        [A, B].forEach((e) => { if (e.kind === "hole") takeHole(e); });
        [A, B].forEach((e) => { if (e.kind === "term") placeTerm(e); });
        [[A, B], [B, A]].forEach(([e, o]) => {
          if (e.kind === "rail") takeRail(e, o.col || o.c || (o.kind === "term" ? Math.round((o.x - X0) / P) + 1 : 30));
        });
        const where = (e) =>
          e.kind === "hole" ? "hole <code>" + e.hole + "</code> (" + e.label + ")"
          : e.kind === "rail" ? "the " + e.label + (e.col ? " at column " + e.c : "")
          : "the " + e.label;
        const cname = COLORS[w.color] ? w.color : "coloured";
        items.push({ type: "wire", w, A, B,
          text: "<span class='swatch' style='background:" + (COLORS[w.color] || w.color) + "'></span><b>" + cname + "</b> wire: " + where(A) + " → " + where(B) + "." + (w.note ? " <i>(" + esc(w.note) + ")</i>" : "") });
      } catch (err) { errors.push(err.message); }
    });
    return { items, errors, modules, resistors };
  }

  function moduleGeo(m) {
    const n = m.pins.length;
    const wCols = Math.max(n + 2.6, m.width || 0);
    const cx = colX(m.col) + (n - 1) * P / 2;
    const w = wCols * P;
    const h = m.height || (m.terminals ? 104 : 78);
    return { x: cx - w / 2, y: BODY_Y, w, h, cx };
  }

  // ------------------------------------------------------------------ drawing
  function drawBoard(svg) {
    const g = el("g", { class: "bb-board" }, svg);
    const W = colX(COLS) + 26;
    el("rect", { x: X0 - 26, y: 12, width: W - X0 + 26, height: 312, rx: 8, class: "bb-plastic" }, g);
    el("rect", { x: X0 - 26, y: ROWY.e + 14, width: W - X0 + 26, height: ROWY.f - ROWY.e - 28, class: "bb-gap" }, g);
    // rails
    [["+top", "plus", -8], ["-top", "minus", 8], ["+", "plus", -8], ["-", "minus", 8]].forEach(([r, cls, off]) => {
      const y = RAILY[r];
      el("line", { x1: X0 - 10, x2: colX(COLS) + 10, y1: y + off, y2: y + off, class: "bb-rail-line " + cls }, g);
      text(g, X0 - 18, y + 4, r[0] === "+" ? "+" : "−", { class: "bb-rail-sign " + cls, "text-anchor": "middle" });
      text(g, colX(COLS) + 18, y + 4, r[0] === "+" ? "+" : "−", { class: "bb-rail-sign " + cls, "text-anchor": "middle" });
      for (let c = 1; c <= COLS; c++) {
        if ((c - 1) % 6 === 5) continue; // gaps in rail groups (like a real board)
        el("rect", { x: colX(c) - 2.5, y: y - 2.5, width: 5, height: 5, rx: 1, class: "bb-hole" }, g);
      }
    });
    Object.keys(ROWY).forEach((r) => {
      const y = ROWY[r];
      text(g, X0 - 16, y + 3, r, { class: "bb-label", "text-anchor": "middle" });
      text(g, colX(COLS) + 16, y + 3, r, { class: "bb-label", "text-anchor": "middle" });
      for (let c = 1; c <= COLS; c++) el("rect", { x: colX(c) - 2.5, y: y - 2.5, width: 5, height: 5, rx: 1, class: "bb-hole" }, g);
    });
    for (let c = 1; c <= COLS; c++) {
      if (c === 1 || c % 5 === 0) {
        text(g, colX(c), ROWY.a - 10, String(c), { class: "bb-label", "text-anchor": "middle" });
        text(g, colX(c), ROWY.j + 15, String(c), { class: "bb-label", "text-anchor": "middle" });
      }
    }
    return g;
  }

  function drawPico(svg, usedPins) {
    const g = el("g", { class: "bb-item bb-pico" }, svg);
    const x1 = colX(1 + OFF) - P / 2 - 2, x2 = colX(20 + OFF) + P / 2 + 2;
    const y1 = ROWY.c - 8, y2 = ROWY.h + 8;
    el("rect", { x: x1, y: y1, width: x2 - x1, height: y2 - y1, rx: 4, class: "pico-pcb" }, g);
    // USB
    el("rect", { x: x1 - 12, y: (y1 + y2) / 2 - 13, width: 22, height: 26, rx: 2, class: "pico-usb" }, g);
    // RP2040 + wireless module
    el("rect", { x: colX(9), y: 148, width: 30, height: 30, rx: 2, class: "pico-chip" }, g);
    el("rect", { x: colX(14), y: 146, width: 64, height: 36, rx: 2, class: "pico-shield" }, g);
    text(g, colX(14) + 32, 167, "Pico W", { class: "pico-text", "text-anchor": "middle" });
    el("rect", { x: colX(4) - 4, y: 156, width: 10, height: 14, rx: 1, class: "pico-btn" }, g);
    text(g, colX(4) + 1, 182, "BOOTSEL", { class: "pico-tiny", "text-anchor": "middle" });
    el("rect", { x: x1 + 2, y: 160, width: 7, height: 8, class: "pico-led" }, g);
    for (let n = 1; n <= 40; n++) {
      const pos = picoPinPos(n);
      const x = colX(pos.col), y = ROWY[pos.row];
      el("rect", { x: x - 4, y: y - 4, width: 8, height: 8, rx: 1.5, class: "pico-pin" + (usedPins.has(n) ? " used" : "") + (/GND/.test(PICO[n]) ? " gnd" : "") }, g);
      const label = PICO[n];
      if (n <= 20) {
        const t = text(g, x + 2.4, y - 8, label, { class: "pico-label" + (usedPins.has(n) ? " used" : ""), transform: "rotate(-90 " + (x + 2.4) + " " + (y - 8) + ")" });
        t.setAttribute("text-anchor", "start");
      } else {
        const t = text(g, x + 2.4, y + 8, label, { class: "pico-label" + (usedPins.has(n) ? " used" : ""), transform: "rotate(-90 " + (x + 2.4) + " " + (y + 8) + ")" });
        t.setAttribute("text-anchor", "end");
      }
    }
    return g;
  }

  function drawIcon(g, m, geo) {
    const cx = geo.cx, cy = geo.y + geo.h / 2 + 4;
    const ic = m.icon;
    if (!ic) return;
    if (ic === "led" || ic === "rgb" || ic === "bicolor") {
      const fill = ic === "rgb" ? "url(#bb-rainbow)" : ic === "bicolor" ? "url(#bb-bicolor)" : (m.iconColor || "#fff9c4");
      el("circle", { cx, cy, r: 9, fill, stroke: "#0006" }, g);
    } else if (ic === "traffic") {
      ["#e53935", "#fdd835", "#43a047"].forEach((c, i) => el("circle", { cx: cx - 16 + i * 16, cy, r: 6, fill: c, stroke: "#0006" }, g));
    } else if (ic === "button") {
      el("rect", { x: cx - 9, y: cy - 9, width: 18, height: 18, rx: 2, fill: "#cfd8dc" }, g);
      el("circle", { cx, cy, r: 5.5, fill: "#37474f" }, g);
    } else if (ic === "buzzer") {
      el("circle", { cx, cy, r: 12, fill: "#111", stroke: "#555" }, g);
      el("circle", { cx, cy, r: 2.5, fill: "#666" }, g);
    } else if (ic === "pot") {
      el("rect", { x: cx - 18, y: cy - 8, width: 14, height: 14, rx: 1, fill: "#1e64c8" }, g);
      el("circle", { cx: cx + 10, cy, r: 6, fill: "#9e9e9e", stroke: "#0006" }, g);
    } else if (ic === "sensor") {
      el("circle", { cx, cy, r: 8, fill: m.iconColor || "#455a64", stroke: "#0006" }, g);
    } else if (ic === "relay") {
      el("rect", { x: cx - 22, y: cy - 22, width: 44, height: 30, rx: 2, fill: "#1565c0" }, g);
      text(g, cx, cy - 4, "RELAY", { class: "mod-pin", "text-anchor": "middle", fill: "#fff" });
    } else if (ic === "joystick") {
      el("circle", { cx, cy, r: 16, fill: "#333", stroke: "#111" }, g);
      el("circle", { cx, cy, r: 9, fill: "#555" }, g);
    } else if (ic === "encoder") {
      el("circle", { cx, cy, r: 13, fill: "#bdbdbd", stroke: "#616161" }, g);
      el("circle", { cx, cy, r: 5, fill: "#eeeeee" }, g);
    } else if (ic === "dht") {
      el("rect", { x: cx - 13, y: cy - 16, width: 26, height: 30, rx: 2, fill: "#4fc3f7" }, g);
      for (let i = 0; i < 4; i++) el("line", { x1: cx - 8, x2: cx + 8, y1: cy - 10 + i * 7, y2: cy - 10 + i * 7, stroke: "#0277bd", "stroke-width": 2 }, g);
    } else if (ic === "mic") {
      el("rect", { x: cx - 20, y: cy - 8, width: 12, height: 12, rx: 1, fill: "#1e64c8" }, g);
      el("circle", { cx: cx + 10, cy: cy - 2, r: m.big ? 10 : 6, fill: "#212121", stroke: "#9e9e9e" }, g);
    }
  }

  function drawModule(svg, m) {
    const g = el("g", { class: "bb-item bb-module" }, svg);
    const geo = moduleGeo(m);
    m.pins.forEach((_, i) => {
      const x = colX(m.col + i);
      el("line", { x1: x, y1: ROWY.j, x2: x, y2: geo.y + 2, class: "mod-lead" }, g);
      el("rect", { x: x - 3, y: ROWY.j - 3, width: 6, height: 6, class: "mod-pinhead" }, g);
    });
    el("rect", { x: geo.x, y: geo.y, width: geo.w, height: geo.h, rx: 5, fill: m.color || "#1b2533", class: "mod-pcb" }, g);
    m.pins.forEach((p, i) => {
      text(g, colX(m.col + i), geo.y + 13, pretty(p), { class: "mod-pin", "text-anchor": "middle" });
    });
    drawIcon(g, m, geo);
    const name = m.name;
    const sp = name.indexOf(" ");
    const l1 = sp > 0 ? name.slice(0, sp) : name, l2 = sp > 0 ? name.slice(sp + 1) : "";
    const ty = geo.y + geo.h - (m.terminals ? 26 : 8);
    text(g, geo.cx, ty - 10, l1, { class: "mod-name", "text-anchor": "middle" });
    if (l2) text(g, geo.cx, ty, l2, { class: "mod-sub", "text-anchor": "middle" });
    (m.terminals || []).forEach((t, i) => {
      const x = geo.x + geo.w * (i + 1) / (m.terminals.length + 1);
      el("rect", { x: x - 8, y: geo.y + geo.h - 16, width: 16, height: 14, rx: 2, fill: "#2e7d32" }, g);
      el("circle", { cx: x, cy: geo.y + geo.h - 8, r: 3.5, fill: "#cfd8dc" }, g);
      text(g, x, geo.y + geo.h + 11, t, { class: "mod-term", "text-anchor": "middle" });
    });
    return g;
  }

  function drawResistor(svg, r) {
    const g = el("g", { class: "bb-item bb-resistor" }, svg);
    const y = ROWY[r.row], x1 = colX(r.col), x2 = colX(r.col + 4);
    el("line", { x1, y1: y, x2, y2: y, class: "res-lead" }, g);
    el("rect", { x: x1 + 14, y: y - 6, width: x2 - x1 - 28, height: 12, rx: 5, class: "res-body" }, g);
    const bands = r.bands || (/^220/.test(r.value) ? ["#e53935", "#e53935", "#795548"]
      : /^100\b|^100 /.test(r.value) ? ["#795548", "#263238", "#795548"]
      : /^10 ?k/.test(r.value) ? ["#795548", "#263238", "#fb8c00"]
      : /^1 ?k/.test(r.value) ? ["#795548", "#263238", "#e53935"] : ["#9e9e9e", "#9e9e9e", "#9e9e9e"]);
    bands.concat(["#c9a227"]).forEach((c, i) => {
      el("rect", { x: x1 + 19 + i * 6 + (i === 3 ? 4 : 0), y: y - 6, width: 3, height: 12, fill: c }, g);
    });
    text(g, (x1 + x2) / 2, y - 9, r.value, { class: "res-label", "text-anchor": "middle" });
    return g;
  }

  function drawWire(svg, it, idx) {
    const g = el("g", { class: "bb-item bb-wire" }, svg);
    const { A, B } = it;
    const dx = B.x - A.x, dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    let d;
    if (Math.abs(dx) < 2) {
      const bow = Math.min(14, 5 + len * 0.06) * (idx % 2 ? 1 : -1);
      d = "M" + A.x + " " + A.y + " C" + (A.x + bow) + " " + (A.y + dy * 0.3) + " " + (B.x + bow) + " " + (B.y - dy * 0.3) + " " + B.x + " " + B.y;
    } else {
      const lift = Math.min(70, 10 + len * 0.16) * [1, 0.55, 1.45, 0.8, 1.2][idx % 5];
      const nx = -dy / len, ny = dx / len;
      const s = ny > 0 ? -1 : 1; // bow upwards
      const cx = (A.x + B.x) / 2 + nx * lift * s, cy = (A.y + B.y) / 2 + ny * lift * s;
      d = "M" + A.x + " " + A.y + " Q" + cx + " " + cy + " " + B.x + " " + B.y;
    }
    const col = COLORS[it.w.color] || it.w.color;
    el("path", { d, class: "wire-outline" }, g);
    el("path", { d, class: "wire-core", stroke: col }, g);
    el("circle", { cx: A.x, cy: A.y, r: 3.6, class: "wire-end", fill: col }, g);
    el("circle", { cx: B.x, cy: B.y, r: 3.6, class: "wire-end", fill: col }, g);
    const t = el("title", {}, g);
    t.textContent = it.text.replace(/<[^>]+>/g, "");
    return g;
  }

  function render(container) {
    const script = container.querySelector('script[type="application/json"]');
    let spec;
    try { spec = JSON.parse(script.textContent); }
    catch (e) { container.innerHTML = "<p class='bb-error'>Circuit JSON error: " + esc(e.message) + "</p>"; return; }
    const { items, errors } = build(spec);

    const usedPins = new Set();
    items.forEach((it) => { if (it.type === "wire") [it.A, it.B].forEach((e) => { if (e.pico) usedPins.add(e.pico); }); });

    const wrap = document.createElement("div");
    wrap.className = "bb-wrap";
    const maxBody = Math.max(0, ...((spec.modules || []).map((m) => moduleGeo(m).h + (m.terminals ? 16 : 0))));
    const H = BODY_Y + maxBody + 14;
    const W = colX(COLS) + 34;
    const svg = el("svg", { viewBox: "0 0 " + W + " " + H, class: "bb-svg", role: "img", "aria-label": "Breadboard wiring diagram" });
    const defs = el("defs", {}, svg);
    const lg = el("linearGradient", { id: "bb-rainbow", x1: 0, x2: 1 }, defs);
    [["0", "#f44336"], ["0.5", "#4caf50"], ["1", "#2196f3"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, lg));
    const lg2 = el("linearGradient", { id: "bb-bicolor", x1: 0, x2: 1 }, defs);
    [["0.45", "#f44336"], ["0.55", "#4caf50"]].forEach(([o, c]) => el("stop", { offset: o, "stop-color": c }, lg2));
    drawBoard(svg);

    const nodes = [];
    let wi = 0;
    items.forEach((it) => {
      let node;
      if (it.type === "pico") node = drawPico(svg, usedPins);
      else if (it.type === "module") node = drawModule(svg, it.m);
      else if (it.type === "resistor") node = drawResistor(svg, it.r);
      else node = drawWire(svg, it, wi++);
      nodes.push(node);
    });
    // wires on top of everything: move them last
    nodes.forEach((n) => { if (n.classList.contains("bb-wire")) svg.appendChild(n); });

    const controls = document.createElement("div");
    controls.className = "bb-controls";
    controls.innerHTML =
      "<button type='button' data-a='first' title='First step'>⏮</button>" +
      "<button type='button' data-a='prev'>◀ Back</button>" +
      "<span class='bb-count'></span>" +
      "<button type='button' data-a='next'>Next ▶</button>" +
      "<button type='button' data-a='all'>Show all</button>";
    const caption = document.createElement("div");
    caption.className = "bb-caption";
    const list = document.createElement("ol");
    list.className = "bb-steps";
    items.forEach((it, i) => {
      const li = document.createElement("li");
      li.innerHTML = it.text;
      li.addEventListener("click", () => show(i));
      list.appendChild(li);
    });

    let cur = items.length - 1;
    function show(i) {
      cur = Math.max(0, Math.min(items.length - 1, i));
      nodes.forEach((n, k) => {
        n.classList.toggle("hidden", k > cur);
        n.classList.toggle("current", showStepMode && k === cur);
      });
      [...list.children].forEach((li, k) => {
        li.classList.toggle("done", k < cur);
        li.classList.toggle("current", k === cur);
      });
      controls.querySelector(".bb-count").textContent = "Step " + (cur + 1) + " / " + items.length;
      caption.innerHTML = "<b>Step " + (cur + 1) + ":</b> " + items[cur].text;
    }
    let showStepMode = false;
    controls.addEventListener("click", (e) => {
      const a = e.target.closest("button") && e.target.closest("button").dataset.a;
      if (!a) return;
      showStepMode = a !== "all";
      if (a === "first") show(0);
      if (a === "prev") show(cur - 1);
      if (a === "next") show(cur + 1);
      if (a === "all") show(items.length - 1);
    });

    container.innerHTML = "";
    if (errors.length) {
      const p = document.createElement("p");
      p.className = "bb-error";
      p.textContent = "Diagram problems: " + errors.join("; ");
      container.appendChild(p);
      console.error("breadboard:", errors);
    }
    wrap.appendChild(svg);
    container.appendChild(controls);
    container.appendChild(wrap);
    container.appendChild(caption);
    const det = document.createElement("details");
    det.className = "bb-list";
    det.open = true;
    det.innerHTML = "<summary>All wiring steps as a checklist</summary>";
    det.appendChild(list);
    container.appendChild(det);
    showStepMode = true;
    show(0);
  }

  window.Breadboard = { render, build };
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".breadboard").forEach(render);
  });
})();
