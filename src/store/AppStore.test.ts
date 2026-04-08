import { describe, expect, it } from 'vitest';
import { druckerPragerSlopeScene } from '../examples/druckerPragerSlopeScene';
import { AppStore } from './AppStore';

describe('AppStore', () => {
  it('creates a new node and marks the scene dirty', () => {
    const store = new AppStore();
    const before = store.getState().scene.nodes.length;

    store.addNode(12, 34);

    expect(store.getState().scene.nodes).toHaveLength(before + 1);
    expect(store.getState().dirty).toBe(true);
  });

  it('creates an element after staging three nodes', () => {
    const store = new AppStore();
    const [first, second, third] = store.getState().scene.nodes.slice(0, 3).map((node) => node.id);
    const before = store.getState().scene.elements.length;

    store.setTool('add-element');
    store.stageElementNode(first);
    store.stageElementNode(second);
    store.stageElementNode(third);

    expect(store.getState().scene.elements).toHaveLength(before + 1);
    expect(store.getState().stagedElementNodeIds).toEqual([]);
  });

  it('applies directional supports and load drafts to a node', () => {
    const store = new AppStore();
    const nodeId = store.getState().scene.nodes[1].id;

    store.applySupportToNode(nodeId, 'x');
    store.setLoadDraft({ fx: 12, fy: -7 });
    store.applyLoadToNode(nodeId);

    expect(store.getState().scene.supports.find((support) => support.nodeId === nodeId && support.direction === 'x')).toMatchObject({
      nodeId,
      direction: 'x',
    });
    expect(store.getState().scene.loads.find((load) => load.nodeId === nodeId)).toMatchObject({
      nodeId,
      fx: 12,
      fy: -7,
    });
  });

  it('replaces the scene with a structured rectangular mesh', () => {
    const store = new AppStore();

    store.setMeshDraft({ width: 200, height: 100, divisionsX: 2, divisionsY: 1 });
    store.generateStructuredMesh();

    expect(store.getState().scene.nodes).toHaveLength(6);
    expect(store.getState().scene.elements).toHaveLength(4);
    expect(store.getState().scene.supports).toEqual([]);
    expect(store.getState().scene.loads).toEqual([]);
  });

  it('solves the linear-elastic system and clears the dirty flag', () => {
    const store = new AppStore();

    store.solveLinearElastic();

    expect(store.getState().analysis.status).toBe('success');
    expect(store.getState().analysis.result?.displacements).toHaveLength(store.getState().scene.nodes.length);
    expect(store.getState().dirty).toBe(false);
  });

  it('updates visualization settings independently of the analysis state', () => {
    const store = new AppStore();

    store.setContourField('meanStress');
    store.setDeformationScale(12);
    store.setShowDeformedMesh(false);
    store.setShowDisplacementVectors(true);
    store.setShowReactionVectors(true);

    expect(store.getState().visualization).toEqual({
      contourField: 'meanStress',
      deformationScale: 12,
      showDeformedMesh: false,
      showDisplacementVectors: true,
      showReactionVectors: true,
    });
  });

  it('defaults displacement vectors on for solved scenes', () => {
    const store = new AppStore();

    expect(store.getState().visualization.showDisplacementVectors).toBe(true);
    expect(store.getState().visualization.showReactionVectors).toBe(false);
  });

  it('updates and deletes a selected load without deleting its node', () => {
    const store = new AppStore();
    const load = store.getState().scene.loads[0];

    store.selectLoad(load.id);
    store.updateLoad(load.id, 18, -11);

    expect(store.getState().scene.loads.find((candidate) => candidate.id === load.id)).toMatchObject({
      id: load.id,
      fx: 18,
      fy: -11,
    });
    expect(store.getState().loadDraft).toEqual({ fx: 18, fy: -11 });

    store.deleteSelection();

    expect(store.getState().scene.loads).toEqual([]);
    expect(store.getState().scene.nodes.some((node) => node.id === load.nodeId)).toBe(true);
  });

  it('deletes a selected support without deleting its node', () => {
    const store = new AppStore();
    const support = store.getState().scene.supports[0];

    store.selectSupport(support.id);
    store.deleteSelection();

    expect(store.getState().scene.supports.some((candidate) => candidate.id === support.id)).toBe(false);
    expect(store.getState().scene.nodes.some((node) => node.id === support.nodeId)).toBe(true);
  });

  it('loads the built-in Drucker-Prager slope scene cleanly', () => {
    const store = new AppStore();

    store.loadScene(druckerPragerSlopeScene);

    expect(store.getState().scene.materials[0].kind).toBe('drucker-prager-plane-strain');
    expect(store.getState().scene.elements).toHaveLength(druckerPragerSlopeScene.elements.length);
    expect(store.getState().dirty).toBe(false);
  });

  it('updates linear-elastic material parameters and clears stale results', () => {
    const store = new AppStore();
    const materialId = store.getState().scene.materials[0].id;

    store.solveLinearElastic();
    store.updateMaterialValue(materialId, 'youngModulus', 18_500);
    store.updateMaterialValue(materialId, 'poissonRatio', 0.31);

    expect(store.getState().scene.materials[0]).toMatchObject({
      id: materialId,
      youngModulus: 18_500,
      poissonRatio: 0.31,
    });
    expect(store.getState().analysis.status).toBe('idle');
    expect(store.getState().dirty).toBe(true);
  });

  it('updates Drucker-Prager material and solver parameters', () => {
    const store = new AppStore();

    store.loadScene(druckerPragerSlopeScene);

    const materialId = store.getState().scene.materials[0].id;

    store.updateMaterialValue(materialId, 'beta', 0.12);
    store.updateMaterialValue(materialId, 'mu', 2.8);
    store.updateMaterialValue(materialId, 'exponent', 1.4);
    store.updateMaterialValue(materialId, 'loadSteps', 30);
    store.updateMaterialValue(materialId, 'maxIterations', 64);
    store.updateMaterialValue(materialId, 'tolerance', 1e-7);

    expect(store.getState().scene.materials[0]).toMatchObject({
      id: materialId,
      beta: 0.12,
      mu: 2.8,
      exponent: 1.4,
      loadSteps: 30,
      maxIterations: 64,
      tolerance: 1e-7,
    });
    expect(store.getState().dirty).toBe(true);
  });

  it('adds and updates Terra Cotta material parameters', () => {
    const store = new AppStore();

    store.addMaterial('terra-cotta-plane-strain');

    const materialId = store.getState().activeMaterialId!;

    store.updateMaterialValue(materialId, 'initialConfinement', 3.5);
    store.updateMaterialValue(materialId, 'solidFraction', 0.66);
    store.updateMaterialValue(materialId, 'mesoTemperature', 0.08);
    store.updateMaterialValue(materialId, 'energyCoupling', 1.2);
    store.updateMaterialValue(materialId, 'criticalStateSlope', 0.9);
    store.updateMaterialValue(materialId, 'omega', 0.6);
    store.updateMaterialValue(materialId, 'compressionIndex', 5.5);
    store.updateMaterialValue(materialId, 'referenceSolidFraction', 0.28);
    store.updateMaterialValue(materialId, 'volumetricCoefficient', 3.1);
    store.updateMaterialValue(materialId, 'deviatoricCoefficient', 2.7);
    store.updateMaterialValue(materialId, 'dissipation', 12);
    store.updateMaterialValue(materialId, 'loadSteps', 18);
    store.updateMaterialValue(materialId, 'maxIterations', 40);
    store.updateMaterialValue(materialId, 'tolerance', 5e-8);

    expect(store.getState().scene.materials.find((material) => material.id === materialId)).toMatchObject({
      id: materialId,
      kind: 'terra-cotta-plane-strain',
      initialConfinement: 3.5,
      solidFraction: 0.66,
      mesoTemperature: 0.08,
      energyCoupling: 1.2,
      criticalStateSlope: 0.9,
      omega: 0.6,
      compressionIndex: 5.5,
      referenceSolidFraction: 0.28,
      volumetricCoefficient: 3.1,
      deviatoricCoefficient: 2.7,
      dissipation: 12,
      loadSteps: 18,
      maxIterations: 40,
      tolerance: 5e-8,
    });
    expect(store.getState().dirty).toBe(true);
  });

  it('adds a second material, marks it active, and assigns it to selected elements', () => {
    const store = new AppStore();
    const elementId = store.getState().scene.elements[0].id;

    store.addMaterial('drucker-prager-plane-strain');

    const activeMaterialId = store.getState().activeMaterialId;

    expect(activeMaterialId).not.toBeNull();
    expect(store.getState().scene.materials).toHaveLength(2);

    store.selectElement(elementId);
    store.assignMaterialToSelectedElements(activeMaterialId!);

    expect(store.getState().scene.elements.find((element) => element.id === elementId)?.materialId).toBe(activeMaterialId);
  });

  it('switches material kind and reassigns elements when removing a material', () => {
    const store = new AppStore();
    const firstMaterialId = store.getState().scene.materials[0].id;
    const firstElementId = store.getState().scene.elements[0].id;

    store.changeMaterialKind(firstMaterialId, 'drucker-prager-plane-strain');

    expect(store.getState().scene.materials[0].kind).toBe('drucker-prager-plane-strain');

    store.addMaterial('linear-elastic-plane-strain');
    const secondMaterialId = store.getState().activeMaterialId!;

    store.selectElement(firstElementId);
    store.assignMaterialToSelectedElements(secondMaterialId);
    store.removeMaterial(secondMaterialId);

    expect(store.getState().scene.materials).toHaveLength(1);
    expect(store.getState().scene.elements.find((element) => element.id === firstElementId)?.materialId).toBe(firstMaterialId);
    expect(store.getState().activeMaterialId).toBe(firstMaterialId);
  });

  it('converts a material to Terra Cotta while preserving shared elastic properties', () => {
    const store = new AppStore();
    const firstMaterialId = store.getState().scene.materials[0].id;

    store.changeMaterialKind(firstMaterialId, 'terra-cotta-plane-strain');

    expect(store.getState().scene.materials[0]).toMatchObject({
      id: firstMaterialId,
      kind: 'terra-cotta-plane-strain',
      youngModulus: 20_000,
      poissonRatio: 0.3,
    });
  });
});
