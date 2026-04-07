import { describe, expect, it } from 'vitest';
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

  it('applies support and load drafts to a node', () => {
    const store = new AppStore();
    const nodeId = store.getState().scene.nodes[1].id;

    store.setSupportDraft({ fixX: true, fixY: false });
    store.applySupportToNode(nodeId);
    store.setLoadDraft({ fx: 12, fy: -7 });
    store.applyLoadToNode(nodeId);

    expect(store.getState().scene.supports.find((support) => support.nodeId === nodeId)).toEqual({
      nodeId,
      fixX: true,
      fixY: false,
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
});