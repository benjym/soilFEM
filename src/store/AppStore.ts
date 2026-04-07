import { defaultScene } from '../examples/defaultScene';
import type { AnalysisScene, AppState, Element, Node, ToolMode, ViewportState } from '../model/types';

type Listener = (state: AppState) => void;

const initialViewport: ViewportState = {
  zoom: 1.5,
  panX: 240,
  panY: 180,
};

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
