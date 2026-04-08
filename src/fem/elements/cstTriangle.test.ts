import type { Node } from '../../model/types';
import { describe, expect, it } from 'vitest';
import { computeCstTriangleKinematics, recoverCstTriangleStrain } from './cstTriangle';

describe('cstTriangle', () => {
  it('recovers a constant strain field exactly for a unit right triangle', () => {
    const nodes: [Node, Node, Node] = [
      { id: 'node-1', x: 0, y: 0 },
      { id: 'node-2', x: 1, y: 0 },
      { id: 'node-3', x: 0, y: 1 },
    ];
    const strain = recoverCstTriangleStrain(nodes, [0, 0, 0.01, 0.015, 0.015, 0.02]);

    expect(strain[0]).toBeCloseTo(0.01, 12);
    expect(strain[1]).toBeCloseTo(0.02, 12);
    expect(strain[2]).toBeCloseTo(0.03, 12);
  });

  it('computes positive area for the example unit triangle', () => {
    const nodes: [Node, Node, Node] = [
      { id: 'node-1', x: 0, y: 0 },
      { id: 'node-2', x: 1, y: 0 },
      { id: 'node-3', x: 0, y: 1 },
    ];
    const kinematics = computeCstTriangleKinematics(nodes);

    expect(kinematics.area).toBeCloseTo(0.5, 12);
  });
});
