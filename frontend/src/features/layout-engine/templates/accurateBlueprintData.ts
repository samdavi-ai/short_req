/**
 * ACCURATE PROGRAMMATIC BLUEPRINT DATA
 * Derived by careful pixel-mapping of the actual CAD floor plan images:
 *   page-1.png  → Ground Floor Alpha-2
 *   page-2.png  → Area A (Intermediate)
 *   page-3.png  → First Floor Alpha-2
 *
 * Canvas working area: left=80, top=60, right=1120, bottom=720
 * Total canvas span: 1040 × 660 px
 * Building real dimensions: ~82m × ~25m  →  scale ≈ 12.7 px/m
 *
 * Coordinate convention:
 *   X increases → east (right)
 *   Y increases ↓ south (down)  (canvas origin is top-left)
 */

export type WallSegment = {
  id: number;
  startX: number; startY: number;
  endX: number;   endY: number;
  thickness: number;
  color: string;
  label: string;
};

export type ArchElement = {
  id: number;
  type: 'DOOR' | 'DOUBLE_DOOR' | 'ACCESS_DOOR' | 'WINDOW' | 'COLUMN' | 'STAIRS' | 'ELEVATOR';
  x: number; y: number;
  width: number;
  rotation: number;
  label: string;
  openDirection?: 'LEFT' | 'RIGHT';
};

export type ZonePoint = { x: number; y: number };
export type ZoneOnCanvas = {
  id: number;
  name: string;
  type: 'RESTRICTED' | 'LOUNGE' | 'DWELL' | 'TRIPWIRE';
  color: string;
  dwell_alert_seconds: number;
  is_active: boolean;
  points: ZonePoint[];
};

const W = '#111111';   // wall colour
const R = '#ef4444';   // restricted zone
const L = '#22c55e';   // lounge / rest
const D = '#3b82f6';   // dwell / office
const T = '#f59e0b';   // tripwire / alert

// ─────────────────────────────────────────────────────────────────────────────
// GROUND FLOOR  (page-1.png — "GROUND FLOOR ALPHA-2")
// Layout:  West canteen wing │ LT MCC electrical │ Toilet block │ Reception
//          └─ Ground floor has an L-shaped canteen annex on the south-west
// ─────────────────────────────────────────────────────────────────────────────

export const GF_WALLS_ACCURATE: WallSegment[] = [
  // ── Outer perimeter ────────────────────────────────────────────────────────
  { id: 1001, startX:  80, startY:  80, endX: 1120, endY:  80, thickness: 8, color: W, label: 'North Perimeter Wall'      },
  { id: 1002, startX:  80, startY:  80, endX:   80, endY: 720, thickness: 8, color: W, label: 'West Perimeter Wall'       },
  { id: 1003, startX: 1120, startY:  80, endX: 1120, endY: 720, thickness: 8, color: W, label: 'East Perimeter Wall'      },
  { id: 1004, startX:  80, startY: 720, endX: 1120, endY: 720, thickness: 8, color: W, label: 'South Perimeter Wall'     },

  // ── Canteen wing east boundary (full height N→S) ───────────────────────────
  { id: 1005, startX: 330, startY:  80, endX: 330, endY: 720, thickness: 6, color: W, label: 'Canteen / Main Zone Divider' },

  // ── Within canteen: locker/rest block (north portion, left side) ───────────
  { id: 1006, startX:  80, startY: 220, endX: 175, endY: 220, thickness: 4, color: W, label: 'Porch / Locker Divider (H)'  },
  { id: 1007, startX: 175, startY:  80, endX: 175, endY: 330, thickness: 4, color: W, label: 'Porch / Locker Divider (V)'  },
  { id: 1008, startX:  80, startY: 330, endX: 330, endY: 330, thickness: 4, color: W, label: 'Locker / Sofa Divider (H)'   },
  { id: 1009, startX: 175, startY: 220, endX: 330, endY: 220, thickness: 4, color: W, label: 'Locker / Sofa Divider Top'   },

  // ── Canteen lower section: kitchen + pantry + storage ──────────────────────
  { id: 1010, startX:  80, startY: 510, endX: 330, endY: 510, thickness: 4, color: W, label: 'Canteen Kitchen North Wall'  },
  { id: 1011, startX: 210, startY: 510, endX: 210, endY: 720, thickness: 4, color: W, label: 'Kitchen / Pantry Divider'   },
  { id: 1012, startX:  80, startY: 620, endX: 210, endY: 620, thickness: 4, color: W, label: 'Kitchen Sub Divider'        },

  // ── LT MCC HV Electrical Room ─────────────────────────────────────────────
  { id: 1013, startX: 330, startY:  80, endX: 330, endY: 290, thickness: 5, color: W, label: 'Electrical Room West Wall'   },
  { id: 1014, startX: 330, startY: 290, endX: 560, endY: 290, thickness: 5, color: W, label: 'Electrical Room South Wall'  },
  { id: 1015, startX: 560, startY:  80, endX: 560, endY: 290, thickness: 5, color: W, label: 'Electrical Room East Wall'   },

  // ── Central Toilet Block (centre of building) ─────────────────────────────
  { id: 1016, startX: 330, startY: 430, endX: 640, endY: 430, thickness: 5, color: W, label: 'Toilet Block North Wall'    },
  { id: 1017, startX: 330, startY: 555, endX: 640, endY: 555, thickness: 5, color: W, label: 'Toilet Block South Wall'    },
  { id: 1018, startX: 330, startY: 290, endX: 330, endY: 430, thickness: 4, color: W, label: 'Toilet Block West Wall'     },
  { id: 1019, startX: 640, startY: 290, endX: 640, endY: 555, thickness: 4, color: W, label: 'Toilet Block East Wall'     },
  { id: 1020, startX: 485, startY: 290, endX: 485, endY: 430, thickness: 4, color: W, label: 'Ladies / Gents Divider'    },

  // ── Reception Lobby (north-centre band) ───────────────────────────────────
  { id: 1021, startX: 640, startY:  80, endX: 640, endY: 290, thickness: 5, color: W, label: 'Reception West Wall'        },
  { id: 1022, startX: 640, startY: 290, endX: 860, endY: 290, thickness: 4, color: W, label: 'Reception South Wall'       },
  { id: 1023, startX: 860, startY:  80, endX: 860, endY: 290, thickness: 4, color: W, label: 'Reception East Wall'        },

  // ── Area of Stay / Storage (centre-right, below reception) ────────────────
  { id: 1024, startX: 640, startY: 430, endX: 770, endY: 430, thickness: 4, color: W, label: 'Storage North Wall'         },
  { id: 1025, startX: 640, startY: 555, endX: 770, endY: 555, thickness: 4, color: W, label: 'Storage South Wall'         },
  { id: 1026, startX: 770, startY: 290, endX: 770, endY: 555, thickness: 4, color: W, label: 'Storage East Wall'          },

  // ── Monitor Room / Misc area (centre-right) ────────────────────────────────
  { id: 1027, startX: 860, startY: 290, endX: 895, endY: 290, thickness: 4, color: W, label: 'Monitor Room North'         },
  { id: 1028, startX: 895, startY:  80, endX: 895, endY: 720, thickness: 6, color: W, label: 'Director Wing West Wall'    },
  { id: 1029, startX: 860, startY: 555, endX: 895, endY: 555, thickness: 4, color: W, label: 'Monitor Room South'         },

  // ── Director Office Wing (east portion) ───────────────────────────────────
  { id: 1030, startX: 895, startY: 250, endX: 1120, endY: 250, thickness: 4, color: W, label: 'Director Wing Upper Div'   },
  { id: 1031, startX: 1015, startY:  80, endX: 1015, endY: 250, thickness: 4, color: W, label: 'Data Office East Wall'    },
  { id: 1032, startX: 895, startY: 375, endX: 1120, endY: 375, thickness: 4, color: W, label: 'Director Office Row Div'   },
  { id: 1033, startX:  950, startY: 375, endX:  950, endY: 720, thickness: 4, color: W, label: 'HR-Admin East Wall'       },
  { id: 1034, startX: 1005, startY: 375, endX: 1005, endY: 720, thickness: 4, color: W, label: 'Accounts East Wall'       },
  { id: 1035, startX: 1060, startY: 375, endX: 1060, endY: 720, thickness: 4, color: W, label: 'CODC/CS East Wall'        },
  { id: 1036, startX: 1070, startY: 250, endX: 1070, endY: 375, thickness: 4, color: W, label: 'Meeting Room East Div'    },
  { id: 1037, startX: 895, startY: 590, endX: 1120, endY: 590, thickness: 4, color: W, label: 'East Wing South Div'       },
  { id: 1038, startX: 1015, startY: 590, endX: 1015, endY: 720, thickness: 4, color: W, label: 'AFSB / Toilet Divider'    },
];

export const GF_ARCH_ACCURATE: ArchElement[] = [
  // ── North perimeter entry (y=80 wall) ──────────────────────────────────────
  // Main Entry: centred between x=560 (electrical east wall) and x=640 (reception west wall)
  { id: 1101, type: 'DOUBLE_DOOR', x: 595,  y:  80, width: 52, rotation:  0, label: 'Main North Entry (Double)',   openDirection: 'RIGHT' },
  // Window openings on north wall (top face, rotation 0 = horizontal)
  { id: 1117, type: 'WINDOW',      x: 210,  y:  80, width: 80, rotation:  0, label: 'Canteen North Window'                               },
  { id: 1118, type: 'WINDOW',      x: 760,  y:  80, width: 70, rotation:  0, label: 'Reception North Window'                             },
  { id: 1119, type: 'WINDOW',      x: 990,  y:  80, width: 70, rotation:  0, label: 'Director Wing North Window'                         },

  // ── West canteen wing (x=175 vertical wall) ────────────────────────────────
  // Porch lift + stairs inside the 80–175 block
  { id: 1113, type: 'ELEVATOR',    x: 115,  y: 145, width: 32, rotation:  0, label: 'Lift GF-West'                                      },
  { id: 1114, type: 'STAIRS',      x: 115,  y: 245, width: 40, rotation:  0, label: 'Staircase GF'                                      },
  // Door from porch into locker room (on x=175 wall, mid-height between y=80 and y=220)
  { id: 1102, type: 'DOOR',        x: 175,  y: 150, width: 40, rotation:  0, label: 'Porch → Locker Door',         openDirection: 'RIGHT' },
  // Door from locker into sofa/rest area (on y=220 horizontal wall)
  { id: 1103, type: 'DOOR',        x: 255,  y: 220, width: 40, rotation:  0, label: 'Locker → Rest Area Door',     openDirection: 'LEFT'  },
  // Door canteen → corridor (on x=330 wall between y=330 and y=510)
  { id: 1104, type: 'DOOR',        x: 330,  y: 415, width: 44, rotation:  0, label: 'Canteen → Corridor Door',     openDirection: 'RIGHT' },

  // ── LT MCC Electrical Room (south wall y=290) ─────────────────────────────
  // Door on south wall, centred between x=330 and x=560
  { id: 1105, type: 'DOOR',        x: 445,  y: 290, width: 48, rotation:  0, label: 'Electrical Room Entry',       openDirection: 'RIGHT' },

  // ── Central Toilet Block (north wall y=430) ────────────────────────────────
  // Ladies: centred in left half (x=330–485), Gents: centred in right half (x=485–640)
  { id: 1106, type: 'DOOR',        x: 407,  y: 430, width: 42, rotation:  0, label: 'Ladies Toilet Entry',         openDirection: 'RIGHT' },
  { id: 1107, type: 'DOOR',        x: 562,  y: 430, width: 42, rotation:  0, label: 'Gents Toilet Entry',          openDirection: 'LEFT'  },

  // ── Reception lobby (west wall x=640) ─────────────────────────────────────
  // Door centred between y=80 and y=290 on the west wall of reception
  { id: 1108, type: 'DOOR',        x: 640,  y: 185, width: 44, rotation:  0, label: 'Reception Entry',             openDirection: 'LEFT'  },

  // ── Storage / area-of-stay (below reception) ──────────────────────────────
  // Door on north wall of storage block (y=430), centred x=640–770
  { id: 1109, type: 'DOOR',        x: 705,  y: 430, width: 44, rotation:  0, label: 'Storage Room Entry',          openDirection: 'RIGHT' },

  // ── Monitor / Dispatch area (west wall x=895) ──────────────────────────────
  // Door on west wall between y=290 and y=555, centred vertically
  { id: 1110, type: 'DOOR',        x: 895,  y: 420, width: 44, rotation:  0, label: 'Monitor Room Door',           openDirection: 'LEFT'  },

  // ── Director Wing main entry (x=895 wall) ─────────────────────────────────
  // Double door centred between y=250 and y=375 on director wing wall
  { id: 1111, type: 'DOUBLE_DOOR', x: 895,  y: 312, width: 56, rotation:  0, label: 'Director Wing Entry',         openDirection: 'RIGHT' },

  // ── East-wing office row (y=375 horizontal wall) ──────────────────────────
  // Each office has a door on y=375 centred in its bay
  { id: 1120, type: 'DOOR',        x: 922,  y: 375, width: 40, rotation:  0, label: 'HR / Admin Entry',            openDirection: 'RIGHT' },
  { id: 1121, type: 'DOOR',        x: 977,  y: 375, width: 40, rotation:  0, label: 'Accounts Office Entry',       openDirection: 'RIGHT' },
  { id: 1122, type: 'DOOR',        x: 1032, y: 375, width: 40, rotation:  0, label: 'CODC / CS Entry',             openDirection: 'RIGHT' },
  { id: 1123, type: 'DOOR',        x: 1087, y: 375, width: 40, rotation:  0, label: 'MD / Director Entry',         openDirection: 'RIGHT' },

  // ── East wing upper row (y=250 horizontal wall) ───────────────────────────
  { id: 1124, type: 'DOOR',        x: 955,  y: 250, width: 44, rotation:  0, label: 'Data Office Entry',           openDirection: 'LEFT'  },
  { id: 1125, type: 'DOOR',        x: 1065, y: 250, width: 44, rotation:  0, label: 'Director Reception Entry',    openDirection: 'LEFT'  },

  // ── AFSB south band (y=590 horizontal wall) ───────────────────────────────
  { id: 1126, type: 'DOOR',        x: 950,  y: 590, width: 40, rotation:  0, label: 'AFSB Misc Office Entry',      openDirection: 'RIGHT' },
  { id: 1127, type: 'DOOR',        x: 1060, y: 590, width: 40, rotation:  0, label: 'East Gents Toilet Entry',     openDirection: 'RIGHT' },

  // ── Structural columns ─────────────────────────────────────────────────────
  { id: 1115, type: 'COLUMN',      x: 485,  y:  80, width: 16, rotation:  0, label: 'Column-GF-1'                                       },
  { id: 1116, type: 'COLUMN',      x: 765,  y:  80, width: 16, rotation:  0, label: 'Column-GF-2'                                       },
];

export const GF_ZONES_ACCURATE: ZoneOnCanvas[] = [
  // ── West Canteen Wing ──────────────────────────────────────────────────────
  { id: 2001, name: 'Covered Porch',             type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x:  80, y:  80 }, { x: 175, y:  80 }, { x: 175, y: 220 }, { x:  80, y: 220 }] },
  { id: 2002, name: 'Locker Room',               type: 'LOUNGE',     color: L, dwell_alert_seconds: 900,  is_active: true,
    points: [{ x: 175, y:  80 }, { x: 330, y:  80 }, { x: 330, y: 220 }, { x: 175, y: 220 }] },
  { id: 2003, name: 'Sofa / Rest Area',          type: 'LOUNGE',     color: L, dwell_alert_seconds: 1200, is_active: true,
    points: [{ x:  80, y: 220 }, { x: 330, y: 220 }, { x: 330, y: 330 }, { x:  80, y: 330 }] },
  { id: 2004, name: 'BIAL Canteen — R&M Dining', type: 'DWELL',      color: D, dwell_alert_seconds: 3600, is_active: true,
    points: [{ x:  80, y: 330 }, { x: 330, y: 330 }, { x: 330, y: 510 }, { x:  80, y: 510 }] },
  { id: 2005, name: 'Canteen Kitchen',           type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x:  80, y: 510 }, { x: 210, y: 510 }, { x: 210, y: 720 }, { x:  80, y: 720 }] },
  { id: 2006, name: 'Canteen Storage / Pantry',  type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 210, y: 510 }, { x: 330, y: 510 }, { x: 330, y: 720 }, { x: 210, y: 720 }] },
  // ── LT MCC HV Electrical Room ──────────────────────────────────────────────
  { id: 2007, name: 'LT MCC HV Electrical Room', type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,   is_active: true,
    points: [{ x: 330, y:  80 }, { x: 560, y:  80 }, { x: 560, y: 290 }, { x: 330, y: 290 }] },
  // ── Centre Corridor & Toilet Block ─────────────────────────────────────────
  { id: 2008, name: 'Ladies Toilet (Centre)',    type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 330, y: 290 }, { x: 485, y: 290 }, { x: 485, y: 430 }, { x: 330, y: 430 }] },
  { id: 2009, name: 'Gents Toilet (Centre)',     type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 485, y: 290 }, { x: 640, y: 290 }, { x: 640, y: 430 }, { x: 485, y: 430 }] },
  { id: 2010, name: 'Toilet Block Corridor',     type: 'DWELL',      color: D, dwell_alert_seconds: 300,  is_active: true,
    points: [{ x: 330, y: 430 }, { x: 640, y: 430 }, { x: 640, y: 555 }, { x: 330, y: 555 }] },
  { id: 2011, name: 'Canteen Corridor / Lobby',  type: 'DWELL',      color: D, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 330, y: 555 }, { x: 640, y: 555 }, { x: 640, y: 720 }, { x: 330, y: 720 }] },
  // ── Reception ──────────────────────────────────────────────────────────────
  { id: 2012, name: 'Reception Lobby',           type: 'LOUNGE',     color: L, dwell_alert_seconds: 900,  is_active: true,
    points: [{ x: 640, y:  80 }, { x: 860, y:  80 }, { x: 860, y: 290 }, { x: 640, y: 290 }] },
  { id: 2013, name: 'Waiting / Area of Stay',    type: 'DWELL',      color: D, dwell_alert_seconds: 1800, is_active: true,
    points: [{ x: 560, y: 290 }, { x: 640, y: 290 }, { x: 640, y: 430 }, { x: 560, y: 430 }] },
  // ── Storage / Monitor ──────────────────────────────────────────────────────
  { id: 2014, name: 'Storage / Legal Room',      type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 640, y: 430 }, { x: 770, y: 430 }, { x: 770, y: 555 }, { x: 640, y: 555 }] },
  { id: 2015, name: 'Monitor / Dispatch Room',   type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 770, y: 290 }, { x: 895, y: 290 }, { x: 895, y: 555 }, { x: 770, y: 555 }] },
  { id: 2016, name: 'Corridor (Monitor South)',   type: 'DWELL',      color: D, dwell_alert_seconds: 300,  is_active: true,
    points: [{ x: 640, y: 555 }, { x: 895, y: 555 }, { x: 895, y: 720 }, { x: 640, y: 720 }] },
  // ── Director / Airport Director Offices Wing ───────────────────────────────
  { id: 2017, name: 'Data Office / Server Room', type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 895, y:  80 }, { x: 1015, y:  80 }, { x: 1015, y: 250 }, { x: 895, y: 250 }] },
  { id: 2018, name: 'Director Wing Reception',   type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 1015, y:  80 }, { x: 1120, y:  80 }, { x: 1120, y: 250 }, { x: 1015, y: 250 }] },
  { id: 2019, name: 'Open Work Stations',        type: 'DWELL',      color: D, dwell_alert_seconds: 2400, is_active: true,
    points: [{ x: 895, y: 250 }, { x: 1070, y: 250 }, { x: 1070, y: 375 }, { x: 895, y: 375 }] },
  { id: 2020, name: 'Meeting Room',              type: 'DWELL',      color: D, dwell_alert_seconds: 1800, is_active: true,
    points: [{ x: 1070, y: 250 }, { x: 1120, y: 250 }, { x: 1120, y: 375 }, { x: 1070, y: 375 }] },
  { id: 2021, name: 'HR / Admin Office',         type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 895, y: 375 }, { x:  950, y: 375 }, { x:  950, y: 590 }, { x: 895, y: 590 }] },
  { id: 2022, name: 'Accounts Office',           type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 950, y: 375 }, { x: 1005, y: 375 }, { x: 1005, y: 590 }, { x: 950, y: 590 }] },
  { id: 2023, name: 'CODC / CS Office',          type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 1005, y: 375 }, { x: 1060, y: 375 }, { x: 1060, y: 590 }, { x: 1005, y: 590 }] },
  { id: 2024, name: 'MD / Director Office',      type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 1060, y: 375 }, { x: 1120, y: 375 }, { x: 1120, y: 590 }, { x: 1060, y: 590 }] },
  { id: 2025, name: 'AFSB / Misc Office',        type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 895, y: 590 }, { x: 1015, y: 590 }, { x: 1015, y: 720 }, { x: 895, y: 720 }] },
  { id: 2026, name: 'Gents Toilet (East Wing)',  type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 1015, y: 590 }, { x: 1120, y: 590 }, { x: 1120, y: 720 }, { x: 1015, y: 720 }] },
  // ── Security Tripwires ──────────────────────────────────────────────────────
  { id: 2027, name: 'Main Entry Tripwire',       type: 'TRIPWIRE',   color: T, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x:  80, y:  80 }, { x: 175, y:  80 }, { x: 175, y: 140 }, { x:  80, y: 140 }] },
  { id: 2028, name: 'South Exit Tripwire',       type: 'TRIPWIRE',   color: T, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x:  80, y: 660 }, { x: 175, y: 660 }, { x: 175, y: 720 }, { x:  80, y: 720 }] },
];


// ─────────────────────────────────────────────────────────────────────────────
// AREA A — INTERMEDIATE FLOOR  (page-2.png — "AREA A")
// Layout:  West CMS block │ Pest rooms │ RAF/RADAR │ CHS Executives │
//          Director offices │ Rest rooms (east) │ Server rooms (south band)
// ─────────────────────────────────────────────────────────────────────────────

export const AA_WALLS_ACCURATE: WallSegment[] = [
  // ── Outer perimeter ────────────────────────────────────────────────────────
  { id: 3001, startX:   80, startY:  80, endX: 1120, endY:  80, thickness: 8, color: W, label: 'North Perimeter Wall'          },
  { id: 3002, startX:   80, startY:  80, endX:   80, endY: 720, thickness: 8, color: W, label: 'West Perimeter Wall'           },
  { id: 3003, startX: 1120, startY:  80, endX: 1120, endY: 720, thickness: 8, color: W, label: 'East Perimeter Wall'           },
  { id: 3004, startX:   80, startY: 720, endX: 1120, endY: 720, thickness: 8, color: W, label: 'South Perimeter Wall'          },

  // ── Major floor divider: upper office zone / lower server hall ─────────────
  { id: 3005, startX:   80, startY: 480, endX: 1120, endY: 480, thickness: 6, color: W, label: 'Server Room North Wall'        },

  // ── CMS Block — west wing (upper) ──────────────────────────────────────────
  { id: 3006, startX:   80, startY: 170, endX:  340, endY: 170, thickness: 4, color: W, label: 'CMS Maintenance South Wall'    },
  { id: 3007, startX:  340, startY:  80, endX:  340, endY: 480, thickness: 5, color: W, label: 'CMS Block East Wall'           },
  { id: 3008, startX:   80, startY: 310, endX:  340, endY: 310, thickness: 4, color: W, label: 'CMS Room South Wall'           },
  { id: 3009, startX:  210, startY: 310, endX:  210, endY: 480, thickness: 4, color: W, label: 'CMS Server Rack Divider (V)'   },
  { id: 3010, startX:  210, startY: 400, endX:  340, endY: 400, thickness: 4, color: W, label: 'Tech Supervisor South Wall'    },

  // ── Pest Rooms (north band, centre-west) ───────────────────────────────────
  { id: 3011, startX:  340, startY: 200, endX:  480, endY: 200, thickness: 4, color: W, label: 'Pest Rooms South Wall'         },
  { id: 3012, startX:  410, startY: 200, endX:  410, endY: 310, thickness: 4, color: W, label: 'Ladies / Gents Pest Divider'   },

  // ── RAF / RADAR Add EXT Interface Room ─────────────────────────────────────
  { id: 3013, startX:  480, startY: 200, endX:  630, endY: 200, thickness: 4, color: W, label: 'RADAR Interface South Wall'    },
  { id: 3014, startX:  480, startY: 200, endX:  480, endY: 310, thickness: 4, color: W, label: 'RADAR Interface West Wall'     },

  // ── CHS / Comms zone (north band, centre) ──────────────────────────────────
  { id: 3015, startX:  340, startY: 310, endX:  630, endY: 310, thickness: 5, color: W, label: 'Comms Room South Wall'         },
  { id: 3016, startX:  480, startY: 310, endX:  480, endY: 480, thickness: 4, color: W, label: 'Radio / Comms East Wall'       },
  { id: 3017, startX:  630, startY:  80, endX:  630, endY: 480, thickness: 5, color: W, label: 'CHS Executive West Wall'       },
  { id: 3018, startX:  630, startY: 310, endX:  870, endY: 310, thickness: 4, color: W, label: 'CHS Executive South Wall'      },

  // ── Director offices (north band, east) ────────────────────────────────────
  { id: 3019, startX:  870, startY:  80, endX:  870, endY: 480, thickness: 5, color: W, label: 'Director Area East Partition'  },
  { id: 3020, startX:  870, startY: 310, endX:  950, endY: 310, thickness: 4, color: W, label: 'Director Office South Wall'    },
  { id: 3021, startX:  950, startY:  80, endX:  950, endY: 480, thickness: 4, color: W, label: 'Inner Director Office East'    },

  // ── East rest rooms (north band, far east) ─────────────────────────────────
  { id: 3022, startX:  950, startY: 200, endX: 1120, endY: 200, thickness: 4, color: W, label: 'Locker / Rest Rooms South Wall' },
  { id: 3023, startX: 1020, startY: 200, endX: 1020, endY: 480, thickness: 4, color: W, label: 'Ladies / Gents Rest Divider'   },
  { id: 3024, startX: 1070, startY: 200, endX: 1070, endY: 480, thickness: 4, color: W, label: 'Gents / Office-C Divider'      },

  // ── Lower server zone — vertical room dividers ─────────────────────────────
  { id: 3025, startX:  260, startY: 480, endX:  260, endY: 720, thickness: 4, color: W, label: 'AMRS / Cyber TAC Divider'      },
  { id: 3026, startX:  445, startY: 480, endX:  445, endY: 720, thickness: 4, color: W, label: 'Cyber TAC East Wall'           },
  { id: 3027, startX:  595, startY: 480, endX:  595, endY: 720, thickness: 4, color: W, label: 'UHF / CCS Room East Wall'      },
  { id: 3028, startX:  745, startY: 480, endX:  745, endY: 720, thickness: 4, color: W, label: 'Battery Room East Wall'        },
  { id: 3029, startX:  900, startY: 480, endX:  900, endY: 720, thickness: 4, color: W, label: 'Fallback Server Room W Wall'   },

  // ── Distribution Panel sub-partitions (lower zone) ────────────────────────
  { id: 3030, startX:  340, startY: 600, endX:  445, endY: 600, thickness: 4, color: W, label: 'Dist Panel 1 South Wall'       },
  { id: 3031, startX:  700, startY: 600, endX:  745, endY: 600, thickness: 4, color: W, label: 'Dist Panel 2 South Wall'       },
];

export const AA_ARCH_ACCURATE: ArchElement[] = [
  // ── CMS Block west wing ────────────────────────────────────────────────────
  // CMS Maintenance door: on south wall y=170, centred in x=80–340 block
  { id: 3101, type: 'DOOR',     x:  210, y:  170, width: 44, rotation: 0, label: 'CMS Maintenance Entry',       openDirection: 'RIGHT' },
  // Rest Room door: on x=80 west wall, between y=170 and y=310 (mid ~y=240)
  { id: 3102, type: 'DOOR',     x:   80, y:  240, width: 40, rotation: 0, label: 'CMS Rest Room Entry',         openDirection: 'RIGHT' },
  // CMS Server Room: on y=310 wall, right half (x=210–340 → centre x=275)
  { id: 3103, type: 'DOOR',     x:  275, y:  310, width: 44, rotation: 0, label: 'CMS Server Room Entry',       openDirection: 'LEFT'  },
  // Tech Supervisor room: on y=400 wall, right half (x=210–340 → centre x=275)
  { id: 3104, type: 'DOOR',     x:  275, y:  400, width: 44, rotation: 0, label: 'Tech Supervisor Entry',       openDirection: 'LEFT'  },

  // ── Pest Rooms (y=200 south wall) ─────────────────────────────────────────
  // Ladies: centred in x=340–410 → x=375; Gents: centred in x=410–480 → x=445
  { id: 3105, type: 'DOOR',     x:  375, y:  200, width: 36, rotation: 0, label: 'Pest Room Ladies Entry',      openDirection: 'RIGHT' },
  { id: 3106, type: 'DOOR',     x:  445, y:  200, width: 36, rotation: 0, label: 'Pest Room Gents Entry',       openDirection: 'LEFT'  },

  // ── RADAR Interface (y=200 south wall, centred x=480–630 → x=555) ─────────
  { id: 3107, type: 'DOOR',     x:  555, y:  200, width: 40, rotation: 0, label: 'RADAR Interface Entry',       openDirection: 'RIGHT' },

  // ── CHS Executives (y=310 south wall, centred x=630–870 → x=750) ──────────
  { id: 3108, type: 'DOOR',     x:  750, y:  310, width: 48, rotation: 0, label: 'CHS Executive Entry',         openDirection: 'LEFT'  },

  // ── Director Area (east of CHS, y=310 south wall, centred x=870–950 → x=910)
  { id: 3109, type: 'DOOR',     x:  910, y:  310, width: 44, rotation: 0, label: 'Director Office Entry',       openDirection: 'RIGHT' },

  // ── East Locker block (y=200 south wall, centred x=950–1120) ─────────────
  // Upper locker header → x=1035
  { id: 3110, type: 'DOOR',     x: 1035, y:  200, width: 44, rotation: 0, label: 'East Locker Room Entry',      openDirection: 'LEFT'  },
  // Ladies rest door: on x=950 wall between y=200 and y=480 → mid y=340
  { id: 3111, type: 'DOOR',     x:  950, y:  340, width: 40, rotation: 0, label: 'Ladies Rest Room Entry',      openDirection: 'RIGHT' },
  // Gents rest door: on x=1020 wall → same y=340
  { id: 3112, type: 'DOOR',     x: 1020, y:  340, width: 40, rotation: 0, label: 'Gents Rest Room Entry',       openDirection: 'LEFT'  },
  // Office C: on x=1070 wall → same y=340
  { id: 3113, type: 'DOOR',     x: 1070, y:  340, width: 40, rotation: 0, label: 'Office C Entry',              openDirection: 'LEFT'  },

  // ── Lower server hall (y=480 north wall) ──────────────────────────────────
  // AMRS: centred x=80–260 → x=170
  { id: 3114, type: 'DOOR',     x:  170, y:  480, width: 48, rotation: 0, label: 'AMRS Server Room Entry',      openDirection: 'RIGHT' },
  // Cyber TAC: centred x=260–445 → x=352
  { id: 3115, type: 'DOOR',     x:  352, y:  480, width: 48, rotation: 0, label: 'Cyber TAC Room Entry',        openDirection: 'RIGHT' },
  // UHF/CCS: centred x=445–595 → x=520
  { id: 3116, type: 'DOOR',     x:  520, y:  480, width: 44, rotation: 0, label: 'UHF/CCS Room Entry',          openDirection: 'RIGHT' },
  // Battery: centred x=595–745 → x=670
  { id: 3117, type: 'DOOR',     x:  670, y:  480, width: 44, rotation: 0, label: 'Battery Room Entry',          openDirection: 'LEFT'  },
  // Distribution Panel: centred x=745–900 → x=822
  { id: 3118, type: 'DOOR',     x:  822, y:  480, width: 44, rotation: 0, label: 'Distribution Panel Entry',    openDirection: 'LEFT'  },
  // Fallback Servers: centred x=900–1120 → x=1010
  { id: 3119, type: 'DOOR',     x: 1010, y:  480, width: 48, rotation: 0, label: 'Fallback Server Entry',       openDirection: 'LEFT'  },

  // ── Lift and stairs (west end, inside CMS block boundary) ─────────────────
  { id: 3120, type: 'ELEVATOR', x:  115, y:  135, width: 32, rotation: 0, label: 'Lift A (Area A)'                                    },
  { id: 3121, type: 'STAIRS',   x:  115, y:  235, width: 40, rotation: 0, label: 'Staircase Area A'                                   },

  // ── Structural columns ─────────────────────────────────────────────────────
  { id: 3122, type: 'COLUMN',   x:  480, y:   80, width: 16, rotation: 0, label: 'Column-AA-1'                                        },
  { id: 3123, type: 'COLUMN',   x:  760, y:   80, width: 16, rotation: 0, label: 'Column-AA-2'                                        },
];

export const AA_ZONES_ACCURATE: ZoneOnCanvas[] = [
  // ── CMS Block (west, upper) ────────────────────────────────────────────────
  { id: 4001, name: 'CMS Maintenance Room',        type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x:  80, y:  80 }, { x: 340, y:  80 }, { x: 340, y: 170 }, { x:  80, y: 170 }] },
  { id: 4002, name: 'Technical Supervisor Room',   type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x:  80, y: 170 }, { x: 210, y: 170 }, { x: 210, y: 310 }, { x:  80, y: 310 }] },
  { id: 4003, name: 'CMS Server Room',             type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 210, y: 310 }, { x: 340, y: 310 }, { x: 340, y: 400 }, { x: 210, y: 400 }] },
  { id: 4004, name: 'CMS Rack Room (Tech Sup.)',   type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x:  80, y: 310 }, { x: 210, y: 310 }, { x: 210, y: 400 }, { x:  80, y: 400 }] },
  { id: 4005, name: 'CMS Lower Zone',              type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x:  80, y: 400 }, { x: 340, y: 400 }, { x: 340, y: 480 }, { x:  80, y: 480 }] },
  // ── Pest Rooms ─────────────────────────────────────────────────────────────
  { id: 4006, name: 'Pest Room — Ladies',          type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 340, y: 200 }, { x: 410, y: 200 }, { x: 410, y: 310 }, { x: 340, y: 310 }] },
  { id: 4007, name: 'Pest Room — Gents',           type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 410, y: 200 }, { x: 480, y: 200 }, { x: 480, y: 310 }, { x: 410, y: 310 }] },
  // ── RAF / RADAR EXT Interface Room ─────────────────────────────────────────
  { id: 4008, name: 'RAF / RADAR ADD EXT Interface', type: 'RESTRICTED', color: R, dwell_alert_seconds: 0, is_active: true,
    points: [{ x: 480, y: 200 }, { x: 630, y: 200 }, { x: 630, y: 310 }, { x: 480, y: 310 }] },
  // ── CHS / Radio / Comms zone ───────────────────────────────────────────────
  { id: 4009, name: 'Radio / Comms Room',          type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 340, y: 310 }, { x: 480, y: 310 }, { x: 480, y: 480 }, { x: 340, y: 480 }] },
  { id: 4010, name: 'CHS Executives Room (West)',  type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 480, y: 310 }, { x: 630, y: 310 }, { x: 630, y: 480 }, { x: 480, y: 480 }] },
  { id: 4011, name: 'CHS Executives Room (East)',  type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 630, y:  80 }, { x: 870, y:  80 }, { x: 870, y: 310 }, { x: 630, y: 310 }] },
  { id: 4012, name: 'Director Office Area',        type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 630, y: 310 }, { x: 870, y: 310 }, { x: 870, y: 480 }, { x: 630, y: 480 }] },
  { id: 4013, name: 'Inner Director Office',       type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 870, y:  80 }, { x: 950, y:  80 }, { x: 950, y: 480 }, { x: 870, y: 480 }] },
  // ── East Rest / Locker Rooms ───────────────────────────────────────────────
  { id: 4014, name: 'Locker Room (East)',          type: 'LOUNGE',     color: L, dwell_alert_seconds: 900,  is_active: true,
    points: [{ x: 950, y:  80 }, { x: 1120, y:  80 }, { x: 1120, y: 200 }, { x: 950, y: 200 }] },
  { id: 4015, name: 'Ladies Rest Room',            type: 'LOUNGE',     color: L, dwell_alert_seconds: 900,  is_active: true,
    points: [{ x: 950, y: 200 }, { x: 1020, y: 200 }, { x: 1020, y: 480 }, { x: 950, y: 480 }] },
  { id: 4016, name: 'Gents Rest Room',             type: 'LOUNGE',     color: L, dwell_alert_seconds: 900,  is_active: true,
    points: [{ x: 1020, y: 200 }, { x: 1070, y: 200 }, { x: 1070, y: 480 }, { x: 1020, y: 480 }] },
  { id: 4017, name: 'Office C / Director Room',    type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 1070, y: 200 }, { x: 1120, y: 200 }, { x: 1120, y: 480 }, { x: 1070, y: 480 }] },
  // ── Lower Server Hall ──────────────────────────────────────────────────────
  { id: 4018, name: 'Automation Server Room (AMRS)', type: 'RESTRICTED', color: R, dwell_alert_seconds: 0, is_active: true,
    points: [{ x:  80, y: 480 }, { x: 260, y: 480 }, { x: 260, y: 720 }, { x:  80, y: 720 }] },
  { id: 4019, name: 'Cyber Security & ASMOS TAC Room', type: 'RESTRICTED', color: R, dwell_alert_seconds: 0, is_active: true,
    points: [{ x: 260, y: 480 }, { x: 445, y: 480 }, { x: 445, y: 720 }, { x: 260, y: 720 }] },
  { id: 4020, name: 'UHF / CCS / DATA / GTR Room', type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,   is_active: true,
    points: [{ x: 445, y: 480 }, { x: 595, y: 480 }, { x: 595, y: 720 }, { x: 445, y: 720 }] },
  { id: 4021, name: 'UPS Battery Room',            type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 595, y: 480 }, { x: 745, y: 480 }, { x: 745, y: 720 }, { x: 595, y: 720 }] },
  { id: 4022, name: 'Distribution Panel Area',     type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 745, y: 480 }, { x: 900, y: 480 }, { x: 900, y: 720 }, { x: 745, y: 720 }] },
  { id: 4023, name: 'Fallback Servers Room',       type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 900, y: 480 }, { x: 1120, y: 480 }, { x: 1120, y: 720 }, { x: 900, y: 720 }] },
];


// ─────────────────────────────────────────────────────────────────────────────
// FIRST FLOOR  (page-3.png — "ALPHA-2 – FIRST FLOOR")
// Layout:  Upper band: Shower │ Training │ Gents Rest × 3 │ Recreation │ UPS
//          Corridor band: OPS × 2 │ RADAR Int. │ Reception
//          Lower band: Janitor │ Electrical │ STM │ ACC × 4 │ APP
// ─────────────────────────────────────────────────────────────────────────────

export const FF_WALLS_ACCURATE: WallSegment[] = [
  // ── Outer perimeter ────────────────────────────────────────────────────────
  { id: 5001, startX: 235, startY: 235, endX: 960, endY: 235, thickness: 8, color: W, label: 'North Perimeter Wall'              },
  { id: 5002, startX: 235, startY: 235, endX: 235, endY: 565, thickness: 8, color: W, label: 'West Perimeter Wall'               },
  { id: 5003, startX: 960, startY: 235, endX: 960, endY: 565, thickness: 8, color: W, label: 'East Perimeter Wall'               },
  { id: 5004, startX: 235, startY: 565, endX: 960, endY: 565, thickness: 8, color: W, label: 'South Perimeter Wall'              },

  // ── Corridor band ─────────────────────────────────────────────────────────
  { id: 5005, startX: 235, startY: 380, endX: 960, endY: 380, thickness: 6, color: W, label: 'Corridor North Wall'               },
  { id: 5006, startX: 235, startY: 420, endX: 960, endY: 420, thickness: 6, color: W, label: 'Corridor South Wall'               },

  // ── Upper band — vertical partitions ──────────────────────────────────────
  { id: 5010, startX: 305, startY: 235, endX: 305, endY: 380, thickness: 4, color: W, label: 'Shower / Training-IC Div'          },
  { id: 5011, startX: 375, startY: 235, endX: 375, endY: 380, thickness: 4, color: W, label: 'Training IC / Support Div'         },
  { id: 5012, startX: 445, startY: 235, endX: 445, endY: 380, thickness: 4, color: W, label: 'Training Support / Class-1 Div'    },
  { id: 5013, startX: 515, startY: 235, endX: 515, endY: 380, thickness: 4, color: W, label: 'Gents Rest Room 1 Div'             },
  { id: 5014, startX: 585, startY: 235, endX: 585, endY: 380, thickness: 4, color: W, label: 'Gents Rest Room 2 Div'             },
  { id: 5015, startX: 655, startY: 235, endX: 655, endY: 380, thickness: 4, color: W, label: 'Gents Rest Room 3 Div'             },
  { id: 5016, startX: 725, startY: 235, endX: 725, endY: 380, thickness: 4, color: W, label: 'Gents Rest 3 / Recreation Div'     },
  { id: 5017, startX: 820, startY: 235, endX: 820, endY: 380, thickness: 4, color: W, label: 'Recreation / UPS Battery Div'      },
  { id: 5018, startX: 890, startY: 235, endX: 890, endY: 380, thickness: 4, color: W, label: 'UPS Battery Room Div'              },

  // ── Corridor sub-partitions (OPS / RADAR / Reception) ─────────────────────
  { id: 5020, startX: 395, startY: 380, endX: 395, endY: 420, thickness: 4, color: W, label: 'OPS Room 1 / OPS Room 2 Div'       },
  { id: 5021, startX: 555, startY: 380, endX: 555, endY: 420, thickness: 4, color: W, label: 'OPS Room 2 / RADAR Interface Div'   },
  { id: 5022, startX: 715, startY: 380, endX: 715, endY: 420, thickness: 4, color: W, label: 'RADAR Interface / Reception Div'    },

  // ── Lower band — vertical partitions ──────────────────────────────────────
  { id: 5030, startX: 280, startY: 420, endX: 280, endY: 565, thickness: 4, color: W, label: 'Janitor / Electrical-FF Div'        },
  { id: 5031, startX: 350, startY: 420, endX: 350, endY: 565, thickness: 4, color: W, label: 'Electrical-FF / STM Telecom Div'    },
  { id: 5032, startX: 465, startY: 420, endX: 465, endY: 565, thickness: 4, color: W, label: 'STM Telecom / ACC Bay-1 Div'        },
  { id: 5033, startX: 555, startY: 420, endX: 555, endY: 565, thickness: 4, color: W, label: 'ACC Bay-1 / ACC Bay-2 Div'          },
  { id: 5034, startX: 645, startY: 420, endX: 645, endY: 565, thickness: 4, color: W, label: 'ACC Bay-2 / ACC Bay-3 Div'          },
  { id: 5035, startX: 735, startY: 420, endX: 735, endY: 565, thickness: 4, color: W, label: 'ACC Bay-3 / ACC Bay-4 Div'          },
  { id: 5036, startX: 845, startY: 420, endX: 845, endY: 565, thickness: 4, color: W, label: 'ACC Bay-4 / APP Room Div'           },
];

export const FF_ARCH_ACCURATE: ArchElement[] = [
  // ── Upper band: each room's door on SOUTH wall (y=380), centred in its bay ─
  // Shower (x=235–305, centre=270)
  { id: 5101, type: 'DOOR',        x: 270,  y: 380, width: 36, rotation: 0, label: 'Shower Room Door',           openDirection: 'RIGHT' },
  // Training In-Charge (x=305–375, centre=340)
  { id: 5102, type: 'DOOR',        x: 340,  y: 380, width: 36, rotation: 0, label: 'Training In-Charge Door',    openDirection: 'RIGHT' },
  // Training Support (x=375–445, centre=410)
  { id: 5103, type: 'DOOR',        x: 410,  y: 380, width: 36, rotation: 0, label: 'Training Support Door',      openDirection: 'RIGHT' },
  // Gents Rest 1 (x=445–515, centre=480)
  { id: 5104, type: 'DOOR',        x: 480,  y: 380, width: 36, rotation: 0, label: "Gents Rest 1 Door",          openDirection: 'LEFT'  },
  // Gents Rest 2 (x=515–585, centre=550)
  { id: 5105, type: 'DOOR',        x: 550,  y: 380, width: 36, rotation: 0, label: "Gents Rest 2 Door",          openDirection: 'LEFT'  },
  // Gents Rest 3 (x=585–655, centre=620)
  { id: 5106, type: 'DOOR',        x: 620,  y: 380, width: 36, rotation: 0, label: "Gents Rest 3 Door",          openDirection: 'LEFT'  },
  // Recreation (x=655–725, centre=690)
  { id: 5107, type: 'DOOR',        x: 690,  y: 380, width: 36, rotation: 0, label: 'Recreation Room Door',       openDirection: 'LEFT'  },
  // UPS Battery (x=725–820, centre=772)
  { id: 5108, type: 'DOOR',        x: 772,  y: 380, width: 36, rotation: 0, label: 'UPS Battery Room Door',      openDirection: 'LEFT'  },
  // East Wing (x=820–960 shared stairwell area, door near x=855)
  { id: 5109, type: 'DOOR',        x: 855,  y: 380, width: 36, rotation: 0, label: 'East Stairwell Door',        openDirection: 'LEFT'  },

  // ── Lower band: each room's door on NORTH wall (y=420), centred in its bay ─
  // Janitor (x=235–280, centre=257)
  { id: 5110, type: 'DOOR',        x: 257,  y: 420, width: 32, rotation: 0, label: 'Janitor Room Door',          openDirection: 'RIGHT' },
  // Electrical FF (x=280–350, centre=315)
  { id: 5111, type: 'DOOR',        x: 315,  y: 420, width: 36, rotation: 0, label: 'Electrical Room (FF) Door',  openDirection: 'RIGHT' },
  // STM Telecom (x=350–465, centre=407)
  { id: 5112, type: 'DOOR',        x: 407,  y: 420, width: 40, rotation: 0, label: 'STM Telecom Door',           openDirection: 'RIGHT' },
  // ACC Bay-1 (x=465–555, centre=510)
  { id: 5113, type: 'DOOR',        x: 510,  y: 420, width: 40, rotation: 0, label: 'ACC Bay-1 Door',             openDirection: 'LEFT'  },
  // ACC Bay-2 (x=555–645, centre=600)
  { id: 5114, type: 'DOOR',        x: 600,  y: 420, width: 40, rotation: 0, label: 'ACC Bay-2 Door',             openDirection: 'LEFT'  },
  // ACC Bay-3 (x=645–735, centre=690)
  { id: 5115, type: 'DOOR',        x: 690,  y: 420, width: 40, rotation: 0, label: 'ACC Bay-3 Door',             openDirection: 'LEFT'  },
  // ACC Bay-4 / WSO (x=735–845, centre=790)
  { id: 5116, type: 'DOOR',        x: 790,  y: 420, width: 40, rotation: 0, label: 'ACC Bay-4 (WSO) Door',       openDirection: 'LEFT'  },
  // APP Room (x=845–960, centre=902)
  { id: 5117, type: 'DOOR',        x: 902,  y: 420, width: 40, rotation: 0, label: 'APP Room Door',              openDirection: 'LEFT'  },

  // ── Stairs: west stairwell (inside shower/cloak block at x=235, y=235–380)
  //           east stairwell (inside east-wing block at x=890–960, y=235–380)
  { id: 5118, type: 'STAIRS',      x: 248,  y: 307, width: 44, rotation: 0, label: 'Staircase FF West'                                  },
  { id: 5119, type: 'STAIRS',      x: 925,  y: 307, width: 44, rotation: 0, label: 'Staircase FF East'                                  },

  // ── Corridor access control points ─────────────────────────────────────────
  { id: 5120, type: 'ACCESS_DOOR', x: 395,  y: 400, width: 16, rotation: 0, label: 'Corridor Gate A'                                    },
  { id: 5121, type: 'ACCESS_DOOR', x: 715,  y: 400, width: 16, rotation: 0, label: 'Corridor Gate B'                                    },
];

export const FF_ZONES_ACCURATE: ZoneOnCanvas[] = [
  // ── Upper band rooms ───────────────────────────────────────────────────────
  { id: 6001, name: 'Shower / Cloak Room',         type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 235, y: 235 }, { x: 305, y: 235 }, { x: 305, y: 380 }, { x: 235, y: 380 }] },
  { id: 6002, name: 'Training In-Charge Room',     type: 'RESTRICTED', color: R, dwell_alert_seconds: 1800, is_active: true,
    points: [{ x: 305, y: 235 }, { x: 375, y: 235 }, { x: 375, y: 380 }, { x: 305, y: 380 }] },
  { id: 6003, name: 'Training Support Room',       type: 'DWELL',      color: D, dwell_alert_seconds: 2400, is_active: true,
    points: [{ x: 375, y: 235 }, { x: 445, y: 235 }, { x: 445, y: 380 }, { x: 375, y: 380 }] },
  { id: 6004, name: "Gent's Rest Room — 1",        type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 445, y: 235 }, { x: 515, y: 235 }, { x: 515, y: 380 }, { x: 445, y: 380 }] },
  { id: 6005, name: "Gent's Rest Room — 2",        type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 515, y: 235 }, { x: 585, y: 235 }, { x: 585, y: 380 }, { x: 515, y: 380 }] },
  { id: 6006, name: "Gent's Rest Room — 3",        type: 'LOUNGE',     color: L, dwell_alert_seconds: 600,  is_active: true,
    points: [{ x: 585, y: 235 }, { x: 655, y: 235 }, { x: 655, y: 380 }, { x: 585, y: 380 }] },
  { id: 6007, name: 'Recreation Room',             type: 'LOUNGE',     color: L, dwell_alert_seconds: 1200, is_active: true,
    points: [{ x: 655, y: 235 }, { x: 725, y: 235 }, { x: 725, y: 380 }, { x: 655, y: 380 }] },
  { id: 6008, name: 'UPS Battery Room',            type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 725, y: 235 }, { x: 820, y: 235 }, { x: 820, y: 380 }, { x: 725, y: 380 }] },
  { id: 6009, name: 'East Wing Rooms',             type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 820, y: 235 }, { x: 960, y: 235 }, { x: 960, y: 380 }, { x: 820, y: 380 }] },
  // ── Corridor band ──────────────────────────────────────────────────────────
  { id: 6010, name: 'OPS Room 1',                  type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 235, y: 380 }, { x: 395, y: 380 }, { x: 395, y: 420 }, { x: 235, y: 420 }] },
  { id: 6011, name: 'OPS Room 2',                  type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 395, y: 380 }, { x: 555, y: 380 }, { x: 555, y: 420 }, { x: 395, y: 420 }] },
  { id: 6012, name: 'RAF / RADAR ADD EXT Interface Room', type: 'RESTRICTED', color: R, dwell_alert_seconds: 0, is_active: true,
    points: [{ x: 555, y: 380 }, { x: 715, y: 380 }, { x: 715, y: 420 }, { x: 555, y: 420 }] },
  { id: 6013, name: 'Reception Room',              type: 'LOUNGE',     color: L, dwell_alert_seconds: 900,  is_active: true,
    points: [{ x: 715, y: 380 }, { x: 960, y: 380 }, { x: 960, y: 420 }, { x: 715, y: 420 }] },
  // ── Lower band rooms ───────────────────────────────────────────────────────
  { id: 6014, name: 'Janitor / Pantry Room',       type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 235, y: 420 }, { x: 280, y: 420 }, { x: 280, y: 565 }, { x: 235, y: 565 }] },
  { id: 6015, name: 'Electrical Room (FF)',         type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 280, y: 420 }, { x: 350, y: 420 }, { x: 350, y: 565 }, { x: 280, y: 565 }] },
  { id: 6016, name: 'STM Telecom Room',            type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 350, y: 420 }, { x: 465, y: 420 }, { x: 465, y: 565 }, { x: 350, y: 565 }] },
  { id: 6017, name: 'ACC Room — Bay 1',            type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 465, y: 420 }, { x: 555, y: 420 }, { x: 555, y: 565 }, { x: 465, y: 565 }] },
  { id: 6018, name: 'ACC Room — Bay 2',            type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 555, y: 420 }, { x: 645, y: 420 }, { x: 645, y: 565 }, { x: 555, y: 565 }] },
  { id: 6019, name: 'ACC Room — Bay 3',            type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 645, y: 420 }, { x: 735, y: 420 }, { x: 735, y: 565 }, { x: 645, y: 565 }] },
  { id: 6020, name: 'ACC Room — Bay 4 (WSO)',      type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 735, y: 420 }, { x: 845, y: 420 }, { x: 845, y: 565 }, { x: 735, y: 565 }] },
  { id: 6021, name: 'APP Room',                    type: 'RESTRICTED', color: R, dwell_alert_seconds: 0,    is_active: true,
    points: [{ x: 845, y: 420 }, { x: 960, y: 420 }, { x: 960, y: 565 }, { x: 845, y: 565 }] },
];


// ═════════════════════════════════════════════════════════════════════════════
// DEFAULT CCTV CAMERA PLACEMENTS — OPTIMIZED NO-BLIND-SPOT COVERAGE
// 42 cameras total: 16 (GF) + 14 (Area A) + 12 (First Floor)
//
// Placement principles:
//   • Corner-mount dome cameras, 110–120° FOV, ~8 m effective range
//   • Corridor sweeps cover multiple door entries (no individual toilet/rest cams)
//   • Every restricted room has at least 1 interior camera
//   • Every entry/exit has a dedicated camera
//   • Privacy rooms (toilets, rest, showers) have NO interior cameras
// ═════════════════════════════════════════════════════════════════════════════

export type CamPreset = {
  id: number;
  x: number;
  y: number;
  angle: number;
  fov: number;
  name: string;
  status: 'ACTIVE' | 'OFFLINE' | 'MAINTENANCE';
  location: string;
  is_overhead: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// GROUND FLOOR — 16 Cameras
// ─────────────────────────────────────────────────────────────────────────────

export const GF_CAMERAS_DEFAULT: CamPreset[] = [
  // ── Entry & West Wing ─────────────────────────────────────────────────────
  // Main Entry: north wall, look SOUTH into building (30px inside wall)
  { id: 7001, x: 595,  y: 110, angle:  90, fov: 110, name: 'GF-CAM-01 Main Entry',       status: 'ACTIVE', location: 'Main North Entry',        is_overhead: true },
  // Porch NW corner: look SE (45°) into porch + lift area
  { id: 7002, x: 105,  y: 110, angle:  45, fov: 110, name: 'GF-CAM-02 Porch / Lift',     status: 'ACTIVE', location: 'Porch NW Corner',          is_overhead: true },
  // Locker: north wall centre, look SOUTH into room
  { id: 7003, x: 252,  y: 110, angle:  90, fov: 110, name: 'GF-CAM-03 Locker Room',      status: 'ACTIVE', location: 'Locker Room North',        is_overhead: true },
  // Canteen NW corner: look SE (45°) across dining hall
  { id: 7004, x: 105,  y: 350, angle:  45, fov: 120, name: 'GF-CAM-04 Canteen NW',       status: 'ACTIVE', location: 'Canteen Dining NW',        is_overhead: true },
  // Canteen SE corner: look NW (225°) to cover other half
  { id: 7005, x: 310,  y: 490, angle: 225, fov: 120, name: 'GF-CAM-05 Canteen SE',       status: 'ACTIVE', location: 'Canteen Dining SE',        is_overhead: true },

  // ── Electrical & Toilet Zone ──────────────────────────────────────────────
  // Electrical: north wall centre, look SOUTH into room
  { id: 7006, x: 445,  y: 110, angle:  90, fov: 110, name: 'GF-CAM-06 Electrical Room',  status: 'ACTIVE', location: 'LT MCC HV Electrical',     is_overhead: true },
  // Central Corridor: mid-corridor, sweep EAST along corridor axis
  { id: 7007, x: 490,  y: 490, angle:   0, fov: 120, name: 'GF-CAM-07 Central Corridor', status: 'ACTIVE', location: 'Toilet Corridor Junction',  is_overhead: true },

  // ── Reception & Storage ───────────────────────────────────────────────────
  // Reception: north wall centre, look SOUTH into lobby
  { id: 7008, x: 750,  y: 110, angle:  90, fov: 120, name: 'GF-CAM-08 Reception',        status: 'ACTIVE', location: 'Reception Lobby',           is_overhead: true },
  // Storage: NW corner of storage room, look SE (45°)
  { id: 7009, x: 655,  y: 450, angle:  45, fov: 110, name: 'GF-CAM-09 Storage / Legal',  status: 'ACTIVE', location: 'Storage Room NW',           is_overhead: true },
  // Monitor Room: NW corner, look SE (45°) into ops area
  { id: 7010, x: 790,  y: 310, angle:  45, fov: 110, name: 'GF-CAM-10 Monitor Room',     status: 'ACTIVE', location: 'Monitor / Dispatch',        is_overhead: true },
  // South Corridor: sweep EAST along south corridor
  { id: 7011, x: 760,  y: 570, angle:   0, fov: 120, name: 'GF-CAM-11 South Corridor',   status: 'ACTIVE', location: 'South Corridor',            is_overhead: true },

  // ── Director Wing (East) ──────────────────────────────────────────────────
  // Data/Server: north wall, look SOUTH into restricted room
  { id: 7012, x: 920,  y: 110, angle:  90, fov: 110, name: 'GF-CAM-12 Data / Server',    status: 'ACTIVE', location: 'Data Office / Server',      is_overhead: true },
  // Workstations: top of area, look SOUTH across open desks
  { id: 7013, x: 980,  y: 270, angle:  90, fov: 120, name: 'GF-CAM-13 Workstations',     status: 'ACTIVE', location: 'Open Work Stations',        is_overhead: true },
  // Office Row: on divider wall, sweep EAST along office row corridor
  { id: 7014, x: 910,  y: 395, angle:   0, fov: 120, name: 'GF-CAM-14 Office Row',       status: 'ACTIVE', location: 'Office Row Corridor',       is_overhead: true },
  // East Wing South: NW corner of AFSB block, look SE (45°)
  { id: 7015, x: 910,  y: 570, angle:  45, fov: 110, name: 'GF-CAM-15 East Wing S',      status: 'ACTIVE', location: 'AFSB / East Gents Entry',   is_overhead: true },
  // Director Reception: NE corner, look SW (135°) into reception
  { id: 7016, x: 1095, y: 110, angle: 135, fov: 110, name: 'GF-CAM-16 Director Recep',   status: 'ACTIVE', location: 'Director Wing Reception',   is_overhead: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// AREA A (INTERMEDIATE) — 14 Cameras
// ─────────────────────────────────────────────────────────────────────────────

export const AA_CAMERAS_DEFAULT: CamPreset[] = [
  // ── CMS Block (West) ──────────────────────────────────────────────────────
  // CMS Maintenance NW corner: look SE (45°) into maintenance area
  { id: 8001, x: 110,  y: 110, angle:  45, fov: 110, name: 'AA-CAM-01 CMS Maintenance',  status: 'ACTIVE', location: 'CMS Maintenance Room',      is_overhead: true },
  // CMS Server SE corner: look NW (225°) across server racks
  { id: 8002, x: 315,  y: 310, angle: 225, fov: 110, name: 'AA-CAM-02 CMS Server',       status: 'ACTIVE', location: 'CMS Server Room',            is_overhead: true },
  // CMS Lower NW corner: look SE (45°)
  { id: 8003, x: 110,  y: 425, angle:  45, fov: 110, name: 'AA-CAM-03 CMS Lower',        status: 'ACTIVE', location: 'CMS Lower Zone',             is_overhead: true },

  // ── Upper Office Band ─────────────────────────────────────────────────────
  // Upper Corridor W: sweep EAST along corridor past pest/RADAR doors
  { id: 8004, x: 360,  y: 215, angle:   0, fov: 120, name: 'AA-CAM-04 Upper Corridor W', status: 'ACTIVE', location: 'Pest + RADAR Entry Sweep',   is_overhead: true },
  // RADAR Interface: north wall, look SOUTH into room
  { id: 8005, x: 555,  y: 110, angle:  90, fov: 110, name: 'AA-CAM-05 RADAR Interface',  status: 'ACTIVE', location: 'RADAR EXT Interface',        is_overhead: true },
  // CHS Executives: north wall, look SOUTH into exec room
  { id: 8006, x: 750,  y: 110, angle:  90, fov: 120, name: 'AA-CAM-06 CHS Executives',   status: 'ACTIVE', location: 'CHS Executives Room',        is_overhead: true },
  // Director Area: north wall, look SOUTH
  { id: 8007, x: 910,  y: 110, angle:  90, fov: 120, name: 'AA-CAM-07 Director Area',    status: 'ACTIVE', location: 'Director + East Corridor',   is_overhead: true },
  // East Locker Corridor: sweep SOUTH along east locker doors
  { id: 8008, x: 1000, y: 215, angle:  90, fov: 120, name: 'AA-CAM-08 East Locker Corr', status: 'ACTIVE', location: 'East Locker Corridor Sweep', is_overhead: true },

  // ── Lower Server Hall ─────────────────────────────────────────────────────
  // All server cams: on north wall of server band, look SOUTH into rooms
  { id: 8009, x: 170,  y: 500, angle:  90, fov: 110, name: 'AA-CAM-09 AMRS Server',      status: 'ACTIVE', location: 'AMRS Server Room',           is_overhead: true },
  { id: 8010, x: 355,  y: 500, angle:  90, fov: 110, name: 'AA-CAM-10 Cyber TAC',        status: 'ACTIVE', location: 'Cyber Security TAC',         is_overhead: true },
  { id: 8011, x: 520,  y: 500, angle:  90, fov: 110, name: 'AA-CAM-11 UHF / CCS',        status: 'ACTIVE', location: 'UHF / CCS Data Room',        is_overhead: true },
  { id: 8012, x: 670,  y: 500, angle:  90, fov: 110, name: 'AA-CAM-12 Battery Room',     status: 'ACTIVE', location: 'UPS Battery Room',           is_overhead: true },
  { id: 8013, x: 825,  y: 500, angle:  90, fov: 110, name: 'AA-CAM-13 Dist Panel',       status: 'ACTIVE', location: 'Distribution Panel Area',    is_overhead: true },
  { id: 8014, x: 1010, y: 500, angle:  90, fov: 110, name: 'AA-CAM-14 Fallback Srv',     status: 'ACTIVE', location: 'Fallback Servers Room',      is_overhead: true },
];

// ─────────────────────────────────────────────────────────────────────────────
// FIRST FLOOR — 12 Cameras
// ─────────────────────────────────────────────────────────────────────────────

export const FF_CAMERAS_DEFAULT: CamPreset[] = [
  // ── Corridor Sweep (covers all room doors) ────────────────────────────────
  // West corridor: sweep EAST along corridor
  { id: 9001, x: 300,  y: 400, angle:   0, fov: 120, name: 'FF-CAM-01 Corridor West',    status: 'ACTIVE', location: 'Corridor West Sweep',       is_overhead: true },
  // Centre corridor: sweep WEST (opposite direction for overlap)
  { id: 9002, x: 600,  y: 400, angle: 180, fov: 120, name: 'FF-CAM-02 Corridor Centre',  status: 'ACTIVE', location: 'Corridor Centre Sweep',     is_overhead: true },
  // East corridor: sweep EAST along corridor
  { id: 9003, x: 760,  y: 400, angle:   0, fov: 120, name: 'FF-CAM-03 Corridor East',    status: 'ACTIVE', location: 'Corridor East Sweep',       is_overhead: true },

  // ── Upper Band (restricted rooms only) ────────────────────────────────────
  // On north wall of their room, look SOUTH into room (y=265 = 30px inside top wall at y=235)
  { id: 9004, x: 340,  y: 265, angle:  90, fov: 110, name: 'FF-CAM-04 Training IC',      status: 'ACTIVE', location: 'Training In-Charge Room',   is_overhead: true },
  { id: 9005, x: 690,  y: 265, angle:  90, fov: 110, name: 'FF-CAM-05 Recreation',       status: 'ACTIVE', location: 'Recreation Room',            is_overhead: true },
  { id: 9006, x: 775,  y: 265, angle:  90, fov: 110, name: 'FF-CAM-06 UPS Battery',      status: 'ACTIVE', location: 'UPS Battery Room',           is_overhead: true },

  // ── Lower Band (critical operations) ──────────────────────────────────────
  // On north wall of their room, look SOUTH (y=450 = 30px inside corridor wall at y=420)
  { id: 9007, x: 410,  y: 450, angle:  90, fov: 110, name: 'FF-CAM-07 STM Telecom',      status: 'ACTIVE', location: 'STM Telecom Room',           is_overhead: true },
  // ACC Bays NW corners, look SE (45°) to cover 2 bays each
  { id: 9008, x: 475,  y: 450, angle:  45, fov: 120, name: 'FF-CAM-08 ACC Bay 1-2',      status: 'ACTIVE', location: 'ACC Bay 1 + Bay 2',          is_overhead: true },
  { id: 9009, x: 655,  y: 450, angle:  45, fov: 120, name: 'FF-CAM-09 ACC Bay 3-4',      status: 'ACTIVE', location: 'ACC Bay 3 + Bay 4',          is_overhead: true },
  // APP Room: north wall, look SOUTH
  { id: 9010, x: 895,  y: 450, angle:  90, fov: 110, name: 'FF-CAM-10 APP Room',         status: 'ACTIVE', location: 'APP Room',                   is_overhead: true },

  // ── Stairwell Monitoring ──────────────────────────────────────────────────
  // West stairwell: look EAST into stairwell
  { id: 9011, x: 255,  y: 310, angle:   0, fov: 110, name: 'FF-CAM-11 Stairwell W',      status: 'ACTIVE', location: 'West Stairwell',             is_overhead: true },
  // East stairwell: look WEST into stairwell
  { id: 9012, x: 945,  y: 310, angle: 180, fov: 110, name: 'FF-CAM-12 Stairwell E',      status: 'ACTIVE', location: 'East Stairwell',             is_overhead: true },
];
