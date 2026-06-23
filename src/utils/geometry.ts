import type { CanvasElement, Point } from "../types";

export const getElementAtPosition = (
  elements: CanvasElement[],
  point: Point
): CanvasElement | null => {
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
      
      const A = point.x - el.x;
      const B = point.y - el.y;
      const C = targetX - el.x;
      const D = targetY - el.y;
      
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      let param = -1;
      
      if (lenSq !== 0) param = dot / lenSq;
      
      let xx, yy;
      if (param < 0) {
        xx = el.x;
        yy = el.y;
      } else if (param > 1) {
        xx = targetX;
        yy = targetY;
      } else {
        xx = el.x + param * C;
        yy = el.y + param * D;
      }
      
      const dx = point.x - xx;
      const dy = point.y - yy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 6) return el;
    } else if (el.type === "text" && el.text) {
      const lines = el.text.split("\n");
      const width = Math.max(el.width, ...lines.map((line) => line.length * 9));
      const height = Math.max(el.height, lines.length * 20);

      if (
        point.x >= el.x &&
        point.x <= el.x + width &&
        point.y >= el.y &&
        point.y <= el.y + height
      ) {
        return el;
      }
    }
  }
  return null;
};
