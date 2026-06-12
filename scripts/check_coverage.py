import math

# Cameras from LayoutEditor.tsx (Demo Mode)
KEMPEGOWDA_CAMERAS = [
    { "x": 600, "y":  95, "angle":  90, "fov": 120 },
    { "x": 210, "y": 210, "angle": 135, "fov": 120 },
    { "x": 210, "y": 590, "angle": 315, "fov": 120 },
    { "x": 100, "y": 100, "angle":  45, "fov": 120 },
    { "x": 360, "y": 100, "angle":  45, "fov": 120 },
    { "x": 360, "y": 400, "angle":   0, "fov": 110 },
    { "x": 620, "y": 400, "angle": 180, "fov": 110 },
    { "x": 570, "y": 300, "angle":  90, "fov": 120 },
    { "x": 650, "y": 100, "angle":  45, "fov": 120 },
    { "x": 840, "y": 100, "angle": 225, "fov": 120 },
    { "x": 750, "y": 540, "angle": 225, "fov": 120 },
    { "x": 880, "y": 540, "angle": 135, "fov": 120 },
    { "x": 910, "y": 420, "angle":  45, "fov": 120 },
    { "x": 1100, "y": 100, "angle": 225, "fov": 120 }
]

ALPHA2_AREA_A_CAMERAS = [
    { "x":  90, "y": 310, "angle":  45, "fov": 120 },
    { "x": 330, "y": 480, "angle": 225, "fov": 120 },
    { "x":  90, "y":  90, "angle":  45, "fov": 120 },
    { "x": 630, "y":  90, "angle":  45, "fov": 120 },
    { "x": 850, "y": 290, "angle": 225, "fov": 120 },
    { "x": 350, "y": 310, "angle":  45, "fov": 120 },
    { "x":  90, "y": 710, "angle":  45, "fov": 120 },
    { "x": 580, "y": 710, "angle": 315, "fov": 120 },
    { "x": 260, "y": 500, "angle":  90, "fov": 120 },
    { "x": 580, "y": 500, "angle":  90, "fov": 120 },
    { "x": 730, "y": 710, "angle": 315, "fov": 120 },
    { "x": 1110, "y": 710, "angle": 135, "fov": 120 }
]

ALPHA2_FF_CAMERAS = [
    { "x": 240, "y": 240, "angle": 45,  "fov": 110 },
    { "x": 240, "y": 400, "angle": 0,   "fov": 100 },
    { "x": 240, "y": 560, "angle": 315, "fov": 110 },
    { "x": 816, "y": 240, "angle": 135, "fov": 110 },
    { "x": 960, "y": 400, "angle": 180, "fov": 100 },
    { "x": 960, "y": 560, "angle": 225, "fov": 110 },
    { "x": 456, "y": 240, "angle": 90,  "fov": 120 },
    { "x": 600, "y": 240, "angle": 90,  "fov": 120 },
    { "x": 888, "y": 240, "angle": 90,  "fov": 120 },
    { "x": 420, "y": 560, "angle": 270, "fov": 120 },
    { "x": 660, "y": 560, "angle": 270, "fov": 120 },
    { "x": 780, "y": 560, "angle": 270, "fov": 120 }
]

# Cameras from seed_alpha2.py (Database Mode)
DB_GF_CAMERAS = [
    { "x": 110, "y": 120, "angle": 135, "fov": 90 },
    { "x": 110, "y": 400, "angle":  45, "fov": 90 },
    { "x": 300, "y": 120, "angle": 180, "fov": 90 },
    { "x": 450, "y": 120, "angle": 180, "fov": 90 },
    { "x": 600, "y": 120, "angle": 180, "fov": 90 },
    { "x": 550, "y": 400, "angle":   0, "fov": 90 },
    { "x": 450, "y": 550, "angle": 315, "fov": 90 },
    { "x": 850, "y": 120, "angle": 225, "fov": 90 },
    { "x": 1050, "y": 120, "angle": 270, "fov": 90 },
    { "x": 1050, "y": 600, "angle": 180, "fov": 90 },
    { "x": 800, "y": 600, "angle":  90, "fov": 90 },
    { "x": 110, "y": 660, "angle": 315, "fov": 90 }
]

DB_AA_CAMERAS = [
    { "x": 110, "y": 120, "angle": 135, "fov": 90 },
    { "x": 200, "y": 350, "angle":  90, "fov": 90 },
    { "x": 380, "y": 120, "angle": 180, "fov": 90 },
    { "x": 550, "y": 120, "angle": 180, "fov": 90 },
    { "x": 800, "y": 120, "angle": 225, "fov": 90 },
    { "x": 1050, "y": 120, "angle": 270, "fov": 90 },
    { "x": 500, "y": 380, "angle":   0, "fov": 110 },
    { "x": 750, "y": 380, "angle": 315, "fov": 90 },
    { "x": 300, "y": 550, "angle":  45, "fov": 90 },
    { "x": 600, "y": 550, "angle":   0, "fov": 90 },
    { "x": 900, "y": 550, "angle": 315, "fov": 90 },
    { "x": 1050, "y": 650, "angle": 315, "fov": 90 }
]

DB_FF_CAMERAS = ALPHA2_FF_CAMERAS # same

def check_coverage(cams, active_floor, camera_range):
    startX = 240 if active_floor == 2 else 80
    endX = 960 if active_floor == 2 else 1120
    startY = 240 if active_floor == 2 else 80
    endY = 560 if active_floor == 2 else 720
    
    stepX = (endX - startX) / 40
    stepY = (endY - startY) / 25
    
    total = 0
    covered = 0
    
    c_list = []
    for c in cams:
        angleRad = math.radians(c["angle"])
        fovRad = math.radians(c["fov"])
        c_list.append({
            "x": c["x"],
            "y": c["y"],
            "angle": angleRad,
            "halfFov": fovRad / 2,
            "rangeSq": camera_range * camera_range
        })
        
    for i in range(40):
        x = startX + stepX * (i + 0.5)
        for j in range(25):
            y = startY + stepY * (j + 0.5)
            total += 1
            is_cov = False
            for c in c_list:
                dx = x - c["x"]
                dy = y - c["y"]
                distSq = dx*dx + dy*dy
                if distSq <= c["rangeSq"]:
                    angleToPoint = math.atan2(dy, dx)
                    diff = angleToPoint - c["angle"]
                    while diff < -math.pi: diff += math.pi * 2
                    while diff > math.pi: diff -= math.pi * 2
                    if abs(diff) <= c["halfFov"]:
                        is_cov = True
                        break
            if is_cov:
                covered += 1
                
    return (covered / total) * 100

for rng in [200, 250, 300, 350, 400, 450, 500]:
    print(f"\n================ RANGE = {rng} ================")
    print("DEMO MODE COVERAGE:")
    print(f"  Ground Floor: {check_coverage(KEMPEGOWDA_CAMERAS, 0, rng):.2f}%")
    print(f"  Area A:       {check_coverage(ALPHA2_AREA_A_CAMERAS, 1, rng):.2f}%")
    print(f"  First Floor:  {check_coverage(ALPHA2_FF_CAMERAS, 2, rng):.2f}%")
    
    print("DATABASE MODE COVERAGE:")
    print(f"  Ground Floor: {check_coverage(DB_GF_CAMERAS, 0, rng):.2f}%")
    print(f"  Area A:       {check_coverage(DB_AA_CAMERAS, 1, rng):.2f}%")
    print(f"  First Floor:  {check_coverage(DB_FF_CAMERAS, 2, rng):.2f}%")
