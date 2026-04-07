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
});