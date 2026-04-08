import type { TerraCottaPlaneStrainMaterial } from '../../model/types';
import { createPlaneStrainMaterialResponse } from './linearElasticPlaneStrain';
import type {
  EngineeringStrain,
  EngineeringStress,
  Matrix3x3,
  PlaneStrainMaterialModel,
  PlaneStrainMaterialPointResponse,
  PlaneStrainMaterialPointState,
} from './materialModel';

type Tensor3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

type TerraCottaElasticStrain = [number, number, number, number];

export interface TerraCottaPlaneStrainState extends PlaneStrainMaterialPointState {
  readonly kind: 'terra-cotta-plane-strain';
  solidFraction: number;
  mesoTemperature: number;
  elasticStrain: TerraCottaElasticStrain;
}

interface StressUpdate {
  stress: EngineeringStress;
  outOfPlaneStress: number;
  state: TerraCottaPlaneStrainState;
}

const MAX_LOCAL_STRAIN_INCREMENT = 5e-4;
const MAX_LOCAL_PLASTIC_INCREMENT = 5e-4;
const MAX_LOCAL_SOLID_FRACTION_INCREMENT = 5e-3;
const MAX_LOCAL_RELATIVE_TEMPERATURE_CHANGE = 0.25;
const MAX_LOCAL_SUBSTEPS = 128;
const MIN_LOCAL_PSEUDO_TIME_STEP = 1 / MAX_LOCAL_SUBSTEPS;

const identity = (): Tensor3x3 => [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

function addEngineeringStrain(left: EngineeringStrain, right: EngineeringStrain): EngineeringStrain {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scaleEngineeringStrain(strain: EngineeringStrain, factor: number): EngineeringStrain {
  return [strain[0] * factor, strain[1] * factor, strain[2] * factor];
}

function zeroTensor(): Tensor3x3 {
  return [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
}

function addTensor(left: Tensor3x3, right: Tensor3x3): Tensor3x3 {
  return left.map((row, rowIndex) => row.map((value, columnIndex) => value + right[rowIndex][columnIndex])) as Tensor3x3;
}

function subtractTensor(left: Tensor3x3, right: Tensor3x3): Tensor3x3 {
  return left.map((row, rowIndex) => row.map((value, columnIndex) => value - right[rowIndex][columnIndex])) as Tensor3x3;
}

function scaleTensor(tensor: Tensor3x3, factor: number): Tensor3x3 {
  return tensor.map((row) => row.map((value) => value * factor)) as Tensor3x3;
}

function negateTensor(tensor: Tensor3x3): Tensor3x3 {
  return scaleTensor(tensor, -1);
}

function trace(tensor: Tensor3x3): number {
  return tensor[0][0] + tensor[1][1] + tensor[2][2];
}

function doubleContract(left: Tensor3x3, right: Tensor3x3): number {
  let sum = 0;

  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      sum += left[row][column] * right[row][column];
    }
  }

  return sum;
}

function tensorNorm(tensor: Tensor3x3): number {
  return Math.sqrt(Math.max(0, doubleContract(tensor, tensor)));
}

function deviatoric(tensor: Tensor3x3): Tensor3x3 {
  return subtractTensor(tensor, scaleTensor(identity(), trace(tensor) / 3));
}

function engineeringIncrementToTensor(strainIncrement: EngineeringStrain): Tensor3x3 {
  return [
    [strainIncrement[0], strainIncrement[2] / 2, 0],
    [strainIncrement[2] / 2, strainIncrement[1], 0],
    [0, 0, 0],
  ];
}

function elasticStrainToTensor(elasticStrain: TerraCottaElasticStrain): Tensor3x3 {
  return [
    [elasticStrain[0], elasticStrain[2] / 2, 0],
    [elasticStrain[2] / 2, elasticStrain[1], 0],
    [0, 0, elasticStrain[3]],
  ];
}

function tensorToElasticStrain(tensor: Tensor3x3): TerraCottaElasticStrain {
  return [tensor[0][0], tensor[1][1], 2 * tensor[0][1], tensor[2][2]];
}

function toEngineeringStress(tensor: Tensor3x3): EngineeringStress {
  return [tensor[0][0], tensor[1][1], tensor[0][1]];
}

function isFiniteTensor(tensor: Tensor3x3): boolean {
  return tensor.every((row) => row.every((value) => Number.isFinite(value)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isFiniteStressUpdate(update: StressUpdate): boolean {
  return (
    update.stress.every((value) => Number.isFinite(value)) &&
    Number.isFinite(update.outOfPlaneStress) &&
    Number.isFinite(update.state.solidFraction) &&
    Number.isFinite(update.state.mesoTemperature) &&
    update.state.elasticStrain.every((value) => Number.isFinite(value))
  );
}

function validateMaterial(material: TerraCottaPlaneStrainMaterial): void {
  if (material.youngModulus <= 0) {
    throw new Error('Terra Cotta Young modulus must be positive.');
  }

  if (material.poissonRatio <= -1 || material.poissonRatio >= 0.5) {
    throw new Error('Terra Cotta Poisson ratio must lie in the open interval (-1, 0.5).');
  }

  if (material.initialConfinement < 0) {
    throw new Error('Terra Cotta initial confinement must be non-negative.');
  }

  if (material.solidFraction <= 0 || material.solidFraction >= 1) {
    throw new Error('Terra Cotta solid fraction must lie in the open interval (0, 1).');
  }

  if (material.mesoTemperature < 0) {
    throw new Error('Terra Cotta meso-temperature must be non-negative.');
  }

  if (material.energyCoupling <= 0 || material.criticalStateSlope <= 0 || material.omega <= 0) {
    throw new Error('Terra Cotta energy coupling, critical-state slope, and omega must be positive.');
  }

  if (material.compressionIndex <= 0 || material.referenceSolidFraction <= 0 || material.referenceSolidFraction >= 1) {
    throw new Error('Terra Cotta compression index must be positive and reference solid fraction must lie in (0, 1).');
  }

  if (material.volumetricCoefficient <= 0 || material.deviatoricCoefficient <= 0 || material.dissipation <= 0) {
    throw new Error('Terra Cotta volumetric, deviatoric, and dissipation coefficients must be positive.');
  }
}

function computeElasticStress(
  elasticStrainTensor: Tensor3x3,
  solidFraction: number,
  bulkModulus: number,
  shearModulus: number,
): Tensor3x3 {
  const elasticVolumetricStrain = trace(elasticStrainTensor);
  const elasticDeviatoricStrain = deviatoric(elasticStrainTensor);
  const deviatoricNormSquared = doubleContract(elasticDeviatoricStrain, elasticDeviatoricStrain);
  const isotropicPart = scaleTensor(
    identity(),
    (bulkModulus * elasticVolumetricStrain * elasticVolumetricStrain) / 2 + shearModulus * deviatoricNormSquared,
  );
  const deviatoricPart = scaleTensor(elasticDeviatoricStrain, 2 * shearModulus * elasticVolumetricStrain);

  return scaleTensor(addTensor(isotropicPart, deviatoricPart), solidFraction ** 6);
}

function computeTotalGeomechanicsStress(
  material: TerraCottaPlaneStrainMaterial,
  solidFraction: number,
  mesoTemperature: number,
  elasticStrainTensor: Tensor3x3,
  strainRateTensor: Tensor3x3,
): Tensor3x3 {
  const elastic = createPlaneStrainMaterialResponse(material.youngModulus, material.poissonRatio);
  const elasticStressTensor = computeElasticStress(elasticStrainTensor, solidFraction, elastic.bulkModulus, elastic.shearModulus);
  const volumetricStrainRate = trace(strainRateTensor);
  const deviatoricStrainRate = deviatoric(strainRateTensor);
  const viscousStressTensor = scaleTensor(
    addTensor(
      scaleTensor(identity(), material.volumetricCoefficient * volumetricStrainRate),
      scaleTensor(deviatoricStrainRate, (2 * material.deviatoricCoefficient) / 3),
    ),
    (2 * mesoTemperature) / material.energyCoupling,
  );
  const thermodynamicPressureTensor = scaleTensor(identity(), (mesoTemperature * mesoTemperature) / material.energyCoupling);

  return addTensor(addTensor(elasticStressTensor, viscousStressTensor), thermodynamicPressureTensor);
}

function createInitialElasticStrain(material: TerraCottaPlaneStrainMaterial): TerraCottaElasticStrain {
  if (material.initialConfinement <= 0) {
    return [0, 0, 0, 0];
  }

  const elastic = createPlaneStrainMaterialResponse(material.youngModulus, material.poissonRatio);
  const thermodynamicPressure = (material.mesoTemperature * material.mesoTemperature) / material.energyCoupling;
  const elasticPressure = Math.max(0, material.initialConfinement - thermodynamicPressure);

  if (elasticPressure <= 0) {
    return [0, 0, 0, 0];
  }

  const elasticVolumetricStrain = Math.sqrt((2 * elasticPressure) / ((material.solidFraction ** 6) * elastic.bulkModulus));
  const component = elasticVolumetricStrain / 3;

  return [component, component, 0, component];
}

function computePlasticStrainRate(
  material: TerraCottaPlaneStrainMaterial,
  solidFraction: number,
  mesoTemperature: number,
  elasticStressTensor: Tensor3x3,
): Tensor3x3 {
  if (mesoTemperature <= 1e-12 || solidFraction <= 1e-12) {
    return scaleTensor(identity(), 0);
  }

  const elasticMeanStress = trace(elasticStressTensor) / 3;

  if (elasticMeanStress <= 1e-12) {
    return scaleTensor(identity(), 0);
  }

  const elasticDeviatoricStress = deviatoric(elasticStressTensor);
  const elasticDeviatoricInvariant = Math.sqrt(Math.max(0, 1.5 * doubleContract(elasticDeviatoricStress, elasticDeviatoricStress)));
  const pI = material.referenceSolidFraction ** (-material.compressionIndex);
  const hardeningPressure = pI * solidFraction ** material.compressionIndex;
  const prefactor =
    (mesoTemperature / (material.criticalStateSlope * material.criticalStateSlope * hardeningPressure)) *
    Math.sqrt(material.dissipation / material.volumetricCoefficient);
  const stressRatio = elasticDeviatoricInvariant / elasticMeanStress;
  const volumetricTerm = scaleTensor(
    identity(),
    ((material.criticalStateSlope * material.criticalStateSlope - stressRatio * stressRatio) * elasticMeanStress) / 3,
  );
  const deviatoricTerm = scaleTensor(
    elasticDeviatoricStress,
    1.5 * Math.sqrt(material.volumetricCoefficient / material.deviatoricCoefficient) * (material.criticalStateSlope / material.omega),
  );

  return scaleTensor(addTensor(volumetricTerm, deviatoricTerm), prefactor);
}

function estimateSubstepCount(
  strainIncrement: EngineeringStrain,
  state: TerraCottaPlaneStrainState,
  material: TerraCottaPlaneStrainMaterial,
  pseudoTimeStep: number,
): number {
  const elastic = createPlaneStrainMaterialResponse(material.youngModulus, material.poissonRatio);
  const totalStrainIncrementTensor = negateTensor(engineeringIncrementToTensor(strainIncrement));
  const strainRateTensor = scaleTensor(totalStrainIncrementTensor, 1 / pseudoTimeStep);
  const volumetricStrainRate = trace(strainRateTensor);
  const deviatoricStrainRate = deviatoric(strainRateTensor);
  const elasticStrainTensor = elasticStrainToTensor(state.elasticStrain);
  const elasticStressTensor = computeElasticStress(
    elasticStrainTensor,
    state.solidFraction,
    elastic.bulkModulus,
    elastic.shearModulus,
  );
  const plasticStrainRate = computePlasticStrainRate(material, state.solidFraction, state.mesoTemperature, elasticStressTensor);
  const plasticIncrementTensor = scaleTensor(plasticStrainRate, pseudoTimeStep);
  const mesoTemperatureRate =
    material.volumetricCoefficient * volumetricStrainRate * volumetricStrainRate +
    (2 / 3) * material.deviatoricCoefficient * doubleContract(deviatoricStrainRate, deviatoricStrainRate) -
    material.dissipation * state.mesoTemperature * state.mesoTemperature;
  const temperatureScale = Math.max(1e-6, state.mesoTemperature);
  const relativeTemperatureChange = Math.abs((pseudoTimeStep * mesoTemperatureRate) / temperatureScale);
  const solidFractionIncrement = Math.abs(pseudoTimeStep * state.solidFraction * volumetricStrainRate);

  return Math.min(
    MAX_LOCAL_SUBSTEPS,
    Math.max(
      1,
      Math.ceil(tensorNorm(totalStrainIncrementTensor) / MAX_LOCAL_STRAIN_INCREMENT),
      Math.ceil(tensorNorm(plasticIncrementTensor) / MAX_LOCAL_PLASTIC_INCREMENT),
      Math.ceil(solidFractionIncrement / MAX_LOCAL_SOLID_FRACTION_INCREMENT),
      Math.ceil(relativeTemperatureChange / MAX_LOCAL_RELATIVE_TEMPERATURE_CHANGE),
    ),
  );
}

function computeSingleStressUpdate(
  strainIncrement: EngineeringStrain,
  state: TerraCottaPlaneStrainState,
  material: TerraCottaPlaneStrainMaterial,
  pseudoTimeStep: number,
): StressUpdate {
  validateMaterial(material);

  const elastic = createPlaneStrainMaterialResponse(material.youngModulus, material.poissonRatio);
  const totalStrainIncrementTensor = negateTensor(engineeringIncrementToTensor(strainIncrement));
  const strainRateTensor = scaleTensor(totalStrainIncrementTensor, 1 / pseudoTimeStep);
  const volumetricStrainRate = trace(strainRateTensor);
  const deviatoricStrainRate = deviatoric(strainRateTensor);
  const elasticStrainTensor = elasticStrainToTensor(state.elasticStrain);
  const elasticStressTensor = computeElasticStress(
    elasticStrainTensor,
    state.solidFraction,
    elastic.bulkModulus,
    elastic.shearModulus,
  );
  const plasticStrainRate = computePlasticStrainRate(material, state.solidFraction, state.mesoTemperature, elasticStressTensor);
  const nextElasticStrainTensor = addTensor(
    elasticStrainTensor,
    scaleTensor(subtractTensor(strainRateTensor, plasticStrainRate), pseudoTimeStep),
  );
  const nextSolidFraction = clamp(
    state.solidFraction + pseudoTimeStep * state.solidFraction * volumetricStrainRate,
    1e-6,
    0.999999,
  );
  const mesoTemperatureRate =
    material.volumetricCoefficient * volumetricStrainRate * volumetricStrainRate +
    (2 / 3) * material.deviatoricCoefficient * doubleContract(deviatoricStrainRate, deviatoricStrainRate) -
    material.dissipation * state.mesoTemperature * state.mesoTemperature;
  const nextMesoTemperature = Math.max(0, state.mesoTemperature + pseudoTimeStep * mesoTemperatureRate);
  const nextGeomechanicsStress = computeTotalGeomechanicsStress(
    material,
    nextSolidFraction,
    nextMesoTemperature,
    nextElasticStrainTensor,
    strainRateTensor,
  );
  const nextStandardStress = negateTensor(nextGeomechanicsStress);
  const nextTotalStrain = addEngineeringStrain(state.strain, strainIncrement);

  return {
    stress: toEngineeringStress(nextStandardStress),
    outOfPlaneStress: nextStandardStress[2][2],
    state: {
      kind: 'terra-cotta-plane-strain',
      strain: nextTotalStrain,
      stress: toEngineeringStress(nextStandardStress),
      outOfPlaneStress: nextStandardStress[2][2],
      solidFraction: nextSolidFraction,
      mesoTemperature: nextMesoTemperature,
      elasticStrain: tensorToElasticStrain(nextElasticStrainTensor),
    },
  };
}

function computeStressUpdate(
  strainIncrement: EngineeringStrain,
  state: TerraCottaPlaneStrainState,
  material: TerraCottaPlaneStrainMaterial,
  pseudoTimeStep = 1,
): StressUpdate {
  const substepCount = estimateSubstepCount(strainIncrement, state, material, pseudoTimeStep);

  if (substepCount <= 1 || pseudoTimeStep <= MIN_LOCAL_PSEUDO_TIME_STEP) {
    const update = computeSingleStressUpdate(strainIncrement, state, material, pseudoTimeStep);

    if (isFiniteStressUpdate(update) && isFiniteTensor(elasticStrainToTensor(update.state.elasticStrain))) {
      return update;
    }

    if (pseudoTimeStep <= MIN_LOCAL_PSEUDO_TIME_STEP) {
      throw new Error('Terra Cotta local update produced a non-finite state at the minimum pseudo-time step.');
    }
  }

  const localSubstepCount = Math.max(2, substepCount);
  const substepIncrement = scaleEngineeringStrain(strainIncrement, 1 / localSubstepCount);
  const substepDuration = pseudoTimeStep / localSubstepCount;
  let currentState = state;
  let latestUpdate: StressUpdate | null = null;

  for (let substepIndex = 0; substepIndex < localSubstepCount; substepIndex += 1) {
    latestUpdate = computeStressUpdate(substepIncrement, currentState, material, substepDuration);
    currentState = latestUpdate.state;
  }

  if (!latestUpdate) {
    throw new Error('Terra Cotta local update failed before taking any substeps.');
  }

  return latestUpdate;
}

function numericalTangent(
  strainIncrement: EngineeringStrain,
  state: TerraCottaPlaneStrainState,
  material: TerraCottaPlaneStrainMaterial,
): Matrix3x3 {
  const base = computeStressUpdate(strainIncrement, state, material);
  const tangent: Matrix3x3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];

  for (let column = 0; column < 3; column += 1) {
    const perturbationMagnitude = Math.max(1e-8, Math.abs(strainIncrement[column]) * 1e-4);
    const perturbedIncrement = [...strainIncrement] as EngineeringStrain;
    perturbedIncrement[column] += perturbationMagnitude;
    const perturbed = computeStressUpdate(perturbedIncrement, state, material);

    tangent[0][column] = (perturbed.stress[0] - base.stress[0]) / perturbationMagnitude;
    tangent[1][column] = (perturbed.stress[1] - base.stress[1]) / perturbationMagnitude;
    tangent[2][column] = (perturbed.stress[2] - base.stress[2]) / perturbationMagnitude;
  }

  return tangent;
}

export function createTerraCottaPlaneStrainMaterialModel(
  material: TerraCottaPlaneStrainMaterial,
): PlaneStrainMaterialModel<TerraCottaPlaneStrainState> {
  if (material.kind !== 'terra-cotta-plane-strain') {
    throw new Error(`Material '${material.id}' is not a Terra Cotta plane-strain material.`);
  }

  validateMaterial(material);

  return {
    kind: material.kind,
    createInitialState(): TerraCottaPlaneStrainState {
      const initialState: TerraCottaPlaneStrainState = {
        kind: 'terra-cotta-plane-strain',
        strain: [0, 0, 0],
        solidFraction: material.solidFraction,
        mesoTemperature: material.mesoTemperature,
        elasticStrain: createInitialElasticStrain(material),
        stress: [0, 0, 0],
        outOfPlaneStress: 0,
      };

      const initialStress = computeTotalGeomechanicsStress(
        material,
        initialState.solidFraction,
        initialState.mesoTemperature,
        elasticStrainToTensor(initialState.elasticStrain),
        zeroTensor(),
      );
      const initialStandardStress = negateTensor(initialStress);

      initialState.stress = toEngineeringStress(initialStandardStress);
      initialState.outOfPlaneStress = initialStandardStress[2][2];

      return initialState;
    },
    evaluate(
      strainIncrement: EngineeringStrain,
      state: TerraCottaPlaneStrainState,
    ): PlaneStrainMaterialPointResponse<TerraCottaPlaneStrainState> {
      const update = computeStressUpdate(strainIncrement, state, material);

      return {
        tangent: numericalTangent(strainIncrement, state, material),
        stress: update.stress,
        outOfPlaneStress: update.outOfPlaneStress,
        state: update.state,
      };
    },
  };
}
