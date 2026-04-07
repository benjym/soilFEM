export type ToolMode = 'select' | 'add-node' | 'add-element' | 'add-support' | 'add-load';

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

export interface SupportDraft {
  fixX: boolean;
  fixY: boolean;
}

export interface LoadDraft {
  fx: number;
  fy: number;
}

export interface StructuredMeshDraft {
  width: number;
  height: number;
  divisionsX: number;
  divisionsY: number;
}

export type ContourField = 'none' | 'meanStress' | 'deviatoricStress' | 'sxx' | 'syy' | 'txy' | 'volumetricStrain';

export interface VisualizationState {
  contourField: ContourField;
  deformationScale: number;
  showDeformedMesh: boolean;
  showDisplacementVectors: boolean;
  showReactionVectors: boolean;
}

export interface NodalDisplacementResult {
  nodeId: string;
  ux: number;
  uy: number;
  magnitude: number;
}

export interface NodalReactionResult {
  nodeId: string;
  rx: number;
  ry: number;
  magnitude: number;
}

export interface ElementStrainResult {
  exx: number;
  eyy: number;
  gxy: number;
  volumetric: number;
}

export interface ElementStressResult {
  sxx: number;
  syy: number;
  szz: number;
  txy: number;
  meanStress: number;
  deviatoricStress: number;
}

export interface ElementAnalysisResult {
  elementId: string;
  nodeIds: [string, string, string];
  materialId: string;
  area: number;
  strain: ElementStrainResult;
  stress: ElementStressResult;
}

export interface AnalysisSummary {
  maxDisplacement: number;
  maxReaction: number;
  minMeanStress: number;
  maxMeanStress: number;
  maxDeviatoricStress: number;
}

export interface LinearElasticAnalysisResult {
  displacements: NodalDisplacementResult[];
  reactions: NodalReactionResult[];
  elementResults: ElementAnalysisResult[];
  summary: AnalysisSummary;
}

export interface AnalysisState {
  status: 'idle' | 'success' | 'error';
  result: LinearElasticAnalysisResult | null;
  error: string | null;
}

export interface AppState {
  scene: AnalysisScene;
  tool: ToolMode;
  selection: SelectionState;
  stagedElementNodeIds: string[];
  hoveredNodeId: string | null;
  viewport: ViewportState;
  supportDraft: SupportDraft;
  loadDraft: LoadDraft;
  meshDraft: StructuredMeshDraft;
  visualization: VisualizationState;
  analysis: AnalysisState;
  dirty: boolean;
}
