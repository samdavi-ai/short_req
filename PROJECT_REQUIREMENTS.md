# 🛫 Airport Security — Intelligent Surveillance & Tracking System

> **Project Codename:** Chairman Requirement  
> **Domain:** Airport Security & Operations  
> **Classification:** High-Accuracy Person Identification, Re-Identification & Behavioral Monitoring  
> **Date:** June 2026

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Feature List](#feature-list)
3. [Person Identification & Re-Identification Strategy](#person-identification--re-identification-strategy)
4. [System Architecture](#system-architecture)
5. [Technology Stack](#technology-stack)
6. [Data Pipeline](#data-pipeline)
7. [Database Schema (High-Level)](#database-schema-high-level)
8. [Deployment Architecture (Local Docker Compose)](#deployment-architecture-local-docker-compose)
9. [Privacy & Compliance](#privacy--compliance)
10. [Accuracy Targets](#accuracy-targets)
11. [Development Phases](#development-phases)
12. [Implemented Changes & Production Fixes](#implemented-changes--production-fixes)

---

## Project Overview

This system is designed for **airport security operations**, providing real-time tracking, identification, and behavioral analysis of all individuals (passengers, employees, visitors) across the entire airport premises using a network of surveillance cameras.

The system must operate with **high accuracy** in challenging conditions:
- Crowded terminals with hundreds of concurrent individuals
- Varying lighting (indoor terminals, outdoor tarmac, night operations)
- Occlusions (luggage, crowds, pillars)
- Appearance changes (removing jackets, hats, sunglasses)
- Multiple camera angles, resolutions, and fields of view

---

## Feature List

### 1. 🚪 Entry / Exit Tracking

**Purpose:** Track every person entering and exiting designated zones (terminal gates, restricted areas, building perimeters).

| Aspect | Detail |
|---|---|
| **Trigger** | Virtual tripwire or zone boundary crossing detected by camera |
| **Data Captured** | Person ID, timestamp, direction (in/out), camera ID, zone ID |
| **Counting Logic** | Directional counting using optical flow + centroid tracking |
| **Outputs** | Real-time occupancy count per zone, entry/exit logs, alerts on capacity breach |
| **Edge Cases** | Groups entering together, tailgating, revolving doors, re-entry within short window |

**Implementation Approach:**
- Define virtual entry/exit lines on each camera feed
- Use person detection (YOLOv8/v9) + DeepSORT/ByteTrack for directional crossing
- Maintain per-zone occupancy counters with time-series logging
- Alert system for unauthorized zone entry or occupancy threshold breaches

---

### 2. 🗺️ In-Person Tracking / Cross-Camera Mapping

**Purpose:** Track an individual seamlessly across multiple cameras as they move through the airport.

| Aspect | Detail |
|---|---|
| **Scope** | All cameras in the network — indoor, outdoor, across terminals |
| **Core Challenge** | Re-identifying the same person across non-overlapping camera views |
| **Output** | Unified trajectory per person on the building map, historical path replay |
| **Latency Target** | < 2 seconds for cross-camera handoff |

**Implementation Approach:**
- Person Re-Identification (ReID) model generates appearance embeddings per detected person
- Spatio-temporal reasoning: if Person A disappears from Camera 3 and a similar embedding appears on Camera 5 within a plausible travel time → match
- Global track ID assignment via a centralized tracker service
- Path visualization on the building layout map

---

### 3. ⏱️ Dwell Time Monitoring

**Purpose:** Monitor how long a person stays in a specific area and generate alerts for abnormal loitering.

| Aspect | Detail |
|---|---|
| **Zones** | Security checkpoints, boarding gates, retail areas, restricted zones, baggage claim |
| **Threshold Config** | Configurable per zone (e.g., > 15 min at a gate = normal; > 15 min near restricted = alert) |
| **Tracking Method** | Continuous tracking via ReID + zone polygon intersection |
| **Alerts** | Tiered: Info → Warning → Critical based on dwell duration |

**Implementation Approach:**
- Define polygonal zones on the building layout
- Track each person's presence within each zone using their global track ID
- Compute cumulative dwell time, accounting for brief exits (< 30s gap = same session)
- Dashboard widget showing real-time dwell heatmaps per zone

---

### 4. 🧘 Relaxation Time Monitor (Employee Break Compliance)

**Purpose:** Ensure airport employees take mandatory breaks every 2 hours, as per labor/safety regulations.

| Aspect | Detail |
|---|---|
| **Applicable To** | Registered airport employees (ground staff, security, retail, maintenance) |
| **Rule** | Must leave their assigned work zone for a break every 2 hours |
| **Detection** | Track employee's continuous presence in their work zone |
| **Alert Flow** | 1h 45m → Reminder notification; 2h → Compliance alert to supervisor |

**Implementation Approach:**
- Employees are pre-enrolled with face embeddings and/or badge-linked appearance profiles
- System tracks their presence in their assigned zone using ReID
- Timer logic: continuous presence counter resets when the employee leaves the zone for ≥ configured break duration (e.g., 10 minutes)
- Integration with HR/shift management system for duty schedules
- Dashboard: Employee compliance overview with green/yellow/red status

---

### 5. 👥 Visitors Tracking

**Purpose:** Track visitors entering the airport, provide review workflows, and manage visitor records in the database.

| Aspect | Detail |
|---|---|
| **Visitor Types** | Meeters/greeters, vendors, contractors, VIPs, unknown individuals |
| **Registration** | Auto-capture face + appearance on entry; manual review to classify |
| **Review Workflow** | Security operator reviews new visitor entries, adds metadata (name, purpose, host) |
| **Database** | Persistent visitor records with visit history, linked to appearance embeddings |
| **Watchlist** | Cross-reference against known watchlists on entry |

**Implementation Approach:**
- On entry detection, capture best-quality face crop + full-body appearance embedding
- Queue new entries for operator review in the dashboard
- Operator can: approve, flag, add to watchlist, or link to existing visitor record
- Returning visitors are auto-matched against the visitor DB
- Alerts for watchlisted individuals or repeat flagged visitors

---

### 6. 🏗️ Camera Position in Building Layout Editor

**Purpose:** Visual drag-and-drop editor to place, configure, and manage camera positions on interactive building floor plans. Designed to be so simple that **anyone can use it — no technical training required.**

---

#### 🎯 Core Design Principle: "If You Can Use a Phone, You Can Use This"

> **Target Users:** Airport facility managers, security supervisors, maintenance staff — many of whom may have limited computer literacy. The UI must feel like a **touchscreen map app**, not enterprise software.

| Principle | How We Achieve It |
|---|---|
| **No text-heavy menus** | Use large, colorful icons with picture labels instead of text-only menus |
| **Drag & Drop everything** | Cameras, zones, labels — everything is placed by dragging from a visual toolbar |
| **Instant visual feedback** | Every action shows an immediate result on the map (no "apply" or "save" buttons hidden in menus) |
| **Undo everything** | Big visible ↩️ Undo button + Ctrl+Z — users are never afraid to try things |
| **Guided setup wizard** | First-time users get a step-by-step guided tour with animated arrows |
| **Tooltips on hover** | Every button shows a simple explanation on hover (e.g., "Drag this camera to the map") |
| **Large touch targets** | Buttons and interactive elements are minimum 48×48px for easy clicking |
| **Color-coded everything** | Cameras = blue 📷, Zones = colored by type, Alerts = red ⚠️ |
| **Auto-save** | Changes save automatically every 5 seconds — no "forgot to save" disasters |
| **Multi-language** | Full UI translation support (Hindi, Arabic, English, etc.) |

---

#### 📐 Multi-Floor / Multi-Terminal Support

```
┌─────────────────────────────────────────────────────────────────┐
│  🏢 Airport Terminal Layout                                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  BUILDING SELECTOR (tab bar at top)                  │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │       │
│  │  │Terminal 1│ │Terminal 2│ │Terminal 3│ │ + Add  │  │       │
│  │  │  ✈️      │ │  ✈️      │ │  ✈️      │ │Building│  │       │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘  │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  FLOOR SELECTOR (vertical tab on left side)          │       │
│  │  ┌─────────┐                                        │       │
│  │  │ Roof    │  ← Click to switch floors              │       │
│  │  ├─────────┤                                        │       │
│  │  │ Floor 3 │  ← Each floor shows camera count       │       │
│  │  │ 📷 ×12  │     e.g., "12 cameras"                 │       │
│  │  ├─────────┤                                        │       │
│  │  │ Floor 2 │                                        │       │
│  │  │ 📷 ×24  │  ← Active floor is highlighted         │       │
│  │  ├─────────┤                                        │       │
│  │  │ Floor 1 │  ← Ground floor / arrivals             │       │
│  │  │ 📷 ×31  │                                        │       │
│  │  ├─────────┤                                        │       │
│  │  │ Basement│  ← Parking / baggage handling           │       │
│  │  │ 📷 ×8   │                                         │       │
│  │  └─────────┘                                         │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                 │
│  Features:                                                      │
│  • Drag floor plan images onto each floor                       │
│  • Copy cameras between floors (for similar layouts)            │
│  • Cross-floor tracking lines showing connected cameras         │
│  • 3D building overview mode (see all floors stacked)           │
│  • Floor plan alignment tool (match elevator/stairway positions)│
└─────────────────────────────────────────────────────────────────┘
```

| Multi-Floor Feature | Detail |
|---|---|
| **Building Management** | Add/rename/delete buildings (terminals, hangars, parking structures) |
| **Floor Management** | Add/rename/reorder floors per building; upload separate floor plan per floor |
| **Floor Plan Upload** | Drag & drop PNG, JPG, SVG, or PDF floor plans — auto-scales to fit canvas |
| **Floor Alignment** | Align floors vertically by marking common reference points (elevators, pillars, stairs) |
| **Cross-Floor Tracking** | Visual lines showing which cameras on Floor 1 connect to which cameras on Floor 2 |
| **3D Stacked View** | Toggle a 3D isometric view showing all floors stacked with camera positions |
| **Floor Templates** | Save a floor layout as a template and apply it to similar floors |
| **Global Camera List** | View all cameras across all floors/buildings in a searchable list |

---

#### 🖱️ Drag & Drop Camera Placement — Step by Step

```
STEP 1: SELECT                    STEP 2: DRAG                     STEP 3: CONFIGURE
┌──────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│ Camera Toolbar   │         │ Floor Plan Canvas     │         │ Camera Properties    │
│ (left sidebar)   │         │                       │         │ (right panel)        │
│                  │         │                       │         │                      │
│ ┌──────────────┐ │         │    ┌───┐              │         │ Name: [Gate A3 Cam ] │
│ │ 📷           │ │  DRAG   │    │📷 │  ← dropped    │         │                      │
│ │ Dome Camera  │ │ ──────► │    └───┘    here      │  CLICK  │ Type: [Dome     ▼]   │
│ │              │ │         │         ╱  ╲          │ ──────► │                      │
│ └──────────────┘ │         │        ╱ FoV ╲        │         │ Stream: [rtsp://... ] │
│ ┌──────────────┐ │         │       ╱______╲        │         │                      │
│ │ 📹           │ │         │                       │         │ Height: [4.5m   ▼]   │
│ │ PTZ Camera   │ │         │                       │         │                      │
│ └──────────────┘ │         │                       │         │ FoV: [━━━●━━ 120°]   │
│ ┌──────────────┐ │         │                       │         │       (drag slider)   │
│ │ 📷           │ │         │                       │         │                      │
│ │ Bullet Cam   │ │         │                       │         │ Rotation: [🔄 drag]  │
│ └──────────────┘ │         │                       │         │                      │
│ ┌──────────────┐ │         │                       │         │ [▶ Live Preview]     │
│ │ 📷           │ │         │                       │         │ [🗑 Delete Camera]   │
│ │ Face-Capture │ │         │                       │         │                      │
│ │ (wall-mount) │ │         │                       │         │ Status: 🟢 Online    │
│ └──────────────┘ │         │                       │         │                      │
└──────────────────┘         └──────────────────────┘         └──────────────────────┘
```

**Camera Drag & Drop Interactions:**

| Interaction | What Happens | Visual Feedback |
|---|---|---|
| **Drag camera from toolbar** | Camera icon follows cursor onto the floor plan | Ghost icon follows mouse; valid drop zones highlight green |
| **Drop camera on map** | Camera is placed at drop position with default FoV cone | Camera icon appears with semi-transparent FoV cone; a gentle bounce animation |
| **Drag camera on map** | Reposition an existing camera | Camera + FoV cone move together; snap-to-grid optional |
| **Rotate camera** | Drag the rotation handle (circular arrow around camera) | FoV cone rotates in real-time showing coverage direction |
| **Resize FoV** | Drag the edge of the FoV cone or use slider | Cone widens/narrows in real-time; overlapping zones show in a different color |
| **Click camera** | Select it — opens properties panel on the right | Camera icon gets a glowing selection ring; properties panel slides in |
| **Double-click camera** | Opens live feed in a popup overlay | Mini video player appears over the map showing that camera's stream |
| **Right-click camera** | Context menu: Rename, Delete, Duplicate, Connect to camera, View feed | Simple context menu with icons for each action |
| **Drag camera to trash** | Delete the camera | Camera fades out with a gentle animation; undo notification appears at bottom |

---

#### 🟩 Zone Drawing Tool — Simple Polygon Drawing

```
ZONE DRAWING MODE
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Toolbar:  [🟩 Entry Zone] [🟥 Restricted] [🟦 Work Area]     │
│            [🟧 Dwell Zone] [🟪 Break Area] [🟨 Public]        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                                                        │  │
│  │    Click points on the map to draw a zone boundary:    │  │
│  │                                                        │  │
│  │         ●─────────────────●                            │  │
│  │         │   GATE A3       │                            │  │
│  │         │  🟧 Dwell Zone  │  ← Each zone has a         │  │
│  │         │  (15 min max)   │     color + name + icon    │  │
│  │         │                 │                            │  │
│  │         ●─────────────────●                            │  │
│  │                                                        │  │
│  │    [✓ Finish Zone]  [↩️ Undo Point]  [✕ Cancel]        │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  After finishing:                                            │
│  → Name the zone (auto-suggested based on nearby cameras)    │
│  → Set zone type (dropdown with color-coded icons)           │
│  → Set dwell threshold (simple slider: "Alert after __ min") │
│  → Set max occupancy (simple number input)                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Zone Drawing Interactions:**

| Interaction | What Happens |
|---|---|
| **Select zone type** from toolbar | Color is pre-set; cursor changes to crosshair |
| **Click on map** | Places a vertex; line connects to previous vertex |
| **Double-click / click "Finish"** | Closes the polygon; fills with semi-transparent zone color |
| **Drag a vertex** | Reshape the zone boundary |
| **Drag zone interior** | Move the entire zone |
| **Click a finished zone** | Select it; shows properties panel |
| **Preset shapes** | Quick-draw rectangles, circles, or L-shapes with one click + resize |

---

#### 📱 Complete Editor Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔒 Airport Security — Layout Editor                    👤 Admin  ⚙️  🔔   │
├────────┬────────────────────────────────────────────────────────┬───────────┤
│        │  Terminal 1 ✈️  │  Terminal 2 ✈️  │  Terminal 3 ✈️  │ + Add     │
│        ├────────────────────────────────────────────────────────┤           │
│ FLOORS │                                                        │ PROPERTIES│
│        │              FLOOR PLAN CANVAS                         │  PANEL    │
│┌──────┐│     (Zoomable, Pannable, Interactive)                  │           │
││Roof  ││                                                        │ ┌───────┐ │
│├──────┤│     📷──╱╲     📷──╱╲                                   │ │ Name  │ │
││Fl. 3 ││       ╱  ╲       ╱  ╲     📹──╱╲                        │ │[     ]│ │
│├──────┤│      ╱____╲     ╱____╲        ╱  ╲                     │ │       │ │
││Fl. 2 ││                              ╱____╲                    │ │ Type  │ │
│├──────┤│  ┌─────────────────────┐                               │ │[Dome▼]│ │
││Fl. 1 ││  │ 🟧 Gate A3 Zone    │         📷──╱╲                  │ │       │ │
││ ●    ││  │ Dwell: 15 min      │            ╱  ╲                │ │ URL   │ │
│├──────┤│  └─────────────────────┘          ╱____╲               │ │[rtsp:]│ │
││Base  ││                                                        │ │       │ │
│└──────┘│  🟥 Restricted  ┌──────────────────┐                   │ │ FoV   │ │
│        │   Area          │ 🟩 Entry Zone    │                   │ │[━●━━ ]│ │
│        │                 │ Count: 142 in    │                   │ │       │ │
│        │                 └──────────────────┘                   │ │[▶Live]│ │
│        │                                                        │ │[🗑Del]│ │
│        ├────────────────────────────────────────────────────────┤ └───────┘ │
│ TOOLS  │  🔍+ 🔍- 🔄Reset │ 📷Add │ 🟩Zone │ ↩️Undo │ 💾Save │           │
├────────┴────────────────────────────────────────────────────────┴───────────┤
│  STATUS BAR: 📷 75 cameras placed  │  🟩 12 zones defined  │  ⚠️ 3 offline │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

#### 🧑‍🦳 Accessibility & Ease-of-Use Features (For Non-Technical Users)

| Feature | Description |
|---|---|
| **🎓 Guided Setup Wizard** | On first use, a step-by-step wizard walks through: 1) Upload floor plan → 2) Add cameras → 3) Draw zones → 4) Connect streams. Each step has animated hand-cursor showing exactly what to do |
| **🖼️ Large Visual Icons** | Every tool has a large (64×64px) colored icon with a picture — e.g., a camera icon for "Add Camera", a colored square for "Draw Zone" — no text-only buttons |
| **🌐 Multi-Language UI** | Full support for Hindi, Arabic, Urdu, English, and other regional languages — all labels, tooltips, and instructions are translated |
| **🔤 Simple Language** | No technical jargon in the UI. Instead of "Configure RTSP endpoint" → **"Paste camera link here"**. Instead of "FoV angle" → **"How wide can this camera see?"** |
| **🎨 Color-Coded Everything** | Camera types have distinct colors/shapes. Zone types are color-coded. Online = 🟢 Green, Offline = 🔴 Red, Warning = 🟡 Yellow |
| **💬 Contextual Help Bubbles** | Small "?" icons next to every field that show a simple explanation with a picture when clicked |
| **↩️ Prominent Undo/Redo** | Large, always-visible Undo button. Also shows "You just deleted Camera 5" with a "Bring it back" button (toast notification) |
| **🔍 Pinch-to-Zoom** | On touchscreen / trackpad: pinch to zoom, two-finger drag to pan — same as Google Maps |
| **📱 Tablet Friendly** | Full touch support — designed to work on iPads and Android tablets at the airport |
| **🔊 Audio Feedback** | Optional: soft click sound when placing a camera, success chime when zone is completed |
| **🌙 Dark/Light Mode** | Toggle between dark mode (for control rooms) and light mode (for office use) |
| **📋 Template Layouts** | Pre-built templates: "Standard Terminal Gate", "Security Checkpoint", "Baggage Claim" — one-click to apply a standard camera layout |
| **🤖 Auto-Suggest Placement** | AI suggests optimal camera positions based on the floor plan shape and zone definitions — user just approves |
| **👁️ Coverage Heatmap** | Toggle overlay showing camera coverage as a heatmap — green = well covered, red = blind spots — makes it obvious where to add cameras |
| **📏 Smart Snapping** | Cameras snap to walls and corners automatically; zones snap to room boundaries |
| **🖨️ Print Layout** | One-click print a clean layout with camera positions, zone names, and a legend for physical installation teams |

---

#### 🔄 Real-Time Features on the Layout Map

When the system is live, the layout editor doubles as a **live monitoring map:**

| Feature | Description |
|---|---|
| **👤 Live Person Dots** | Moving dots on the map showing real-time positions of tracked individuals |
| **🔴 Alert Flashing** | When an alert triggers, the relevant camera/zone flashes red with a pulse animation |
| **📊 Zone Occupancy Count** | Each zone shows a live count badge (e.g., "Gate A3: 47 people") |
| **🟢🔴 Camera Status** | Online cameras = green dot, offline = red dot with "!" badge |
| **🔥 Dwell Heatmap** | Toggle overlay showing where people spend the most time (warmer = longer dwell) |
| **🚶 Path Replay** | Click a person's track → see their path drawn on the map across floors |
| **📷 Quick Feed** | Hover over any camera → see a small live thumbnail of that camera's feed |

---

#### 💾 Data Management

| Feature | Detail |
|---|---|
| **Auto-Save** | Every change saves automatically (with 5-second debounce) — no explicit save button needed |
| **Version History** | Every layout change creates a version — roll back to any previous state with one click |
| **Export** | Export layout as JSON (for API/backup), PNG/PDF (for printing), or SVG (for editing) |
| **Import** | Import layouts from JSON backup or from another airport's template |
| **Audit Log** | Who changed what, when — full audit trail for compliance |

---

#### 🏗️ Implementation Approach

| Component | Technology | Reason |
|---|---|---|
| **Canvas Engine** | HTML5 Canvas via Fabric.js or Konva.js | Best drag-and-drop support, handles thousands of objects, touch-friendly |
| **Floor Plan Rendering** | Multi-layer canvas (background = floor plan, mid = zones, top = cameras) | Separate layers for independent interaction |
| **State Management** | React Context + Zustand | Simple state for camera/zone positions and properties |
| **Persistence** | REST API → PostgreSQL (layout data) + MinIO (floor plan images) | Reliable storage with versioning |
| **Real-Time Overlay** | WebSocket feed of person positions → rendered as moving dots on canvas | Live monitoring integration |
| **Touch Support** | Hammer.js for gesture recognition (pinch, pan, rotate) | Tablet and touchscreen compatibility |
| **Internationalization** | react-i18next with JSON language files | Easy to add new languages |
| **Guided Tour** | Intro.js or Shepherd.js for step-by-step walkthroughs | First-time user onboarding |

---

## Person Identification & Re-Identification Strategy

> **This is the core intelligence layer of the system.** Accuracy here directly determines the reliability of every feature above.

### ⚠️ Critical Constraint: Overhead Camera Mounting

> **In airports, the vast majority of cameras are ceiling-mounted (3–5m height), looking downward.** This means:
> - Cameras primarily see the **top of heads, shoulders, and upper body** — NOT faces
> - Frontal face views are **rare** and only available at specific strategic locations
> - **Body-based and top-down appearance features are the PRIMARY identification signals**
> - Face recognition is an **opportunistic boost**, not a guaranteed input

#### Camera View Reality by Location

| Location | Mounting | Angle | Face Visibility | Primary Signal |
|---|---|---|---|---|
| Terminal hallways | Ceiling (4–5m) | ~60–80° downward | ❌ Top of head only | Body shape, clothing, hair |
| Boarding gates | Ceiling (3–4m) | ~45–70° downward | ⚠️ Occasional partial | Body + occasional face |
| Check-in counters | Ceiling + desk-level | Mixed | ✅ At desk-level cams | Face at kiosks, body overhead |
| Security checkpoints | Ceiling + corridor | ~30–50° | ✅ Corridor-mounted | Face at choke points |
| Baggage claim | Ceiling (5–6m) | ~70–90° downward | ❌ Top of head | Body, luggage association |
| Retail areas | Ceiling (3m) | ~45–60° | ⚠️ Partial angles | Body + partial face |
| Restricted area doors | Wall-mounted (2m) | ~10–30° | ✅ Near-frontal | Face (best capture point) |
| Escalators / elevators | Ceiling + wall | Mixed | ✅ People look up | Face + body |

> **Key Insight:** Only ~15–20% of cameras will reliably capture faces. The system MUST be designed to work primarily on **top-down body appearance** with face as an opportunistic enhancement.

---

### Multi-Modal Identification Pipeline (Overhead-First Design)

```
┌─────────────────────────────────────────────────────────────┐
│                    CAMERA FEED INPUT                        │
└─────────────┬───────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────┐
│   Person Detection      │  ← YOLOv8/v9-Pose (bounding box + keypoints)
│   (Full Body)           │
└─────────────┬───────────┘
              │
       ┌──────┴──────────────┬────────────────┐
       ▼                     ▼                ▼
┌──────────────┐   ┌──────────────┐  ┌────────────────┐
│ Head-Top     │   │ Body Crop    │  │ Face Detection │
│ Appearance   │   │ Extraction   │  │ (RetinaFace /  │
│ (hair, hat,  │   │ (top-down    │  │  SCRFD)        │
│  accessories)│   │  perspective)│  │ ⚠️ ONLY when   │
└──────┬───────┘   └──────┬───────┘  │  face visible  │
       │                  │          └───────┬────────┘
       ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐  ┌────────────────┐
│ Head-Top     │   │ ReID Embedding│  │ Face Embedding│
│ Embedding    │   │ (TransReID / │  │ (ArcFace /     │
│ 256-d vector │   │  CLIP-ReID)  │  │  AdaFace)      │
│              │   │  2048-d vec  │  │  512-d vector  │
│  ★ PRIMARY   │   │  ★ PRIMARY   │  │  ☆ OPTIONAL    │
└──────┬───────┘   └──────┬───────┘  └───────┬────────┘
       │                  │                  │
       └──────────┬───────┴──────────────────┘
                  ▼
┌───────────────────────────┐
│   Fusion & Matching       │  ← Weighted: body + head-top (always)
│   Engine                  │     + face (when available)
│                           │     + spatio-temporal constraints
└───────────────┬───────────┘
                ▼
┌───────────────────────────┐
│   Global Identity         │  ← Assign/retrieve global track ID
│   Database                │     (Vector DB: Milvus / FAISS)
└───────────────────────────┘
```

### Strategy 1: Top-Down Body ReID (★ PRIMARY — Always Available)

> **This is the workhorse strategy.** Every overhead camera provides this signal.

| Component | Choice | Details |
|---|---|---|
| **Body Detection** | YOLOv8-L / v9 (top-down trained) | Detect persons from overhead perspective — sees shoulders, head-top, torso |
| **ReID Model** | TransReID (ViT-based) | Transformer-based, fine-tuned on top-down airport views |
| **Alternative** | CLIP-ReID | Robust zero-shot appearance understanding, handles viewpoint variation |
| **Alternative** | OSNet-AIN (appearance invariant) | Lightweight, handles viewpoint changes across cameras |
| **Embedding Dim** | 2048-d or 768-d | Stored per detection for matching |
| **Matching** | Cosine similarity + re-ranking | k-reciprocal re-ranking for improved precision |
| **Training Data** | Fine-tune on overhead airport datasets | Critical: models trained on side-view data perform poorly on top-down |

**What Top-Down Body ReID Captures:**
- Shoulder width and body shape (seen from above)
- Clothing color and texture (shirt/jacket patterns, backpack straps)
- Hair color, style, head covering (clearly visible from above)
- Carried items visible from top (bags, trolleys, umbrellas)
- Walking speed and stride pattern (from frame sequences)

**Why This Is Primary:**
- ✅ Available from **every** ceiling-mounted camera (80–85% of cameras)
- ✅ Works regardless of whether the person looks up or down
- ✅ Shoulder/clothing appearance is highly discriminative in short time windows
- ✅ No cooperation needed from the subject

**Limitations:**
- Appearance changes (removing jacket, changing bags)
- Identical uniforms (airport staff — mitigated by badge + head-top features)
- Crowded scenes with heavy occlusion from above
- Long-term re-identification (clothing changes across days)

---

### Strategy 2: Head-Top Appearance Analysis (★ PRIMARY — Overhead Specific)

> **Unique to overhead camera systems.** The top of the head is the MOST consistently visible feature from ceiling cameras.

| Component | Choice | Details |
|---|---|---|
| **Head Detection** | Custom YOLOv8 head detector | Trained specifically on overhead head crops |
| **Features Extracted** | CNN-based head-top embedder | Hair color, hairstyle, bald patterns, hats, hijabs, turbans |
| **Model** | EfficientNet-B3 or ResNet-50 (fine-tuned) | 256-d embedding from head-top crops |
| **Augmentations** | Rotation-invariant training | Head-top looks similar regardless of walking direction |
| **Matching** | Cosine similarity | Combined with body ReID score |

**What Head-Top Analysis Captures:**
- Hair color and style (blonde, black, curly, straight, bald, ponytail)
- Head coverings (hats, caps, hijabs, turbans, helmets)
- Accessories visible from above (headphones, earbuds, glasses on head)
- Bald patterns (unique and stable over time)
- Hair parting direction and density

**Why This Matters for Overhead Cameras:**
- ✅ The head-top is the **first and last thing** an overhead camera sees
- ✅ Even in crowds, the top of the head is often unoccluded
- ✅ Hair/head features are relatively stable within a visit (unlike carried items)
- ✅ Strong discriminator when combined with body ReID

**Limitations:**
- Similar hairstyles can cause confusion (e.g., many dark-haired men)
- Hat removal changes appearance
- Head coverings can look similar (uniform caps for employees)

---

### Strategy 3: Face Recognition (☆ OPPORTUNISTIC — At Strategic Capture Points Only)

> **Face recognition is NOT the primary strategy due to overhead cameras.** It is used as a **high-confidence boost** at the ~15–20% of cameras that can capture faces.

| Component | Choice | Details |
|---|---|---|
| **Face Detection** | SCRFD / RetinaFace | High-speed, handles small faces, multi-scale |
| **Face Alignment** | 5-point landmark alignment | Normalize face crop before embedding |
| **Face Embedding** | ArcFace (ResNet-100 backbone) | 512-dimensional embedding, state-of-art accuracy |
| **Alternative** | AdaFace | Better on low-quality / surveillance-grade faces |
| **Matching** | Cosine similarity with adaptive threshold | Threshold: 0.45–0.55 depending on quality score |
| **Quality Gate** | Face quality score (blur, pose, occlusion) | Only use faces with quality > threshold for enrollment |

**Strategic Face-Capture Locations (Install Face-Level Cameras Here):**
- 🚪 **Entry/exit corridors** — Narrow passages, people walk toward camera (wall-mounted at 1.8–2.2m)
- 🛂 **Security checkpoints** — People face forward in queue lines
- 🎫 **Check-in kiosks / self-service machines** — People look at screens (camera behind/above screen)
- 🚪 **Restricted area doors** — Wall-mounted at 1.5–2m height, people look at door/badge reader
- 🛗 **Escalator entry/exit** — People naturally look forward, camera at eye level at top/bottom
- 🚻 **Corridor chokepoints** — Narrow hallways where people must pass single-file
- 🅿️ **Elevator lobbies** — People face the elevator doors, camera mounted above doors

**Face Capture Strategy:**
```
  ┌─────────────────────────────────────────────────────────┐
  │  OVERHEAD CAMERAS (majority)     FACE-CAPTURE CAMERAS   │
  │  ┌───────────────────────┐       ┌───────────────────┐  │
  │  │ Track person with     │       │ Capture face at   │  │
  │  │ body + head-top ReID  │──────►│ strategic points  │  │
  │  │ (continuous tracking) │       │ (link face to     │  │
  │  │                       │       │  existing track)  │  │
  │  └───────────────────────┘       └───────────────────┘  │
  │                                                         │
  │  Person tracked by body/head →  Face captured at gate   │
  │  → Face embedding linked to →   Global ID now has both  │
  │     body + head + face data     body AND face identity  │
  └─────────────────────────────────────────────────────────┘
```

**When Face Works Well (at face-capture points):**
- Wall-mounted cameras at 1.5–2.2m height in corridors
- Self-service kiosk cameras (people look directly at screen)
- Restricted door cameras (people face the access panel)
- Adequate lighting

**Limitations (Why It Cannot Be Primary):**
- ❌ Overhead ceiling cameras see top of head, NOT face
- ❌ Masked faces (still common in airports)
- ❌ Only ~15–20% of camera positions can reliably capture faces
- ❌ Low resolution at distance from ceiling height

---

### Strategy 4: Multi-Modal Fusion — Overhead-First Design (Recommended for Production)

Combine all available signals with an **overhead-first** weighted fusion strategy:

```
Score_final = α × Score_body_reid + β × Score_head_top + γ × Score_face + δ × Score_spatiotemporal
```

> **Note:** Face score is 0.0 for the majority of cameras (overhead). The system must achieve reliable matching using body + head-top + spatio-temporal alone.

| Scenario | α (Body ReID) | β (Head-Top) | γ (Face) | δ (Spatial) |
|---|---|---|---|---|
| **Overhead camera (typical — 80% of cases)** | **0.50** | **0.30** | 0.00 | 0.20 |
| Face-capture camera (corridor/door) | 0.15 | 0.10 | **0.60** | 0.15 |
| Mixed camera (partial face visible) | 0.30 | 0.20 | 0.30 | 0.20 |
| Same camera, short gap (< 5s) | 0.20 | 0.15 | 0.00 | **0.65** |
| Cross-camera handoff (overhead → overhead) | **0.45** | **0.30** | 0.00 | 0.25 |
| Cross-camera handoff (overhead → face-capture) | 0.20 | 0.15 | **0.50** | 0.15 |

**Spatio-Temporal Constraints (Critical for Overhead Systems):**
- **Travel time plausibility:** Camera A to Camera B takes ~3 minutes walking → reject matches with < 1 min or > 10 min gap
- **Velocity constraints:** A person can't appear 500m away in 10 seconds
- **Directional continuity:** If last seen heading east, prioritize cameras in that direction
- **Height continuity from overhead:** Estimated person height from top-down silhouette should be consistent across cameras
- **Group association:** People traveling together maintain relative positions — use group context as additional constraint

---

### Strategy 5: Gait Recognition from Overhead (Advanced — Phase 2)

> **Gait from overhead cameras** uses walking speed, stride length, and sway patterns visible from the top-down view.

| Component | Choice | Details |
|---|---|---|
| **Model** | GaitGL / OpenGait (adapted for top-down) | Silhouette-based or skeleton-based gait recognition |
| **Input** | Sequence of top-down body positions (30+ frames) | Walking trajectory, speed, stride, sway from overhead |
| **Top-Down Gait Features** | Stride length, cadence, arm swing width, sway amplitude | Measurable from overhead centroid trajectories |
| **Use Case** | Long-term re-identification, when appearance changes | Gait is harder to disguise than clothing |
| **Accuracy** | ~85%+ rank-1 for top-down | Lower than side-view but still valuable as supplementary signal |

---

### Strategy 6: Soft Biometrics — Adapted for Overhead Views (Supplementary Filtering)

Before running expensive embedding comparisons, filter candidates using fast soft-biometric attributes. Note which attributes are **reliable vs. unreliable** from overhead cameras:

| Attribute | Method | Overhead Reliability | Purpose |
|---|---|---|---|
| **Hair Color/Style** | Head-top crop classification | ✅ **Excellent** — clearly visible from above | Strong pre-filter |
| **Clothing Color** | Dominant color from shoulder/back area (HSV) | ✅ **Good** — shirt/jacket top visible | Fast pre-filter |
| **Height** | Estimated from shadow length + camera calibration | ✅ **Good** — with proper calibration | Strong discriminator |
| **Body Build** | Shoulder width / body area from top-down silhouette | ✅ **Good** — clear from above | Reduce search space |
| **Luggage** | Object detection for bags, trolleys, backpacks | ✅ **Excellent** — visible from above | Contextual matching cue |
| **Gender** | Classification head on ReID backbone | ⚠️ **Moderate** — harder without face | Reduce search space by ~50% |
| **Age Group** | Classification (child/young/adult/senior) | ❌ **Poor** — requires face or gait | Limited utility from overhead |
| **Walking Speed** | Centroid displacement per frame | ✅ **Excellent** — directly measurable | Behavioral fingerprint |

---

### Strategy 7: Enrollment & Watchlist Matching (Adapted for Overhead-Primary System)

> **Key challenge:** Enrollment photos are typically frontal face shots, but the system primarily sees top-down views. The solution: **multi-modal enrollment** and **face-linking at capture points.**

| Category | Enrollment Method | Primary Matching Strategy |
|---|---|---|
| **Employees** | Pre-enrolled face (3–5 angles) + **overhead body/head-top capture during enrollment walk** | Body/head-top ReID in normal operations; face confirmation at face-capture points |
| **Known Visitors** | Auto-enrolled at **entry corridor face-capture camera** + overhead body profile linked | Body/head-top tracking; face used to initially link identity |
| **Watchlist** | Uploaded face photos from security agencies | **Real-time face matching ONLY at face-capture cameras** (corridors, doors, kiosks) → once matched, switch to body/head-top tracking across all cameras |
| **Passengers** | Boarding pass scan at checkpoint + face capture + overhead profile | Face captured at checkpoint, then body/head-top tracked throughout terminal |

**Enrollment Workflow for Overhead-Primary System:**
```
1. Employee/person walks through enrollment corridor
2. Face-capture camera captures face → ArcFace embedding stored
3. Overhead camera simultaneously captures body + head-top → ReID + head-top embeddings stored
4. All embeddings linked to a single identity profile
5. During normal operations:
   - Overhead cameras match by body + head-top (continuous)
   - Face-capture cameras match by face (periodic confirmation)
   - Identity confidence increases when multiple modalities agree
```

---

### Matching Architecture: Vector Database

| Component | Choice | Purpose |
|---|---|---|
| **Vector DB** | Milvus or FAISS (GPU-accelerated) | Fast approximate nearest-neighbor search |
| **Index Type** | IVF_PQ or HNSW | Balance between speed and accuracy |
| **Gallery Size** | Up to 1M embeddings | Employees, visitors, watchlist, recent tracks |
| **Search Latency** | < 10ms for top-100 candidates | Real-time matching requirement |
| **Update Strategy** | Sliding window — keep last 24h of transient tracks; permanent for enrolled | Manage DB size |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Web Dashboard)                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Live View│ │ Tracking │ │ Alerts   │ │ Building Layout   │  │
│  │ Grid     │ │ Map      │ │ Panel    │ │ Editor            │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
│  │ Visitor  │ │ Employee │ │ Dwell    │ │ Reports &         │  │
│  │ Manager  │ │ Breaks   │ │ Heatmap  │ │ Analytics         │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │ WebSocket + REST API
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (FastAPI)                          │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ API Gateway  │ │ Auth & RBAC  │ │ WebSocket Manager       │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐ │
│  │ Track Manager│ │ Alert Engine │ │ Zone / Layout Service   │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   PROCESSING LAYER                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐  │
│  │ Video Ingest     │ │ Detection &      │ │ ReID & Face    │  │
│  │ (per camera)     │ │ Tracking         │ │ Recognition    │  │
│  │ RTSP → Frames    │ │ YOLOv8 + ByteTrack│ │ ArcFace +     │  │
│  │                  │ │                  │ │ TransReID      │  │
│  └──────────────────┘ └──────────────────┘ └────────────────┘  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐  │
│  │ Global Tracker   │ │ Dwell / Break    │ │ Entry/Exit     │  │
│  │ (cross-camera)   │ │ Logic Engine     │ │ Counter        │  │
│  └──────────────────┘ └──────────────────┘ └────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐  │
│  │ PostgreSQL   │ │ Milvus /     │ │ Redis                   │  │
│  │ (Relational) │ │ FAISS        │ │ (Cache / Pub-Sub)       │  │ 
│  │ Tracks, logs │ │ (Vectors)    │ │ Real-time state         │  │
│  │ visitors,    │ │ Face & body  │ │ Occupancy counters      │  │
│  │ employees    │ │ embeddings   │ │ Active tracks           │ │
│  └──────────────┘ └──────────────┘ └─────────────────────────┘ │
│  ┌──────────────┐ ┌──────────────────────────────────────────┐ │
│  │ MinIO / S3   │ │ TimescaleDB (optional)                   │ │
│  │ (Object Store)│ │ Time-series data for analytics          │ │
│  │ Face crops,  │ │ Dwell time history, occupancy trends     │ │
│  │ snapshots    │ │                                          │ │
│  └──────────────┘ └──────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```
---

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React + TypeScript | Dashboard, layout editor, live views |
| **UI Components** | Custom + Canvas API | Building layout editor, zone drawing |
| **Real-Time** | WebSocket (native) | Live tracking updates, alerts |
| **Backend** | FastAPI (Python) | REST API, WebSocket server |
| **Task Queue** | Celery + Redis | Async processing, report generation |
| **Detection** | YOLOv8 / YOLOv9 | Person detection, pose estimation |
| **Tracking** | ByteTrack / BoT-SORT | Single-camera multi-object tracking |
| **Face Recognition** | ArcFace / AdaFace (InsightFace) | Face embedding extraction |
| **Person ReID** | TransReID / CLIP-ReID | Body appearance embedding |
| **Vector Search** | Milvus / FAISS | Fast embedding similarity search |
| **Database** | PostgreSQL | Relational data (tracks, visitors, employees) |
| **Cache** | Redis | Real-time state, pub-sub |
| **Object Storage** | MinIO | Face crops, snapshots, floor plans |
| **GPU Inference** | NVIDIA TensorRT / ONNX Runtime | Optimized model inference |
| **Deployment** | Docker + Docker Compose | Containerized local deployment, GPU passthrough via NVIDIA Container Toolkit |
| **Monitoring** | Prometheus + Grafana | System health, inference latency |

---

## Data Pipeline

```
Camera RTSP Stream
       │
       ▼
[Frame Grabber] ──── 1-5 FPS (configurable) ────►
       │
       ▼
[Person Detector] ── YOLOv8 ── bounding boxes + confidence ──►
       │
       ▼
[Single-Camera Tracker] ── ByteTrack ── local track IDs ──►
       │
       ├──► [Face Detector] ── best face crop ── [Face Embedder] ── 512-d vector
       │
       ├──► [Body Cropper] ── body crop ── [ReID Embedder] ── 2048-d vector
       │
       ▼
[Global Matcher] ── query vector DB ── assign/retrieve global ID ──►
       │
       ├──► [Entry/Exit Logic] ── zone crossing events ── DB + alert
       ├──► [Dwell Timer] ── accumulate per zone ── DB + alert
       ├──► [Break Monitor] ── employee-specific ── DB + alert
       ├──► [Visitor Matcher] ── check visitor DB ── queue for review
       └──► [Watchlist Check] ── 1:N against watchlist ── immediate alert
```

---

## Database Schema (High-Level)

### Core Tables

```sql
-- Tracked individuals (transient + enrolled)
persons (
    id UUID PRIMARY KEY,
    type ENUM('transient', 'employee', 'visitor', 'watchlist'),
    name VARCHAR,                    -- NULL for transient
    face_embedding_id VARCHAR,       -- ref to vector DB
    body_embedding_id VARCHAR,       -- ref to vector DB
    metadata JSONB,                  -- age_group, gender, height_cm, etc.
    created_at TIMESTAMP,
    updated_at TIMESTAMP
)

-- Individual detection events
detections (
    id BIGSERIAL PRIMARY KEY,
    person_id UUID REFERENCES persons(id),
    camera_id VARCHAR,
    timestamp TIMESTAMP,
    bbox FLOAT[4],                   -- x, y, w, h
    confidence FLOAT,
    face_quality_score FLOAT,
    snapshot_path VARCHAR             -- path in object storage
)

-- Zone definitions
zones (
    id UUID PRIMARY KEY,
    name VARCHAR,
    floor_id UUID,
    zone_type ENUM('entry', 'exit', 'restricted', 'work', 'public', 'break'),
    polygon JSONB,                   -- array of [x,y] points on floor plan
    dwell_threshold_minutes INT,
    max_occupancy INT
)

-- Zone presence events
zone_events (
    id BIGSERIAL PRIMARY KEY,
    person_id UUID REFERENCES persons(id),
    zone_id UUID REFERENCES zones(id),
    event_type ENUM('enter', 'exit', 'dwell_alert'),
    timestamp TIMESTAMP,
    dwell_duration_seconds INT
)

-- Employee break compliance
employee_breaks (
    id BIGSERIAL PRIMARY KEY,
    employee_id UUID REFERENCES persons(id),
    shift_start TIMESTAMP,
    last_break_time TIMESTAMP,
    continuous_work_minutes INT,
    compliance_status ENUM('compliant', 'warning', 'violation'),
    alert_sent_at TIMESTAMP
)

-- Visitor records
visitors (
    id UUID PRIMARY KEY,
    person_id UUID REFERENCES persons(id),
    name VARCHAR,
    purpose VARCHAR,
    host_employee_id UUID,
    id_document_type VARCHAR,
    id_document_number VARCHAR,
    status ENUM('pending_review', 'approved', 'flagged', 'watchlisted'),
    visit_count INT DEFAULT 1,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP
)

-- Cameras
cameras (
    id VARCHAR PRIMARY KEY,
    name VARCHAR,
    stream_url VARCHAR,
    floor_id UUID,
    position_x FLOAT,               -- position on floor plan
    position_y FLOAT,
    rotation_degrees FLOAT,
    fov_degrees FLOAT,
    mounting_height_m FLOAT,
    status ENUM('active', 'inactive', 'maintenance'),
    resolution VARCHAR
)

-- Floor plans
floors (
    id UUID PRIMARY KEY,
    building_name VARCHAR,
    floor_number INT,
    floor_plan_image_path VARCHAR,
    scale_pixels_per_meter FLOAT
)

-- Alerts
alerts (
    id BIGSERIAL PRIMARY KEY,
    alert_type ENUM('watchlist_match', 'dwell_exceeded', 'break_violation',
                     'unauthorized_zone', 'occupancy_exceeded', 'tailgating'),
    severity ENUM('info', 'warning', 'critical'),
    person_id UUID,
    zone_id UUID,
    camera_id VARCHAR,
    timestamp TIMESTAMP,
    message TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR,
    snapshot_path VARCHAR
)
```

---

## Deployment Architecture (Local Docker Compose)

> **This project runs entirely on local machines using Docker Compose.** No cloud or Kubernetes required. GPU passthrough is handled via the NVIDIA Container Toolkit. All services run as Docker containers on a single server or workstation.

---

### 📁 Project File Structure

```
airport-surveillance-system/
│
├── 📂 frontend/                          ← React Dashboard + Layout Editor
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── src/
│   │   ├── components/
│   │   │   ├── LiveView/                 ← Camera grid, video player
│   │   │   ├── LayoutEditor/             ← Building layout, drag-drop
│   │   │   ├── TrackingMap/              ← Live person positions on map
│   │   │   ├── AlertPanel/               ← Real-time alerts
│   │   │   ├── VisitorManager/           ← Visitor review workflow
│   │   │   ├── EmployeeBreaks/           ← Break compliance dashboard
│   │   │   ├── DwellHeatmap/             ← Dwell time visualizations
│   │   │   └── Analytics/                ← Reports, charts, exports
│   │   ├── hooks/                        ← WebSocket, API hooks
│   │   ├── stores/                       ← Zustand state management
│   │   ├── i18n/                         ← Multi-language (Hindi, Arabic, English)
│   │   └── App.tsx
│   └── public/
│
├── 📂 backend/                           ← FastAPI API Server
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py                       ← FastAPI entry point
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── cameras.py
│   │   │   │   ├── tracks.py
│   │   │   │   ├── zones.py
│   │   │   │   ├── visitors.py
│   │   │   │   ├── employees.py
│   │   │   │   ├── alerts.py
│   │   │   │   ├── layouts.py
│   │   │   │   └── analytics.py
│   │   │   └── websocket.py              ← WebSocket handler
│   │   ├── services/
│   │   │   ├── track_service.py
│   │   │   ├── alert_service.py
│   │   │   ├── visitor_service.py
│   │   │   ├── break_monitor_service.py
│   │   │   └── layout_service.py
│   │   ├── models/                       ← SQLAlchemy ORM models
│   │   ├── schemas/                      ← Pydantic request/response schemas
│   │   ├── core/
│   │   │   ├── config.py                 ← Environment config
│   │   │   ├── security.py               ← JWT auth, RBAC
│   │   │   └── database.py               ← DB connection pool
│   │   └── workers/
│   │       └── celery_tasks.py           ← Async report generation
│   └── alembic/                          ← Database migrations
│       └── versions/
│
├── 📂 processing/                        ← GPU Video Processing Workers
│   ├── Dockerfile.gpu                    ← Based on nvidia/cuda base image
│   ├── requirements.txt
│   ├── workers/
│   │   ├── video_ingest.py               ← RTSP stream → frame extraction
│   │   ├── person_detector.py            ← YOLOv8 detection
│   │   ├── single_cam_tracker.py         ← ByteTrack per camera
│   │   ├── face_detector.py              ← SCRFD / RetinaFace
│   │   ├── face_embedder.py              ← ArcFace embedding
│   │   ├── body_reid.py                  ← TransReID embedding
│   │   ├── head_top_embedder.py          ← Head-top appearance
│   │   ├── global_tracker.py             ← Cross-camera ID assignment
│   │   ├── dwell_monitor.py              ← Zone dwell time logic
│   │   ├── break_monitor.py              ← Employee break compliance
│   │   ├── entry_exit_counter.py         ← Virtual tripwire counting
│   │   └── watchlist_matcher.py          ← Real-time watchlist alerts
│   ├── pipeline/
│   │   ├── camera_pipeline.py            ← Orchestrates per-camera pipeline
│   │   └── pipeline_manager.py           ← Manages all camera pipelines
│   └── utils/
│       ├── tensorrt_engine.py            ← TensorRT model loader
│       ├── onnx_runtime.py               ← ONNX fallback
│       └── frame_utils.py                ← Crop, resize, normalize
│
├── 📂 models/                            ← Pre-trained AI Model Weights
│   ├── yolov8l.onnx                      ← Person detection (~130 MB)
│   ├── yolov8l.engine                    ← TensorRT compiled (GPU-specific)
│   ├── scrfd_10g.onnx                    ← Face detection (~30 MB)
│   ├── arcface_r100.onnx                 ← Face embedding (~250 MB)
│   ├── adaface_ir101.onnx               ← Alternative face (~250 MB)
│   ├── transreid_vit.onnx               ← Body ReID (~350 MB)
│   ├── head_top_efficientnet.onnx        ← Head-top appearance (~40 MB)
│   └── README.md                         ← Model versions, sources, licenses
│
├── 📂 config/                            ← 🎯 DEPLOYMENT CONFIGURATION
│   ├── prometheus/
│   │   └── prometheus.yml                ← Prometheus scrape config
│   ├── grafana/
│   │   ├── provisioning/
│   │   │   ├── datasources.yml           ← Auto-configure Prometheus datasource
│   │   │   └── dashboards.yml            ← Auto-import dashboards
│   │   └── dashboards/
│   │       ├── gpu-metrics.json          ← GPU utilization dashboard
│   │       ├── inference-fps.json        ← Processing FPS dashboard
│   │       └── system-overview.json      ← System health dashboard
│   ├── nginx/
│   │   └── nginx.conf                    ← Reverse proxy for local deployment
│   ├── redis/
│   │   └── redis.conf                    ← Redis persistence + memory config
│   ├── postgresql/
│   │   └── init.sql                      ← Database initialization script
│   └── milvus/
│       └── milvus.yaml                   ← Milvus standalone config
│
├── 📂 scripts/                           ← Utility Scripts
│   ├── setup-local.sh                    ← Install Docker, NVIDIA drivers, Compose
│   ├── start.sh                          ← One-command startup (docker compose up)
│   ├── stop.sh                           ← Graceful shutdown all services
│   ├── backup-db.sh                      ← Database backup to local disk
│   ├── restore-db.sh                     ← Database restore from backup
│   ├── download-models.sh               ← Download AI model weights
│   ├── generate-trt-engines.sh           ← Compile TensorRT engines on target GPU
│   └── health-check.sh                   ← Check all services are running
│
├── 📂 docs/                              ← Documentation
│   ├── installation-guide.md
│   ├── operator-manual.md
│   ├── api-reference.md
│   ├── architecture-diagram.png
│   └── troubleshooting.md
│
├── 📂 tests/                             ← Test Suites
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── load/
│       └── locustfile.py                 ← Load testing with Locust
│
├── docker-compose.yml                    ← 🎯 PRIMARY — CPU-only deployment
├── docker-compose.gpu.yml                ← 🎯 PRIMARY — GPU-accelerated deployment
├── docker-compose.monitoring.yml         ← Optional — Prometheus + Grafana stack
├── Makefile                              ← Common commands (start, stop, logs, etc.)
├── .env.example                          ← Environment template
├── .env                                  ← Local config (git-ignored)
└── README.md
```

---

### 🏗️ Local Docker Compose Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     LOCAL SERVER / WORKSTATION                              │
│                                                                             │
│  Docker Compose Network: airport-net (bridge)                               │
│                                                                             │
│  ┌─── REVERSE PROXY (NGINX) ───────────────────────────────────────────┐   │
│  │  Port 80  → HTTP (auto-redirect to HTTPS in production)             │   │
│  │  Port 443 → HTTPS (self-signed cert for local)                      │   │
│  │  /            → frontend:3000 (React dashboard)                     │   │
│  │  /api/*       → backend:8000 (FastAPI)                              │   │
│  │  /ws          → backend:8000 (WebSocket upgrade)                    │   │
│  │  /minio       → minio:9001 (admin console)                          │   │
│  │  /grafana     → grafana:3000 (monitoring dashboards)                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─── APPLICATION CONTAINERS ──────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐     │   │
│  │  │ frontend        │  │ backend         │  │ celery-worker    │     │   │
│  │  │ Port: 3000      │  │ Port: 8000      │  │ (no exposed port)│     │   │
│  │  │ Image: node +   │  │ Image: python + │  │ Image: python +  │     │   │
│  │  │  react build    │  │  fastapi        │  │  celery          │     │   │
│  │  │ CPU: 0.5 core   │  │ CPU: 2 cores    │  │ CPU: 1 core      │     │   │
│  │  │ RAM: 512 MB     │  │ RAM: 2 GB       │  │ RAM: 1 GB        │     │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────┘     │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─── GPU PROCESSING CONTAINER(S) ─────────────────────────────────────┐   │
│  │  (Uses NVIDIA Container Toolkit for GPU passthrough)                 │   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │ gpu-worker                                                   │    │   │
│  │  │ Image: nvidia/cuda:12.2 + Python + AI models                 │    │   │
│  │  │ GPU: All available GPUs (runtime: nvidia)                    │    │   │
│  │  │ CPU: 8 cores     RAM: 32 GB                                  │    │   │
│  │  │                                                              │    │   │
│  │  │ Runs full pipeline per camera:                               │    │   │
│  │  │ • YOLOv8 person detection                                    │    │   │
│  │  │ • Face detection (SCRFD) + ArcFace embedding                 │    │   │
│  │  │ • Body ReID (TransReID)                                      │    │   │
│  │  │ • Head-top appearance embedding                              │    │   │
│  │  │ • ByteTrack single-camera tracking                           │    │   │
│  │  │ • Cross-camera global tracking                               │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  GPU Requirements:                                                   │   │
│  │  • NVIDIA GPU (RTX 3060+ / A30 / A100)                               │   │
│  │  • NVIDIA Driver 525+ installed on host                              │   │
│  │  • NVIDIA Container Toolkit installed                                │   │
│  │  • docker compose with runtime: nvidia support                       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─── DATA LAYER (Docker Volumes for Persistence) ─────────────────────┐    │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐      │   │
│  │  │ postgresql       │  │ redis           │  │ milvus           │     │   │
│  │  │ Port: 5432      │  │ Port: 6379      │  │ Port: 19530      │      │   │
│  │  │ Volume:         │  │ Volume:         │  │ Volume:          │      │   │
│  │  │  pgdata:/data   │  │  redis:/data    │  │  milvus:/data    │      │   │
│  │  │ Backup: manual  │  │ Persistence: on │  │ Standalone mode  │      │   │
│  │  │  via script     │  │                 │  │                  │      │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────┘      │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐                                                 │   │
│  │  │ minio           │                                                 │   │
│  │  │ Port: 9000/9001 │                                                 │   │
│  │  │ Volume:         │                                                 │   │
│  │  │  minio:/data    │                                                 │   │
│  │  │ Standalone mode │                                                 │   │
│  │  └─────────────────┘                                                 │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─── MONITORING STACK (Optional — docker-compose.monitoring.yml) ──────┐   │
│  │                                                                      │   │
│  │  ┌─────────────────┐  ┌─────────────────┐                           │   │
│  │  │ prometheus      │  │ grafana         │                           │   │
│  │  │ Port: 9090      │  │ Port: 3001      │                           │   │
│  │  │ Scrapes metrics │  │ Dashboards:     │                           │   │
│  │  │ from all        │  │ • GPU usage     │                           │   │
│  │  │ containers      │  │ • Inference FPS │                           │   │
│  │  │ every 15s       │  │ • Camera status │                           │   │
│  │  │                 │  │ • API latency   │                           │   │
│  │  └─────────────────┘  └─────────────────┘                           │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 📊 Container Summary Table

| Container | Image Base | Exposed Port | Resources | Scaling |
|---|---|---|---|---|
| `frontend` | node:20-alpine + nginx | 3000 | 0.5 CPU, 512 MB | Single instance |
| `backend` | python:3.11-slim | 8000 | 2 CPU, 2 GB | Single instance (can scale with `--scale`) |
| `celery-worker` | python:3.11-slim | — | 1 CPU, 1 GB | Single instance |
| `gpu-worker` | nvidia/cuda:12.2-runtime | — | 8 CPU, 32 GB, all GPUs | Single instance (1 per GPU) |
| `postgresql` | postgres:16-alpine | 5432 | 2 CPU, 4 GB | Single instance |
| `redis` | redis:7-alpine | 6379 | 1 CPU, 2 GB | Single instance (standalone) |
| `milvus` | milvusdb/milvus:latest | 19530 | 2 CPU, 8 GB | Single instance (standalone) |
| `minio` | minio/minio:latest | 9000, 9001 | 1 CPU, 2 GB | Single instance |
| `nginx` | nginx:alpine | 80, 443 | 0.25 CPU, 256 MB | Single instance (reverse proxy) |
| `prometheus` | prom/prometheus:latest | 9090 | 0.5 CPU, 1 GB | Optional |
| `grafana` | grafana/grafana:latest | 3001 | 0.5 CPU, 512 MB | Optional |

---

### 🐳 Docker Compose Profiles

The project uses **multiple compose files** that can be combined:

```bash
# CPU-only development (no GPU required)
docker compose up -d

# GPU-accelerated (requires NVIDIA Container Toolkit)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

# With monitoring (Prometheus + Grafana)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml \
               -f docker-compose.monitoring.yml up -d
```

---

### 💾 Docker Volumes

| Volume Name | Container | Mount Point | Purpose |
|---|---|---|---|
| `pgdata` | postgresql | /var/lib/postgresql/data | Database storage |
| `redis_data` | redis | /data | Cache persistence (AOF) |
| `milvus_data` | milvus | /var/lib/milvus | Vector database storage |
| `minio_data` | minio | /data | Object storage (face crops, snapshots, floor plans) |
| `model_weights` | gpu-worker | /app/models | Shared AI model weights (bind mount) |
| `prometheus_data` | prometheus | /prometheus | Metrics time-series data |
| `grafana_data` | grafana | /var/lib/grafana | Dashboard configs + user data |
| `nginx_certs` | nginx | /etc/nginx/certs | Self-signed TLS certificates |

---

### 🌐 Local Networking

```
LOCAL NETWORK / BROWSER
       │
       ▼
┌──────────────────────┐
│  NGINX Reverse Proxy │  ← Single entry point
│  Port 80 / 443       │  ← Access: http://localhost or https://localhost
│                      │
│  Routes:             │
│  /          → frontend:3000   (React dashboard)
│  /api/*     → backend:8000    (FastAPI REST API)
│  /ws        → backend:8000    (WebSocket upgrade)
│  /grafana   → grafana:3001    (monitoring, optional)
│  /minio     → minio:9001      (object storage console)
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│  Docker Bridge       │  ← Internal network: airport-net
│  Network             │
│                      │
│  • frontend ↔ backend
│  • backend ↔ postgresql, redis, milvus, minio
│  • gpu-worker ↔ redis, milvus, minio, backend
│  • celery-worker ↔ redis, postgresql
│  • prometheus → all containers (metrics scraping)
│  • All containers resolve each other by service name
└──────────────────────┘
```

---

### 🛡️ Deployment Commands

```bash
# ──────────────────────────────────────────────
# QUICK START
# ──────────────────────────────────────────────

# 1. Clone and configure
git clone <repo-url> && cd airport-surveillance-system
cp .env.example .env                    # Edit with your settings

# 2. Download AI model weights
./scripts/download-models.sh

# 3. Start all services (CPU mode)
docker compose up -d

# 4. Start all services (GPU mode — requires NVIDIA Container Toolkit)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d

# 5. Open dashboard
open http://localhost                    # → React dashboard


# ──────────────────────────────────────────────
# COMMON OPERATIONS
# ──────────────────────────────────────────────

# Check status of all containers
docker compose ps

# View logs (all services)
docker compose logs -f

# View GPU worker logs only
docker compose logs -f gpu-worker

# Restart a specific service
docker compose restart backend

# Stop all services
docker compose down

# Stop and remove all data (DESTRUCTIVE)
docker compose down -v

# Rebuild images after code changes
docker compose build --no-cache
docker compose up -d


# ──────────────────────────────────────────────
# DATABASE OPERATIONS
# ──────────────────────────────────────────────

# Backup database to local file
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh backup_2026-06-01.sql

# Run database migrations
docker compose exec backend alembic upgrade head

# Access PostgreSQL shell
docker compose exec postgresql psql -U admin airport_db


# ──────────────────────────────────────────────
# GPU OPERATIONS
# ──────────────────────────────────────────────

# Check GPU availability inside container
docker compose exec gpu-worker nvidia-smi

# Compile TensorRT engines for local GPU
./scripts/generate-trt-engines.sh

# Scale GPU workers (if multiple GPUs)
docker compose -f docker-compose.yml -f docker-compose.gpu.yml \
  up -d --scale gpu-worker=2


# ──────────────────────────────────────────────
# MONITORING
# ──────────────────────────────────────────────

# Start with monitoring stack
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Access Grafana: http://localhost:3001 (admin/admin)
# Access Prometheus: http://localhost:9090


# ──────────────────────────────────────────────
# MAKEFILE SHORTCUTS
# ──────────────────────────────────────────────

make start                 # docker compose up -d
make start-gpu             # docker compose with GPU
make stop                  # docker compose down
make logs                  # docker compose logs -f
make build                 # docker compose build
make backup                # backup database
make test                  # run all tests
make health                # check all services
```

---

### 🌍 Deployment Profiles

| Config | Development | Testing | Production (Local Server) |
|---|---|---|---|
| **Cameras** | 1–5 (RTSP or video files) | 5–10 (simulated RTSP) | 20–50+ (real airport cameras) |
| **GPU Workers** | 1 (shared GPU / CPU fallback) | 1 (dedicated GPU) | 1–4 (1 per GPU card) |
| **Backend** | 1 instance | 1 instance | 1–2 instances (via `--scale`) |
| **Frontend** | 1 instance (hot-reload) | 1 instance (built) | 1 instance (nginx-served) |
| **PostgreSQL** | 1 (no replica) | 1 instance | 1 instance + daily backups |
| **Redis** | 1 (standalone) | 1 (standalone) | 1 (standalone + AOF persistence) |
| **Milvus** | 1 (standalone) | 1 (standalone) | 1 (standalone) |
| **MinIO** | 1 (standalone) | 1 (standalone) | 1 (standalone) |
| **TLS** | None (HTTP) | Self-signed | Self-signed or local CA |
| **Logging** | Console (stdout) | Console + Grafana | Prometheus + Grafana |
| **Model Format** | ONNX (portable) | ONNX (portable) | TensorRT (max performance) |
| **GPU Type** | RTX 3060 / CPU | RTX 3060+ | RTX 4090 / A30 / A100 |
| **Compose File** | `docker-compose.yml` | `docker-compose.yml` + `.gpu.yml` | `.yml` + `.gpu.yml` + `.monitoring.yml` |

---

### 🔒 Local Security

| Layer | Implementation |
|---|---|
| **Authentication** | JWT tokens with role-based access (Admin, Operator, Supervisor, Auditor) |
| **Secrets** | Stored in `.env` file (git-ignored), never committed to repo |
| **Network Isolation** | Docker bridge network — services only accessible via NGINX proxy |
| **Container Security** | Non-root containers, read-only root filesystem where possible |
| **TLS** | Self-signed certificates for HTTPS (generated by setup script) |
| **Database Access** | PostgreSQL only accessible within Docker network, not exposed to host |
| **Image Scanning** | Optional: scan images with Trivy before deploying locally |
| **Audit Logging** | Application-level audit logs for all data access and modifications |

---

### 📦 Hardware Requirements

| Deployment Size | CPU | RAM | GPU | Storage | Cameras |
|---|---|---|---|---|---|
| **Development** (laptop/desktop) | 8 cores | 16 GB | Optional (CPU fallback) | 100 GB SSD | 1–5 |
| **Small** (single server) | 16 cores | 64 GB | 1× RTX 3060+ (12GB VRAM) | 500 GB NVMe | 5–15 |
| **Medium** (single server) | 32 cores | 128 GB | 1× RTX 4090 (24GB VRAM) | 1 TB NVMe | 15–30 |
| **Large** (single server) | 64 cores | 256 GB | 2–4× A30/A100 GPUs | 2 TB NVMe | 30–50+ |

**Minimum for development:** 8 cores, 16 GB RAM, 100 GB disk, no GPU (CPU inference fallback)

---

### Camera Processing Budget (per camera, per frame)

| Stage | Latency | GPU Memory |
|---|---|---|
| Person Detection (YOLOv8-L) | ~15ms | ~500 MB |
| Face Detection (SCRFD) | ~5ms | ~200 MB |
| Face Embedding (ArcFace) | ~3ms per face | ~300 MB |
| Body ReID (TransReID) | ~8ms per person | ~400 MB |
| Head-Top Embedding | ~3ms per person | ~150 MB |
| Tracking (ByteTrack) | ~1ms | CPU only |
| Vector Search (FAISS) | ~2ms per query | ~1 GB (index) |
| **Total per frame** | **~37ms (~27 FPS)** | **~2.5 GB** |

**GPU capacity:** RTX 3060 (12 GB) ≈ 5 cameras, RTX 4090 (24 GB) ≈ 10 cameras, A100 (80 GB) ≈ 30 cameras

---

### 🔄 Backup & Recovery (Local)

| Scenario | Strategy | RTO | RPO |
|---|---|---|---|
| **Container crash** | Docker auto-restart (restart: unless-stopped) | < 10s | 0 (volumes persist) |
| **Service hang** | Health check + automatic restart | < 30s | 0 |
| **GPU failure** | Fallback to CPU inference (slower but functional) | Immediate | 0 |
| **Database corruption** | Restore from local backup (`./scripts/restore-db.sh`) | < 15 min | Last backup |
| **Disk failure** | Restore from external backup drive / NAS | < 1 hour | Last backup |
| **Full server failure** | Re-install Docker, restore volumes from backup | < 2 hours | Last backup |

---

## Privacy & Compliance

| Requirement | Implementation |
|---|---|
| **Data Retention** | Configurable per data type (e.g., transient tracks: 7 days, visitor records: 1 year) |
| **Access Control** | Role-based (RBAC): Admin, Security Operator, Supervisor, Auditor |
| **Audit Logging** | All data access and modifications logged with user ID and timestamp |
| **Encryption** | Data at rest (AES-256 via encrypted volumes), in transit (TLS 1.3 via NGINX) |
| **Consent / Notice** | Signage at airport entrances per local regulations |
| **Face Data** | Embeddings stored, raw face images auto-purged after configurable period |
| **Right to Erasure** | Admin tool to purge all data for a specific individual |
| **Regulatory** | Designed for compliance with GDPR, local aviation authority requirements |
| **Local-only** | All data stays on local server — no cloud dependencies, no external data transfer |

---

## Accuracy Targets

| Metric | Target | Measurement |
|---|---|---|
| **Person Detection** | > 95% mAP@0.5 | Evaluated on airport test set |
| **Face Recognition (enrolled)** | > 99.2% TAR @ 0.1% FAR | 1:N against employee/visitor gallery |
| **Person ReID (cross-camera)** | > 85% Rank-1 accuracy | Evaluated on multi-camera test scenarios |
| **Entry/Exit Counting** | > 98% accuracy | Compared against manual ground truth |
| **Dwell Time** | ± 30 seconds accuracy | Validated against timed observations |
| **Break Compliance** | > 97% detection rate | Validated against HR check-in records |

---

## Development Phases

### Phase 1 — Foundation (Weeks 1–6)
- [ ] Local Docker Compose setup with NVIDIA Container Toolkit
- [ ] Docker Compose profiles for CPU-only and GPU modes
- [ ] Camera ingestion pipeline (RTSP → frames)
- [ ] Person detection + single-camera tracking
- [ ] Face detection + embedding extraction
- [ ] Head-top appearance extraction (overhead-first)
- [ ] Basic entry/exit counting
- [ ] PostgreSQL + Redis + Milvus containers
- [ ] Dashboard: live camera grid + basic alerts
- [ ] Makefile with common operations

### Phase 2 — Core Intelligence (Weeks 7–12)
- [ ] Body ReID model integration (TransReID)
- [ ] Cross-camera tracking with global ID assignment
- [ ] Multi-modal fusion (body + head-top + face)
- [ ] Dwell time monitoring with zone definition
- [ ] Building layout editor (drag-drop cameras + zones)
- [ ] Employee enrollment + break monitoring
- [ ] GPU worker scaling (multi-GPU support via docker compose --scale)
- [ ] Prometheus + Grafana monitoring stack (docker-compose.monitoring.yml)

### Phase 3 — Advanced Features (Weeks 13–18)
- [ ] Visitor management workflow (auto-capture, review, DB)
- [ ] Watchlist matching with real-time alerts
- [ ] Advanced analytics dashboard (heatmaps, trends, reports)
- [ ] Gait recognition from overhead (experimental)
- [ ] Multi-language UI (Hindi, Arabic, English)
- [ ] NGINX reverse proxy with self-signed TLS
- [ ] Automated backup scripts with scheduling

### Phase 4 — Hardening & Deployment (Weeks 19–24)
- [ ] TensorRT optimization for all models
- [ ] Load testing with 20+ camera streams (Locust)
- [ ] Disaster recovery testing (container failure, DB restore)
- [ ] Security audit & penetration testing
- [ ] Health check scripts + auto-restart policies
- [ ] Documentation & operator training materials
- [ ] UAT with airport security team
- [ ] Production deployment on local airport server

---

## Implemented Changes & Production Fixes

A set of 8 critical production readiness and real-time operations fixes have been implemented in the camera processing and tracking codebase to meet the accuracy and performance goals defined in this document.

### 📋 Overview of Implemented Fixes

| ID | Component | Severity | Description | Files Modified |
|:---|:---|:---|:---|:---|
| **1** | **GlobalTracker** | 🔴 Critical | Added camera-type-aware fusion weights & spatio-temporal constraint scoring | [global_tracker.py](file:///Users/samdavi/projects/short_req/processing/workers/global_tracker.py) |
| **2** | **Face Cache Safety** | 🔴 Critical | Moved face tracking cache to instance-level attributes to prevent multi-camera race conditions | [face_detector.py](file:///Users/samdavi/projects/short_req/processing/workers/face_detector.py), [face_embedder.py](file:///Users/samdavi/projects/short_req/processing/workers/face_embedder.py), [camera_pipeline.py](file:///Users/samdavi/projects/short_req/processing/pipeline/camera_pipeline.py) |
| **3** | **Overhead Detection** | 🟠 Major | Integrated camera profile loading (`is_overhead` flag) to drive automatic weight selection | [camera_pipeline.py](file:///Users/samdavi/projects/short_req/processing/pipeline/camera_pipeline.py) |
| **4** | **Entry/Exit Counter** | 🟠 Major | Implemented directional cooldowns for bidirectional counting and zone occupancy tracking | [entry_exit_counter.py](file:///Users/samdavi/projects/short_req/processing/workers/entry_exit_counter.py) |
| **5** | **Break DB Persistence** | 🟠 Major | Added database persistence for relaxation lounge monitoring breaks to prevent data loss on restart | [break_monitor.py](file:///Users/samdavi/projects/short_req/processing/workers/break_monitor.py) |
| **6** | **Pipeline Resilience** | 🟡 Minor | Implemented process health checks, automated self-healing restarts, and camera offline alerts | [pipeline_manager.py](file:///Users/samdavi/projects/short_req/processing/pipeline/pipeline_manager.py) |
| **7** | **Dwell Time Heatmap** | 🟡 Minor | Added high-frequency real-time dwell time updates to Redis for the dashboard heatmap | [intrusion_engine.py](file:///Users/samdavi/projects/short_req/processing/workers/intrusion_engine.py) |
| **8** | **Code Hygiene** | 🟡 Minor | Cleansed the project directory of unused/duplicated code files and temporary directories | *Workspace-wide clean up* |

---

### 🔍 Detailed Fix Breakdown

#### 1. GlobalTracker Multi-Modal Fusion & Spatio-Temporal Constraints
* **Issue:** The fusion tracker previously used fixed weights (Face = 50%, Body = 35%, Head = 15%) across all cameras. Since 80% of airport cameras are ceiling-mounted (overhead-first design), they cannot capture faces, leading to degradation of tracking accuracy.
* **Resolution:** Replaced fixed weights with three dynamic, camera-specific profiles loaded automatically depending on the camera's mounting type:
  * **Overhead Profile:** Body = 50%, Head = 30%, Face = 0%, Spatial = 20%.
  * **Face-Capture Profile:** Face = 60%, Body = 15%, Head = 10%, Spatial = 15%.
  * **Mixed Profile:** Body = 30%, Head = 20%, Face = 30%, Spatial = 20%.
* **Spatio-Temporal Plausibility:** Integrated physical constraints for track association (handoffs) between camera zones:
  * Same camera, short occlusion (<5s) → score = 1.0 (highly plausible)
  * Same floor, adjacent zone transit (15s–60s) → score = 0.8
  * Elevator/escalator multi-floor transit (60s–90s) → score = 0.6
  * Physically impossible transitions (different floors in <15s) → score = 0.0 (strictly suppressed)

#### 2. Thread-Safe Multi-Camera Face Cache
* **Issue:** `FaceDetector` utilized module-level global variables (`_last_faces`, `_last_person_crop_id`) to share detection data with `FaceEmbedder`. Under multi-camera parallel frame ingestion, this caused race conditions where one camera's embeddings were associated with another camera's crops.
* **Resolution:**
  * Moved cache storage (`_last_faces` and `_last_crop_id`) to instance-level fields of `FaceDetector`.
  * Refactored `FaceEmbedder`'s constructor to accept a specific `FaceDetector` instance, accessing its local instance-level cache.
  * Ensures complete data isolation for parallel execution context across all running pipelines.

#### 3. Live Integration of Camera Mounting Configurations
* **Issue:** The database contained an `is_overhead` attribute for each camera, but this flag was never loaded or propagated to the ingestion pipeline.
* **Resolution:** Updated `CameraPipeline._load_camera_config` to query and cache the camera's `is_overhead` configuration from the PostgreSQL database, passing it down during frame matching to initialize the correct `GlobalTracker` weight profile.

#### 4. Bidirectional Counting and Cooldown Controls
* **Issue:** Tracks crossing the line were saved to a permanent `crossed_tracks` set, making it impossible to register an individual who enters a zone and then subsequently exits it.
* **Resolution:** Replaced the static set with a directional cooldown mechanism using Redis-backed temporal tracking:
  * Recrossing in the same direction is throttled for 3 seconds to prevent count jitter (double counts).
  * Recrossing in the opposite direction is allowed immediately.
  * Added `get_zone_occupancy()` to calculate net real-time occupancy.

#### 5. Database Auditing for Employee Break Compliance
* **Issue:** Break start and end times were stored only in transient memory. A restart of the processing daemon completely wiped active breaks and history.
* **Resolution:** Integrated the PostgreSQL ORM with `BreakMonitor`. Once an employee enters and subsequently leaves a relaxation lounge zone, the system commits an `EmployeeBreak` record storing:
  * `employee_id`
  * `start_time` & `end_time`
  * `duration_seconds`
  * `compliant` (Boolean flag reflecting whether the break duration was within bounds)

#### 6. Pipeline Self-Healing and Offline Alerts
* **Issue:** Camera ingestion processes crashed silently on frame loss or RTSP disconnect, requiring manual process restart.
* **Resolution:** Enhanced `PipelineManager` with a 10-second watchdog loop using `Process.is_alive()`.
  * Crashed ingestion streams are automatically restarted (up to 5 retry attempts).
  * Automatically publishes a JSON payload to the Redis `CAMERA_OFFLINE` channel to notify security operators on the frontend dashboard.

#### 7. High-Frequency Heatmap Data Stream
* **Issue:** The security dashboard heatmap was only updated when alerts were generated, lacking visual density.
* **Resolution:** Added real-time tracker publishing inside `IntrusionEngine`. The engine now broadcasts a `DWELL_UPDATE` Redis payload every 10 seconds for all active individuals within dwell zones, allowing the UI to render real-time color-coded heatmaps.

#### 8. Project Files Clean Up & Maintenance
* **Action:** Removed redundant files, dead code, experimental scripts, and duplicate dependencies from the codebase. Ensured that only deployment-ready modules are retained under `processing/` and `backend/`.

---

> **Document Version:** 3.1  
do> **Last Updated:** June 2026  
> **Status:** Draft — Pending Review  
> **Deployment Model:** Local Docker Compose (NVIDIA Container Toolkit for GPU)



