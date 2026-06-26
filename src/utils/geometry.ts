import type { CanvasElement, Point } from "../types";

// Helper math utility to check the exact distance between a clicked point and a line segment
const distanceToLineSegment = (p: Point, a: Point, b: Point): number => {
  const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
  if (l2 === 0)
    return Math.sqrt(Math.pow(p.x - a.x, 2) + Math.pow(p.y - a.y, 2));

  // Calculate projection projection parameter t clamped between 0 and 1
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  // Find the closest point coordinates along the segment path line
  const closestPoint = {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };

  return Math.sqrt(
    Math.pow(p.x - closestPoint.x, 2) + Math.pow(p.y - closestPoint.y, 2),
  );
};

const getDistance = (a: Point, b: Point): number =>
  Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

const isClosedFreehandPath = (points: Point[]): boolean => {
  if (points.length < 4) return false;
  return getDistance(points[0], points[points.length - 1]) <= 24;
};

const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let isInside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i];
    const previous = polygon[j];
    const crossesY = current.y > point.y !== previous.y > point.y;
    const xAtY =
      ((previous.x - current.x) * (point.y - current.y)) /
        (previous.y - current.y) +
      current.x;

    if (crossesY && point.x < xAtY) {
      isInside = !isInside;
    }
  }

  return isInside;
};

export const getElementAtPosition = (
  elements: CanvasElement[],
  point: Point,
): CanvasElement | null => {
  // Loop backward to select the topmost layered elements first
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];

    if (el.type === "rectangle") {
      if (
        point.x >= el.x &&
        point.x <= el.x + el.width &&
        point.y >= el.y &&
        point.y <= el.y + el.height
      ) {
        return el;
      }
    } else if (el.type === "circle") {
      const radiusX = Math.abs(el.width / 2);
      const radiusY = Math.abs(el.height / 2);
      const centerX = el.x + radiusX;
      const centerY = el.y + radiusY;

      const normalizedX = Math.pow(point.x - centerX, 2) / Math.pow(radiusX, 2);
      const normalizedY = Math.pow(point.y - centerY, 2) / Math.pow(radiusY, 2);

      if (normalizedX + normalizedY <= 1) {
        return el;
      }
    } else if (el.type === "arrow") {
      const targetX = el.x + el.width;
      const targetY = el.y + el.height;

      const distance = distanceToLineSegment(
        point,
        { x: el.x, y: el.y },
        { x: targetX, y: targetY },
      );
      if (distance <= 8) {
        // 8px tolerance window
        return el;
      }
    } else if (el.type === "text") {
      // Basic bounding box check for text nodes
      const textWidth = el.width || 120;
      const textHeight = el.height || 24;
      if (
        point.x >= el.x &&
        point.x <= el.x + textWidth &&
        point.y >= el.y &&
        point.y <= el.y + textHeight
      ) {
        return el;
      }
    } else if (el.type === "freehand") {
      // ✏️ NEW: Check click proximity against all vectors inside the pen points array
      const points = (el as any).points || [];
      if (isClosedFreehandPath(points) && isPointInPolygon(point, points)) {
        return el;
      }

      for (let j = 0; j < points.length - 1; j++) {
        const dist = distanceToLineSegment(point, points[j], points[j + 1]);
        if (dist <= 8) {
          // If mouse is within 8 pixels of any segment, select it!
          return el;
        }
      }
    }
  }
  return null;
};
