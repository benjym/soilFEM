import { describe, expect, it } from 'vitest';
import { createPlaneStrainMaterialModel } from './materialModel';
import type { TerraCottaPlaneStrainState } from './terraCottaPlaneStrain';

describe('materialModel', () => {
  it('creates a linear-elastic plane-strain material model and evaluates stress consistently', () => {
    const model = createPlaneStrainMaterialModel({
      id: 'material-1',
      name: 'Elastic Soil',
      kind: 'linear-elastic-plane-strain',
      youngModulus: 20_000,
      poissonRatio: 0.3,
      density: 2_000,
    });
    const response = model.evaluate([0.001, 0.002, 0.0005], model.createInitialState());

    expect(model.kind).toBe('linear-elastic-plane-strain');
    expect(response.tangent[0][0]).toBeGreaterThan(0);
    expect(response.stress[0]).toBeGreaterThan(0);
    expect(response.outOfPlaneStress).toBeGreaterThan(0);
    expect(response.state.kind).toBe('linear-elastic-plane-strain');
  });

  it('creates a Drucker-Prager plane-strain material model and returns finite stresses', () => {
    const model = createPlaneStrainMaterialModel({
      id: 'material-2',
      name: 'DP Soil',
      kind: 'drucker-prager-plane-strain',
      youngModulus: 20_000,
      poissonRatio: 0.3,
      density: 2_000,
      beta: 0.2,
      mu: 1.1,
      exponent: 1,
    });
    const response = model.evaluate([-0.001, -0.0015, 0.0002], model.createInitialState());

    expect(model.kind).toBe('drucker-prager-plane-strain');
    expect(Number.isFinite(response.tangent[0][0])).toBe(true);
    expect(response.stress.every((value) => Number.isFinite(value))).toBe(true);
    expect(Number.isFinite(response.outOfPlaneStress)).toBe(true);
    expect(response.state.kind).toBe('drucker-prager-plane-strain');
  });

  it('creates a Terra Cotta plane-strain material model and advances internal variables', () => {
    const model = createPlaneStrainMaterialModel({
      id: 'material-3',
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
    });
    const response = model.evaluate([-0.0008, -0.0012, 0.00015], model.createInitialState());

    expect(model.kind).toBe('terra-cotta-plane-strain');
    expect(Number.isFinite(response.tangent[0][0])).toBe(true);
    expect(response.stress.every((value) => Number.isFinite(value))).toBe(true);
    expect(Number.isFinite(response.outOfPlaneStress)).toBe(true);
    expect(response.state.kind).toBe('terra-cotta-plane-strain');

    if (response.state.kind !== 'terra-cotta-plane-strain') {
      throw new Error('Expected Terra Cotta state.');
    }

    const terraCottaState = response.state as TerraCottaPlaneStrainState;

    expect(terraCottaState.solidFraction).toBeGreaterThan(0);
    expect(terraCottaState.mesoTemperature).toBeGreaterThanOrEqual(0);
  });
});