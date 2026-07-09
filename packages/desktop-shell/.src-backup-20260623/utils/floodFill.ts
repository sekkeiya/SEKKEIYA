export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: { r: number, g: number, b: number, a: number },
  tolerance: number = 32
) {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Convert startX/startY to integers
  const x = Math.floor(startX);
  const y = Math.floor(startY);

  if (x < 0 || y < 0 || x >= width || y >= height) return;

  const startIndex = (y * width + x) * 4;
  const targetR = data[startIndex];
  const targetG = data[startIndex + 1];
  const targetB = data[startIndex + 2];
  const targetA = data[startIndex + 3];

  // If the target color is already the fill color, do nothing
  if (
    colorMatch(targetR, targetG, targetB, targetA, fillColor.r, fillColor.g, fillColor.b, fillColor.a, 0)
  ) {
    return;
  }

  const stack: [number, number][] = [[x, y]];
  const visited = new Uint8Array(width * height);

  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    const idx = cy * width + cx;

    if (visited[idx]) continue;
    visited[idx] = 1;

    const pxIndex = idx * 4;
    
    if (colorMatch(data[pxIndex], data[pxIndex+1], data[pxIndex+2], data[pxIndex+3], targetR, targetG, targetB, targetA, tolerance)) {
      data[pxIndex] = fillColor.r;
      data[pxIndex+1] = fillColor.g;
      data[pxIndex+2] = fillColor.b;
      data[pxIndex+3] = fillColor.a;

      if (cx > 0) stack.push([cx - 1, cy]);
      if (cx < width - 1) stack.push([cx + 1, cy]);
      if (cy > 0) stack.push([cx, cy - 1]);
      if (cy < height - 1) stack.push([cx, cy + 1]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function colorMatch(r1: number, g1: number, b1: number, a1: number, r2: number, g2: number, b2: number, a2: number, tolerance: number) {
  return (
    Math.abs(r1 - r2) <= tolerance &&
    Math.abs(g1 - g2) <= tolerance &&
    Math.abs(b1 - b2) <= tolerance &&
    Math.abs(a1 - a2) <= tolerance
  );
}
