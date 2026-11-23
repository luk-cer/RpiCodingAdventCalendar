/* site.js — shared behaviour: day list, navigation, notebook-style code cells. */
(function () {
  "use strict";

  const DAYS = [
    { n: 1,  title: "Traffic Light",              parts: "LED traffic light" },
    { n: 2,  title: "Press the Button",           parts: "KY-004, traffic light" },
    { n: 3,  title: "Two-Colour Glow",            parts: "KY-011, KY-029" },
    { n: 4,  title: "Rainbow Mixer",              parts: "KY-016, KY-009" },
    { n: 5,  title: "Morse Code Elf",             parts: "KY-012, KY-004" },
    { n: 6,  title: "Jingle Bells",               parts: "KY-006" },
    { n: 7,  title: "Shake the Snow Globe",       parts: "KY-020, KY-002, KY-034" },
    { n: 8,  title: "Night Light",                parts: "KY-018, KY-016" },
    { n: 9,  title: "Thermistor Thermometer",     parts: "KY-013, traffic light" },
    { n: 10, title: "Digital Thermometer",        parts: "KY-001 DS18B20" },
    { n: 11, title: "Temperature & Humidity",     parts: "KY-015 DHT11, traffic light" },
    { n: 12, title: "Click! The Thermostat",      parts: "KY-028, KY-019, KY-034" },
    { n: 13, title: "Present Door Alarm",         parts: "KY-021, KY-025, KY-012" },
    { n: 14, title: "Magnet Detective",           parts: "KY-003, KY-024, KY-035" },
    { n: 15, title: "Cookie Jar Guard",           parts: "KY-010, KY-032" },
    { n: 16, title: "Candy-Cane Barcodes",        parts: "KY-033" },
    { n: 17, title: "Advent Candle Watch",        parts: "KY-026, KY-012" },
    { n: 18, title: "Secret Knock",               parts: "KY-036, KY-031, traffic light" },
    { n: 19, title: "Clap Your Hands",            parts: "KY-037, KY-038, traffic light" },
    { n: 20, title: "Joystick Colour Wheel",      parts: "KY-023, KY-016" },
    { n: 21, title: "Safe Cracker",               parts: "KY-040, KY-006, traffic light" },
    { n: 22, title: "Infrared Remote",            parts: "KY-022, KY-005" },
    { n: 23, title: "Heartbeat",                  parts: "KY-039" },
    { n: 24, title: "Wi-Fi Christmas Tree",       parts: "Pico W Wi-Fi, KY-001, KY-016, KY-006" },
  ];
  window.ADVENT_DAYS = DAYS;

  // ---------------------------------------------------------------- highlight
  const KW = new Set(("False None True and as assert async await break class continue def del elif else except " +
    "finally for from global if import in is lambda nonlocal not or pass raise return try while with yield").split(" "));
  const BI = new Set(("print range len int float str bool list dict tuple set abs min max sum round sorted enumerate " +
    "zip map filter open isinstance hex bin ord chr any all reversed super input bytearray bytes iter next object " +
    "Exception KeyboardInterrupt OSError ValueError").split(" "));
  const TOKEN = new RegExp([
    "(#[^\\n]*)",                                            // 1 comment
    "([rRbBfF]{0,2}(?:\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'))", // 2 string
    "(@[A-Za-z_][\\w.]*)",                                   // 3 decorator
    "\\b(0[xX][0-9a-fA-F_]+|0[bB][01_]+|\\d[\\d_]*\\.?\\d*(?:[eE][+-]?\\d+)?)\\b", // 4 number
    "([A-Za-z_]\\w*)",                                       // 5 name
  ].join("|"), "g");
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

  function highlight(src) {
    let out = "", last = 0, m, prevWord = "";
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(src))) {
      out += esc(src.slice(last, m.index));
      last = TOKEN.lastIndex;
      const t = m[0];
      if (m[1]) out += "<span class='tk-c'>" + esc(t) + "</span>";
      else if (m[2]) out += "<span class='tk-s'>" + esc(t) + "</span>";
      else if (m[3]) out += "<span class='tk-d'>" + esc(t) + "</span>";
      else if (m[4]) out += "<span class='tk-n'>" + esc(t) + "</span>";
      else if (m[5]) {
        if (KW.has(t)) out += "<span class='tk-k'>" + t + "</span>";
        else if (prevWord === "def" || prevWord === "class") out += "<span class='tk-f'>" + t + "</span>";
        else if (BI.has(t)) out += "<span class='tk-b'>" + t + "</span>";
        else out += t;
        prevWord = t;
        continue;
      }
      prevWord = "";
    }
    return out + esc(src.slice(last));
  }

  function dedent(s) {
    s = s.replace(/^\s*\n/, "").replace(/\s+$/, "");
    const lines = s.split("\n");
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
    return lines.map((l) => l.slice(ind)).join("\n");
  }

  function copyText(txt, btn) {
    const done = () => { btn.textContent = "Copied ✓"; setTimeout(() => (btn.textContent = "Copy"), 1400); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, fallback);
    else fallback();
    function fallback() {
      const ta = document.createElement("textarea");
      ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { btn.textContent = "Select & copy manually"; }
      ta.remove();
    }
  }

  let cellNo = 0;
  function makeCells() {
    document.querySelectorAll('script[type="text/x-python"], script[type="text/x-output"]').forEach((s) => {
      const isOut = s.type === "text/x-output";
      const code = dedent(s.textContent);
      const cell = document.createElement("div");
      cell.className = "cell " + (isOut ? "out" : "code") + (s.dataset.title ? " full" : "");
      const prompt = document.createElement("div");
      prompt.className = "prompt";
      prompt.textContent = isOut ? "Out:" : "In [" + ++cellNo + "]:";
      const body = document.createElement("div");
      body.className = "cell-body";
      if (s.dataset.title) {
        const h = document.createElement("div");
        h.className = "cell-title";
        h.textContent = s.dataset.title;
        body.appendChild(h);
      }
      const pre = document.createElement("pre");
      const c = document.createElement("code");
      if (isOut) c.textContent = code; else c.innerHTML = highlight(code);
      pre.appendChild(c);
      body.appendChild(pre);
      if (!isOut) {
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "copy"; btn.textContent = "Copy";
        btn.addEventListener("click", () => copyText(code, btn));
        body.appendChild(btn);
      }
      cell.appendChild(prompt);
      cell.appendChild(body);
      s.replaceWith(cell);
    });
  }

  // ---------------------------------------------------------------- navigation
  function makeNav() {
    const day = +document.body.dataset.day;
    if (!day && day !== 0) return;
    const root = document.body.dataset.root || "../";
    const prev = DAYS.find((d) => d.n === day - 1);
    const next = DAYS.find((d) => d.n === day + 1);
    const link = (d, label, cls) => d
      ? "<a class='" + cls + "' href='" + root + "days/day" + String(d.n).padStart(2, "0") + ".html'>" + label + "</a>"
      : (day === 1 && cls === "prev" ? "<a class='prev' href='" + root + "days/day00.html'>◀ Setup</a>" : "<span></span>");
    const html =
      "<nav class='daynav'>" +
      link(prev, "◀ Day " + (prev ? prev.n : ""), "prev") +
      "<a class='home' href='" + root + "index.html'>🎄 Calendar</a>" +
      (day === 0 ? "<a class='next' href='" + root + "days/day01.html'>Day 1 ▶</a>" : link(next, "Day " + (next ? next.n : "") + " ▶", "next")) +
      "</nav>";
    document.querySelectorAll(".nav-slot").forEach((s) => (s.outerHTML = html));
    try {
      const k = "advent-opened";
      const opened = JSON.parse(localStorage.getItem(k) || "[]");
      if (day && opened.indexOf(day) < 0) { opened.push(day); localStorage.setItem(k, JSON.stringify(opened)); }
    } catch (e) { /* storage unavailable — fine */ }
  }

  document.addEventListener("DOMContentLoaded", () => {
    makeNav();
    makeCells();
  });
  window.AdventSite = { highlight };
})();
