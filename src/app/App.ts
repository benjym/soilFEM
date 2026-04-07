import { SvgEditor } from '../editor/SvgEditor';
import type { AppState, ToolMode } from '../model/types';
import { AppStore } from '../store/AppStore';

const toolMeta: Array<{ mode: ToolMode; label: string; shortcut: string }> = [
  { mode: 'select', label: 'Select / Pan', shortcut: '1' },
  { mode: 'add-node', label: 'Add Node', shortcut: '2' },
  { mode: 'add-element', label: 'Add Triangle', shortcut: '3' },
];

function downloadScene(json: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = 'soilfem-scene.json';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function createApp(root: HTMLElement): void {
  const store = new AppStore();

  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Postgraduate Soil Mechanics</p>
          <h1>soilFEM studio</h1>
        </div>
        <div class="topbar-actions">
          <button type="button" data-action="export-scene">Export Scene</button>
          <button type="button" data-action="import-scene">Import Scene</button>
          <button type="button" data-action="reset-scene">Reset Example</button>
          <input type="file" data-role="import-file" accept="application/json" hidden />
        </div>
      </header>
      <main class="workspace">
        <aside class="panel left-panel">
          <section>
            <p class="panel-label">Tools</p>
            <div class="tool-list" data-role="tool-list"></div>
          </section>
          <section>
            <p class="panel-label">Interaction</p>
            <div class="note-stack">
              <p>Mouse wheel zooms.</p>
              <p>Drag a node to reshape the mesh.</p>
              <p>Add Triangle mode creates a CST element after three node clicks.</p>
            </div>
          </section>
          <section>
            <p class="panel-label">Roadmap</p>
            <div class="note-stack">
              <p>Current build focuses on geometry, state, and browser-first interaction.</p>
              <p>Linear elasticity and results views will plug into the same scene model next.</p>
            </div>
          </section>
        </aside>
        <section class="viewport-panel">
          <div class="viewport-header">
            <div>
              <p class="panel-label">Editor</p>
              <h2>Interactive mesh sketchpad</h2>
            </div>
            <div class="status-pill" data-role="status-pill"></div>
          </div>
          <svg class="editor-surface" data-role="editor-surface" aria-label="Finite element editor"></svg>
        </section>
        <aside class="panel right-panel">
          <section>
            <p class="panel-label">Scene</p>
            <div class="stat-grid" data-role="scene-stats"></div>
          </section>
          <section>
            <p class="panel-label">Selection</p>
            <div class="note-stack" data-role="selection-panel"></div>
          </section>
          <section>
            <p class="panel-label">Material</p>
            <div class="note-stack" data-role="material-panel"></div>
          </section>
        </aside>
      </main>
      <section class="results-strip">
        <article>
          <p class="panel-label">Analysis</p>
          <h3>Solver placeholder</h3>
          <p>The next implementation slice will assemble CST stiffness matrices from this scene graph and drive plane-strain linear elasticity in-browser.</p>
        </article>
        <article>
          <p class="panel-label">Terra Cotta</p>
          <h3>Constitutive seam reserved</h3>
          <p>The scene and material structures are shaped so a later material-point driver can consume the Figure 3a stress split and evolution laws without a UI rewrite.</p>
        </article>
      </section>
    </div>
  `;

  const toolList = root.querySelector<HTMLDivElement>('[data-role="tool-list"]');
  const svg = root.querySelector<SVGSVGElement>('[data-role="editor-surface"]');
  const sceneStats = root.querySelector<HTMLDivElement>('[data-role="scene-stats"]');
  const selectionPanel = root.querySelector<HTMLDivElement>('[data-role="selection-panel"]');
  const materialPanel = root.querySelector<HTMLDivElement>('[data-role="material-panel"]');
  const statusPill = root.querySelector<HTMLDivElement>('[data-role="status-pill"]');
  const importInput = root.querySelector<HTMLInputElement>('[data-role="import-file"]');
  const exportButton = root.querySelector<HTMLButtonElement>('[data-action="export-scene"]');
  const importButton = root.querySelector<HTMLButtonElement>('[data-action="import-scene"]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset-scene"]');

  if (!toolList || !svg || !sceneStats || !selectionPanel || !materialPanel || !statusPill || !importInput || !exportButton || !importButton || !resetButton) {
    throw new Error('App shell is missing required DOM nodes.');
  }

  const editor = new SvgEditor(svg, store);
  void editor;

  toolList.innerHTML = toolMeta
    .map(
      ({ mode, label, shortcut }) => `
        <button type="button" class="tool-button" data-tool="${mode}">
          <span>${label}</span>
          <span class="shortcut">${shortcut}</span>
        </button>
      `,
    )
    .join('');

  toolList.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.tool as ToolMode;
      store.setTool(mode);
    });
  });

  window.addEventListener('keydown', (event) => {
    const tool = toolMeta.find((candidate) => candidate.shortcut === event.key)?.mode;

    if (!tool) {
      if (event.key === 'Backspace' || event.key === 'Delete') {
        store.deleteSelection();
      }

      return;
    }

    store.setTool(tool);
  });

  exportButton.addEventListener('click', () => {
    downloadScene(store.exportScene());
  });

  importButton.addEventListener('click', () => {
    importInput.click();
  });

  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    store.importScene(text);
    importInput.value = '';
  });

  resetButton.addEventListener('click', () => {
    store.resetScene();
  });

  store.subscribe((state) => renderPanels(state, toolList, sceneStats, selectionPanel, materialPanel, statusPill));
}

function renderPanels(
  state: AppState,
  toolList: HTMLElement,
  sceneStats: HTMLElement,
  selectionPanel: HTMLElement,
  materialPanel: HTMLElement,
  statusPill: HTMLElement,
): void {
  toolList.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tool === state.tool);
  });

  statusPill.textContent = `${state.scene.nodes.length} nodes · ${state.scene.elements.length} elements · ${state.tool}`;
  statusPill.classList.toggle('is-dirty', state.dirty);

  sceneStats.innerHTML = [
    ['Nodes', `${state.scene.nodes.length}`],
    ['Elements', `${state.scene.elements.length}`],
    ['Supports', `${state.scene.supports.length}`],
    ['Loads', `${state.scene.loads.length}`],
    ['Zoom', `${state.viewport.zoom.toFixed(2)}x`],
    ['Dirty', state.dirty ? 'yes' : 'no'],
  ]
    .map(
      ([label, value]) => `
        <div class="stat-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
      `,
    )
    .join('');

  const selectedNodes = state.scene.nodes.filter((node) => state.selection.nodeIds.includes(node.id));
  selectionPanel.innerHTML = selectedNodes.length
    ? selectedNodes
        .map(
          (node) => `
            <p><strong>${node.id}</strong> at (${node.x.toFixed(1)}, ${node.y.toFixed(1)})</p>
          `,
        )
        .join('')
    : '<p>No node selected.</p>';

  if (state.stagedElementNodeIds.length > 0) {
    selectionPanel.insertAdjacentHTML(
      'beforeend',
      `<p>Triangle staging: ${state.stagedElementNodeIds.join(', ')}</p>`,
    );
  }

  if (state.hoveredNodeId) {
    selectionPanel.insertAdjacentHTML('beforeend', `<p>Hover: ${state.hoveredNodeId}</p>`);
  }

  materialPanel.innerHTML = state.scene.materials
    .map(
      (material) => `
        <p><strong>${material.name}</strong></p>
        <p>Model: plane strain linear elasticity</p>
        <p>E = ${material.youngModulus.toLocaleString()}</p>
        <p>ν = ${material.poissonRatio.toFixed(2)}</p>
      `,
    )
    .join('');
}
