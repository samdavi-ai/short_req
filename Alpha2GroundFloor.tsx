import React from "react";
import { Stage, Layer, Line, Text } from "react-konva";

type Wall = {
  x1:number;
  y1:number;
  x2:number;
  y2:number;
};

// Replace with walls extracted from DXF
const walls: Wall[] = [
  { x1:0, y1:0, x2:16544.544, y2:0 },
  { x1:16544.544, y1:0, x2:16544.544, y2:7620 },
  { x1:16544.544, y1:7620, x2:0, y2:7620 },
  { x1:0, y1:7620, x2:0, y2:0 },
];

export default function Alpha2GroundFloor() {
  const scale = 0.05;

  return (
    <Stage width={1200} height={700}>
      <Layer>
        {walls.map((w, i) => (
          <Line
            key={i}
            points={[
              w.x1 * scale,
              w.y1 * scale,
              w.x2 * scale,
              w.y2 * scale,
            ]}
            stroke="black"
            strokeWidth={2}
          />
        ))}

        <Text
          text="ALPHA-2 Ground Floor"
          x={20}
          y={20}
          fontSize={24}
        />
      </Layer>
    </Stage>
  );
}
