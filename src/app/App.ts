import { SvgEditor } from '../editor/SvgEditor';
import type { AppState, ContourField, ElementAnalysisResult, ToolMode } from '../model/types';
import { AppStore } from '../store/AppStore';

const toolMeta: Array<{ mode: ToolMode; label: string; shortcut: string }> = [
  { mode: 'select', label: 'Select / Pan', shortcut: '1' },
  { mode: 'add-node', label: 'Add Node', shortcut: '2' },
  { mode: 'add-element', label: 'Add Triangle', shortcut: '3' },
  { mode: 'add-support', label: 'Stamp Support', shortcut: '4' },
  { mode: 'add-load', label: 'Stamp Load', shortcut: '5' },
];

const contourFieldMeta: Array<{ value: ContourField; label: string }> = [
  { value: 'none', label: 'No contour fill' },
  { value: 'meanStress', label: 'Mean stress p' },
  { value: 'deviatoricStress', label: 'Deviatoric stress q' },
  { value: 'sxx', label: 'Sigma xx' },
  { value: 'syy', label: 'Sigma yy' },
  { value: 'txy', label: 'Tau xy' },
  { value: 'volumetricStrain', label: 'Volumetric strain' },
];

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Math.floor(Number(value));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getContourFieldLabel(field: ContourField): string {
  return contourFieldMeta.find((candidate) => candidate.value === field)?.label ?? field;
}

function getContourValues(field: ContourField, elementResults: ElementAnalysisResult[]): number[] {
  if (field === 'none') {
    return [];
  }

  return elementResults.map((result) => {
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
      default:
        return 0;
    }
  });
}

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
          <h1>FEM studio</h1>
        </div>
        <div class="topbar-actions">
          <button type="button" class="primary-action" data-action="solve-linear">Solve Linear Elastic</button>
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
            <p class="panel-label">Structured Mesh</p>
            <div class="control-grid">
              <label class="labelled-field">
                <span>Width</span>
                <input type="number" min="10" step="10" data-role="mesh-width" />
              </label>
              <label class="labelled-field">
                <span>Height</span>
                <input type="number" min="10" step="10" data-role="mesh-height" />
              </label>
              <label class="labelled-field">
                <span>Divisions X</span>
                <input type="number" min="1" step="1" data-role="mesh-divisions-x" />
              </label>
              <label class="labelled-field">
                <span>Divisions Y</span>
                <input type="number" min="1" step="1" data-role="mesh-divisions-y" />
              </label>
            </div>
            <button type="button" class="primary-action" data-action="generate-mesh">Generate Rectangle</button>
          </section>
          <section>
            <p class="panel-label">Stamp Settings</p>
            <div class="control-grid">
              <label class="checkbox-row">
                <input type="checkbox" data-role="support-fix-x" />
                <span>Fix X</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" data-role="support-fix-y" />
                <span>Fix Y</span>
              </label>
              <label class="labelled-field">
                <span>Load Fx</span>
                <input type="number" step="1" data-role="load-fx" />
              </label>
              <label class="labelled-field">
                <span>Load Fy</span>
                <input type="number" step="1" data-role="load-fy" />
              </label>
            </div>
            <div class="note-stack">
              <p>Set both support flags off to remove a support stamp.</p>
              <p>Set Fx and Fy to zero to remove a nodal load stamp.</p>
            </div>
          </section>
          <section>
            <p class="panel-label">Visualization</p>
            <div class="control-grid">
              <label class="labelled-field control-span-2">
                <span>Contour field</span>
                <select data-role="contour-field"></select>
              </label>
              <label class="labelled-field">
                <span>Deformation scale</span>
                <input type="number" min="0" step="0.25" data-role="deformation-scale" />
              </label>
              <label class="checkbox-row">
                <input type="checkbox" data-role="show-deformed" />
                <span>Show deformed mesh</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" data-role="show-displacement-vectors" />
                <span>Show displacement vectors</span>
              </label>
              <label class="checkbox-row">
                <input type="checkbox" data-role="show-reaction-vectors" />
                <span>Show reaction vectors</span>
              </label>
            </div>
          </section>
        </aside>
        <section class="viewport-panel">
          <div class="viewport-header">
            <div>
              <p class="panel-label">Editor</p>
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
            <p class="panel-label">Analysis</p>
            <div class="note-stack" data-role="analysis-panel"></div>
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
        <article data-role="results-summary">
          <p class="panel-label">Analysis</p>
          <h3>Linear-elastic response</h3>
          <div class="note-stack"></div>
        </article>
        <article data-role="results-detail">
          <p class="panel-label">Terra Cotta</p>
          <h3>Constitutive seam reserved</h3>
          <div class="note-stack"></div>
        </article>
      </section>
    </div>
  `;

  const toolList = root.querySelector<HTMLDivElement>('[data-role="tool-list"]');
  const svg = root.querySelector<SVGSVGElement>('[data-role="editor-surface"]');
  const sceneStats = root.querySelector<HTMLDivElement>('[data-role="scene-stats"]');
  const analysisPanel = root.querySelector<HTMLDivElement>('[data-role="analysis-panel"]');
  const selectionPanel = root.querySelector<HTMLDivElement>('[data-role="selection-panel"]');
  const materialPanel = root.querySelector<HTMLDivElement>('[data-role="material-panel"]');
  const statusPill = root.querySelector<HTMLDivElement>('[data-role="status-pill"]');
  const resultsSummary = root.querySelector<HTMLElement>('[data-role="results-summary"] .note-stack');
  const resultsDetail = root.querySelector<HTMLElement>('[data-role="results-detail"] .note-stack');
  const importInput = root.querySelector<HTMLInputElement>('[data-role="import-file"]');
  const meshWidthInput = root.querySelector<HTMLInputElement>('[data-role="mesh-width"]');
  const meshHeightInput = root.querySelector<HTMLInputElement>('[data-role="mesh-height"]');
  const meshDivisionsXInput = root.querySelector<HTMLInputElement>('[data-role="mesh-divisions-x"]');
  const meshDivisionsYInput = root.querySelector<HTMLInputElement>('[data-role="mesh-divisions-y"]');
  const supportFixXInput = root.querySelector<HTMLInputElement>('[data-role="support-fix-x"]');
  const supportFixYInput = root.querySelector<HTMLInputElement>('[data-role="support-fix-y"]');
  const loadFxInput = root.querySelector<HTMLInputElement>('[data-role="load-fx"]');
  const loadFyInput = root.querySelector<HTMLInputElement>('[data-role="load-fy"]');
  const contourFieldSelect = root.querySelector<HTMLSelectElement>('[data-role="contour-field"]');
  const deformationScaleInput = root.querySelector<HTMLInputElement>('[data-role="deformation-scale"]');
  const showDeformedInput = root.querySelector<HTMLInputElement>('[data-role="show-deformed"]');
  const showDisplacementVectorsInput = root.querySelector<HTMLInputElement>('[data-role="show-displacement-vectors"]');
  const showReactionVectorsInput = root.querySelector<HTMLInputElement>('[data-role="show-reaction-vectors"]');
  const exportButton = root.querySelector<HTMLButtonElement>('[data-action="export-scene"]');
  const importButton = root.querySelector<HTMLButtonElement>('[data-action="import-scene"]');
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset-scene"]');
  const solveButton = root.querySelector<HTMLButtonElement>('[data-action="solve-linear"]');
  const generateMeshButton = root.querySelector<HTMLButtonElement>('[data-action="generate-mesh"]');

  if (!toolList || !svg || !sceneStats || !analysisPanel || !selectionPanel || !materialPanel || !statusPill || !resultsSummary || !resultsDetail || !importInput || !meshWidthInput || !meshHeightInput || !meshDivisionsXInput || !meshDivisionsYInput || !supportFixXInput || !supportFixYInput || !loadFxInput || !loadFyInput || !contourFieldSelect || !deformationScaleInput || !showDeformedInput || !showDisplacementVectorsInput || !showReactionVectorsInput || !exportButton || !importButton || !resetButton || !solveButton || !generateMeshButton) {
    throw new Error('App shell is missing required DOM nodes.');
  }

  contourFieldSelect.innerHTML = contourFieldMeta
    .map((field) => `<option value="${field.value}">${field.label}</option>`)
    .join('');

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
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

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

  solveButton.addEventListener('click', () => {
    store.solveLinearElastic();
  });

  const updateMeshDraft = (): void => {
    const current = store.getState().meshDraft;

    store.setMeshDraft({
      width: parseNumber(meshWidthInput.value, current.width),
      height: parseNumber(meshHeightInput.value, current.height),
      divisionsX: parsePositiveInteger(meshDivisionsXInput.value, current.divisionsX),
      divisionsY: parsePositiveInteger(meshDivisionsYInput.value, current.divisionsY),
    });
  };

  const updateSupportDraft = (): void => {
    store.setSupportDraft({
      fixX: supportFixXInput.checked,
      fixY: supportFixYInput.checked,
    });
  };

  const updateLoadDraft = (): void => {
    const current = store.getState().loadDraft;

    store.setLoadDraft({
      fx: parseNumber(loadFxInput.value, current.fx),
      fy: parseNumber(loadFyInput.value, current.fy),
    });
  };

  const updateVisualization = (): void => {
    const current = store.getState().visualization;

    store.setVisualization({
      contourField: contourFieldSelect.value as ContourField,
      deformationScale: Math.max(0, parseNumber(deformationScaleInput.value, current.deformationScale)),
      showDeformedMesh: showDeformedInput.checked,
      showDisplacementVectors: showDisplacementVectorsInput.checked,
      showReactionVectors: showReactionVectorsInput.checked,
    });
  };

  meshWidthInput.addEventListener('input', updateMeshDraft);
  meshHeightInput.addEventListener('input', updateMeshDraft);
  meshDivisionsXInput.addEventListener('input', updateMeshDraft);
  meshDivisionsYInput.addEventListener('input', updateMeshDraft);
  supportFixXInput.addEventListener('input', updateSupportDraft);
  supportFixYInput.addEventListener('input', updateSupportDraft);
  loadFxInput.addEventListener('input', updateLoadDraft);
  loadFyInput.addEventListener('input', updateLoadDraft);
  contourFieldSelect.addEventListener('input', updateVisualization);
  deformationScaleInput.addEventListener('input', updateVisualization);
  showDeformedInput.addEventListener('input', updateVisualization);
  showDisplacementVectorsInput.addEventListener('input', updateVisualization);
  showReactionVectorsInput.addEventListener('input', updateVisualization);
  generateMeshButton.addEventListener('click', () => {
    store.generateStructuredMesh();
  });

  store.subscribe((state) => renderPanels(state, toolList, sceneStats, analysisPanel, selectionPanel, materialPanel, statusPill, resultsSummary, resultsDetail, {
    meshWidthInput,
    meshHeightInput,
    meshDivisionsXInput,
    meshDivisionsYInput,
    supportFixXInput,
    supportFixYInput,
    loadFxInput,
    loadFyInput,
    contourFieldSelect,
    deformationScaleInput,
    showDeformedInput,
    showDisplacementVectorsInput,
    showReactionVectorsInput,
  }));
}

interface ControlRefs {
  meshWidthInput: HTMLInputElement;
  meshHeightInput: HTMLInputElement;
  meshDivisionsXInput: HTMLInputElement;
  meshDivisionsYInput: HTMLInputElement;
  supportFixXInput: HTMLInputElement;
  supportFixYInput: HTMLInputElement;
  loadFxInput: HTMLInputElement;
  loadFyInput: HTMLInputElement;
  contourFieldSelect: HTMLSelectElement;
  deformationScaleInput: HTMLInputElement;
  showDeformedInput: HTMLInputElement;
  showDisplacementVectorsInput: HTMLInputElement;
  showReactionVectorsInput: HTMLInputElement;
}

function renderPanels(
  state: AppState,
  toolList: HTMLElement,
  sceneStats: HTMLElement,
  analysisPanel: HTMLElement,
  selectionPanel: HTMLElement,
  materialPanel: HTMLElement,
  statusPill: HTMLElement,
  resultsSummary: HTMLElement,
  resultsDetail: HTMLElement,
  controls: ControlRefs,
): void {
  toolList.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tool === state.tool);
  });

  const analysisLabel = state.analysis.status === 'success'
    ? 'solved'
    : state.analysis.status === 'error'
      ? 'solve error'
      : state.dirty
        ? 'unsolved changes'
        : 'ready';
  statusPill.textContent = `${state.scene.nodes.length} nodes · ${state.scene.elements.length} elements · ${state.tool} · ${analysisLabel}`;
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

  controls.meshWidthInput.value = `${state.meshDraft.width}`;
  controls.meshHeightInput.value = `${state.meshDraft.height}`;
  controls.meshDivisionsXInput.value = `${state.meshDraft.divisionsX}`;
  controls.meshDivisionsYInput.value = `${state.meshDraft.divisionsY}`;
  controls.supportFixXInput.checked = state.supportDraft.fixX;
  controls.supportFixYInput.checked = state.supportDraft.fixY;
  controls.loadFxInput.value = `${state.loadDraft.fx}`;
  controls.loadFyInput.value = `${state.loadDraft.fy}`;
  controls.contourFieldSelect.value = state.visualization.contourField;
  controls.deformationScaleInput.value = `${state.visualization.deformationScale}`;
  controls.showDeformedInput.checked = state.visualization.showDeformedMesh;
  controls.showDisplacementVectorsInput.checked = state.visualization.showDisplacementVectors;
  controls.showReactionVectorsInput.checked = state.visualization.showReactionVectors;

  if (state.analysis.status === 'success' && state.analysis.result) {
    const contourValues = getContourValues(state.visualization.contourField, state.analysis.result.elementResults);
    const contourRange = contourValues.length
      ? `${Math.min(...contourValues).toFixed(3)} to ${Math.max(...contourValues).toFixed(3)}`
      : 'disabled';
    analysisPanel.innerHTML = `
      <p>Max |u| = ${state.analysis.result.summary.maxDisplacement.toExponential(3)}</p>
      <p>Max |R| = ${state.analysis.result.summary.maxReaction.toExponential(3)}</p>
      <p>q max = ${state.analysis.result.summary.maxDeviatoricStress.toFixed(3)}</p>
      <p>p range = ${state.analysis.result.summary.minMeanStress.toFixed(3)} to ${state.analysis.result.summary.maxMeanStress.toFixed(3)}</p>
      <p>Contour: ${getContourFieldLabel(state.visualization.contourField)} (${contourRange})</p>
      <p>Vectors: u ${state.visualization.showDisplacementVectors ? 'on' : 'off'}, R ${state.visualization.showReactionVectors ? 'on' : 'off'}</p>
    `;
  } else if (state.analysis.status === 'error') {
    analysisPanel.innerHTML = `<p>${state.analysis.error}</p>`;
  } else {
    analysisPanel.innerHTML = '<p>Run the linear-elastic solve after editing supports and loads.</p>';
  }

  const selectedNodes = state.scene.nodes.filter((node) => state.selection.nodeIds.includes(node.id));
  const selectedElements = state.scene.elements.filter((element) => state.selection.elementIds.includes(element.id));
  const selectedNodeResults = state.analysis.result
    ? selectedNodes.map((node) => state.analysis.result?.displacements.find((candidate) => candidate.nodeId === node.id))
    : [];
  const selectedElementResults = state.analysis.result
    ? selectedElements.map((element) => state.analysis.result?.elementResults.find((candidate) => candidate.elementId === element.id))
    : [];
  selectionPanel.innerHTML = selectedNodes.length
    ? selectedNodes
        .map(
          (node, index) => {
            const support = state.scene.supports.find((candidate) => candidate.nodeId === node.id);
            const load = state.scene.loads.find((candidate) => candidate.nodeId === node.id);
            const displacement = selectedNodeResults[index];
            const reaction = state.analysis.result?.reactions.find((candidate) => candidate.nodeId === node.id);

            return `
              <p><strong>${node.id}</strong> at (${node.x.toFixed(1)}, ${node.y.toFixed(1)})</p>
              <p>Support: ${support ? `ux=${support.fixX ? 'fixed' : 'free'}, uy=${support.fixY ? 'fixed' : 'free'}` : 'none'}</p>
              <p>Load: ${load ? `Fx=${load.fx.toFixed(1)}, Fy=${load.fy.toFixed(1)}` : 'none'}</p>
              <p>Displacement: ${displacement ? `ux=${displacement.ux.toExponential(3)}, uy=${displacement.uy.toExponential(3)}` : 'not solved'}</p>
              <p>Reaction: ${reaction ? `Rx=${reaction.rx.toFixed(3)}, Ry=${reaction.ry.toFixed(3)}` : 'none'}</p>
            `;
          },
        )
        .join('')
    : selectedElements.length
      ? selectedElements.map((element, index) => {
          const result = selectedElementResults[index];

          return `
            <p><strong>${element.id}</strong> uses ${element.nodeIds.join(', ')}</p>
            <p>Stress: ${result ? `sxx=${result.stress.sxx.toFixed(3)}, syy=${result.stress.syy.toFixed(3)}, txy=${result.stress.txy.toFixed(3)}` : 'not solved'}</p>
            <p>Invariants: ${result ? `p=${result.stress.meanStress.toFixed(3)}, q=${result.stress.deviatoricStress.toFixed(3)}` : 'not solved'}</p>
          `;
        }).join('')
      : '<p>No node or element selected.</p>';

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

  if (state.analysis.status === 'success' && state.analysis.result) {
    const topDisplacement = [...state.analysis.result.displacements].sort((left, right) => right.magnitude - left.magnitude)[0];
    const topReaction = [...state.analysis.result.reactions].sort((left, right) => right.magnitude - left.magnitude)[0];

    resultsSummary.innerHTML = `
      <p>Maximum displacement occurs at <strong>${topDisplacement?.nodeId ?? 'n/a'}</strong>.</p>
      <p>|u| = ${topDisplacement ? topDisplacement.magnitude.toExponential(3) : '0.000e+0'}</p>
      <p>Maximum reaction occurs at <strong>${topReaction?.nodeId ?? 'n/a'}</strong>.</p>
      <p>|R| = ${topReaction ? topReaction.magnitude.toFixed(3) : '0.000'}</p>
      <p>Deformed mesh: ${state.visualization.showDeformedMesh ? `on (scale ${state.visualization.deformationScale.toFixed(2)})` : 'off'}</p>
      <p>Vectors: displacement ${state.visualization.showDisplacementVectors ? 'on' : 'off'}, reaction ${state.visualization.showReactionVectors ? 'on' : 'off'}</p>
    `;
    resultsDetail.innerHTML = `
      <p>The constitutive seam is still reserved for Terra Cotta, but the FE core now reports plane-strain mean stress p and deviatoric stress q from the elastic stress tensor.</p>
      <p>Use the element selection tool to inspect sxx, syy, txy, p, and q for any triangle, or switch the contour field to compare response across the mesh.</p>
    `;
  } else if (state.analysis.status === 'error') {
    resultsSummary.innerHTML = `<p>${state.analysis.error}</p>`;
    resultsDetail.innerHTML = '<p>Fix supports or mesh validity, then run the solve again.</p>';
  } else {
    resultsSummary.innerHTML = '<p>Build or import a mesh, stamp supports and loads, then run the linear-elastic solve.</p>';
    resultsDetail.innerHTML = '<p>The Terra Cotta constitutive pathway remains isolated from the current elastic solver so the later material-point work can slot in without changing the editor.</p>';
  }
}
