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
  Node,
  StructuredMeshDraft,
  SupportDraft,
  ToolMode,
  VisualizationState,
  ViewportState,
} from '../model/types';

type Listener = (state: AppState) => void;

const initialViewport: ViewportState = {
  zoom: 1.5,
  panX: 240,
  panY: 180,
};

const initialSupportDraft: SupportDraft = {
  fixX: true,
  fixY: true,
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

function cloneScene(scene: AnalysisScene): AnalysisScene {
  return {
    nodes: scene.nodes.map((node) => ({ ...node })),
    elements: scene.elements.map((element) => ({ ...element, nodeIds: [...element.nodeIds] as Element['nodeIds'] })),
    supports: scene.supports.map((support) => ({ ...support })),
    loads: scene.loads.map((load) => ({ ...load })),
    materials: scene.materials.map((material) => ({ ...material })),
  };
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

export class AppStore {
  private state: AppState;

  private listeners = new Set<Listener>();

  constructor(scene: AnalysisScene = defaultScene) {
    this.state = {
      scene: cloneScene(scene),
      tool: 'select',
      selection: { nodeIds: [], elementIds: [] },
      stagedElementNodeIds: [],
      hoveredNodeId: null,
      viewport: { ...initialViewport },
      supportDraft: { ...initialSupportDraft },
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

  setSupportDraft(supportDraft: SupportDraft): void {
    this.patchState({ supportDraft });
  }

  setLoadDraft(loadDraft: LoadDraft): void {
    this.patchState({ loadDraft });
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
      },
    });
  }

  clearSelection(): void {
    this.patchState({
      selection: { nodeIds: [], elementIds: [] },
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
        },
      });

      return;
    }

    const materialId = this.state.scene.materials[0]?.id;

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
      },
    });
  }

  applySupportToNode(nodeId: string): void {
    const { fixX, fixY } = this.state.supportDraft;
    const supports = !fixX && !fixY
      ? this.state.scene.supports.filter((support) => support.nodeId !== nodeId)
      : this.state.scene.supports.some((support) => support.nodeId === nodeId)
        ? this.state.scene.supports.map((support) => (support.nodeId === nodeId ? { nodeId, fixX, fixY } : support))
        : [...this.state.scene.supports, { nodeId, fixX, fixY }];

    this.patchScene({ supports });
    this.selectNode(nodeId);
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
    this.selectNode(nodeId);
  }

  generateStructuredMesh(): void {
    const materialId = this.state.scene.materials[0]?.id;

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
      selection: { nodeIds: [], elementIds: [] },
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

    if (nodeIds.size === 0 && elementIds.size === 0) {
      return;
    }

    this.patchScene({
      nodes: this.state.scene.nodes.filter((node) => !nodeIds.has(node.id)),
      elements: this.state.scene.elements.filter(
        (element) => !elementIds.has(element.id) && !element.nodeIds.some((nodeId) => nodeIds.has(nodeId)),
      ),
      supports: this.state.scene.supports.filter((support) => !nodeIds.has(support.nodeId)),
      loads: this.state.scene.loads.filter((load) => !nodeIds.has(load.nodeId)),
    });

    this.clearSelection();
  }

  exportScene(): string {
    return JSON.stringify(this.state.scene, null, 2);
  }

  importScene(json: string): void {
    const parsed = JSON.parse(json) as AnalysisScene;

    this.state = {
      ...this.state,
      scene: cloneScene(parsed),
      selection: { nodeIds: [], elementIds: [] },
      stagedElementNodeIds: [],
      analysis: createIdleAnalysisState(),
      dirty: false,
    };
    this.notify();
  }

  resetScene(): void {
    this.state = {
      ...this.state,
      scene: cloneScene(defaultScene),
      selection: { nodeIds: [], elementIds: [] },
      stagedElementNodeIds: [],
      hoveredNodeId: null,
      viewport: { ...initialViewport },
      supportDraft: { ...initialSupportDraft },
      loadDraft: { ...initialLoadDraft },
      meshDraft: { ...initialMeshDraft },
      visualization: { ...initialVisualization },
      analysis: createIdleAnalysisState(),
      dirty: false,
    };
    this.notify();
  }

  private patchScene(partial: Partial<AnalysisScene>): void {
    this.patchState({
      scene: {
        ...this.state.scene,
        ...partial,
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
