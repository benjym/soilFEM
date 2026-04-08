export type ToolMode = 'select' | 'add-node' | 'add-element' | 'add-support-x' | 'add-support-y' | 'add-load';

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

export type SupportDirection = 'x' | 'y';

export interface Support {
  id: string;
  nodeId: string;
  direction: SupportDirection;
}

export interface NodalLoad {
  id: string;
  nodeId: string;
  fx: number;
  fy: number;
}

export interface LinearElasticPlaneStrainMaterial {
  id: string;
  name: string;
  kind: 'linear-elastic-plane-strain';
  youngModulus: number;
  poissonRatio: number;
  density: number;
}

export interface DruckerPragerPlaneStrainMaterial {
  id: string;
  name: string;
  kind: 'drucker-prager-plane-strain';
  youngModulus: number;
  poissonRatio: number;
  density: number;
  beta: number;
  mu: number;
  exponent: number;
  loadSteps?: number;
  maxIterations?: number;
  tolerance?: number;
}

export interface TerraCottaPlaneStrainMaterial {
  id: string;
  name: string;
  kind: 'terra-cotta-plane-strain';
  bulkModulus: number;
  shearModulus: number;
  density: number;
  initialConfinement: number;
  solidFraction: number;
  mesoTemperature: number;
  energyCoupling: number;
  criticalStateSlope: number;
  omega: number;
  compressionIndex: number;
  referenceSolidFraction: number;
  volumetricCoefficient: number;
  deviatoricCoefficient: number;
  dissipation: number;
  loadSteps?: number;
  maxIterations?: number;
  tolerance?: number;
}

export type Material = LinearElasticPlaneStrainMaterial | DruckerPragerPlaneStrainMaterial | TerraCottaPlaneStrainMaterial;
export type MaterialKind = Material['kind'];

export type MaterialNumericField =
  | 'youngModulus'
  | 'poissonRatio'
  | 'bulkModulus'
  | 'shearModulus'
  | 'density'
  | 'beta'
  | 'mu'
  | 'exponent'
  | 'initialConfinement'
  | 'solidFraction'
  | 'mesoTemperature'
  | 'energyCoupling'
  | 'criticalStateSlope'
  | 'omega'
  | 'compressionIndex'
  | 'referenceSolidFraction'
  | 'volumetricCoefficient'
  | 'deviatoricCoefficient'
  | 'dissipation'
  | 'loadSteps'
  | 'maxIterations'
  | 'tolerance';

export interface GravitySettings {
  enabled: boolean;
  x: number;
  y: number;
}

export interface AnalysisScene {
  nodes: Node[];
  elements: Element[];
  supports: Support[];
  loads: NodalLoad[];
  materials: Material[];
  gravity: GravitySettings;
}

export interface SelectionState {
  nodeIds: string[];
  elementIds: string[];
  supportIds: string[];
  loadIds: string[];
}

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
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
  activeMaterialId: string | null;
  loadDraft: LoadDraft;
  meshDraft: StructuredMeshDraft;
  visualization: VisualizationState;
  analysis: AnalysisState;
  dirty: boolean;
}
