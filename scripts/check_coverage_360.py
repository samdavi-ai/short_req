import math

# Cameras from LayoutEditor.tsx (Demo Mode) but with 360 FOV
KEMPEGOWDA_CAMERAS = [
    { "x": 600, "y":  95, "angle":  90, "fov": 360 },
    { "x": 210, "y": 210, "angle": 135, "fov": 360 },
    { "x": 210, "y": 590, "angle": 315, "fov": 360 },
    { "x": 100, "y": 100, "angle":  45, "fov": 360 },
    { "x": 360, "y": 100, "angle":  45, "fov": 360 },
    { "x": 360, "y": 400, "angle":   0, "fov": 360 },
    { "x": 620, "y": 400, "angle": 180, "fov": 360 },
    { "x": 570, "y": 300, "angle":  90, "fov": 360 },
    { "x": 650, "y": 100, "angle":  45, "fov": 360 },
    { "x": 840, "y": 100, "angle": 225, "fov": 360 },
    { "x": 750, "y": 540, "angle": 225, "fov": 360 },
    { "x": 880, "y": 540, "angle": 135, "fov": 360 },
    { "x": 910, "y": 420, "angle":  45, "fov": 360 },
    { "x": 1100, "y": 100, "angle": 225, "fov": 360 }
]

ALPHA2_AREA_A_CAMERAS = [
    { "x":  90, "y": 310, "angle":  45, "fov": 360 },
    { "x": 330, "y": 480, "angle": 225, "fov": 360 },
    { "x":  90, "y":  90, "angle":  45, "fov": 360 },
    { "x": 630, "y":  90, "angle":  45, "fov": 360 },
    { "x": 850, "y": 290, "angle": 225, "fov": 360 },
    { "x": 350, "y": 310, "angle":  45, "fov": 360 },
    { "x":  90, "y": 710, "angle":  45, "fov": 360 },
    { "x": 580, "y": 710, "angle": 315, "fov": 360 },
    { "x": 260, "y": 500, "angle":  90, "fov": 360 },
    { "x": 580, "y": 500, "angle":  90, "fov": 360 },
    { "x": 730, "y": 710, "angle": 315, "fov": 360 },
    { "x": 1110, "y": 710, "angle": 135, "fov": 360 }
]

ALPHA2_FF_CAMERAS = [
    { "x": 240, "y": 240, "angle": 45,  "fov": 360 },
    { "x": 240, "y": 400, "angle": 0,   "fov": 360 },
    { "x": 240, "y": 560, "angle": 315, "fov": 360 },
    { "x": 816, "y": 240, "angle": 135, "fov": 360 },
    { "x": 960, "y": 400, "angle": 180, "fov": 360 },
    { "x": 960, "y": 560, "angle": 225, "fov": 360 },
    { "x": 456, "y": 240, "angle": 90,  "fov": 360 },
    { "x": 600, "y": 240, "angle": 90,  "fov": 360 },
    { "x": 888, "y": 240, "angle": 90,  "fov": 360 },
    { "x": 420, "y": 560, "angle": 270, "fov": 360 },
    { "x": 660, "y": 560, "angle": 270, "fov": 360 },
    { "x": 780, "y": 560, "angle": 270, "fov": 360 }
]

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

for rng in [200, 250, 300, 350, 400]:
    print(f"\n================ RANGE = {rng} ================")
    print("360 FOV DEMO MODE COVERAGE:")
    print(f"  Ground Floor: {check_coverage(KEMPEGOWDA_CAMERAS, 0, rng):.2f}%")
    print(f"  Area A:       {check_coverage(ALPHA2_AREA_A_CAMERAS, 1, rng):.2f}%")
    print(f"  First Floor:  {check_coverage(ALPHA2_FF_CAMERAS, 2, rng):.2f}%")
