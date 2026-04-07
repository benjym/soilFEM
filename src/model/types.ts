export type ToolMode = 'select' | 'add-node' | 'add-element';

export interface Node {
  id: string;
  x: number;
  y: number;
}

export interface Element {
  id: string;
  nodeIds: [string, string, string];
  materialId: string;
}

export interface Support {
  nodeId: string;
  fixX: boolean;
  fixY: boolean;
}

export interface NodalLoad {
  id: string;
  nodeId: string;
  fx: number;
  fy: number;
}

export interface Material {
  id: string;
  name: string;
  kind: 'linear-elastic-plane-strain';
  youngModulus: number;
  poissonRatio: number;
}

export interface AnalysisScene {
  nodes: Node[];
  elements: Element[];
  supports: Support[];
  loads: NodalLoad[];
  materials: Material[];
}

export interface SelectionState {
  nodeIds: string[];
  elementIds: string[];
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface AppState {
  scene: AnalysisScene;
  tool: ToolMode;
  selection: SelectionState;
  stagedElementNodeIds: string[];
  hoveredNodeId: string | null;
  viewport: ViewportState;
  dirty: boolean;
}
