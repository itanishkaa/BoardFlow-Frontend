export type Point = { x: number; y: number };

export type ElementType = 'rectangle' | 'circle' | 'arrow' | 'text' | 'freehand';

export interface BaseElement {
    id: string;
    type: ElementType;
    x: number;
    y: number;
    width: number;
    height: number;
    strokeColor: string;
    fillColor?: string | null;
    strokeWidth: number;
    text?: string;
}

export interface FreehandElement extends BaseElement {
    type: 'freehand';
    points: Point[];
}

export type CanvasElement = BaseElement | FreehandElement;

export interface Camera {
    x: number;
    y: number;
    zoom: number;
}
