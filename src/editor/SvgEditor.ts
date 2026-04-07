import type { AppState, Node, ViewportState } from '../model/types';
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

    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;

      if (!nodeId) {
        return;
      }

      if (state.tool === 'add-element') {
        this.store.stageElementNode(nodeId);
        return;
      }

      this.store.selectNode(nodeId, event.shiftKey || event.metaKey);
      this.dragState = { kind: 'move-node', pointerId: event.pointerId, nodeId };
      this.svg.setPointerCapture(event.pointerId);
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

    this.svg.append(
      this.buildGrid(state.viewport, width, height),
      this.buildWorld(state, width, height),
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
    group.setAttribute(
      'transform',
      `matrix(${state.viewport.zoom} 0 0 ${state.viewport.zoom} ${state.viewport.panX} ${state.viewport.panY})`,
    );
    group.append(this.buildWorldBounds(width, height, state.viewport));

    for (const element of state.scene.elements) {
      const polygon = createSvgElement('polygon');
      const points = element.nodeIds
        .map((nodeId) => state.scene.nodes.find((node) => node.id === nodeId))
        .filter((node): node is Node => Boolean(node))
        .map((node) => `${node.x},${node.y}`)
        .join(' ');

      polygon.setAttribute('points', points);
      polygon.setAttribute('class', state.selection.elementIds.includes(element.id) ? 'mesh-element selected' : 'mesh-element');
      group.append(polygon);
    }

    for (const support of state.scene.supports) {
      const node = state.scene.nodes.find((candidate) => candidate.id === support.nodeId);

      if (!node) {
        continue;
      }

      const marker = createSvgElement('path');
      marker.setAttribute('d', `M ${node.x - 8} ${node.y + 10} L ${node.x + 8} ${node.y + 10} L ${node.x} ${node.y + 18} Z`);
      marker.setAttribute('class', 'support-marker');
      group.append(marker);
    }

    for (const load of state.scene.loads) {
      const node = state.scene.nodes.find((candidate) => candidate.id === load.nodeId);

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
