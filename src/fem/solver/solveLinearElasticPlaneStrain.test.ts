import { describe, expect, it } from 'vitest';
import { defaultScene } from '../../examples/defaultScene';
import { druckerPragerSlopeScene } from '../../examples/druckerPragerSlopeScene';
import { solveLinearElasticPlaneStrain } from './solveLinearElasticPlaneStrain';
import type { AnalysisScene } from '../../model/types';

function computeTotalAppliedLoad(scene: AnalysisScene): { x: number; y: number } {
  const nodalLoad = scene.loads.reduce(
    (sum, load) => ({ x: sum.x + load.fx, y: sum.y + load.fy }),
    { x: 0, y: 0 },
  );

  if (!scene.gravity.enabled) {
    return nodalLoad;
  }

  const nodesById = new Map(scene.nodes.map((node) => [node.id, node]));
  const materialsById = new Map(scene.materials.map((material) => [material.id, material]));

  return scene.elements.reduce((sum, element) => {
    const [first, second, third] = element.nodeIds.map((nodeId) => nodesById.get(nodeId));
    const material = materialsById.get(element.materialId);

    if (!first || !second || !third || !material) {
      throw new Error('Test scene is missing nodes or materials referenced by an element.');
    }

    const area = Math.abs(
      first.x * (second.y - third.y) +
      second.x * (third.y - first.y) +
      third.x * (first.y - second.y),
    ) / 2;

    return {
      x: sum.x + area * material.density * scene.gravity.x,
      y: sum.y + area * material.density * scene.gravity.y,
    };
  }, nodalLoad);
}

const druckerPragerScene: AnalysisScene = {
  ...defaultScene,
  materials: [
    {
      id: 'material-1',
      name: 'DP Soil',
      kind: 'drucker-prager-plane-strain',
      youngModulus: 20_000,
      poissonRatio: 0.3,
      density: 2_000,
      beta: 0.2,
      mu: 1.1,
      exponent: 1,
      loadSteps: 8,
      maxIterations: 24,
      tolerance: 1e-8,
    },
  ],
};

const terraCottaScene: AnalysisScene = {
  ...defaultScene,
  materials: [
    {
      id: 'material-1',
      name: 'Terra Cotta Soil',
      kind: 'terra-cotta-plane-strain',
      bulkModulus: 16_666.666666666668,
      shearModulus: 7_692.307692307692,
      density: 2_000,
      initialConfinement: 2,
      solidFraction: 0.62,
      mesoTemperature: 0,
      energyCoupling: 50,
      criticalStateSlope: 1,
      omega: 0.5,
      compressionIndex: 4,
      referenceSolidFraction: 0.3,
      volumetricCoefficient: 1,
      deviatoricCoefficient: 1,
      dissipation: 1,
      loadSteps: 16,
      maxIterations: 48,
      tolerance: 1e-8,
    },
  ],
};

describe('solveLinearElasticPlaneStrain', () => {
  it('satisfies global force equilibrium on the default scene', () => {
    const result = solveLinearElasticPlaneStrain(defaultScene);
    const totalReactionX = result.reactions.reduce((sum, reaction) => sum + reaction.rx, 0);
    const totalReactionY = result.reactions.reduce((sum, reaction) => sum + reaction.ry, 0);
    const totalLoad = computeTotalAppliedLoad(defaultScene);

    expect(totalReactionX + totalLoad.x).toBeCloseTo(0, 8);
    expect(totalReactionY + totalLoad.y).toBeCloseTo(0, 8);
  });

  it('produces a downward displacement at the loaded top node', () => {
    const result = solveLinearElasticPlaneStrain(defaultScene);
    const loadedNodeDisplacement = result.displacements.find((displacement) => displacement.nodeId === 'node-3');

    expect(loadedNodeDisplacement).toBeDefined();
    expect(loadedNodeDisplacement?.uy).toBeLessThan(0);
  });

  it('solves a Drucker-Prager scene with finite stresses and equilibrated reactions', () => {
    const result = solveLinearElasticPlaneStrain(druckerPragerScene);
    const totalReactionX = result.reactions.reduce((sum, reaction) => sum + reaction.rx, 0);
    const totalReactionY = result.reactions.reduce((sum, reaction) => sum + reaction.ry, 0);
    const totalLoad = computeTotalAppliedLoad(druckerPragerScene);

    expect(totalReactionX + totalLoad.x).toBeCloseTo(0, 6);
    expect(totalReactionY + totalLoad.y).toBeCloseTo(0, 6);
    expect(result.elementResults.every((element) => Number.isFinite(element.stress.meanStress))).toBe(true);
    expect(result.displacements.find((displacement) => displacement.nodeId === 'node-3')?.uy).toBeLessThan(0);
  });

  it('solves the built-in Drucker-Prager slope example with downhill movement at the crest', () => {
    const result = solveLinearElasticPlaneStrain(druckerPragerSlopeScene);
    const crestDisplacement = result.displacements.find((displacement) => displacement.nodeId === 'node-10');

    expect(result.elementResults).toHaveLength(druckerPragerSlopeScene.elements.length);
    expect(result.reactions.length).toBeGreaterThan(0);
    expect(crestDisplacement).toBeDefined();
    expect(crestDisplacement?.uy).toBeLessThan(0);
    expect(crestDisplacement?.ux).toBeGreaterThanOrEqual(0);
  });

  it('solves a Terra Cotta scene with finite stresses and equilibrated reactions', () => {
    const result = solveLinearElasticPlaneStrain(terraCottaScene);
    const totalReactionX = result.reactions.reduce((sum, reaction) => sum + reaction.rx, 0);
    const totalReactionY = result.reactions.reduce((sum, reaction) => sum + reaction.ry, 0);
    const totalLoad = computeTotalAppliedLoad(terraCottaScene);

    expect(totalReactionX + totalLoad.x).toBeCloseTo(0, 5);
    expect(totalReactionY + totalLoad.y).toBeCloseTo(0, 5);
    expect(result.elementResults.every((element) => Number.isFinite(element.stress.meanStress))).toBe(true);
    expect(result.elementResults.every((element) => Number.isFinite(element.stress.deviatoricStress))).toBe(true);
    expect(result.displacements.find((displacement) => displacement.nodeId === 'node-3')?.uy).toBeLessThan(0);
  });
});