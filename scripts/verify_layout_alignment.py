import re
import sys

def parse_zones(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    def extract_array(name):
        match = re.search(r'const\s+' + name + r'\s*:\s*ZoneOnCanvas\[\]\s*=\s*\[(.*?)\];', content, re.DOTALL)
        if not match:
            match = re.search(r'export\s+const\s+' + name + r'\s*:\s*ZoneOnCanvas\[\]\s*=\s*\[(.*?)\];', content, re.DOTALL)
        if not match:
            match = re.search(r'const\s+' + name + r'\s*=\s*\[(.*?)\];', content, re.DOTALL)
        if not match:
            return []
        
        array_content = match.group(1)
        zones = []
        zone_matches = re.finditer(r'\{\s*id:\s*(\d+),\s*name:\s*[\'"]([^\'"]+)[\'"].*?points:\s*\[(.*?)\]\s*\}', array_content, re.DOTALL)
        for zm in zone_matches:
            zid = int(zm.group(1))
            name_str = zm.group(2)
            pts_str = zm.group(3)
            pts = []
            pt_matches = re.finditer(r'\{\s*x:\s*([\d\.-]+),\s*y:\s*([\d\.-]+)\s*\}', pts_str)
            for pm in pt_matches:
                pts.append({"x": float(pm.group(1)), "y": float(pm.group(2))})
            zones.append({"id": zid, "name": name_str, "points": pts})
        return zones

    return {
        "GF": extract_array('GF_ZONES_ACCURATE'),
        "FF": extract_array('FF_ZONES_ACCURATE')
    }

def get_extents(walls):
    xs = []
    ys = []
    for w in walls:
        xs.extend([w['startX'], w['endX']])
        ys.extend([w['startY'], w['endY']])
    if not xs or not ys:
        return {"minX": 0, "minY": 0, "maxX": 1, "maxY": 1}
    return {
        "minX": min(xs),
        "minY": min(ys),
        "maxX": max(xs),
        "maxY": max(ys)
    }

def is_point_in_polygon(px, py, vertices):
    inside = False
    for i in range(len(vertices)):
        j = (i - 1) % len(vertices)
        xi, yi = vertices[i]['x'], vertices[i]['y']
        xj, yj = vertices[j]['x'], vertices[j]['y']
        intersect = ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi)
        if intersect:
            inside = not inside
    return inside

def get_fitted_labels(raw_walls, fitted_walls, labels, flip_y=False):
    raw = get_extents(raw_walls)
    fitted = get_extents(fitted_walls)
    
    rawW = max(1.0, raw["maxX"] - raw["minX"])
    rawH = max(1.0, raw["maxY"] - raw["minY"])
    fitW = max(1.0, fitted["maxX"] - fitted["minX"])
    fitH = max(1.0, fitted["maxY"] - fitted["minY"])
    
    sx = fitW / rawW
    sy = fitH / rawH
    
    fitted_labels = []
    for label in labels:
        lx = fitted["minX"] + (label["x"] - raw["minX"]) * sx
        
        # If flip_y is True, map label Y from Y-up to Y-down relative to the bounding box
        if flip_y:
            ly = fitted["minY"] + (raw["maxY"] - label["y"]) * sy
        else:
            ly = fitted["minY"] + (label["y"] - raw["minY"]) * sy
            
        fitted_labels.append({
            "text": label["text"],
            "x": lx,
            "y": ly,
            "orig_x": label["x"],
            "orig_y": label["y"]
        })
    return fitted_labels

def main():
    accurate_data_path = "/Users/samdavi/projects/short_req/frontend/src/features/layout-engine/templates/accurateBlueprintData.ts"
    dxf_templates_path = "/Users/samdavi/projects/short_req/frontend/src/features/layout-engine/templates/alpha2DxfTemplates.ts"
    
    with open(dxf_templates_path, 'r') as f:
        dxf_content = f.read()
        
    def parse_dxf_array(array_name):
        match = re.search(r'export const ' + array_name + r' = \[(.*?)\] as const;', dxf_content, re.DOTALL)
        if not match:
            match = re.search(r'export const ' + array_name + r' = \[(.*?)\];', dxf_content, re.DOTALL)
        if not match:
            return []
        inner = match.group(1)
        items = []
        for m in re.finditer(r'\{([^\}]+)\}', inner):
            props = {}
            for prop in re.finditer(r'(\w+):\s*([^,]+)', m.group(1)):
                name = prop.group(1)
                val = prop.group(2).strip().strip("'\"")
                try:
                    if '.' in val or ('e' in val and val.replace('e','').replace('-','').isdigit()):
                        props[name] = float(val)
                    else:
                        props[name] = int(val)
                except:
                    props[name] = val
            items.append(props)
        return items

    raw_gf_walls = parse_dxf_array('ALPHA2_GROUND_WALLS_DXF')
    raw_gf_labels = parse_dxf_array('ALPHA2_GROUND_LABELS_DXF')
    raw_ff_walls = parse_dxf_array('ALPHA2_FIRST_WALLS_DXF')
    raw_ff_labels = parse_dxf_array('ALPHA2_FIRST_LABELS_DXF')
    
    zones = parse_zones(accurate_data_path)
    
    # Target Canvas Wall bounds from accurateBlueprintData.ts
    gf_walls_fitted = [
        {"startX": 80, "startY": 80, "endX": 1120, "endY": 80},
        {"startX": 80, "startY": 80, "endX": 80, "endY": 720},
        {"startX": 1120, "startY": 80, "endX": 1120, "endY": 720},
        {"startX": 80, "startY": 720, "endX": 1120, "endY": 720}
    ]
    
    ff_walls_fitted = [
        {"startX": 235, "startY": 235, "endX": 960, "endY": 235},
        {"startX": 235, "startY": 235, "endX": 235, "endY": 565},
        {"startX": 960, "startY": 235, "endX": 960, "endY": 565},
        {"startX": 235, "startY": 565, "endX": 960, "endY": 565}
    ]

    # Map labels to fitted walls with flip_y=True
    print("=================== WITH FLIP Y = True ===================")
    gf_fitted_labels = get_fitted_labels(raw_gf_walls, gf_walls_fitted, raw_gf_labels, flip_y=True)
    ff_fitted_labels = get_fitted_labels(raw_ff_walls, ff_walls_fitted, raw_ff_labels, flip_y=True)
    
    # ── Report Ground Floor ──
    print("\n--- GROUND FLOOR LABELS VS PREDEFINED ZONES ---")
    gf_room_zones = zones['GF']
    gf_name_labels = [l for l in gf_fitted_labels if not re.match(r'^\d+[\'\d"]*x\d+', l['text'])]
    for label in gf_name_labels:
        matched_zone = None
        for zone in gf_room_zones:
            if is_point_in_polygon(label['x'], label['y'], zone['points']):
                matched_zone = zone
                break
        if matched_zone:
            print(f"Label: '{label['text']}' falls into Zone: '{matched_zone['name']}' (ID: {matched_zone['id']})")
        else:
            print(f"Label: '{label['text']}' at ({label['x']:.1f}, {label['y']:.1f}) is OUTSIDE any Ground Floor zone!")

    # ── Report First Floor ──
    print("\n--- FIRST FLOOR LABELS VS PREDEFINED ZONES ---")
    ff_room_zones = zones['FF']
    ff_name_labels = [l for l in ff_fitted_labels if not re.match(r'^\d+[\'\d"]*x\d+', l['text'])]
    for label in ff_name_labels:
        matched_zone = None
        for zone in ff_room_zones:
            if is_point_in_polygon(label['x'], label['y'], zone['points']):
                matched_zone = zone
                break
        if matched_zone:
            print(f"Label: '{label['text']}' falls into Zone: '{matched_zone['name']}' (ID: {matched_zone['id']})")
        else:
            print(f"Label: '{label['text']}' at ({label['x']:.1f}, {label['y']:.1f}) is OUTSIDE any First Floor zone!")

if __name__ == '__main__':
    main()
