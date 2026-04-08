import { describe, expect, it } from 'vitest';
import { generateStructuredTriMesh } from './structuredTriMesh';

describe('generateStructuredTriMesh', () => {
  it('creates the expected node and element counts', () => {
    const mesh = generateStructuredTriMesh({
      width: 200,
      height: 100,
      divisionsX: 4,
      divisionsY: 2,
      materialId: 'material-1',
    });

    expect(mesh.nodes).toHaveLength(15);
    expect(mesh.elements).toHaveLength(16);
    expect(mesh.nodes[0]).toMatchObject({ id: 'node-1', x: 0, y: 0 });
    expect(mesh.nodes.at(-1)).toMatchObject({ id: 'node-15', x: 200, y: 100 });
    expect(mesh.elements[0]).toMatchObject({
      id: 'element-1',
      nodeIds: ['node-1', 'node-2', 'node-7'],
      materialId: 'material-1',
    });
  });
});