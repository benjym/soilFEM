import type { Element, Node } from '../../model/types';

export interface StructuredTriMeshOptions {
  width: number;
  height: number;
  divisionsX: number;
  divisionsY: number;
  materialId: string;
  originX?: number;
  originY?: number;
}

export interface StructuredTriMeshResult {
  nodes: Node[];
  elements: Element[];
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
}

export function generateStructuredTriMesh(options: StructuredTriMeshOptions): StructuredTriMeshResult {
  const { width, height, divisionsX, divisionsY, materialId, originX = 0, originY = 0 } = options;

  if (width <= 0 || height <= 0) {
    throw new Error('Structured mesh dimensions must be positive.');
  }

  assertPositiveInteger(divisionsX, 'divisionsX');
  assertPositiveInteger(divisionsY, 'divisionsY');

  const stepX = width / divisionsX;
  const stepY = height / divisionsY;
  const nodes: Node[] = [];
  const elements: Element[] = [];

  for (let row = 0; row <= divisionsY; row += 1) {
    for (let column = 0; column <= divisionsX; column += 1) {
      const index = row * (divisionsX + 1) + column + 1;
      nodes.push({
        id: `node-${index}`,
        x: originX + column * stepX,
        y: originY + row * stepY,
      });
    }
  }

  let elementIndex = 1;

  for (let row = 0; row < divisionsY; row += 1) {
    for (let column = 0; column < divisionsX; column += 1) {
      const lowerLeft = row * (divisionsX + 1) + column + 1;
      const lowerRight = lowerLeft + 1;
      const upperLeft = lowerLeft + divisionsX + 1;
      const upperRight = upperLeft + 1;

      elements.push({
        id: `element-${elementIndex}`,
        nodeIds: [`node-${lowerLeft}`, `node-${lowerRight}`, `node-${upperRight}`],
        materialId,
      });
      elementIndex += 1;
      elements.push({
        id: `element-${elementIndex}`,
        nodeIds: [`node-${lowerLeft}`, `node-${upperRight}`, `node-${upperLeft}`],
        materialId,
      });
      elementIndex += 1;
    }
  }

  return { nodes, elements };
}