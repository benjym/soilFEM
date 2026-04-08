import type { AppState, ContourField, ElementAnalysisResult, MaterialKind, Node, SupportDirection, ViewportState } from '../model/types';
import { AppStore } from '../store/AppStore';

const svgNamespace = 'http://www.w3.org/2000/svg';

type DragState =
  | { kind: 'idle' }
  | { kind: 'pan'; pointerId: number; startPanX: number; startPanY: number; startClientX: number; startClientY: number }
  | { kind: 'move-node'; pointerId: number; nodeId: string }
  | { kind: 'move-load'; pointerId: number; loadId: string; nodeId: string };

interface Point {
  x: number;
  y: number;
}

function createSvgElement<T extends keyof SVGElementTagNameMap>(tagName: T): SVGElementTagNameMap[T] {
  return document.createElementNS(svgNamespace, tagName);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const loadVectorScale = 1.2;

const materialKindPresentation: Record<MaterialKind, { label: string; fill: string }> = {
  'linear-elastic-plane-strain': {
    label: 'Linear Elastic',
    fill: 'rgba(198, 166, 113, 0.42)',
  },
  'drucker-prager-plane-strain': {
    label: 'Drucker-Prager',
    fill: 'rgba(84, 122, 139, 0.34)',
  },
  'terra-cotta-plane-strain': {
    label: 'Terra Cotta',
    fill: 'rgba(170, 88, 57, 0.36)',
  },
};

function getNodeMap(nodes: Node[]): Map<string, Node> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function getContourValue(field: ContourField, result: ElementAnalysisResult): number {
  switch (field) {
    case 'meanStress':
      return result.stress.meanStress;
    case 'deviatoricStress':
      return result.stress.deviatoricStress;
    case 'sxx':
      return result.stress.sxx;
    case 'syy':
      return result.stress.syy;
    case 'txy':
      return result.stress.txy;
    case 'volumetricStrain':
      return result.strain.volumetric;
    case 'none':
    default:
      return 0;
  }
}

function interpolateColor(start: [number, number, number], end: [number, number, number], weight: number): string {
  const r = Math.round(start[0] + (end[0] - start[0]) * weight);
  const g = Math.round(start[1] + (end[1] - start[1]) * weight);
  const b = Math.round(start[2] + (end[2] - start[2]) * weight);

  return `rgb(${r}, ${g}, ${b})`;
}

function getContourColor(value: number, minValue: number, maxValue: number): string {
  if (Math.abs(maxValue - minValue) <= 1e-12) {
    return 'rgb(229, 201, 159)';
  }

  const ratio = clamp((value - minValue) / (maxValue - minValue), 0, 1);

  if (ratio <= 0.5) {
    return interpolateColor([49, 92, 121], [238, 228, 205], ratio * 2);
  }

  return interpolateColor([238, 228, 205], [159, 76, 44], (ratio - 0.5) * 2);
}

function getMaterialKindFill(kind: MaterialKind): string {
  return materialKindPresentation[kind].fill;
}

function getMaterialKindsInScene(state: AppState): MaterialKind[] {
  const kindByMaterialId = new Map(state.scene.materials.map((material) => [material.id, material.kind]));
  const sceneKinds = new Set<MaterialKind>();

  for (const element of state.scene.elements) {
    const kind = kindByMaterialId.get(element.materialId);

    if (kind) {
      sceneKinds.add(kind);
    }
  }

  return (Object.keys(materialKindPresentation) as MaterialKind[]).filter((kind) => sceneKinds.has(kind));
}

function createArrowHead(id: string, color: string): SVGMarkerElement {
  const marker = createSvgElement('marker');
  marker.setAttribute('id', id);
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('refX', '6');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const path = createSvgElement('path');
  path.setAttribute('d', 'M 0 0 L 6 3 L 0 6 Z');
  path.setAttribute('fill', color);
  marker.append(path);

  return marker;
}

function appendSupportTicks(group: SVGGElement, points: Array<{ x1: number; y1: number; x2: number; y2: number }>): void {
  for (const point of points) {
    const tick = createSvgElement('line');
    tick.setAttribute('x1', `${point.x1}`);
    tick.setAttribute('y1', `${point.y1}`);
    tick.setAttribute('x2', `${point.x2}`);
    tick.setAttribute('y2', `${point.y2}`);
    tick.setAttribute('class', 'support-marker-tick');
    group.append(tick);
  }
}

function createSupportMarker(node: Node, direction: SupportDirection, selected: boolean, supportId: string): SVGGElement {
  const group = createSvgElement('g');
  const className = selected ? 'support-marker selected' : 'support-marker';

  group.dataset.supportId = supportId;
  group.dataset.supportNodeId = node.id;
  group.dataset.supportDirection = direction;

  if (direction === 'x') {
    const bar = createSvgElement('line');
    bar.setAttribute('x1', `${node.x - 15}`);
    bar.setAttribute('y1', `${node.y - 8}`);
    bar.setAttribute('x2', `${node.x - 15}`);
    bar.setAttribute('y2', `${node.y + 8}`);
    bar.setAttribute('class', className);
    group.append(bar);

    appendSupportTicks(group, [
      { x1: node.x - 15, y1: node.y + 8, x2: node.x - 20, y2: node.y + 12 },
      { x1: node.x - 15, y1: node.y + 2, x2: node.x - 20, y2: node.y + 6 },
      { x1: node.x - 15, y1: node.y - 4, x2: node.x - 20, y2: node.y, },
      { x1: node.x - 15, y1: node.y - 10, x2: node.x - 20, y2: node.y - 6 },
    ]);
  } else {
    const base = createSvgElement('line');
    base.setAttribute('x1', `${node.x - 10}`);
    base.setAttribute('y1', `${node.y - 15}`);
    base.setAttribute('x2', `${node.x + 10}`);
    base.setAttribute('y2', `${node.y - 15}`);
    base.setAttribute('class', className);
    group.append(base);

    appendSupportTicks(group, [
      { x1: node.x - 10, y1: node.y - 15, x2: node.x - 14, y2: node.y - 20 },
      { x1: node.x - 4, y1: node.y - 15, x2: node.x - 8, y2: node.y - 20 },
      { x1: node.x + 2, y1: node.y - 15, x2: node.x - 2, y2: node.y - 20 },
      { x1: node.x + 8, y1: node.y - 15, x2: node.x + 4, y2: node.y - 20 },
    ]);
  }

  const hitArea = createSvgElement('circle');
  hitArea.setAttribute('cx', `${direction === 'x' ? node.x - 15 : node.x}`);
  hitArea.setAttribute('cy', `${direction === 'x' ? node.y : node.y - 15}`);
  hitArea.setAttribute('r', '9');
  hitArea.setAttribute('class', 'support-hit-area');
  group.append(hitArea);

  return group;
}

export class SvgEditor {
  private dragState: DragState = { kind: 'idle' };

  constructor(
    private readonly svg: SVGSVGElement,
    private readonly store: AppStore,
  ) {
    this.attachEvents();
    this.store.subscribe((state) => this.render(state));
  }

  private attachEvents(): void {
    this.svg.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.svg.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.svg.addEventListener('pointerup', (event) => this.onPointerUp(event));
    this.svg.addEventListener('pointerleave', () => this.store.setHoveredNode(null));
    this.svg.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
  }

  private onPointerDown(event: PointerEvent): void {
    const state = this.store.getState();
    const target = event.target instanceof Element ? event.target : null;

    if (!target) {
      return;
    }

    const loadElement = target.closest<SVGElement>('[data-load-id]');
    const supportElement = target.closest<SVGGElement>('[data-support-id]');
    const nodeElement = target.closest<SVGCircleElement>('[data-node-id]');
    const polygonElement = target.closest<SVGPolygonElement>('[data-element-id]');

    if (loadElement && state.tool === 'select') {
      const loadId = loadElement.dataset.loadId;
      const load = state.scene.loads.find((candidate) => candidate.id === loadId);

      if (!loadId || !load) {
        return;
      }

      this.store.selectLoad(loadId, event.shiftKey || event.metaKey);
      this.dragState = { kind: 'move-load', pointerId: event.pointerId, loadId, nodeId: load.nodeId };
      this.svg.setPointerCapture(event.pointerId);
      return;
    }

    if (supportElement && state.tool === 'select') {
      const supportId = supportElement.dataset.supportId;

      if (!supportId) {
        return;
      }

      this.store.selectSupport(supportId, event.shiftKey || event.metaKey);
      return;
    }

    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;

      if (!nodeId) {
        return;
      }

      if (state.tool === 'add-element') {
        this.store.stageElementNode(nodeId);
        return;
      }

      if (state.tool === 'add-support-x') {
        this.store.applySupportToNode(nodeId, 'x');
        return;
      }

      if (state.tool === 'add-support-y') {
        this.store.applySupportToNode(nodeId, 'y');
        return;
      }

      if (state.tool === 'add-load') {
        this.store.applyLoadToNode(nodeId);
        return;
      }

      this.store.selectNode(nodeId, event.shiftKey || event.metaKey);
      this.dragState = { kind: 'move-node', pointerId: event.pointerId, nodeId };
      this.svg.setPointerCapture(event.pointerId);
      return;
    }

    if (polygonElement && state.tool === 'select') {
      const elementId = polygonElement.dataset.elementId;

      if (!elementId) {
        return;
      }

      this.store.selectElement(elementId, event.shiftKey || event.metaKey);
      return;
    }

    if (state.tool === 'add-node') {
      const world = this.clientToWorld(event.clientX, event.clientY, state.viewport);
      this.store.addNode(world.x, world.y);
      return;
    }

    this.store.clearSelection();
    this.dragState = {
      kind: 'pan',
      pointerId: event.pointerId,
      startPanX: state.viewport.panX,
      startPanY: state.viewport.panY,
      startClientX: event.clientX,
      startClientY: event.clientY,
    };
    this.svg.setPointerCapture(event.pointerId);
  }

  private onPointerMove(event: PointerEvent): void {
    const state = this.store.getState();
    const dragState = this.dragState;
    const hoverTarget = (event.target as HTMLElement).closest<SVGCircleElement>('[data-node-id]');
    this.store.setHoveredNode(hoverTarget?.dataset.nodeId ?? null);

    if (dragState.kind === 'move-node' && dragState.pointerId === event.pointerId) {
      const world = this.clientToWorld(event.clientX, event.clientY, state.viewport);
      this.store.moveNode(dragState.nodeId, world.x, world.y);
      return;
    }

    if (dragState.kind === 'move-load' && dragState.pointerId === event.pointerId) {
      const world = this.clientToWorld(event.clientX, event.clientY, state.viewport);
      const node = state.scene.nodes.find((candidate) => candidate.id === dragState.nodeId);

      if (!node) {
        return;
      }

      this.store.updateLoad(
        dragState.loadId,
        (world.x - node.x) / loadVectorScale,
        (world.y - node.y) / loadVectorScale,
      );
      return;
    }

    if (dragState.kind === 'pan' && dragState.pointerId === event.pointerId) {
      const deltaX = event.clientX - dragState.startClientX;
      const deltaY = event.clientY - dragState.startClientY;

      this.store.setViewport({
        ...state.viewport,
        panX: dragState.startPanX + deltaX,
        panY: dragState.startPanY + deltaY,
      });
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.dragState.kind !== 'idle' && this.dragState.pointerId === event.pointerId) {
      this.svg.releasePointerCapture(event.pointerId);
      this.dragState = { kind: 'idle' };
      this.render(this.store.getState());
    }
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();

    const state = this.store.getState();
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.92;
    const nextZoom = clamp(state.viewport.zoom * zoomFactor, 0.3, 6);
    const bounds = this.svg.getBoundingClientRect();
    const cursorX = event.clientX - bounds.left;
    const cursorY = event.clientY - bounds.top;
    const worldX = (cursorX - state.viewport.panX) / state.viewport.zoom;
    const worldY = (state.viewport.panY - cursorY) / state.viewport.zoom;

    this.store.setViewport({
      zoom: nextZoom,
      panX: cursorX - worldX * nextZoom,
      panY: cursorY + worldY * nextZoom,
    });
  }

  private clientToWorld(clientX: number, clientY: number, viewport: ViewportState): Point {
    const bounds = this.svg.getBoundingClientRect();
    const x = (clientX - bounds.left - viewport.panX) / viewport.zoom;
    const y = (viewport.panY - (clientY - bounds.top)) / viewport.zoom;

    return { x, y };
  }

  private render(state: AppState): void {
    const width = this.svg.clientWidth || 900;
    const height = this.svg.clientHeight || 700;
    this.svg.replaceChildren();
    this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const defs = createSvgElement('defs');
    defs.append(
      createArrowHead('displacement-arrowhead', '#185373'),
      createArrowHead('reaction-arrowhead', '#8d2435'),
    );

    this.svg.append(
      defs,
      this.buildGrid(state.viewport, width, height),
      this.buildWorld(state, width, height),
      this.buildOverlay(state, width),
    );
  }

  private buildGrid(viewport: ViewportState, width: number, height: number): SVGGElement {
    const group = createSvgElement('g');
    const worldLeft = -viewport.panX / viewport.zoom;
    const worldRight = (width - viewport.panX) / viewport.zoom;
    const worldTop = viewport.panY / viewport.zoom;
    const worldBottom = (viewport.panY - height) / viewport.zoom;
    const step = 40;
    const startX = Math.floor(worldLeft / step) * step;
    const startY = Math.floor(worldBottom / step) * step;

    group.setAttribute('class', 'editor-grid');

    for (let x = startX; x <= worldRight + step; x += step) {
      const line = createSvgElement('line');
      line.setAttribute('x1', `${x * viewport.zoom + viewport.panX}`);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', `${x * viewport.zoom + viewport.panX}`);
      line.setAttribute('y2', `${height}`);
      group.append(line);
    }

    for (let y = startY; y <= worldTop + step; y += step) {
      const line = createSvgElement('line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', `${viewport.panY - y * viewport.zoom}`);
      line.setAttribute('x2', `${width}`);
      line.setAttribute('y2', `${viewport.panY - y * viewport.zoom}`);
      group.append(line);
    }

    return group;
  }

  private buildWorld(state: AppState, width: number, height: number): SVGGElement {
    const group = createSvgElement('g');
    const nodeMap = getNodeMap(state.scene.nodes);
    const materialKindById = new Map(state.scene.materials.map((material) => [material.id, material.kind]));
    const displacementMap = new Map(state.analysis.result?.displacements.map((result) => [result.nodeId, result]) ?? []);
    const elementResultMap = new Map(state.analysis.result?.elementResults.map((result) => [result.elementId, result]) ?? []);
    const contourField = state.analysis.status === 'success' ? state.visualization.contourField : 'none';
    const contourValues = contourField === 'none'
      ? []
      : state.analysis.result?.elementResults.map((result) => getContourValue(contourField, result)) ?? [];
    const contourMin = contourValues.length ? Math.min(...contourValues) : 0;
    const contourMax = contourValues.length ? Math.max(...contourValues) : 0;
    const span = Math.max(1, ...state.scene.nodes.map((node) => Math.max(Math.abs(node.x), Math.abs(node.y))));
    const maxDisplacement = Math.max(0, ...Array.from(displacementMap.values()).map((result) => result.magnitude));
    const maxReaction = Math.max(0, ...Array.from(state.analysis.result?.reactions ?? []).map((result) => result.magnitude));
    const displacementScale = maxDisplacement > 0 ? (0.18 * span) / maxDisplacement : 0;
    const reactionScale = maxReaction > 0 ? (0.12 * span) / maxReaction : 0;
    const selectedSupportIds = new Set(state.selection.supportIds);
    const selectedSupportNodeIds = new Set(
      state.scene.supports.filter((support) => selectedSupportIds.has(support.id)).map((support) => support.nodeId),
    );
    const selectedLoadIds = new Set(state.selection.loadIds);
    const selectedLoadNodeIds = new Set(
      state.scene.loads.filter((load) => selectedLoadIds.has(load.id)).map((load) => load.nodeId),
    );
    const draggedLoadId = this.dragState.kind === 'move-load' ? this.dragState.loadId : null;

    group.setAttribute(
      'transform',
      `matrix(${state.viewport.zoom} 0 0 ${-state.viewport.zoom} ${state.viewport.panX} ${state.viewport.panY})`,
    );
    group.append(this.buildWorldBounds(width, height, state.viewport));

    for (const element of state.scene.elements) {
      const polygon = createSvgElement('polygon');
      const points = element.nodeIds
        .map((nodeId) => nodeMap.get(nodeId))
        .filter((node): node is Node => Boolean(node))
        .map((node) => `${node.x},${node.y}`)
        .join(' ');
      const contourResult = elementResultMap.get(element.id);
      const materialKind = materialKindById.get(element.materialId);
      const contourColor = contourField !== 'none' && contourResult
        ? getContourColor(getContourValue(contourField, contourResult), contourMin, contourMax)
        : null;
      const materialFill = materialKind ? getMaterialKindFill(materialKind) : 'rgba(180, 120, 68, 0.13)';

      polygon.dataset.elementId = element.id;
      polygon.setAttribute('points', points);
      polygon.setAttribute('class', state.selection.elementIds.includes(element.id) ? 'mesh-element selected' : 'mesh-element');
      polygon.style.fill = contourColor ?? materialFill;
      group.append(polygon);
    }

    if (state.analysis.status === 'success' && state.visualization.showDeformedMesh) {
      for (const element of state.scene.elements) {
        const polygon = createSvgElement('polygon');
        const points = element.nodeIds
          .map((nodeId) => {
            const node = nodeMap.get(nodeId);
            const displacement = displacementMap.get(nodeId);

            if (!node) {
              return null;
            }

            return {
              x: node.x + (displacement?.ux ?? 0) * state.visualization.deformationScale,
              y: node.y + (displacement?.uy ?? 0) * state.visualization.deformationScale,
            };
          })
          .filter((point): point is { x: number; y: number } => Boolean(point))
          .map((point) => `${point.x},${point.y}`)
          .join(' ');

        polygon.setAttribute('points', points);
        polygon.setAttribute('class', 'deformed-element');
        group.append(polygon);
      }
    }

    if (state.analysis.status === 'success' && state.visualization.showDisplacementVectors) {
      for (const node of state.scene.nodes) {
        const displacement = displacementMap.get(node.id);

        if (!displacement || displacement.magnitude <= 1e-12) {
          continue;
        }

        const line = createSvgElement('line');
        line.setAttribute('x1', `${node.x}`);
        line.setAttribute('y1', `${node.y}`);
        line.setAttribute('x2', `${node.x + displacement.ux * displacementScale}`);
        line.setAttribute('y2', `${node.y + displacement.uy * displacementScale}`);
        line.setAttribute('class', 'displacement-vector');
        line.setAttribute('marker-end', 'url(#displacement-arrowhead)');
        group.append(line);
      }
    }

    if (state.analysis.status === 'success' && state.visualization.showReactionVectors) {
      for (const reaction of state.analysis.result?.reactions ?? []) {
        if (reaction.magnitude <= 1e-12) {
          continue;
        }

        const node = nodeMap.get(reaction.nodeId);

        if (!node) {
          continue;
        }

        const line = createSvgElement('line');
        line.setAttribute('x1', `${node.x}`);
        line.setAttribute('y1', `${node.y}`);
        line.setAttribute('x2', `${node.x + reaction.rx * reactionScale}`);
        line.setAttribute('y2', `${node.y + reaction.ry * reactionScale}`);
        line.setAttribute('class', 'reaction-vector');
        line.setAttribute('marker-end', 'url(#reaction-arrowhead)');
        group.append(line);
      }
    }

    for (const support of state.scene.supports) {
      const node = nodeMap.get(support.nodeId);

      if (!node) {
        continue;
      }

      group.append(createSupportMarker(node, support.direction, selectedSupportIds.has(support.id), support.id));
    }

    for (const load of state.scene.loads) {
      const node = nodeMap.get(load.nodeId);

      if (!node) {
        continue;
      }

      const shaft = createSvgElement('line');
      shaft.dataset.loadId = load.id;
      shaft.setAttribute('x1', `${node.x}`);
      shaft.setAttribute('y1', `${node.y}`);
      shaft.setAttribute('x2', `${node.x + load.fx * loadVectorScale}`);
      shaft.setAttribute('y2', `${node.y + load.fy * loadVectorScale}`);
      shaft.setAttribute('class', selectedLoadIds.has(load.id) ? 'load-arrow selected' : 'load-arrow');
      group.append(shaft);

      const head = createSvgElement('circle');
      head.dataset.loadId = load.id;
      head.setAttribute('cx', `${node.x + load.fx * loadVectorScale}`);
      head.setAttribute('cy', `${node.y + load.fy * loadVectorScale}`);
      head.setAttribute('r', '3.5');
      head.setAttribute('class', selectedLoadIds.has(load.id) ? 'load-arrow-head selected' : 'load-arrow-head');
      group.append(head);

      if (draggedLoadId === load.id) {
        const label = createSvgElement('text');
        const labelX = node.x + load.fx * loadVectorScale + 8;
        const labelY = node.y + load.fy * loadVectorScale + 14;

        label.setAttribute('x', `${labelX}`);
        label.setAttribute('y', `${labelY}`);
        label.setAttribute('class', 'load-value-label');
        label.setAttribute('transform', `scale(1 -1) translate(0 ${-2 * labelY})`);
        label.textContent = `Fx=${load.fx.toFixed(1)} Fy=${load.fy.toFixed(1)}`;
        group.append(label);
      }
    }

    for (const node of state.scene.nodes) {
      const circle = createSvgElement('circle');
      const isSelected = state.selection.nodeIds.includes(node.id)
        || selectedSupportNodeIds.has(node.id)
        || selectedLoadNodeIds.has(node.id);
      const isStaged = state.stagedElementNodeIds.includes(node.id);
      const isHovered = state.hoveredNodeId === node.id;
      const className = ['mesh-node'];

      if (isSelected) {
        className.push('selected');
      }

      if (isStaged) {
        className.push('staged');
      }

      if (isHovered) {
        className.push('hovered');
      }

      circle.dataset.nodeId = node.id;
      circle.setAttribute('cx', `${node.x}`);
      circle.setAttribute('cy', `${node.y}`);
      circle.setAttribute('r', '5.5');
      circle.setAttribute('class', className.join(' '));
      group.append(circle);

      const label = createSvgElement('text');
      label.setAttribute('x', `${node.x + 8}`);
      label.setAttribute('y', `${node.y + 8}`);
      label.setAttribute('class', 'node-label');
      label.setAttribute('transform', `scale(1 -1) translate(0 ${-2 * (node.y + 8)})`);
      label.textContent = node.id;
      group.append(label);
    }

    return group;
  }

  private buildOverlay(state: AppState, width: number): SVGGElement {
    const group = createSvgElement('g');
    const materialKinds = getMaterialKindsInScene(state);

    if (state.visualization.contourField === 'none' && materialKinds.length > 0) {
      const legendX = width - 226;
      const legendY = 24;
      const panelHeight = 58 + materialKinds.length * 22;
      const panel = createSvgElement('rect');
      panel.setAttribute('x', `${legendX}`);
      panel.setAttribute('y', `${legendY}`);
      panel.setAttribute('width', '198');
      panel.setAttribute('height', `${panelHeight}`);
      panel.setAttribute('rx', '18');
      panel.setAttribute('class', 'overlay-panel');
      group.append(panel);

      const title = createSvgElement('text');
      title.setAttribute('x', `${legendX + 16}`);
      title.setAttribute('y', `${legendY + 24}`);
      title.setAttribute('class', 'overlay-title');
      title.textContent = 'Material Fill';
      group.append(title);

      let currentY = legendY + 44;

      for (const kind of materialKinds) {
        const swatch = createSvgElement('rect');
        swatch.setAttribute('x', `${legendX + 16}`);
        swatch.setAttribute('y', `${currentY - 10}`);
        swatch.setAttribute('width', '18');
        swatch.setAttribute('height', '12');
        swatch.setAttribute('rx', '4');
        swatch.setAttribute('fill', materialKindPresentation[kind].fill);
        swatch.setAttribute('class', 'material-legend-swatch');
        group.append(swatch);

        const label = createSvgElement('text');
        label.setAttribute('x', `${legendX + 44}`);
        label.setAttribute('y', `${currentY}`);
        label.setAttribute('class', 'overlay-copy');
        label.textContent = materialKindPresentation[kind].label;
        group.append(label);

        currentY += 22;
      }

      return group;
    }

    if (state.analysis.status !== 'success' || !state.analysis.result) {
      return group;
    }

    const legendX = width - 226;
    const legendY = 24;
    const panelHeight = state.visualization.contourField === 'none' ? 132 : 172;
    const panel = createSvgElement('rect');
    panel.setAttribute('x', `${legendX}`);
    panel.setAttribute('y', `${legendY}`);
    panel.setAttribute('width', '198');
    panel.setAttribute('height', `${panelHeight}`);
    panel.setAttribute('rx', '18');
    panel.setAttribute('class', 'overlay-panel');
    group.append(panel);

    const title = createSvgElement('text');
    title.setAttribute('x', `${legendX + 16}`);
    title.setAttribute('y', `${legendY + 24}`);
    title.setAttribute('class', 'overlay-title');
    title.textContent = 'Visualization';
    group.append(title);

    let currentY = legendY + 46;

    if (state.visualization.contourField !== 'none') {
      const values = state.analysis.result.elementResults.map((result) => getContourValue(state.visualization.contourField, result));
      const minValue = Math.min(...values);
      const maxValue = Math.max(...values);
      const gradient = createSvgElement('linearGradient');
      gradient.setAttribute('id', 'contour-legend-gradient');
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('y2', '0%');
      const stops: Array<[string, string]> = [
        ['0%', 'rgb(49, 92, 121)'],
        ['50%', 'rgb(238, 228, 205)'],
        ['100%', 'rgb(159, 76, 44)'],
      ];

      stops.forEach(([offset, color]) => {
        const stop = createSvgElement('stop');
        stop.setAttribute('offset', offset);
        stop.setAttribute('stop-color', color);
        gradient.append(stop);
      });
      const defs = this.svg.querySelector('defs');
      defs?.append(gradient);

      const contourLabel = createSvgElement('text');
      contourLabel.setAttribute('x', `${legendX + 16}`);
      contourLabel.setAttribute('y', `${currentY}`);
      contourLabel.setAttribute('class', 'overlay-copy');
      contourLabel.textContent = `Contour: ${state.visualization.contourField}`;
      group.append(contourLabel);

      const gradientRect = createSvgElement('rect');
      gradientRect.setAttribute('x', `${legendX + 16}`);
      gradientRect.setAttribute('y', `${currentY + 10}`);
      gradientRect.setAttribute('width', '166');
      gradientRect.setAttribute('height', '14');
      gradientRect.setAttribute('rx', '7');
      gradientRect.setAttribute('fill', 'url(#contour-legend-gradient)');
      group.append(gradientRect);

      const minLabel = createSvgElement('text');
      minLabel.setAttribute('x', `${legendX + 16}`);
      minLabel.setAttribute('y', `${currentY + 39}`);
      minLabel.setAttribute('class', 'overlay-copy');
      minLabel.textContent = minValue.toFixed(3);
      group.append(minLabel);

      const maxLabel = createSvgElement('text');
      maxLabel.setAttribute('x', `${legendX + 182}`);
      maxLabel.setAttribute('y', `${currentY + 39}`);
      maxLabel.setAttribute('text-anchor', 'end');
      maxLabel.setAttribute('class', 'overlay-copy');
      maxLabel.textContent = maxValue.toFixed(3);
      group.append(maxLabel);

      currentY += 58;
    }

    const displacementKey = createSvgElement('line');
    displacementKey.setAttribute('x1', `${legendX + 16}`);
    displacementKey.setAttribute('y1', `${currentY}`);
    displacementKey.setAttribute('x2', `${legendX + 44}`);
    displacementKey.setAttribute('y2', `${currentY}`);
    displacementKey.setAttribute('class', 'displacement-vector');
    displacementKey.setAttribute('marker-end', 'url(#displacement-arrowhead)');
    group.append(displacementKey);

    const displacementLabel = createSvgElement('text');
    displacementLabel.setAttribute('x', `${legendX + 54}`);
    displacementLabel.setAttribute('y', `${currentY + 4}`);
    displacementLabel.setAttribute('class', 'overlay-copy');
    displacementLabel.textContent = `Displacement vectors ${state.visualization.showDisplacementVectors ? 'on' : 'off'}`;
    group.append(displacementLabel);

    currentY += 24;

    const reactionKey = createSvgElement('line');
    reactionKey.setAttribute('x1', `${legendX + 16}`);
    reactionKey.setAttribute('y1', `${currentY}`);
    reactionKey.setAttribute('x2', `${legendX + 44}`);
    reactionKey.setAttribute('y2', `${currentY}`);
    reactionKey.setAttribute('class', 'reaction-vector');
    reactionKey.setAttribute('marker-end', 'url(#reaction-arrowhead)');
    group.append(reactionKey);

    const reactionLabel = createSvgElement('text');
    reactionLabel.setAttribute('x', `${legendX + 54}`);
    reactionLabel.setAttribute('y', `${currentY + 4}`);
    reactionLabel.setAttribute('class', 'overlay-copy');
    reactionLabel.textContent = `Reaction vectors ${state.visualization.showReactionVectors ? 'on' : 'off'}`;
    group.append(reactionLabel);

    return group;
  }

  private buildWorldBounds(width: number, height: number, viewport: ViewportState): SVGRectElement {
    const left = -viewport.panX / viewport.zoom;
    const top = viewport.panY / viewport.zoom;
    const right = (width - viewport.panX) / viewport.zoom;
    const bottom = (viewport.panY - height) / viewport.zoom;
    const rect = createSvgElement('rect');

    rect.setAttribute('x', `${left}`);
    rect.setAttribute('y', `${bottom}`);
    rect.setAttribute('width', `${right - left}`);
    rect.setAttribute('height', `${top - bottom}`);
    rect.setAttribute('fill', 'transparent');

    return rect;
  }
}
