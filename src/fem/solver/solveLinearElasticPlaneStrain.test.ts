import { describe, expect, it } from 'vitest';
import { defaultScene } from '../../examples/defaultScene';
import { druckerPragerSlopeScene } from '../../examples/druckerPragerSlopeScene';
import { solveLinearElasticPlaneStrain } from './solveLinearElasticPlaneStrain';
import type { AnalysisScene } from '../../model/types';

const druckerPragerScene: AnalysisScene = {
  ...defaultScene,
  materials: [
    {
      id: 'material-1',
      name: 'DP Soil',
      kind: 'drucker-prager-plane-strain',
      youngModulus: 20_000,
      poissonRatio: 0.3,
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
      youngModulus: 20_000,
      poissonRatio: 0.3,
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
    const totalLoadX = defaultScene.loads.reduce((sum, load) => sum + load.fx, 0);
    const totalLoadY = defaultScene.loads.reduce((sum, load) => sum + load.fy, 0);

    expect(totalReactionX + totalLoadX).toBeCloseTo(0, 8);
    expect(totalReactionY + totalLoadY).toBeCloseTo(0, 8);
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
    const totalLoadX = druckerPragerScene.loads.reduce((sum, load) => sum + load.fx, 0);
    const totalLoadY = druckerPragerScene.loads.reduce((sum, load) => sum + load.fy, 0);

    expect(totalReactionX + totalLoadX).toBeCloseTo(0, 6);
    expect(totalReactionY + totalLoadY).toBeCloseTo(0, 6);
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
    const totalLoadX = terraCottaScene.loads.reduce((sum, load) => sum + load.fx, 0);
    const totalLoadY = terraCottaScene.loads.reduce((sum, load) => sum + load.fy, 0);

    expect(totalReactionX + totalLoadX).toBeCloseTo(0, 5);
    expect(totalReactionY + totalLoadY).toBeCloseTo(0, 5);
    expect(result.elementResults.every((element) => Number.isFinite(element.stress.meanStress))).toBe(true);
    expect(result.elementResults.every((element) => Number.isFinite(element.stress.deviatoricStress))).toBe(true);
    expect(result.displacements.find((displacement) => displacement.nodeId === 'node-3')?.uy).toBeLessThan(0);
  });
});