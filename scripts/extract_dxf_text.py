import sys

def extract_dxf_text(filepath):
    print(f"--- Extracting text from {filepath} ---")
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        lines = [line.strip() for line in f.readlines()]
    
    i = 0
    texts = []
    while i < len(lines) - 1:
        # DXF alternating group code and value
        code = lines[i]
        val = lines[i+1]
        if code == '0' and (val == 'TEXT' or val == 'MTEXT'):
            # Found a text entity! Let's search its properties in the next lines until we hit another entity (code 0)
            text_val = ""
            x = 0.0
            y = 0.0
            layer = ""
            i += 2
            while i < len(lines) - 1:
                sub_code = lines[i]
                sub_val = lines[i+1]
                if sub_code == '0':
                    # Start of next entity
                    break
                elif sub_code == '1': # Text value
                    text_val = sub_val
                elif sub_code == '10': # X coordinate
                    try: x = float(sub_val)
                    except: pass
                elif sub_code == '20': # Y coordinate
                    try: y = float(sub_val)
                    except: pass
                elif sub_code == '8': # Layer
                    layer = sub_val
                i += 2
            if text_val:
                texts.append({"text": text_val, "x": x, "y": y, "layer": layer})
        else:
            i += 1
            
    # Print sorted by Y coordinate descending, then X coordinate ascending
    for t in sorted(texts, key=lambda k: (-k['y'], k['x'])):
        print(f"Layer: {t['layer']:<15} Pos: ({t['x']:>10.2f}, {t['y']:>10.2f}) Text: {t['text']}")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python extract_dxf_text.py <dxf_file>")
    else:
        extract_dxf_text(sys.argv[1])
