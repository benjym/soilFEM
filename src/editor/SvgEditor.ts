import type { AppState, ContourField, ElementAnalysisResult, Node, ViewportState } from '../model/types';
import { AppStore } from '../store/AppStore';

const svgNamespace = 'http://www.w3.org/2000/svg';

type DragState =
  | { kind: 'idle' }
  | { kind: 'pan'; pointerId: number; startPanX: number; startPanY: number; startClientX: number; startClientY: number }
  | { kind: 'move-node'; pointerId: number; nodeId: string };

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
    const nodeElement = (event.target as HTMLElement).closest<SVGCircleElement>('[data-node-id]');
    const polygonElement = (event.target as HTMLElement).closest<SVGPolygonElement>('[data-element-id]');

    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;

      if (!nodeId) {
        return;
      }

      if (state.tool === 'add-element') {
        this.store.stageElementNode(nodeId);
        return;
      }

      if (state.tool === 'add-support') {
        this.store.applySupportToNode(nodeId);
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
    const hoverTarget = (event.target as HTMLElement).closest<SVGCircleElement>('[data-node-id]');
    this.store.setHoveredNode(hoverTarget?.dataset.nodeId ?? null);

    if (this.dragState.kind === 'move-node' && this.dragState.pointerId === event.pointerId) {
      const world = this.clientToWorld(event.clientX, event.clientY, state.viewport);
      this.store.moveNode(this.dragState.nodeId, world.x, world.y);
      return;
    }

    if (this.dragState.kind === 'pan' && this.dragState.pointerId === event.pointerId) {
      const deltaX = event.clientX - this.dragState.startClientX;
      const deltaY = event.clientY - this.dragState.startClientY;

      this.store.setViewport({
        ...state.viewport,
        panX: this.dragState.startPanX + deltaX,
        panY: this.dragState.startPanY + deltaY,
      });
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (this.dragState.kind !== 'idle' && this.dragState.pointerId === event.pointerId) {
      this.svg.releasePointerCapture(event.pointerId);
      this.dragState = { kind: 'idle' };
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
    const worldY = (cursorY - state.viewport.panY) / state.viewport.zoom;

    this.store.setViewport({
      zoom: nextZoom,
      panX: cursorX - worldX * nextZoom,
      panY: cursorY - worldY * nextZoom,
    });
  }

  private clientToWorld(clientX: number, clientY: number, viewport: ViewportState): Point {
    const bounds = this.svg.getBoundingClientRect();
    const x = (clientX - bounds.left - viewport.panX) / viewport.zoom;
    const y = (clientY - bounds.top - viewport.panY) / viewport.zoom;

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
    const worldTop = -viewport.panY / viewport.zoom;
    const worldBottom = (height - viewport.panY) / viewport.zoom;
    const step = 40;
    const startX = Math.floor(worldLeft / step) * step;
    const startY = Math.floor(worldTop / step) * step;

    group.setAttribute('class', 'editor-grid');

    for (let x = startX; x <= worldRight + step; x += step) {
      const line = createSvgElement('line');
      line.setAttribute('x1', `${x * viewport.zoom + viewport.panX}`);
      line.setAttribute('y1', '0');
      line.setAttribute('x2', `${x * viewport.zoom + viewport.panX}`);
      line.setAttribute('y2', `${height}`);
      group.append(line);
    }

    for (let y = startY; y <= worldBottom + step; y += step) {
      const line = createSvgElement('line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', `${y * viewport.zoom + viewport.panY}`);
      line.setAttribute('x2', `${width}`);
      line.setAttribute('y2', `${y * viewport.zoom + viewport.panY}`);
      group.append(line);
    }

    return group;
  }

  private buildWorld(state: AppState, width: number, height: number): SVGGElement {
    const group = createSvgElement('g');
    const nodeMap = getNodeMap(state.scene.nodes);
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

    group.setAttribute(
      'transform',
      `matrix(${state.viewport.zoom} 0 0 ${state.viewport.zoom} ${state.viewport.panX} ${state.viewport.panY})`,
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
      const contourColor = contourField !== 'none' && contourResult
        ? getContourColor(getContourValue(contourField, contourResult), contourMin, contourMax)
        : null;

      polygon.dataset.elementId = element.id;
      polygon.setAttribute('points', points);
      polygon.setAttribute('class', state.selection.elementIds.includes(element.id) ? 'mesh-element selected' : 'mesh-element');
      if (contourColor) {
        polygon.style.fill = contourColor;
      }
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

      const marker = createSvgElement('path');
      marker.setAttribute('d', `M ${node.x - 8} ${node.y + 10} L ${node.x + 8} ${node.y + 10} L ${node.x} ${node.y + 18} Z`);
      marker.setAttribute('class', 'support-marker');
      group.append(marker);
    }

    for (const load of state.scene.loads) {
      const node = nodeMap.get(load.nodeId);

      if (!node) {
        continue;
      }

      const shaft = createSvgElement('line');
      shaft.setAttribute('x1', `${node.x}`);
      shaft.setAttribute('y1', `${node.y}`);
      shaft.setAttribute('x2', `${node.x + load.fx * 1.2}`);
      shaft.setAttribute('y2', `${node.y + load.fy * 1.2}`);
      shaft.setAttribute('class', 'load-arrow');
      group.append(shaft);

      const head = createSvgElement('circle');
      head.setAttribute('cx', `${node.x + load.fx * 1.2}`);
      head.setAttribute('cy', `${node.y + load.fy * 1.2}`);
      head.setAttribute('r', '3.5');
      head.setAttribute('class', 'load-arrow-head');
      group.append(head);
    }

    for (const node of state.scene.nodes) {
      const circle = createSvgElement('circle');
      const isSelected = state.selection.nodeIds.includes(node.id);
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
      label.setAttribute('y', `${node.y - 8}`);
      label.setAttribute('class', 'node-label');
      label.textContent = node.id;
      group.append(label);
    }

    return group;
  }

  private buildOverlay(state: AppState, width: number): SVGGElement {
    const group = createSvgElement('g');

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
    const top = -viewport.panY / viewport.zoom;
    const right = (width - viewport.panX) / viewport.zoom;
    const bottom = (height - viewport.panY) / viewport.zoom;
    const rect = createSvgElement('rect');

    rect.setAttribute('x', `${left}`);
    rect.setAttribute('y', `${top}`);
    rect.setAttribute('width', `${right - left}`);
    rect.setAttribute('height', `${bottom - top}`);
    rect.setAttribute('fill', 'transparent');

    return rect;
  }
}
