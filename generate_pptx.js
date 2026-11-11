const pptxgen = require("pptxgenjs");
const fs = require("fs");
const content = JSON.parse(fs.readFileSync("content.json", "utf8"));

const NAVY = "14213D", TEAL = "0F8B8D", AMBER = "B7791F", GREY = "5B6B80",
  TINT = "EDF1F6", RULE = "C9D2DE", BG = "FCFBF9", WHITE = "FFFFFF",
  TEALTINT = "E4F2F2", AMBERTINT = "F8EFDF";
const HF = "Cambria", BF = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: HF, bodyFontFace: BF };
pres.title = "Robust Multi-Condition Human Recognition for Autonomous Robotics";
pres.author = "GEN530 CA2";

pres.defineSlideMaster({
  title: "TITLE_LAYOUT", background: { color: BG }, objects: [],
});
pres.defineSlideMaster({
  title: "CONTENT_LAYOUT", background: { color: BG },
  objects: [
    {
      text: {
        text: "GEN530 CA2  |  Robust Multi-Condition Human Recognition  |  OpenVisionGuard to GRaCEmo ViRa",
        options: { x: 0.6, y: 7.05, w: 9, h: 0.3, fontFace: BF, fontSize: 9, color: GREY, margin: 0, isTextBox: true }
      }
    },
  ],
  slideNumber: { x: 12.2, y: 7.05, w: 0.55, h: 0.3, fontFace: BF, fontSize: 9, color: GREY, align: "right" },
});

// ---------- helpers ----------
const sty = {
  existing: { fill: NAVY, line: NAVY, text: WHITE, dash: "solid" },
  partial:  { fill: "DCE6F2", line: NAVY, text: NAVY, dash: "solid" },
  proposed: { fill: WHITE, line: TEAL, text: NAVY, dash: "dash" },
  future:   { fill: WHITE, line: AMBER, text: NAVY, dash: "dash" },
};

function box(s, kind, x, y, w, h, runs, opts = {}) {
  const st = sty[kind];
  s.addText(runs, Object.assign({
    shape: pres.shapes.RECTANGLE, x, y, w, h,
    fill: { color: st.fill },
    line: { color: st.line, width: 1.25, dashType: st.dash },
    fontFace: BF, color: st.text, fontSize: 11, align: "left", valign: "middle",
    margin: [3, 7, 3, 7], isTextBox: true,
  }, opts));
}

function header(s, eyebrow, title) {
  s.addText(eyebrow, { x: 0.6, y: 0.36, w: 9, h: 0.28, fontFace: BF, fontSize: 11, bold: true, color: TEAL, charSpacing: 3, margin: 0, isTextBox: true });
  s.addText(title,   { x: 0.6, y: 0.64, w: 12.1, h: 0.62, fontFace: HF, fontSize: 28, bold: true, color: NAVY, margin: 0, isTextBox: true, valign: "middle" });
}

function label(s, text, x, y, w, color = GREY, size = 10.5) {
  s.addText(text, { x, y, w, h: 0.28, fontFace: BF, fontSize: size, bold: true, color, charSpacing: 2, margin: 0, isTextBox: true });
}

function ln(s, x1, y1, x2, y2, o = {}) {
  const x = Math.min(x1, x2), y = Math.min(y1, y2),
        w = Math.max(Math.abs(x2 - x1), 0.01),
        h = Math.max(Math.abs(y2 - y1), 0.01);
  const flipV = (x2 - x1) * (y2 - y1) < 0;
  const line = { color: o.color || NAVY, width: o.width || 1, dashType: o.dash || "solid" };
  if (o.arrow) line.endArrowType = "triangle";
  s.addShape(pres.shapes.LINE, { x, y, w, h, flipV, line });
}

function legendItem(s, kind, text, x, y, w) {
  const st = sty[kind];
  s.addShape(pres.shapes.RECTANGLE, {
    x, y: y + 0.04, w: 0.3, h: 0.17,
    fill: { color: st.fill }, line: { color: st.line, width: 1.25, dashType: st.dash }
  });
  s.addText(text, { x: x + 0.4, y, w, h: 0.25, fontFace: BF, fontSize: 10, color: GREY, margin: 0, isTextBox: true, valign: "middle" });
}

// =====================================================================
// SLIDE 1 - Title + Graphical Abstract
// =====================================================================
{
  const s = pres.addSlide({ masterName: "TITLE_LAYOUT" });

  // top rule
  s.addShape(pres.shapes.RECTANGLE, { x: 0.6, y: 0.3, w: 0.06, h: 0.65, fill: { color: TEAL }, line: { color: TEAL } });

  s.addText("GEN530  |  FUNDAMENTALS OF RESEARCH  |  CA2 RESEARCH PRESENTATION", {
    x: 0.85, y: 0.36, w: 10, h: 0.28, fontFace: BF, fontSize: 11, bold: true, color: TEAL, charSpacing: 3, margin: 0, isTextBox: true
  });
  s.addText("Robust Multi-Condition Human Recognition\nfor Autonomous Robotics", {
    x: 0.85, y: 0.74, w: 8.6, h: 1.3, fontFace: HF, fontSize: 30, bold: true, color: NAVY, margin: 0, isTextBox: true, valign: "top"
  });
  s.addText("An OpenVisionGuard-Based Perception Framework for GRaCEmo ViRa", {
    x: 0.85, y: 2.1, w: 8.6, h: 0.42, fontFace: HF, fontSize: 17, color: TEAL, margin: 0, isTextBox: true
  });
  s.addText("Approved CA1 thrust: Robust Multi-Condition Human Recognition using Deep Learning for Real-Time Visual Systems", {
    x: 0.85, y: 2.6, w: 8.3, h: 0.42, fontFace: BF, fontSize: 11.5, italic: true, color: GREY, margin: 0, isTextBox: true
  });

  // student info box
  s.addShape(pres.shapes.RECTANGLE, {
    x: 9.8, y: 0.9, w: 3.2, h: 1.9, fill: { color: TINT }, line: { color: RULE, width: 0.75 }
  });
  s.addText([
    { text: "[Student Name]",  options: { bold: true, fontSize: 14, color: NAVY, breakLine: true } },
    { text: "[Roll No.]",      options: { fontSize: 11.5, color: GREY, breakLine: true } },
    { text: "M.Tech – ML & AI",options: { fontSize: 11.5, color: GREY, breakLine: true } },
    { text: "GEN530 CA2",      options: { fontSize: 11.5, color: TEAL, bold: true } },
  ], { x: 10.0, y: 1.0, w: 2.85, h: 1.72, fontFace: BF, margin: 0, isTextBox: true, valign: "top", paraSpaceAfter: 4 });

  // graphical abstract section
  label(s, "GRAPHICAL ABSTRACT", 0.6, 3.22, 5, NAVY, 11);
  s.addShape(pres.shapes.LINE, { x: 0.6, y: 3.52, w: 12.13, h: 0.01, line: { color: RULE, width: 0.75 } });

  const nw = 1.72, gap = 0.28, y0 = 3.72, nh = 1.42;
  const nodes = [
    ["existing", "1  Sensor Input",         "RTSP / MP4 via OpenCV"],
    ["existing", "2  Person Detection",      "YOLOv8s, COCO pre-trained"],
    ["existing", "3  Multi-Object Tracking", "ByteTrack, per-camera IDs"],
    ["partial",  "4  Person Re-ID",          "ResNet-50 + HSV, 2144-d\n(heuristic proxy)"],
    ["proposed", "5  Robust Feature Learning","OSNet-AIN, SupCon,\npart visibility (proposed)"],
    ["future",   "6  ViRa Integration",      "ROS 2 interface,\nOAK-D Pro RGB-D (future)"],
  ];

  nodes.forEach((n, i) => {
    const x = 0.6 + i * (nw + gap);
    box(s, n[0], x, y0, nw, nh, [
      { text: n[1], options: { bold: true, fontSize: 12,   breakLine: true } },
      { text: n[2], options: { fontSize: 10.5 } },
    ], { valign: "top", margin: [7, 7, 5, 7] });
    if (i < 5) ln(s, x + nw + 0.03, y0 + nh / 2, x + nw + gap - 0.03, y0 + nh / 2, { color: NAVY, width: 1.5, arrow: true });
  });

  // bottom annotation bars
  const bx = (i) => 0.6 + i * (nw + gap);
  const by = y0 + nh + 0.14;
  s.addShape(pres.shapes.LINE, { x: bx(0), y: by, w: 4 * nw + 3 * gap, h: 0.01, line: { color: NAVY,  width: 1.5 } });
  s.addShape(pres.shapes.LINE, { x: bx(4), y: by, w: nw,                h: 0.01, line: { color: TEAL,  width: 1.5 } });
  s.addShape(pres.shapes.LINE, { x: bx(5), y: by, w: nw,                h: 0.01, line: { color: AMBER, width: 1.5 } });

  s.addText("EXISTING: OpenVisionGuard (code-audited, not benchmarked)", {
    x: bx(0), y: by + 0.05, w: 4 * nw + 3 * gap, h: 0.26,
    fontFace: BF, fontSize: 10, bold: true, color: NAVY, margin: 0, isTextBox: true
  });
  s.addText("PROPOSED RESEARCH", {
    x: bx(4), y: by + 0.05, w: nw, h: 0.26,
    fontFace: BF, fontSize: 10, bold: true, color: TEAL, margin: 0, isTextBox: true
  });
  s.addText("FUTURE INTEGRATION", {
    x: bx(5), y: by + 0.05, w: nw, h: 0.26,
    fontFace: BF, fontSize: 10, bold: true, color: AMBER, margin: 0, isTextBox: true
  });

  s.addText("Target conditions: illumination  ·  occlusion  ·  pose  ·  viewpoint  ·  real-time edge constraints", {
    x: 0.6, y: 6.3, w: 12.1, h: 0.28, fontFace: BF, fontSize: 11.5, color: NAVY, margin: 0, isTextBox: true
  });

  legendItem(s, "existing", "Existing & verified",           0.6,  6.78, 1.6);
  legendItem(s, "partial",  "Existing, heuristic / partial", 2.65, 6.78, 2.1);
  legendItem(s, "proposed", "Proposed research",             5.4,  6.78, 1.5);
  legendItem(s, "future",   "Future work (ViRa under development)", 7.55, 6.78, 3.8);

  s.addNotes(content.script[0].text);
}

// =====================================================================
// SLIDE 2 - Introduction + Problem
// =====================================================================
{
  const s = pres.addSlide({ masterName: "CONTENT_LAYOUT" });
  header(s, "01  INTRODUCTION", "Why robust human recognition matters");

  const rows = [
    ["BACKGROUND",  "Autonomous platforms operating among people must maintain persistent, accurate human identity — not just detect or track individuals."],
    ["WHY IT MATTERS","Appearance shifts with lighting, occlusion, pose and viewpoint. Identity failures cause unsafe or irrelevant robot behaviour."],
    ["APPLICATION", "GRaCEmo ViRa: an autonomous mobile robot (Jetson Orin Nano, OAK-D Pro, ROS 2) under development; it needs reliable human-aware perception."],
    ["FOUNDATION",  "OpenVisionGuard: a working multi-camera pipeline — YOLOv8s, ByteTrack, ArcFace, ResNet-50 + HSV body Re-ID — code-audited, not benchmarked."],
    ["MOTIVATION",  "Audit result: body Re-ID uses ImageNet features with no metric learning; colour cue is fragile under lighting change; no occlusion handling exists."],
  ];

  rows.forEach((r, i) => {
    const y = 1.52 + i * 1.0;
    s.addShape(pres.shapes.LINE, { x: 0.6, y, w: 7.5, h: 0.01, line: { color: RULE, width: 0.75 } });
    label(s, r[0], 0.6, y + 0.14, 1.72, TEAL);
    s.addText(r[1], {
      x: 2.38, y: y + 0.1, w: 5.12, h: 0.84,
      fontFace: BF, fontSize: 12.5, color: NAVY, margin: 0, isTextBox: true, valign: "top"
    });
  });

  // problem panel (right column)
  s.addShape(pres.shapes.RECTANGLE, {
    x: 8.1, y: 1.52, w: 4.63, h: 2.9,
    fill: { color: NAVY }, line: { color: NAVY, width: 0.5 }
  });
  s.addText("RESEARCH PROBLEM", {
    x: 8.4, y: 1.72, w: 4.1, h: 0.28,
    fontFace: BF, fontSize: 10.5, bold: true, color: "7FD1D2", charSpacing: 2, margin: 0, isTextBox: true
  });
  s.addText(
    "How can a person-recognition pipeline preserve identity under illumination, occlusion, pose and viewpoint change, while remaining fast enough for real-time robotic use?",
    { x: 8.4, y: 2.07, w: 4.1, h: 2.26, fontFace: HF, fontSize: 17, color: WHITE, margin: 0, isTextBox: true, valign: "top" }
  );

  label(s, "CONDITIONS STUDIED", 8.1, 4.65, 4, GREY);
  const chips = [
    ["Illumination",  "indoor lamps to daylight"],
    ["Occlusion",     "luggage, counters, people"],
    ["Pose",          "frontal to top-down"],
    ["Viewpoint",     "camera height and angle"],
  ];
  chips.forEach((c, i) => {
    const cx = 8.1 + (i % 2) * 2.35, cy = 4.98 + Math.floor(i / 2) * 0.82;
    s.addText([
      { text: c[0], options: { bold: true, fontSize: 12,   color: NAVY, breakLine: true } },
      { text: c[1], options: { fontSize: 10.5, color: GREY } },
    ], {
      shape: pres.shapes.RECTANGLE, x: cx, y: cy, w: 2.26, h: 0.72,
      fill: { color: WHITE }, line: { color: RULE, width: 1 },
      fontFace: BF, margin: [3, 7, 3, 7], valign: "middle", isTextBox: true
    });
  });

  s.addText("Additional constraint: real-time inference on edge hardware (Jetson Orin Nano target).", {
    x: 8.1, y: 6.6, w: 4.63, h: 0.28,
    fontFace: BF, fontSize: 10.5, italic: true, color: GREY, margin: 0, isTextBox: true
  });

  s.addNotes(content.script[1].text);
}

// =====================================================================
// SLIDE 3 - Existing system + proposed architecture
// =====================================================================
{
  const s = pres.addSlide({ masterName: "CONTENT_LAYOUT" });
  header(s, "02  SYSTEM FOUNDATION", "Existing OpenVisionGuard and the proposed ViRa architecture");

  const cols = [
    { x: 0.6,  w: 3.95, color: NAVY,  head: "EXISTING: OPENVISIONGUARD (AUDITED)" },
    { x: 5.1,  w: 3.95, color: TEAL,  head: "PROPOSED: ROBUST RE-ID MODULE" },
    { x: 9.6,  w: 3.13, color: AMBER, head: "TARGET: GRACEMO VIRA" },
  ];

  cols.forEach((c) => {
    label(s, c.head, c.x, 1.5, c.w, c.color, 10.5);
    const bgColor = c.color === NAVY ? WHITE : (c.color === TEAL ? "F5FAFA" : "FCF8F1");
    s.addShape(pres.shapes.RECTANGLE, {
      x: c.x, y: 1.82, w: c.w, h: 4.35,
      fill: { color: bgColor },
      line: { color: c.color, width: 1.25, dashType: c.color === NAVY ? "solid" : "dash" }
    });
  });

  // --- Left column: existing pipeline blocks ---
  const ix = 0.75, iw = 3.65;
  const A = [
    ["existing", 0.52, [["Video ingestion",          true],  ["OpenCV; every 3rd frame processed",             false]]],
    ["existing", 0.52, [["Detection",                true],  ["YOLOv8s (COCO), conf 0.45, CPU default",       false]]],
    ["existing", 0.52, [["Local tracking",           true],  ["ByteTrack via Ultralytics, per camera",         false]]],
    ["existing", 0.52, [["Face branch",              true],  ["RetinaFace det_10g + ArcFace, 512-d",           false]]],
    ["partial",  0.78, [["Body & head-top branches", true],  ["ResNet-50 + HSV, 2144-d; MobileNetV3-S head-top 256-d, untrained projection", false]]],
    ["existing", 0.60, [["Global tracker",           true],  ["cosine fusion, transit-time gating, EMA α=0.3", false]]],
  ];
  let y = 1.95;
  A.forEach((b) => {
    box(s, b[0], ix, y, iw, b[1],
      b[2].map((r, k) => ({ text: r[0], options: { bold: r[1], fontSize: r[1] ? 11 : 9.5, breakLine: k === 0 } })),
      { margin: [2, 7, 2, 7] }
    );
    y += b[1] + 0.09;
  });

  // --- Middle column: proposed module ---
  const B = [
    ["Learned Re-ID encoder",     "OSNet-AIN replaces the ResNet-50 + HSV body stage"],
    ["Metric learning",           "Triplet + supervised contrastive loss; photometric augmentation"],
    ["Occlusion-aware parts",     "Visibility-weighted body stripe attention"],
    ["Benchmark harness",         "Market-1501, MSMT17, Occluded-Duke, MOT17"],
    ["Edge runtime profiling",    "FPS and latency per pipeline variant"],
  ];
  y = 1.95;
  B.forEach((b) => {
    box(s, "proposed", 5.25, y, 3.65, 0.74, [
      { text: b[0], options: { bold: true, fontSize: 11, breakLine: true } },
      { text: b[1], options: { fontSize: 9.5 } },
    ]);
    y += 0.83;
  });

  // --- Right column: ViRa (future) ---
  const C = [
    ["Sensing",          "OAK-D Pro RGB-D, LiDAR"],
    ["Compute",          "Jetson Orin Nano 16 GB\nSTM32 motor control"],
    ["Middleware",       "ROS 2 Jazzy; Gazebo Harmonic"],
    ["Planned functions","Person following, human-aware nav, HRI"],
  ];
  y = 1.95;
  C.forEach((b) => {
    box(s, "future", 9.75, y, 2.83, 0.90, [
      { text: b[0], options: { bold: true, fontSize: 11, breakLine: true } },
      { text: b[1], options: { fontSize: 9.5 } },
    ]);
    y += 1.0;
  });

  // arrows between columns
  ln(s, 4.58, 4.0, 5.07, 4.0, { color: TEAL,  width: 1.75, arrow: true });
  ln(s, 9.08, 4.0, 9.57, 4.0, { color: AMBER, width: 1.75, arrow: true });
  s.addText("ROS 2", { x: 9.0, y: 3.68, w: 0.65, h: 0.25, fontFace: BF, fontSize: 9, bold: true, color: AMBER, align: "center", margin: 0, isTextBox: true });

  s.addText(
    "Audit evidence: existing components verified in source code. Body and head-top stages are heuristic (partial). ViRa hardware items are design selections; ROS 2 nodes and integration are not yet implemented.",
    { x: 0.6, y: 6.28, w: 12.1, h: 0.52, fontFace: BF, fontSize: 10.5, italic: true, color: GREY, margin: 0, isTextBox: true, valign: "top" }
  );

  s.addNotes(content.script[2].text);
}

// =====================================================================
// SLIDE 4 - Research Gap + Methodology
// =====================================================================
{
  const s = pres.addSlide({ masterName: "CONTENT_LAYOUT" });
  header(s, "03  RESEARCH GAP AND METHODOLOGY", "From audited gaps to a measurable method");

  label(s, "RESEARCH GAPS (FROM CODE AUDIT)", 0.6, 1.48, 4.6, TEAL);

  const gaps = [
    ["No metric learning",    "Body features come from ImageNet classification, not Re-ID losses; the head-top projection layer is randomly initialised and untrained."],
    ["Fragile colour cue",    "A 96-d HSV histogram carries 50% of the body signature; it is sensitive to per-camera white balance and lighting shifts."],
    ["No occlusion handling", "Three fixed vertical stripes are weighted equally, so occlusion by luggage or counters corrupts the entire signature."],
    ["No measured baseline",  "Accuracy figures in project documents are design targets; zero public-benchmark results exist in the repository."],
  ];

  gaps.forEach((g, i) => {
    const gy = 1.82 + i * 1.17;
    s.addText(String(i + 1), {
      shape: pres.shapes.OVAL, x: 0.6, y: gy, w: 0.42, h: 0.42,
      fill: { color: NAVY }, line: { color: NAVY },
      fontFace: BF, fontSize: 12, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true
    });
    s.addText([
      { text: g[0], options: { bold: true, fontSize: 13,   color: NAVY, breakLine: true } },
      { text: g[1], options: { fontSize: 11.5, color: GREY } },
    ], { x: 1.18, y: gy - 0.04, w: 4.1, h: 1.08, fontFace: BF, margin: 0, isTextBox: true, valign: "top" });
  });

  // --- Right: methodology table ---
  label(s, "PROPOSED METHODOLOGY (8 STEPS)", 5.7, 1.48, 7.03, TEAL);

  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11, fontFace: BF } });
  const cell = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 10.5, color: NAVY, fontFace: BF }, o) });
  const st = (t, col) => cell(t, { bold: true, color: col || (t === "Existing" ? NAVY : TEAL), fontSize: 10 });

  const tableRows = [
    [hdr("#"), hdr("Step"), hdr("Approach"), hdr("Status")],
    [cell("1"), cell("Dataset preparation", {bold:true}), cell("Market-1501, MSMT17 (train/test); Occluded-Duke; MOT17 [7–9]"), st("Proposed")],
    [cell("2"), cell("Preprocessing",        {bold:true}), cell("256×128 resize, ImageNet normalisation; colour jitter, shadow, random erasing"), st("Proposed")],
    [cell("3"), cell("Baseline model",       {bold:true}), cell("Benchmark existing ResNet-50 + HSV (2144-d) on public data first"), st("Existing")],
    [cell("4"), cell("Human detection",      {bold:true}), cell("YOLOv8s COCO-pretrained — held fixed and measured"), st("Existing")],
    [cell("5"), cell("Tracking",             {bold:true}), cell("ByteTrack [3] — held fixed; scored with IDF1 and HOTA [10]"), st("Existing")],
    [cell("6"), cell("Person Re-ID",         {bold:true}), cell("Embedding + cosine retrieval; cross-camera fusion unchanged"), st("Existing")],
    [cell("7"), cell("Robust feature learning",{bold:true}), cell("OSNet-AIN [4,5]; triplet + SupCon [11]; visibility-weighted parts"), st("Proposed")],
    [cell("8"), cell("Comparative evaluation",{bold:true}), cell("Baseline vs proposed per condition; cross-domain; runtime"), st("Proposed")],
  ];

  s.addTable(tableRows, {
    x: 5.7, y: 1.82, w: 7.03, colW: [0.38, 1.6, 4.17, 0.88],
    border: { type: "solid", pt: 0.5, color: RULE },
    rowH: [0.34, 0.5, 0.5, 0.5, 0.44, 0.44, 0.5, 0.5, 0.5],
    valign: "middle", margin: [2, 5, 2, 5], autoPage: false,
  });

  s.addText("Scope: detection and tracking are held fixed and only measured. The research contribution targets the Re-ID representation (steps 3, 7, 8).", {
    x: 5.7, y: 6.28, w: 7.03, h: 0.42, fontFace: BF, fontSize: 10.5, italic: true, color: GREY, margin: 0, isTextBox: true, valign: "top"
  });

  s.addNotes(content.script[3].text);
}

// =====================================================================
// SLIDE 5 - Use-case + workflow
// =====================================================================
{
  const s = pres.addSlide({ masterName: "CONTENT_LAYOUT" });
  header(s, "04  WORKFLOW", "System use-case diagram and research process");

  // ---- LEFT: use-case diagram ----
  label(s, "SYSTEM USE-CASE DIAGRAM", 0.6, 1.4, 4, TEAL);

  // system boundary
  s.addShape(pres.shapes.RECTANGLE, {
    x: 1.9, y: 1.72, w: 4.4, h: 5.0,
    fill: { color: WHITE }, line: { color: NAVY, width: 1 }
  });
  s.addText("«system»  Perception Module (proposed)", {
    x: 2.0, y: 1.76, w: 4.2, h: 0.26,
    fontFace: BF, fontSize: 9.5, italic: true, color: GREY, align: "center", margin: 0, isTextBox: true
  });

  // use-case ellipses
  const ucs = [
    ["existing", "Capture visual scene"],
    ["partial",  "Re-identify person"],
    ["partial",  "Extract appearance embedding"],
    ["existing", "Detect and track persons"],
    ["future",   "Publish identity via ROS 2"],
    ["proposed", "Run benchmark evaluation"],
    ["proposed", "Configure models and thresholds"],
  ];
  const ux = 2.18, uw = 3.72, uh = 0.44, y0 = 2.08, pitch = 0.63;
  ucs.forEach((u, i) => {
    const st2 = sty[u[0]];
    s.addText(u[1], {
      shape: pres.shapes.OVAL, x: ux, y: y0 + i * pitch, w: uw, h: uh,
      fill: { color: st2.fill }, line: { color: st2.line, width: 1.25, dashType: st2.dash },
      fontFace: BF, fontSize: 10, color: st2.text, align: "center", valign: "middle", margin: 0, isTextBox: true
    });
  });

  // <<include>> dependencies
  const cy = (i) => y0 + i * pitch + uh / 2;
  [[1, 2], [2, 3]].forEach(([a, b]) => {
    ln(s, ux + uw / 2, y0 + a * pitch + uh, ux + uw / 2, y0 + b * pitch, { color: GREY, width: 0.75, dash: "dash", arrow: true });
  });
  s.addText("<<include>>", { x: ux + uw / 2 + 0.07, y: y0 + pitch + uh,       w: 1.0, h: 0.19, fontFace: BF, fontSize: 8, italic: true, color: GREY, margin: 0, isTextBox: true });
  s.addText("<<include>>", { x: ux + uw / 2 + 0.07, y: y0 + 2 * pitch + uh,   w: 1.0, h: 0.19, fontFace: BF, fontSize: 8, italic: true, color: GREY, margin: 0, isTextBox: true });

  // actor: stick figure helper
  function stick(xx, yy, name) {
    s.addShape(pres.shapes.OVAL,  { x: xx + 0.37, y: yy,       w: 0.26, h: 0.26, fill: { color: WHITE }, line: { color: NAVY, width: 1 } });
    ln(s, xx + 0.5, yy + 0.26, xx + 0.5, yy + 0.68, { color: NAVY, width: 1 });
    ln(s, xx + 0.25, yy + 0.42, xx + 0.75, yy + 0.42, { color: NAVY, width: 1 });
    ln(s, xx + 0.5,  yy + 0.68, xx + 0.28, yy + 0.94, { color: NAVY, width: 1 });
    ln(s, xx + 0.5,  yy + 0.68, xx + 0.72, yy + 0.94, { color: NAVY, width: 1 });
    s.addText(name, { x: xx - 0.1, y: yy + 1.0, w: 1.2, h: 0.48, fontFace: BF, fontSize: 9.5, bold: true, color: NAVY, align: "center", margin: 0, isTextBox: true, valign: "top" });
  }

  // actor device boxes
  box(s, "existing", 0.52, 1.82, 1.2, 0.68, [
    { text: "Camera / Sensor", options: { bold: true, fontSize: 10, breakLine: true } },
    { text: "RTSP; OAK-D Pro",  options: { fontSize: 8.5 } },
  ], { align: "center", margin: [2, 3, 2, 3] });

  stick(0.6, 3.1, "Human /\nEnvironment");
  box(s, "future", 6.5, 4.26, 1.12, 0.74, [
    { text: "GRaCEmo ViRa", options: { bold: true, fontSize: 10, breakLine: true } },
    { text: "under development", options: { fontSize: 8.5 } },
  ], { align: "center", margin: [2, 3, 2, 3] });
  stick(6.6, 5.4, "Researcher /\nAdmin");

  // association lines
  ln(s, 1.72, 2.16, ux + 0.08, cy(0) - 0.04, { width: 1 });
  ln(s, 1.52, 3.44, ux + 0.04, cy(0) + 0.04, { width: 1 });
  ln(s, 1.52, 3.5,  ux + 0.02, cy(1),         { width: 1 });
  ln(s, 6.5,  4.63, ux + uw - 0.05, cy(4),    { width: 1, color: AMBER });
  ln(s, 6.88, 5.66, ux + uw - 0.02, cy(5),    { width: 1, color: TEAL  });
  ln(s, 6.88, 5.7,  ux + uw - 0.12, cy(6) - 0.04, { width: 1, color: TEAL });

  // ---- RIGHT: research workflow ----
  label(s, "RESEARCH WORKFLOW", 8.1, 1.4, 4, TEAL);

  const wf = [
    ["existing", "Problem identification",    "Robust Re-ID under condition change"],
    ["proposed", "Literature review",          "Re-ID, occlusion, domain adaptation"],
    ["existing", "Research gap",               "Audit: no metric learning, no benchmark"],
    ["proposed", "Dataset selection",          "Market-1501, MSMT17, Occluded-Duke, MOT17"],
    ["partial",  "Baseline implementation",    "ResNet-50 + HSV exists; to be benchmarked"],
    ["proposed", "Proposed improvement",       "OSNet-AIN, SupCon, part visibility"],
    ["proposed", "Experimental evaluation",    "Condition-wise, cross-domain, runtime"],
    ["proposed", "Analysis and conclusion",    "Compare, report limits, plan integration"],
  ];

  wf.forEach((w, i) => {
    const wy = 1.76 + i * 0.62, st3 = sty[w[0]];
    s.addText(String(i + 1), {
      shape: pres.shapes.OVAL, x: 8.1, y: wy, w: 0.42, h: 0.42,
      fill: { color: st3.fill }, line: { color: st3.line, width: 1.25, dashType: st3.dash },
      fontFace: BF, fontSize: 11, bold: true, color: st3.text, align: "center", valign: "middle", margin: 0, isTextBox: true
    });
    if (i < 7) {
      s.addShape(pres.shapes.LINE, { x: 8.31, y: wy + 0.42, w: 0.01, h: 0.2, line: { color: GREY, width: 1 } });
    }
    s.addText([
      { text: w[1], options: { bold: true, fontSize: 11.5, color: NAVY, breakLine: true } },
      { text: w[2], options: { fontSize: 10.5, color: GREY } },
    ], { x: 8.65, y: wy - 0.03, w: 4.1, h: 0.52, fontFace: BF, margin: 0, isTextBox: true, valign: "middle" });
  });

  legendItem(s, "existing", "Established",  8.1,  6.78, 1.2);
  legendItem(s, "partial",  "Partial",       9.65, 6.78, 0.75);
  legendItem(s, "proposed", "Proposed",      10.75,6.78, 0.9);

  s.addNotes(content.script[4].text);
}

// =====================================================================
// SLIDE 6 - Evaluation matrix + contributions
// =====================================================================
{
  const s = pres.addSlide({ masterName: "CONTENT_LAYOUT" });
  header(s, "05  OUTPUT AND EVALUATION", "Proposed Evaluation Framework");

  s.addText("⚠  No experimental results exist. Figures in prior project documents are design targets, not measurements.", {
    x: 0.6, y: 1.42, w: 8.2, h: 0.3,
    fontFace: BF, fontSize: 11.5, bold: true, color: AMBER, margin: 0, isTextBox: true
  });

  const hdr = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: NAVY }, fontSize: 11, fontFace: BF } });
  const cell = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 11, color: NAVY, fontFace: BF }, o) });

  const tableRows = [
    [hdr("Evaluation dimension"), hdr("Metric"), hdr("Evaluation purpose"), hdr("Dataset / protocol")],
    [cell("Detection",    {bold:true}), cell("Precision, Recall, mAP@0.5"), cell("Person detection quality"),                       cell("YOLOv8s baseline; MOT17 person boxes")],
    [cell("Tracking",     {bold:true}), cell("IDF1, HOTA, ID switches [10]"), cell("Association consistency within a camera"),       cell("ByteTrack on MOT17")],
    [cell("Person Re-ID", {bold:true}), cell("Rank-1, Rank-5, mAP, mINP"),  cell("Identity retrieval across views"),                 cell("Market-1501, MSMT17, Occluded-Duke [7–9]")],
    [cell("Robustness",   {bold:true}), cell("Condition-wise Rank-1 and mAP drop"), cell("Degradation under visual change"),         cell("Illumination, occlusion, pose, viewpoint subsets")],
    [cell("Runtime",      {bold:true}), cell("FPS, per-frame latency (ms)"), cell("Real-time feasibility on edge hardware"),         cell("CPU / GPU; Jetson Orin Nano when available")],
  ];

  s.addTable(tableRows, {
    x: 0.6, y: 1.84, w: 8.2, colW: [1.5, 2.2, 2.2, 2.3],
    border: { type: "solid", pt: 0.5, color: RULE },
    rowH: [0.38, 0.65, 0.65, 0.65, 0.65, 0.65],
    valign: "middle", margin: [2, 6, 2, 6], autoPage: false,
  });

  s.addText([
    { text: "Reporting rule: ", options: { bold: true, color: NAVY } },
    { text: "each metric is reported for the existing baseline and each proposed variant — so gains are attributable, not assumed.", options: { color: GREY, breakLine: true } },
    { text: "Current evidence: ", options: { bold: true, color: NAVY } },
    { text: "API / smoke tests only. Logged face-match similarity scores are operational data, not accuracy metrics.", options: { color: GREY } },
  ], { x: 0.6, y: 5.58, w: 8.2, h: 0.9, fontFace: BF, fontSize: 11, margin: 0, isTextBox: true, valign: "top", paraSpaceAfter: 4 });

  // --- right: contributions panel ---
  s.addShape(pres.shapes.RECTANGLE, {
    x: 9.2, y: 1.44, w: 3.53, h: 5.22,
    fill: { color: TINT }, line: { color: TINT, width: 0.5 }
  });
  label(s, "EXPECTED CONTRIBUTIONS", 9.45, 1.62, 3.1, TEAL);
  s.addText("Hypotheses to be tested — not findings", {
    x: 9.45, y: 1.9, w: 3.1, h: 0.26,
    fontFace: BF, fontSize: 10.5, italic: true, color: GREY, margin: 0, isTextBox: true
  });

  const contribs = [
    ["First measured baseline",           "OpenVisionGuard Re-ID evaluated on Market-1501 and MSMT17 for the first time."],
    ["More robust Re-ID representation",  "Learned, occlusion-aware encoder tested against the heuristic baseline, condition by condition."],
    ["Condition and runtime evidence",    "Empirical data to guide ViRa integration decisions and edge-deployment choices."],
  ];
  contribs.forEach((k, i) => {
    const cy2 = 2.36 + i * 1.4;
    s.addText(String(i + 1), {
      shape: pres.shapes.OVAL, x: 9.45, y: cy2, w: 0.38, h: 0.38,
      fill: { color: TEAL }, line: { color: TEAL },
      fontFace: BF, fontSize: 11, bold: true, color: WHITE, align: "center", valign: "middle", margin: 0, isTextBox: true
    });
    s.addText([
      { text: k[0], options: { bold: true, fontSize: 12, color: NAVY, breakLine: true } },
      { text: k[1], options: { fontSize: 10.5, color: GREY } },
    ], { x: 9.98, y: cy2 - 0.04, w: 2.57, h: 1.28, fontFace: BF, margin: 0, isTextBox: true, valign: "top" });
  });

  s.addNotes(content.script[5].text);
}

// =====================================================================
// SLIDE 7 - Conclusion + References
// =====================================================================
{
  const s = pres.addSlide({ masterName: "CONTENT_LAYOUT" });
  header(s, "06  CONCLUSION", "Summary and future direction");

  const rows = [
    ["PROBLEM",         "Preserve person identity under changing illumination, occlusion, pose and viewpoint, in real time."],
    ["METHOD",          "Benchmark the existing baseline on public datasets, then compare OSNet-AIN, SupCon and part-visibility variants per condition."],
    ["CONTRIBUTION",    "A first measured baseline and a more robust Re-ID stage — expected outcomes to be tested, not proven findings."],
    ["OPENVISIONGUARD", "Existing, code-audited pipeline: YOLOv8s detection, ByteTrack, ArcFace, ResNet-50 + HSV body Re-ID, global fusion."],
    ["GRACEMO VIRA",    "Target application under development; ROS 2 integration and edge deployment are proposed future work."],
    ["FUTURE",          "Edge TensorRT deployment on Jetson Orin Nano; person following; human-aware navigation; ViRa-platform recordings."],
  ];

  rows.forEach((r, i) => {
    const ry = 1.5 + i * 0.77;
    s.addShape(pres.shapes.LINE, { x: 0.6, y: ry, w: 7.0, h: 0.01, line: { color: RULE, width: 0.75 } });
    label(s, r[0], 0.6, ry + 0.11, 1.75, TEAL, 10);
    s.addText(r[1], { x: 2.42, y: ry + 0.06, w: 4.58, h: 0.68, fontFace: BF, fontSize: 12.5, color: NAVY, margin: 0, isTextBox: true, valign: "top" });
  });

  s.addText("Thank you.  Questions are welcome.", {
    x: 0.6, y: 6.2, w: 6.4, h: 0.55,
    fontFace: HF, fontSize: 24, bold: true, color: NAVY, margin: 0, isTextBox: true, valign: "middle"
  });

  // references panel
  s.addShape(pres.shapes.RECTANGLE, {
    x: 7.55, y: 1.5, w: 5.18, h: 5.3,
    fill: { color: TINT }, line: { color: TINT, width: 0.5 }
  });
  label(s, "KEY REFERENCES", 7.8, 1.65, 4.6, TEAL);

  const refRuns = content.refs.map((r, i) => ({
    text: `[${i + 1}]  ${r}`,
    options: { breakLine: i < content.refs.length - 1, fontSize: 9.5, color: NAVY, paraSpaceAfter: 4 }
  }));
  s.addText(refRuns, { x: 7.8, y: 1.95, w: 4.75, h: 4.72, fontFace: BF, margin: 0, isTextBox: true, valign: "top" });

  s.addNotes(content.script[6].text);
}

// --- Write file ---
pres.writeFile({ fileName: "OpenVisionGuard_ViRa_GEN530_CA2.pptx" })
  .then((f) => console.log("✓ Written:", f))
  .catch((e) => { console.error("Error:", e); process.exit(1); });

