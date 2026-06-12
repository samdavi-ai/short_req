import math

CAMERA_RANGE = 350

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

def find_blind_spots(cams, active_floor):
    startX = 240 if active_floor == 2 else 80
    endX = 960 if active_floor == 2 else 1120
    startY = 240 if active_floor == 2 else 80
    endY = 560 if active_floor == 2 else 720
    
    stepX = (endX - startX) / 40
    stepY = (endY - startY) / 25
    
    c_list = []
    for c in cams:
        angleRad = math.radians(c["angle"])
        fovRad = math.radians(c["fov"])
        c_list.append({
            "x": c["x"],
            "y": c["y"],
            "angle": angleRad,
            "halfFov": fovRad / 2,
            "rangeSq": CAMERA_RANGE * CAMERA_RANGE
        })

    blind_spots = []
    for i in range(40):
        x = startX + stepX * (i + 0.5)
        for j in range(25):
            y = startY + stepY * (j + 0.5)
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
            if not is_cov:
                blind_spots.append((x, y))
    return blind_spots

spots = find_blind_spots(KEMPEGOWDA_CAMERAS, 0)
print(f"Total blind spots: {len(spots)}")
print("First 20 blind spots:")
for s in spots[:20]:
    print(f"  ({s[0]:.1f}, {s[1]:.1f})")
