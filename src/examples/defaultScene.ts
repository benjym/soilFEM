import type { AnalysisScene } from '../model/types';

export const defaultScene: AnalysisScene = {
  gravity: { enabled: false, x: 0, y: -1 },
  nodes: [
    { id: 'node-1', x: 0, y: 0 },
    { id: 'node-2', x: 240, y: 0 },
    { id: 'node-3', x: 240, y: 120 },
    { id: 'node-4', x: 0, y: 120 },
  ],
  elements: [
    { id: 'element-1', nodeIds: ['node-1', 'node-2', 'node-3'], materialId: 'material-1' },
    { id: 'element-2', nodeIds: ['node-1', 'node-3', 'node-4'], materialId: 'material-1' },
  ],
  supports: [
    { id: 'support-1', nodeId: 'node-1', direction: 'x' },
    { id: 'support-2', nodeId: 'node-1', direction: 'y' },
    { id: 'support-3', nodeId: 'node-4', direction: 'x' },
    { id: 'support-4', nodeId: 'node-4', direction: 'y' },
  ],
  loads: [
    { id: 'load-1', nodeId: 'node-3', fx: 0, fy: -25 },
  ],
  materials: [
    {
      id: 'material-1',
      name: 'Material 1',
      kind: 'linear-elastic-plane-strain',
      youngModulus: 20_000,
      poissonRatio: 0.3,
      density: 1,
    },
  ],
};
