import { defaultScene } from '../examples/defaultScene';
import { solveLinearElasticPlaneStrain } from '../fem/solver/solveLinearElasticPlaneStrain';
import { generateStructuredTriMesh } from '../mesh/generators/structuredTriMesh';
import type {
  AnalysisState,
  AnalysisScene,
  AppState,
  ContourField,
  Element,
  LoadDraft,
  Material,
  MaterialKind,
  MaterialNumericField,
  Node,
  SelectionState,
  StructuredMeshDraft,
  SupportDirection,
  ToolMode,
  VisualizationState,
  ViewportState,
} from '../model/types';

type Listener = (state: AppState) => void;

const initialViewport: ViewportState = {
  zoom: 1.5,
  panX: 240,
  panY: 360,
};

const initialLoadDraft: LoadDraft = {
  fx: 0,
  fy: -25,
};

const initialMeshDraft: StructuredMeshDraft = {
  width: 240,
  height: 120,
  divisionsX: 4,
  divisionsY: 2,
};

const initialVisualization: VisualizationState = {
  contourField: 'none',
  deformationScale: 1,
  showDeformedMesh: true,
  showDisplacementVectors: true,
  showReactionVectors: false,
};

function createIdleAnalysisState(): AnalysisState {
  return {
    status: 'idle',
    result: null,
    error: null,
  };
}

function createEmptySelectionState(): SelectionState {
  return {
    nodeIds: [],
    elementIds: [],
    supportIds: [],
    loadIds: [],
  };
}

function cloneScene(scene: AnalysisScene): AnalysisScene {
  return {
    nodes: scene.nodes.map((node) => ({ ...node })),
    elements: scene.elements.map((element) => ({ ...element, nodeIds: [...element.nodeIds] as Element['nodeIds'] })),
    supports: scene.supports.map((support) => ({ ...support })),
    loads: scene.loads.map((load) => ({ ...load })),
    materials: relabelMaterials(scene.materials.map((material) => ({ ...material }))),
  };
}

function relabelMaterials(materials: Material[]): Material[] {
  return materials.map((material, index) => ({
    ...material,
    name: getMaterialLabel(index + 1),
  }));
}

function nextIdentifier(prefix: string, existingIds: string[]): string {
  let index = existingIds.length + 1;
  let candidate = `${prefix}-${index}`;

  while (existingIds.includes(candidate)) {
    index += 1;
    candidate = `${prefix}-${index}`;
  }

  return candidate;
}

function updateMaterialNumericField(material: Material, field: MaterialNumericField, value: number): Material {
  switch (field) {
    case 'youngModulus':
      return { ...material, youngModulus: value };
    case 'poissonRatio':
      return { ...material, poissonRatio: value };
    case 'beta':
      return material.kind === 'drucker-prager-plane-strain' ? { ...material, beta: value } : material;
    case 'mu':
      return material.kind === 'drucker-prager-plane-strain' ? { ...material, mu: value } : material;
    case 'exponent':
      return material.kind === 'drucker-prager-plane-strain' ? { ...material, exponent: value } : material;
    case 'initialConfinement':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, initialConfinement: value } : material;
    case 'solidFraction':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, solidFraction: value } : material;
    case 'mesoTemperature':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, mesoTemperature: value } : material;
    case 'energyCoupling':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, energyCoupling: value } : material;
    case 'criticalStateSlope':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, criticalStateSlope: value } : material;
    case 'omega':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, omega: value } : material;
    case 'compressionIndex':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, compressionIndex: value } : material;
    case 'referenceSolidFraction':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, referenceSolidFraction: value } : material;
    case 'volumetricCoefficient':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, volumetricCoefficient: value } : material;
    case 'deviatoricCoefficient':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, deviatoricCoefficient: value } : material;
    case 'dissipation':
      return material.kind === 'terra-cotta-plane-strain' ? { ...material, dissipation: value } : material;
    case 'loadSteps':
      return material.kind === 'linear-elastic-plane-strain' ? material : { ...material, loadSteps: value };
    case 'maxIterations':
      return material.kind === 'linear-elastic-plane-strain' ? material : { ...material, maxIterations: value };
    case 'tolerance':
      return material.kind === 'linear-elastic-plane-strain' ? material : { ...material, tolerance: value };
    default:
      return material;
  }
}

function createMaterial(kind: MaterialKind, id: string, name: string): Material {
  if (kind === 'linear-elastic-plane-strain') {
    return {
      id,
      name,
      kind,
      youngModulus: 20_000,
      poissonRatio: 0.3,
    };
  }

  if (kind === 'drucker-prager-plane-strain') {
    return {
      id,
      name,
      kind,
      youngModulus: 20_000,
      poissonRatio: 0.3,
      beta: 0.08,
      mu: 2,
      exponent: 1,
      loadSteps: 12,
      maxIterations: 24,
      tolerance: 1e-8,
    };
  }

  return {
    id,
    name,
    kind,
    youngModulus: 20_000,
    poissonRatio: 0.3,
    initialConfinement: 2,
    solidFraction: 0.62,
    mesoTemperature: 0,
    energyCoupling: 50,
    criticalStateSlope: 1,
    omega: 0.5,
    compressionIndex: 4,
    referenceSolidFraction: 0.3,
    volumetricCoefficient: 1,
    deviatoricCoefficient: 1,
    dissipation: 1,
    loadSteps: 16,
    maxIterations: 48,
    tolerance: 1e-8,
  };
}

function convertMaterialKind(material: Material, nextKind: MaterialKind): Material {
  if (material.kind === nextKind) {
    return material;
  }

  if (nextKind === 'linear-elastic-plane-strain') {
    return {
      id: material.id,
      name: material.name,
      kind: nextKind,
      youngModulus: material.youngModulus,
      poissonRatio: material.poissonRatio,
    };
  }

  if (nextKind === 'drucker-prager-plane-strain') {
    return {
      id: material.id,
      name: material.name,
      kind: nextKind,
      youngModulus: material.youngModulus,
      poissonRatio: material.poissonRatio,
      beta: 0.08,
      mu: 2,
      exponent: 1,
      loadSteps: material.kind === 'linear-elastic-plane-strain' ? 12 : material.loadSteps ?? 12,
      maxIterations: material.kind === 'linear-elastic-plane-strain' ? 24 : material.maxIterations ?? 24,
      tolerance: material.kind === 'linear-elastic-plane-strain' ? 1e-8 : material.tolerance ?? 1e-8,
    };
  }

  return {
    id: material.id,
    name: material.name,
    kind: nextKind,
    youngModulus: material.youngModulus,
    poissonRatio: material.poissonRatio,
    initialConfinement: 2,
    solidFraction: 0.62,
    mesoTemperature: 0,
    energyCoupling: 50,
    criticalStateSlope: 1,
    omega: 0.5,
    compressionIndex: 4,
    referenceSolidFraction: 0.3,
    volumetricCoefficient: 1,
    deviatoricCoefficient: 1,
    dissipation: 1,
    loadSteps: material.kind === 'linear-elastic-plane-strain' ? 16 : material.loadSteps ?? 16,
    maxIterations: material.kind === 'linear-elastic-plane-strain' ? 48 : material.maxIterations ?? 48,
    tolerance: material.kind === 'linear-elastic-plane-strain' ? 1e-8 : material.tolerance ?? 1e-8,
  };
}

function getMaterialLabel(index: number): string {
  return `Material ${index}`;
}

export class AppStore {
  private state: AppState;

  private listeners = new Set<Listener>();

  constructor(scene: AnalysisScene = defaultScene) {
    this.state = {
      scene: cloneScene(scene),
      tool: 'select',
      selection: createEmptySelectionState(),
      stagedElementNodeIds: [],
      hoveredNodeId: null,
      viewport: { ...initialViewport },
      activeMaterialId: scene.materials[0]?.id ?? null,
      loadDraft: { ...initialLoadDraft },
      meshDraft: { ...initialMeshDraft },
      visualization: { ...initialVisualization },
      analysis: createIdleAnalysisState(),
      dirty: false,
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);

    return () => {
      this.listeners.delete(listener);
    };
  }

  getState(): AppState {
    return this.state;
  }

  setTool(tool: ToolMode): void {
    this.patchState({
      tool,
      stagedElementNodeIds: tool === 'add-element' ? this.state.stagedElementNodeIds : [],
    });
  }

  setViewport(viewport: ViewportState): void {
    this.patchState({ viewport });
  }

  setLoadDraft(loadDraft: LoadDraft): void {
    this.patchState({ loadDraft });
  }

  setActiveMaterial(materialId: string): void {
    if (!this.state.scene.materials.some((material) => material.id === materialId)) {
      return;
    }

    this.patchState({ activeMaterialId: materialId });
  }

  updateMaterialValue(materialId: string, field: MaterialNumericField, value: number): void {
    let didUpdate = false;

    const materials = this.state.scene.materials.map((material) => {
      if (material.id !== materialId) {
        return material;
      }

      const nextMaterial = updateMaterialNumericField(material, field, value);

      didUpdate ||= nextMaterial !== material;
      return nextMaterial;
    });

    if (!didUpdate) {
      return;
    }

    this.patchScene({ materials });
  }

  changeMaterialKind(materialId: string, kind: MaterialKind): void {
    let didUpdate = false;

    const materials = this.state.scene.materials.map((material) => {
      if (material.id !== materialId) {
        return material;
      }

      const nextMaterial = convertMaterialKind(material, kind);
      didUpdate ||= nextMaterial !== material;
      return nextMaterial;
    });

    if (!didUpdate) {
      return;
    }

    this.patchScene({ materials });
  }

  addMaterial(kind: MaterialKind): void {
    const id = nextIdentifier('material', this.state.scene.materials.map((material) => material.id));
    const nextMaterial = createMaterial(kind, id, getMaterialLabel(this.state.scene.materials.length + 1));

    this.patchState({
      scene: {
        ...this.state.scene,
        materials: [...this.state.scene.materials, nextMaterial],
      },
      activeMaterialId: nextMaterial.id,
      analysis: createIdleAnalysisState(),
      dirty: true,
    });
  }

  removeMaterial(materialId: string): void {
    if (this.state.scene.materials.length <= 1 || !this.state.scene.materials.some((material) => material.id === materialId)) {
      return;
    }

    const fallbackMaterial = this.state.scene.materials.find((material) => material.id !== materialId);

    if (!fallbackMaterial) {
      return;
    }

    this.patchState({
      scene: {
        ...this.state.scene,
        materials: this.state.scene.materials.filter((material) => material.id !== materialId),
        elements: this.state.scene.elements.map((element) => (
          element.materialId === materialId ? { ...element, materialId: fallbackMaterial.id } : element
        )),
      },
      activeMaterialId: this.state.activeMaterialId === materialId ? fallbackMaterial.id : this.state.activeMaterialId,
      analysis: createIdleAnalysisState(),
      dirty: true,
    });
  }

  assignMaterialToSelectedElements(materialId: string): void {
    if (!this.state.scene.materials.some((material) => material.id === materialId) || this.state.selection.elementIds.length === 0) {
      return;
    }

    const selectedElementIds = new Set(this.state.selection.elementIds);

    this.patchScene({
      elements: this.state.scene.elements.map((element) => (
        selectedElementIds.has(element.id) ? { ...element, materialId } : element
      )),
    });
  }

  setMeshDraft(meshDraft: StructuredMeshDraft): void {
    this.patchState({ meshDraft });
  }

  setVisualization(visualization: Partial<VisualizationState>): void {
    this.patchState({
      visualization: {
        ...this.state.visualization,
        ...visualization,
      },
    });
  }

  setContourField(contourField: ContourField): void {
    this.setVisualization({ contourField });
  }

  setDeformationScale(deformationScale: number): void {
    this.setVisualization({ deformationScale });
  }

  setShowDeformedMesh(showDeformedMesh: boolean): void {
    this.setVisualization({ showDeformedMesh });
  }

  setShowDisplacementVectors(showDisplacementVectors: boolean): void {
    this.setVisualization({ showDisplacementVectors });
  }

  setShowReactionVectors(showReactionVectors: boolean): void {
    this.setVisualization({ showReactionVectors });
  }

  setHoveredNode(nodeId: string | null): void {
    if (this.state.hoveredNodeId === nodeId) {
      return;
    }

    this.patchState({ hoveredNodeId: nodeId });
  }

  addNode(x: number, y: number): Node {
    const id = nextIdentifier(
      'node',
      this.state.scene.nodes.map((node) => node.id),
    );
    const node = { id, x, y };

    this.patchScene({
      nodes: [...this.state.scene.nodes, node],
    });
    this.selectNode(node.id);

    return node;
  }

  moveNode(nodeId: string, x: number, y: number): void {
    this.patchScene({
      nodes: this.state.scene.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node)),
    });
  }

  selectElement(elementId: string, additive = false): void {
    const elementIds = additive
      ? Array.from(new Set([...this.state.selection.elementIds, elementId]))
      : [elementId];

    this.patchState({
      selection: {
        nodeIds: [],
        elementIds,
        supportIds: [],
        loadIds: [],
      },
    });
  }

  selectNode(nodeId: string, additive = false): void {
    const nodeIds = additive
      ? Array.from(new Set([...this.state.selection.nodeIds, nodeId]))
      : [nodeId];

    this.patchState({
      selection: {
        nodeIds,
        elementIds: [],
        supportIds: [],
        loadIds: [],
      },
    });
  }

  selectSupport(supportId: string, additive = false): void {
    const support = this.state.scene.supports.find((candidate) => candidate.id === supportId);

    if (!support) {
      return;
    }

    const supportIds = additive
      ? Array.from(new Set([...this.state.selection.supportIds, supportId]))
      : [supportId];

    this.patchState({
      selection: {
        nodeIds: [],
        elementIds: [],
        supportIds,
        loadIds: [],
      },
    });
  }

  selectLoad(loadId: string, additive = false): void {
    const load = this.state.scene.loads.find((candidate) => candidate.id === loadId);

    if (!load) {
      return;
    }

    const loadIds = additive
      ? Array.from(new Set([...this.state.selection.loadIds, loadId]))
      : [loadId];

    this.patchState({
      selection: {
        nodeIds: [],
        elementIds: [],
        supportIds: [],
        loadIds,
      },
      loadDraft: {
        fx: load.fx,
        fy: load.fy,
      },
    });
  }

  clearSelection(): void {
    this.patchState({
      selection: createEmptySelectionState(),
      stagedElementNodeIds: [],
    });
  }

  stageElementNode(nodeId: string): void {
    const staged = this.state.stagedElementNodeIds.includes(nodeId)
      ? this.state.stagedElementNodeIds.filter((candidate) => candidate !== nodeId)
      : [...this.state.stagedElementNodeIds, nodeId].slice(0, 3);

    if (staged.length < 3) {
      this.patchState({
        stagedElementNodeIds: staged,
        selection: {
          nodeIds: staged,
          elementIds: [],
          supportIds: [],
          loadIds: [],
        },
      });

      return;
    }

    const materialId = this.state.activeMaterialId ?? this.state.scene.materials[0]?.id;

    if (!materialId) {
      throw new Error('At least one material is required before creating an element.');
    }

    const id = nextIdentifier(
      'element',
      this.state.scene.elements.map((element) => element.id),
    );

    this.patchScene({
      elements: [
        ...this.state.scene.elements,
        {
          id,
          nodeIds: [staged[0], staged[1], staged[2]],
          materialId,
        },
      ],
    });

    this.patchState({
      stagedElementNodeIds: [],
      selection: {
        nodeIds: staged,
        elementIds: [id],
        supportIds: [],
        loadIds: [],
      },
    });
  }

  applySupportToNode(nodeId: string, direction: SupportDirection): void {
    const existing = this.state.scene.supports.find(
      (support) => support.nodeId === nodeId && support.direction === direction,
    );

    if (existing) {
      this.selectSupport(existing.id);
      return;
    }

    const support = {
      id: nextIdentifier('support', this.state.scene.supports.map((candidate) => candidate.id)),
      nodeId,
      direction,
    };

    this.patchScene({ supports: [...this.state.scene.supports, support] });
    this.selectSupport(support.id);
  }

  applyLoadToNode(nodeId: string): void {
    const { fx, fy } = this.state.loadDraft;
    const existing = this.state.scene.loads.find((load) => load.nodeId === nodeId);
    const loads = fx === 0 && fy === 0
      ? this.state.scene.loads.filter((load) => load.nodeId !== nodeId)
      : existing
        ? this.state.scene.loads.map((load) => (load.nodeId === nodeId ? { ...load, fx, fy } : load))
        : [
            ...this.state.scene.loads,
            {
              id: nextIdentifier('load', this.state.scene.loads.map((load) => load.id)),
              nodeId,
              fx,
              fy,
            },
          ];

    this.patchScene({ loads });

    const nextLoad = loads.find((load) => load.nodeId === nodeId);

    if (nextLoad) {
      this.selectLoad(nextLoad.id);
      return;
    }

    this.selectNode(nodeId);
  }

  updateLoad(loadId: string, fx: number, fy: number): void {
    if (!this.state.scene.loads.some((load) => load.id === loadId)) {
      return;
    }

    this.patchState({
      scene: {
        ...this.state.scene,
        loads: this.state.scene.loads.map((load) => (load.id === loadId ? { ...load, fx, fy } : load)),
      },
      selection: {
        nodeIds: [],
        elementIds: [],
        supportIds: [],
        loadIds: [loadId],
      },
      loadDraft: { fx, fy },
      analysis: createIdleAnalysisState(),
      dirty: true,
    });
  }

  generateStructuredMesh(): void {
    const materialId = this.state.activeMaterialId ?? this.state.scene.materials[0]?.id;

    if (!materialId) {
      throw new Error('A material must exist before generating a structured mesh.');
    }

    const mesh = generateStructuredTriMesh({
      ...this.state.meshDraft,
      materialId,
    });

    this.patchState({
      scene: {
        ...this.state.scene,
        nodes: mesh.nodes,
        elements: mesh.elements,
        supports: [],
        loads: [],
      },
      selection: createEmptySelectionState(),
      stagedElementNodeIds: [],
      hoveredNodeId: null,
      analysis: createIdleAnalysisState(),
      dirty: true,
    });
  }

  solveLinearElastic(): void {
    try {
      const result = solveLinearElasticPlaneStrain(this.state.scene);

      this.patchState({
        analysis: {
          status: 'success',
          result,
          error: null,
        },
        dirty: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to solve the linear-elastic system.';

      this.patchState({
        analysis: {
          status: 'error',
          result: null,
          error: message,
        },
      });
    }
  }

  deleteSelection(): void {
    const nodeIds = new Set(this.state.selection.nodeIds);
    const elementIds = new Set(this.state.selection.elementIds);
    const supportIds = new Set(this.state.selection.supportIds);
    const loadIds = new Set(this.state.selection.loadIds);

    if (nodeIds.size === 0 && elementIds.size === 0 && supportIds.size === 0 && loadIds.size === 0) {
      return;
    }

    this.patchScene({
      nodes: this.state.scene.nodes.filter((node) => !nodeIds.has(node.id)),
      elements: this.state.scene.elements.filter(
        (element) => !elementIds.has(element.id) && !element.nodeIds.some((nodeId) => nodeIds.has(nodeId)),
      ),
      supports: this.state.scene.supports.filter((support) => !nodeIds.has(support.nodeId) && !supportIds.has(support.id)),
      loads: this.state.scene.loads.filter((load) => !nodeIds.has(load.nodeId) && !loadIds.has(load.id)),
    });

    this.clearSelection();
  }

  exportScene(): string {
    return JSON.stringify(this.state.scene, null, 2);
  }

  loadScene(scene: AnalysisScene): void {
    this.state = {
      ...this.state,
      scene: cloneScene(scene),
      selection: createEmptySelectionState(),
      stagedElementNodeIds: [],
      hoveredNodeId: null,
      viewport: { ...initialViewport },
      activeMaterialId: scene.materials[0]?.id ?? null,
      loadDraft: { ...initialLoadDraft },
      meshDraft: { ...initialMeshDraft },
      visualization: { ...initialVisualization },
      analysis: createIdleAnalysisState(),
      dirty: false,
    };
    this.notify();
  }

  importScene(json: string): void {
    const parsed = JSON.parse(json) as AnalysisScene;

    this.loadScene(parsed);
  }

  resetScene(): void {
    this.loadScene(defaultScene);
  }

  private patchScene(partial: Partial<AnalysisScene>): void {
    const nextScene = {
      ...this.state.scene,
      ...partial,
    };

    this.patchState({
      scene: {
        ...nextScene,
        materials: relabelMaterials(nextScene.materials),
      },
      analysis: createIdleAnalysisState(),
      dirty: true,
    });
  }

  private patchState(partial: Partial<AppState>): void {
    this.state = {
      ...this.state,
      ...partial,
    };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
