// Building shape geometry utilities

export type Point2D = [number, number];

// Preset shape templates: fractions of [buildingWidth/2, buildingDepth/2]
export const PRESET_SHAPES: Record<string, Point2D[]> = {
  rectangle: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]],
  lShape: [
    [-0.5, -0.5], [0.5, -0.5], [0.5, 0],
    [0, 0], [0, 0.5], [-0.5, 0.5],
  ],
  uShape: [
    [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5],
    [0.2, 0.5], [0.2, 0], [-0.2, 0], [-0.2, 0.5], [-0.5, 0.5],
  ],
};

/** Convert preset shape to logical coords (meters from canvas center), rotated by northAngle */
export function getPresetPoints(
  preset: string,
  w: number,
  d: number,
  northAngle: number,
): Point2D[] {
  const template = PRESET_SHAPES[preset] ?? PRESET_SHAPES.rectangle;
  const angle = northAngle * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return template.map(([fx, fy]) => {
    const lx = fx * w;
    const ly = fy * d;
    return [lx * cos - ly * sin, lx * sin + ly * cos];
  });
}

/** Convert logical point (meters from center) to canvas pixel */
export function logicalToCanvas(lx: number, ly: number, cx: number, cy: number, scale: number): Point2D {
  return [cx + lx * scale, cy - ly * scale];
}

/** Convert canvas pixel to logical point */
export function canvasToLogical(px: number, py: number, cx: number, cy: number, scale: number): Point2D {
  return [(px - cx) / scale, -(py - cy) / scale];
}

/** Graham scan convex hull */
export function convexHull(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;
  const pts = [...points].sort(([ax, ay], [bx, by]) => ax !== bx ? ax - bx : ay - by);
  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Point2D[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point2D[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}
