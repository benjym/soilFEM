import { SvgEditor } from '../editor/SvgEditor';
import { exampleScenes, getExampleSceneById } from '../examples/exampleLibrary';
import type { AppState, ContourField, Element, Material, MaterialKind, MaterialNumericField, ToolMode } from '../model/types';
import { AppStore } from '../store/AppStore';

const toolMeta: Array<{ mode: ToolMode; label: string; shortcut: string }> = [
  { mode: 'select', label: 'Select / Pan', shortcut: '1' },
  { mode: 'add-node', label: 'Add Node', shortcut: '2' },
  { mode: 'add-element', label: 'Add Element', shortcut: '3' },
  { mode: 'add-support-x', label: 'Fix X', shortcut: '4' },
  { mode: 'add-support-y', label: 'Fix Y', shortcut: '5' },
  { mode: 'add-load', label: 'Stamp Load', shortcut: '6' },
];

const auxiliaryToolMeta = {
  action: 'open-mesh-dialog',
  label: 'Structured Mesh',
  shortcut: 'M',
} as const;

const contourFieldMeta: Array<{ value: ContourField; label: string }> = [
  { value: 'none', label: 'Material model fill' },
  { value: 'meanStress', label: 'Mean stress p' },
  { value: 'deviatoricStress', label: 'Deviatoric stress q' },
  { value: 'sxx', label: 'Sigma xx' },
  { value: 'syy', label: 'Sigma yy' },
  { value: 'txy', label: 'Tau xy' },
  { value: 'volumetricStrain', label: 'Volumetric strain' },
];

const materialKindMeta: Array<{ value: MaterialKind; label: string }> = [
  { value: 'linear-elastic-plane-strain', label: 'Linear Elastic' },
  { value: 'drucker-prager-plane-strain', label: 'Drucker-Prager' },
  { value: 'terra-cotta-plane-strain', label: 'Terra Cotta' },
];

const elasticMaterialFieldMeta: Array<{
  field: Extract<MaterialNumericField, 'youngModulus' | 'poissonRatio'>;
  label: string;
  min?: number;
  max?: number;
  step: string;
}> = [
  { field: 'youngModulus', label: 'Young modulus E', min: 1e-9, step: '100' },
  { field: 'poissonRatio', label: 'Poisson ratio nu', min: -0.99, max: 0.49, step: '0.01' },
];

const sharedMaterialFieldMeta: Array<{
  field: Extract<MaterialNumericField, 'density'>;
  label: string;
  min?: number;
  step: string;
}> = [
  { field: 'density', label: 'Density ρ', min: 0, step: 'any' },
];

const terraCottaElasticFieldMeta: Array<{
  field: Extract<MaterialNumericField, 'bulkModulus' | 'shearModulus'>;
  label: string;
  min?: number;
  step: string;
}> = [
  { field: 'bulkModulus', label: 'Intrinsic bulk stiffness K~', min: 1e-9, step: '0.1' },
  { field: 'shearModulus', label: 'Intrinsic shear stiffness G~', min: 1e-9, step: '0.1' },
];

const druckerPragerFieldMeta: Array<{
  field: Extract<MaterialNumericField, 'beta' | 'mu' | 'exponent' | 'loadSteps' | 'maxIterations' | 'tolerance'>;
  label: string;
  min?: number;
  step: string;
}> = [
  { field: 'beta', label: 'Beta', min: 0, step: '0.01' },
  { field: 'mu', label: 'Mu', min: 1e-9, step: '0.01' },
  { field: 'exponent', label: 'Exponent s', min: 1e-9, step: '0.01' },
  { field: 'loadSteps', label: 'Load steps', min: 1, step: '1' },
  { field: 'maxIterations', label: 'Max iterations', min: 1, step: '1' },
  { field: 'tolerance', label: 'Tolerance', min: 1e-12, step: 'any' },
];

const terraCottaFieldMeta: Array<{
  field: Extract<
    MaterialNumericField,
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
    | 'tolerance'
  >;
  label: string;
  min?: number;
  max?: number;
  step: string;
}> = [
  { field: 'initialConfinement', label: 'Initial confinement p₀', min: 0, step: '0.1' },
  { field: 'solidFraction', label: 'Solid fraction φ', min: 1e-6, max: 0.999999, step: '0.01' },
  { field: 'mesoTemperature', label: 'Meso-temperature Tm', min: 0, step: '0.01' },
  { field: 'energyCoupling', label: 'Energy coupling Γ', min: 1e-9, step: '0.1' },
  { field: 'criticalStateSlope', label: 'Critical state slope M', min: 1e-9, step: '0.01' },
  { field: 'omega', label: 'Omega ω', min: 1e-9, step: '0.01' },
  { field: 'compressionIndex', label: 'Compression index λ', min: 1e-9, step: '0.1' },
  { field: 'referenceSolidFraction', label: 'Reference solid frac φ_I', min: 1e-6, max: 0.999999, step: '0.01' },
  { field: 'volumetricCoefficient', label: 'Volumetric coeff a', min: 1e-9, step: '0.01' },
  { field: 'deviatoricCoefficient', label: 'Deviatoric coeff c', min: 1e-9, step: '0.01' },
  { field: 'dissipation', label: 'Dissipation η', min: 1e-9, step: '0.01' },
  { field: 'loadSteps', label: 'Load steps', min: 1, step: '1' },
  { field: 'maxIterations', label: 'Max iterations', min: 1, step: '1' },
  { field: 'tolerance', label: 'Tolerance', min: 1e-12, step: 'any' },
];

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function parsePositiveInteger(value: string, fallback: number): number {
  const parsed = Math.floor(Number(value));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isMaterialNumericField(value: string): value is MaterialNumericField {
  return [
    'youngModulus',
    'poissonRatio',
    'bulkModulus',
    'shearModulus',
    'density',
    'beta',
    'mu',
    'exponent',
    'initialConfinement',
    'solidFraction',
    'mesoTemperature',
    'energyCoupling',
    'criticalStateSlope',
    'omega',
    'compressionIndex',
    'referenceSolidFraction',
    'volumetricCoefficient',
    'deviatoricCoefficient',
    'dissipation',
    'loadSteps',
    'maxIterations',
    'tolerance',
  ].includes(value);
}

function isMaterialKind(value: string): value is MaterialKind {
  return materialKindMeta.some((candidate) => candidate.value === value);
}

function getMaterialValidationKey(materialId: string, field: MaterialNumericField): string {
  return `${materialId}:${field}`;
}

function getMaterialFieldErrorMessage(material: Material, field: MaterialNumericField): string {
  switch (field) {
    case 'youngModulus':
      return 'Young modulus must be positive.';
    case 'poissonRatio':
      return 'Poisson ratio must stay between -1 and 0.5.';
    case 'bulkModulus':
      return 'Intrinsic bulk stiffness must be positive.';
    case 'shearModulus':
      return 'Intrinsic shear stiffness must be positive.';
    case 'density':
      return 'Density must be zero or positive.';
    case 'beta':
      return 'Beta must be zero or positive.';
    case 'mu':
      return 'Mu must be positive.';
    case 'exponent':
      return 'Exponent must be positive.';
    case 'initialConfinement':
      return 'Initial confinement must be zero or positive.';
    case 'solidFraction':
      return 'Solid fraction must stay between 0 and 1.';
    case 'mesoTemperature':
      return 'Meso-temperature must be zero or positive.';
    case 'energyCoupling':
      return 'Energy coupling must be positive.';
    case 'criticalStateSlope':
      return 'Critical state slope must be positive.';
    case 'omega':
      return 'Omega must be positive.';
    case 'compressionIndex':
      return 'Compression index must be positive.';
    case 'referenceSolidFraction':
      return 'Reference solid fraction must stay between 0 and 1.';
    case 'volumetricCoefficient':
      return 'Volumetric coefficient must be positive.';
    case 'deviatoricCoefficient':
      return 'Deviatoric coefficient must be positive.';
    case 'dissipation':
      return 'Dissipation must be positive.';
    case 'loadSteps':
      return 'Load steps must be a positive integer.';
    case 'maxIterations':
      return 'Max iterations must be a positive integer.';
    case 'tolerance':
      return material.kind !== 'linear-elastic-plane-strain'
        ? 'Tolerance must be positive.'
        : 'This field is not available for the current material.';
    default:
      return 'Enter a valid number.';
  }
}

function getMaterialFieldValue(material: Material, field: MaterialNumericField): number | null {
  switch (field) {
    case 'youngModulus':
      return material.kind !== 'terra-cotta-plane-strain' ? material.youngModulus : null;
    case 'poissonRatio':
      return material.kind !== 'terra-cotta-plane-strain' ? material.poissonRatio : null;
    case 'bulkModulus':
      return material.kind === 'terra-cotta-plane-strain' ? material.bulkModulus : null;
    case 'shearModulus':
      return material.kind === 'terra-cotta-plane-strain' ? material.shearModulus : null;
    case 'density':
      return material.density;
    case 'beta':
      return material.kind === 'drucker-prager-plane-strain' ? material.beta : null;
    case 'mu':
      return material.kind === 'drucker-prager-plane-strain' ? material.mu : null;
    case 'exponent':
      return material.kind === 'drucker-prager-plane-strain' ? material.exponent : null;
    case 'initialConfinement':
      return material.kind === 'terra-cotta-plane-strain' ? material.initialConfinement : null;
    case 'solidFraction':
      return material.kind === 'terra-cotta-plane-strain' ? material.solidFraction : null;
    case 'mesoTemperature':
      return material.kind === 'terra-cotta-plane-strain' ? material.mesoTemperature : null;
    case 'energyCoupling':
      return material.kind === 'terra-cotta-plane-strain' ? material.energyCoupling : null;
    case 'criticalStateSlope':
      return material.kind === 'terra-cotta-plane-strain' ? material.criticalStateSlope : null;
    case 'omega':
      return material.kind === 'terra-cotta-plane-strain' ? material.omega : null;
    case 'compressionIndex':
      return material.kind === 'terra-cotta-plane-strain' ? material.compressionIndex : null;
    case 'referenceSolidFraction':
      return material.kind === 'terra-cotta-plane-strain' ? material.referenceSolidFraction : null;
    case 'volumetricCoefficient':
      return material.kind === 'terra-cotta-plane-strain' ? material.volumetricCoefficient : null;
    case 'deviatoricCoefficient':
      return material.kind === 'terra-cotta-plane-strain' ? material.deviatoricCoefficient : null;
    case 'dissipation':
      return material.kind === 'terra-cotta-plane-strain' ? material.dissipation : null;
    case 'loadSteps':
      return material.kind === 'linear-elastic-plane-strain' ? null : material.loadSteps ?? 12;
    case 'maxIterations':
      return material.kind === 'linear-elastic-plane-strain' ? null : material.maxIterations ?? 24;
    case 'tolerance':
      return material.kind === 'linear-elastic-plane-strain' ? null : material.tolerance ?? 1e-8;
    default:
      return null;
  }
}

function parseMaterialFieldValue(material: Material, field: MaterialNumericField, value: string): number | null {
  const parsed = field === 'loadSteps' || field === 'maxIterations'
    ? Math.floor(Number(value))
    : Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  switch (field) {
    case 'youngModulus':
      return material.kind !== 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'poissonRatio':
      return material.kind !== 'terra-cotta-plane-strain' && parsed > -0.999 && parsed < 0.5 ? parsed : null;
    case 'bulkModulus':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'shearModulus':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'density':
      return parsed >= 0 ? parsed : null;
    case 'beta':
      return material.kind === 'drucker-prager-plane-strain' && parsed >= 0 ? parsed : null;
    case 'mu':
      return material.kind === 'drucker-prager-plane-strain' && parsed > 0 ? parsed : null;
    case 'exponent':
      return material.kind === 'drucker-prager-plane-strain' && parsed > 0 ? parsed : null;
    case 'initialConfinement':
      return material.kind === 'terra-cotta-plane-strain' && parsed >= 0 ? parsed : null;
    case 'solidFraction':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 && parsed < 1 ? parsed : null;
    case 'mesoTemperature':
      return material.kind === 'terra-cotta-plane-strain' && parsed >= 0 ? parsed : null;
    case 'energyCoupling':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'criticalStateSlope':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'omega':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'compressionIndex':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'referenceSolidFraction':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 && parsed < 1 ? parsed : null;
    case 'volumetricCoefficient':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'deviatoricCoefficient':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'dissipation':
      return material.kind === 'terra-cotta-plane-strain' && parsed > 0 ? parsed : null;
    case 'loadSteps':
      return material.kind !== 'linear-elastic-plane-strain' && parsed > 0 ? parsed : null;
    case 'maxIterations':
      return material.kind !== 'linear-elastic-plane-strain' && parsed > 0 ? parsed : null;
    case 'tolerance':
      return material.kind !== 'linear-elastic-plane-strain' && parsed > 0 ? parsed : null;
    default:
      return null;
  }
}

function renderMaterialInput(
  material: Material,
  field: MaterialNumericField,
  label: string,
  step: string,
  validationErrors: Map<string, string>,
  min?: number,
  max?: number,
): string {
  const value = getMaterialFieldValue(material, field);

  if (value === null) {
    return '';
  }

  const error = validationErrors.get(getMaterialValidationKey(material.id, field));

  return `
    <label class="labelled-field material-field">
      <span>${label}</span>
      <input
        type="number"
        data-role="material-input"
        data-material-id="${material.id}"
        data-material-field="${field}"
        value="${value}"
        step="${step}"
        ${min === undefined ? '' : `min="${min}"`}
        ${max === undefined ? '' : `max="${max}"`}
      />
      ${error ? `<span class="field-error">${error}</span>` : ''}
    </label>
  `;
}

function renderMaterialPanel(
  materials: Material[],
  elements: Element[],
  selectedElementIds: string[],
  activeMaterialId: string | null,
  validationErrors: Map<string, string>,
): string {
  if (materials.length === 0) {
    return '<p>No materials are defined in this scene.</p>';
  }

  const selectedElementIdSet = new Set(selectedElementIds);

  const toolbar = `
    <div class="material-toolbar">
      <button type="button" data-action="add-linear-material">Add Linear Elastic</button>
      <button type="button" data-action="add-drucker-prager-material">Add Drucker-Prager</button>
      <button type="button" data-action="add-terra-cotta-material">Add Terra Cotta</button>
    </div>
  `;

  const cards = materials.map((material) => {
    const elementCount = elements.filter((element) => element.materialId === material.id).length;
    const selectedCount = elements.filter((element) => element.materialId === material.id && selectedElementIdSet.has(element.id)).length;
    const sharedFields = sharedMaterialFieldMeta
      .map((fieldMeta) => renderMaterialInput(material, fieldMeta.field, fieldMeta.label, fieldMeta.step, validationErrors, fieldMeta.min))
      .join('');
    const elasticFields = elasticMaterialFieldMeta
      .map((fieldMeta) => renderMaterialInput(material, fieldMeta.field, fieldMeta.label, fieldMeta.step, validationErrors, fieldMeta.min, fieldMeta.max))
      .join('');

    const header = `
      <div class="material-card-header">
        <div>
          <p><strong>${material.name}</strong></p>
          <p class="material-kind">${elementCount} elements${selectedCount > 0 ? ` · ${selectedCount} selected` : ''}${activeMaterialId === material.id ? ' · active for new elements' : ''}</p>
        </div>
        <div class="material-actions">
          <label class="labelled-field material-kind-field">
            <span>Type</span>
            <select data-role="material-kind" data-material-id="${material.id}">
              ${materialKindMeta
                .map((kindMeta) => `<option value="${kindMeta.value}" ${kindMeta.value === material.kind ? 'selected' : ''}>${kindMeta.label}</option>`)
                .join('')}
            </select>
          </label>
          <button type="button" data-action="activate-material" data-material-id="${material.id}" ${activeMaterialId === material.id ? 'disabled' : ''}>Use For New Elements</button>
          <button type="button" data-action="assign-material" data-material-id="${material.id}" ${selectedElementIds.length === 0 ? 'disabled' : ''}>Assign To Selected Elements</button>
          <button type="button" data-action="remove-material" data-material-id="${material.id}" ${materials.length <= 1 ? 'disabled' : ''}>Remove</button>
        </div>
      </div>
    `;

    if (material.kind === 'linear-elastic-plane-strain') {
      return `
        <div class="material-card">
          ${header}
          <div class="control-grid material-grid">${sharedFields}${elasticFields}</div>
        </div>
      `;
    }

    if (material.kind === 'drucker-prager-plane-strain') {
      const druckerPragerFields = druckerPragerFieldMeta
        .map((fieldMeta) => renderMaterialInput(material, fieldMeta.field, fieldMeta.label, fieldMeta.step, validationErrors, fieldMeta.min))
        .join('');

      return `
        <div class="material-card">
          ${header}
          <div class="control-grid material-grid">${sharedFields}${elasticFields}${druckerPragerFields}</div>
          <p class="material-note">Nonlinear solver controls apply when this material is present in the scene.</p>
        </div>
      `;
    }

    const terraCottaElasticFields = terraCottaElasticFieldMeta
      .map((fieldMeta) => renderMaterialInput(material, fieldMeta.field, fieldMeta.label, fieldMeta.step, validationErrors, fieldMeta.min))
      .join('');
    const terraCottaFields = terraCottaFieldMeta
      .map((fieldMeta) => renderMaterialInput(material, fieldMeta.field, fieldMeta.label, fieldMeta.step, validationErrors, fieldMeta.min, fieldMeta.max))
      .join('');

    return `
      <div class="material-card">
        ${header}
        <div class="control-grid material-grid">${sharedFields}${terraCottaElasticFields}${terraCottaFields}</div>
        <p class="material-note">Terra Cotta uses intrinsic nonlinear elastic stiffnesses K~ and G~, not Young's modulus and Poisson ratio.</p>
      </div>
    `;
  }).join('');

  return `${toolbar}${cards}`;
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
  const materialValidationErrors = new Map<string, string>();

  root.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <h1>FEM Studio</h1>
        </div>
        <div class="topbar-actions">
          <button type="button" class="primary-action" data-action="solve-linear">Solve FEM</button>
          <button type="button" data-action="export-scene">Save</button>
          <button type="button" data-action="import-scene">Load</button>
          <button type="button" data-action="reset-scene">Reset</button>
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
            <p class="panel-label">Examples</p>
            <div class="control-grid">
              <label class="labelled-field control-span-2">
                <select data-role="example-scene"></select>
              </label>
            </div>
          </section>
          <section>
            <p class="panel-label">Gravity</p>
            <div class="control-grid">
              <label class="checkbox-row control-span-2">
                <input type="checkbox" data-role="gravity-enabled" />
                <span>Enable gravity body force</span>
              </label>
              <div class="control-grid control-span-2" data-role="gravity-vector-controls">
                <label class="labelled-field">
                  <span>gx</span>
                  <input type="number" step="any" data-role="gravity-x" />
                </label>
                <label class="labelled-field">
                  <span>gy</span>
                  <input type="number" step="any" data-role="gravity-y" />
                </label>
              </div>
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
          <div class="editor-stage">
            <div class="editor-notice" data-role="editor-notice" hidden></div>
            <svg class="editor-surface" data-role="editor-surface" aria-label="Finite element editor"></svg>
          </div>
        </section>
        <aside class="panel right-panel">
          <section>
            <p class="panel-label">Material</p>
            <div class="note-stack" data-role="material-panel"></div>
          </section>
        </aside>
      </main>
      <dialog class="mesh-dialog" data-role="mesh-dialog">
        <form method="dialog" class="mesh-dialog-body">
          <div class="mesh-dialog-header">
            <div>
              <p class="panel-label">Structured Mesh</p>
              <h2>Rectangle Generator</h2>
            </div>
            <button type="submit" value="cancel">Close</button>
          </div>
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
          <div class="mesh-dialog-actions">
            <button type="submit" value="cancel">Cancel</button>
            <button type="button" class="primary-action mesh-generate-button" data-action="generate-mesh">Generate Rectangle</button>
          </div>
        </form>
      </dialog>
    </div>
  `;

  const toolList = root.querySelector<HTMLDivElement>('[data-role="tool-list"]');
  const svg = root.querySelector<SVGSVGElement>('[data-role="editor-surface"]');
  const editorNotice = root.querySelector<HTMLDivElement>('[data-role="editor-notice"]');
  const materialPanel = root.querySelector<HTMLDivElement>('[data-role="material-panel"]');
  const statusPill = root.querySelector<HTMLDivElement>('[data-role="status-pill"]');
  const importInput = root.querySelector<HTMLInputElement>('[data-role="import-file"]');
  const exampleSceneSelect = root.querySelector<HTMLSelectElement>('[data-role="example-scene"]');
  const gravityEnabledInput = root.querySelector<HTMLInputElement>('[data-role="gravity-enabled"]');
  const gravityVectorControls = root.querySelector<HTMLDivElement>('[data-role="gravity-vector-controls"]');
  const gravityXInput = root.querySelector<HTMLInputElement>('[data-role="gravity-x"]');
  const gravityYInput = root.querySelector<HTMLInputElement>('[data-role="gravity-y"]');
  const meshDialog = root.querySelector<HTMLDialogElement>('[data-role="mesh-dialog"]');
  const meshWidthInput = root.querySelector<HTMLInputElement>('[data-role="mesh-width"]');
  const meshHeightInput = root.querySelector<HTMLInputElement>('[data-role="mesh-height"]');
  const meshDivisionsXInput = root.querySelector<HTMLInputElement>('[data-role="mesh-divisions-x"]');
  const meshDivisionsYInput = root.querySelector<HTMLInputElement>('[data-role="mesh-divisions-y"]');
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

  if (!toolList || !svg || !editorNotice || !materialPanel || !statusPill || !importInput || !exampleSceneSelect || !gravityEnabledInput || !gravityVectorControls || !gravityXInput || !gravityYInput || !meshDialog || !meshWidthInput || !meshHeightInput || !meshDivisionsXInput || !meshDivisionsYInput || !contourFieldSelect || !deformationScaleInput || !showDeformedInput || !showDisplacementVectorsInput || !showReactionVectorsInput || !exportButton || !importButton || !resetButton || !solveButton || !generateMeshButton) {
    throw new Error('App shell is missing required DOM nodes.');
  }

  exampleSceneSelect.innerHTML = exampleScenes
    .map((example) => `<option value="${example.id}">${example.label}</option>`)
    .join('');
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
    .join('') + `
      <button type="button" class="tool-button tool-button-secondary" data-action="${auxiliaryToolMeta.action}">
        <span>${auxiliaryToolMeta.label}</span>
        <span class="shortcut">${auxiliaryToolMeta.shortcut}</span>
      </button>
    `;

  toolList.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.tool as ToolMode;
      store.setTool(mode);
    });
  });

  toolList.querySelector<HTMLButtonElement>(`[data-action="${auxiliaryToolMeta.action}"]`)?.addEventListener('click', () => {
    meshDialog.showModal();
  });

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    const tool = toolMeta.find((candidate) => candidate.shortcut === event.key)?.mode;

    if (!tool) {
      if (event.key.toLowerCase() === auxiliaryToolMeta.shortcut.toLowerCase()) {
        meshDialog.showModal();
        return;
      }

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

  const loadSelectedExample = (): void => {
    const nextExample = getExampleSceneById(exampleSceneSelect.value);

    if (!nextExample) {
      return;
    }

    store.loadScene(nextExample.scene);
  };

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

  const updateGravity = (): void => {
    const current = store.getState().scene.gravity;

    store.setGravity({
      enabled: gravityEnabledInput.checked,
      x: parseNumber(gravityXInput.value, current.x),
      y: parseNumber(gravityYInput.value, current.y),
    });
  };

  const renderCurrentState = (): void => {
    renderPanels(
      store.getState(),
      toolList,
      materialPanel,
      statusPill,
      editorNotice,
      {
        meshWidthInput,
        meshHeightInput,
        meshDivisionsXInput,
        meshDivisionsYInput,
        gravityEnabledInput,
        gravityVectorControls,
        gravityXInput,
        gravityYInput,
        contourFieldSelect,
        deformationScaleInput,
        showDeformedInput,
        showDisplacementVectorsInput,
        showReactionVectorsInput,
      },
      materialValidationErrors,
    );
  };

  meshWidthInput.addEventListener('input', updateMeshDraft);
  meshHeightInput.addEventListener('input', updateMeshDraft);
  meshDivisionsXInput.addEventListener('input', updateMeshDraft);
  meshDivisionsYInput.addEventListener('input', updateMeshDraft);
  gravityEnabledInput.addEventListener('input', updateGravity);
  gravityXInput.addEventListener('change', updateGravity);
  gravityYInput.addEventListener('change', updateGravity);
  contourFieldSelect.addEventListener('input', updateVisualization);
  deformationScaleInput.addEventListener('input', updateVisualization);
  showDeformedInput.addEventListener('input', updateVisualization);
  showDisplacementVectorsInput.addEventListener('input', updateVisualization);
  showReactionVectorsInput.addEventListener('input', updateVisualization);
  exampleSceneSelect.addEventListener('input', loadSelectedExample);
  materialPanel.addEventListener('input', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    const materialId = target.dataset.materialId;
    const field = target.dataset.materialField;

    if (!materialId || !field || !isMaterialNumericField(field)) {
      return;
    }

    materialValidationErrors.delete(getMaterialValidationKey(materialId, field));
  });
  materialPanel.addEventListener('change', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLInputElement)) {
      if (target instanceof HTMLSelectElement && target.dataset.role === 'material-kind') {
        const materialId = target.dataset.materialId;
        const kind = target.value;

        if (!materialId || !isMaterialKind(kind)) {
          return;
        }

        for (const key of [...materialValidationErrors.keys()]) {
          if (key.startsWith(`${materialId}:`)) {
            materialValidationErrors.delete(key);
          }
        }

        store.changeMaterialKind(materialId, kind);
      }
      return;
    }

    const materialId = target.dataset.materialId;
    const field = target.dataset.materialField;

    if (!materialId || !field || !isMaterialNumericField(field)) {
      return;
    }

    const material = store.getState().scene.materials.find((candidate) => candidate.id === materialId);

    if (!material) {
      return;
    }

    const nextValue = parseMaterialFieldValue(material, field, target.value);

    if (nextValue === null) {
      materialValidationErrors.set(getMaterialValidationKey(materialId, field), getMaterialFieldErrorMessage(material, field));
      renderCurrentState();
      return;
    }

    materialValidationErrors.delete(getMaterialValidationKey(materialId, field));
    store.updateMaterialValue(materialId, field, nextValue);
  });
  materialPanel.addEventListener('click', (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    const button = target.closest<HTMLButtonElement>('button[data-action]');

    if (!button) {
      return;
    }

    const materialId = button.dataset.materialId;

    switch (button.dataset.action) {
      case 'add-linear-material':
        store.addMaterial('linear-elastic-plane-strain');
        break;
      case 'add-drucker-prager-material':
        store.addMaterial('drucker-prager-plane-strain');
        break;
      case 'add-terra-cotta-material':
        store.addMaterial('terra-cotta-plane-strain');
        break;
      case 'activate-material':
        if (materialId) {
          store.setActiveMaterial(materialId);
        }
        break;
      case 'assign-material':
        if (materialId) {
          store.assignMaterialToSelectedElements(materialId);
        }
        break;
      case 'remove-material':
        if (materialId) {
          for (const key of [...materialValidationErrors.keys()]) {
            if (key.startsWith(`${materialId}:`)) {
              materialValidationErrors.delete(key);
            }
          }
          store.removeMaterial(materialId);
        }
        break;
      default:
        break;
    }
  });
  generateMeshButton.addEventListener('click', () => {
    store.generateStructuredMesh();
    meshDialog.close();
  });
  store.subscribe(() => renderCurrentState());
  loadSelectedExample();
  renderCurrentState();
}

interface ControlRefs {
  meshWidthInput: HTMLInputElement;
  meshHeightInput: HTMLInputElement;
  meshDivisionsXInput: HTMLInputElement;
  meshDivisionsYInput: HTMLInputElement;
  gravityEnabledInput: HTMLInputElement;
  gravityVectorControls: HTMLDivElement;
  gravityXInput: HTMLInputElement;
  gravityYInput: HTMLInputElement;
  contourFieldSelect: HTMLSelectElement;
  deformationScaleInput: HTMLInputElement;
  showDeformedInput: HTMLInputElement;
  showDisplacementVectorsInput: HTMLInputElement;
  showReactionVectorsInput: HTMLInputElement;
}

function renderPanels(
  state: AppState,
  toolList: HTMLElement,
  materialPanel: HTMLElement,
  statusPill: HTMLElement,
  editorNotice: HTMLElement,
  controls: ControlRefs,
  materialValidationErrors: Map<string, string>,
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

  controls.meshWidthInput.value = `${state.meshDraft.width}`;
  controls.meshHeightInput.value = `${state.meshDraft.height}`;
  controls.meshDivisionsXInput.value = `${state.meshDraft.divisionsX}`;
  controls.meshDivisionsYInput.value = `${state.meshDraft.divisionsY}`;
  controls.gravityEnabledInput.checked = state.scene.gravity.enabled;
  controls.gravityVectorControls.hidden = !state.scene.gravity.enabled;
  controls.gravityXInput.value = `${state.scene.gravity.x}`;
  controls.gravityYInput.value = `${state.scene.gravity.y}`;
  controls.contourFieldSelect.value = state.visualization.contourField;
  controls.deformationScaleInput.value = `${state.visualization.deformationScale}`;
  controls.showDeformedInput.checked = state.visualization.showDeformedMesh;
  controls.showDisplacementVectorsInput.checked = state.visualization.showDisplacementVectors;
  controls.showReactionVectorsInput.checked = state.visualization.showReactionVectors;

  if (state.analysis.status === 'error' && state.analysis.error) {
    editorNotice.hidden = false;
    editorNotice.innerHTML = `
      <p class="editor-notice-title">Solve Issue</p>
      <p>${state.analysis.error}</p>
    `;
  } else {
    editorNotice.hidden = true;
    editorNotice.innerHTML = '';
  }

  materialPanel.innerHTML = renderMaterialPanel(
    state.scene.materials,
    state.scene.elements,
    state.selection.elementIds,
    state.activeMaterialId,
    materialValidationErrors,
  );
}
