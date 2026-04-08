import type { DruckerPragerPlaneStrainMaterial } from '../../model/types';
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

export interface DruckerPragerPlaneStrainState extends PlaneStrainMaterialPointState {
  readonly kind: 'drucker-prager-plane-strain';
}

interface StressUpdate {
  stress: EngineeringStress;
  outOfPlaneStress: number;
  state: DruckerPragerPlaneStrainState;
}

function toStressTensor(stress: EngineeringStress, outOfPlaneStress: number): Tensor3x3 {
  return [
    [stress[0], stress[2], 0],
    [stress[2], stress[1], 0],
    [0, 0, outOfPlaneStress],
  ];
}

function toEngineeringStress(tensor: Tensor3x3): EngineeringStress {
  return [tensor[0][0], tensor[1][1], tensor[0][1]];
}

function negateTensor(tensor: Tensor3x3): Tensor3x3 {
  return tensor.map((row) => row.map((value) => -value)) as Tensor3x3;
}

function scaleTensor(tensor: Tensor3x3, factor: number): Tensor3x3 {
  return tensor.map((row) => row.map((value) => value * factor)) as Tensor3x3;
}

function addTensor(left: Tensor3x3, right: Tensor3x3): Tensor3x3 {
  return left.map((row, rowIndex) => row.map((value, columnIndex) => value + right[rowIndex][columnIndex])) as Tensor3x3;
}

function subtractTensor(left: Tensor3x3, right: Tensor3x3): Tensor3x3 {
  return left.map((row, rowIndex) => row.map((value, columnIndex) => value - right[rowIndex][columnIndex])) as Tensor3x3;
}

function trace(tensor: Tensor3x3): number {
  return tensor[0][0] + tensor[1][1] + tensor[2][2];
}

function identityTensor(): Tensor3x3 {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

function deviatoric(tensor: Tensor3x3): Tensor3x3 {
  return subtractTensor(tensor, scaleTensor(identityTensor(), trace(tensor) / 3));
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

function engineeringIncrementToTensor(strainIncrement: EngineeringStrain): Tensor3x3 {
  return [
    [strainIncrement[0], strainIncrement[2] / 2, 0],
    [strainIncrement[2] / 2, strainIncrement[1], 0],
    [0, 0, 0],
  ];
}

function addEngineeringStrain(left: EngineeringStrain, right: EngineeringStrain): EngineeringStrain {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function computeQFromDeviatoricStress(deviatoricStress: Tensor3x3): number {
  return Math.sqrt(Math.max(0, 1.5 * doubleContract(deviatoricStress, deviatoricStress)));
}

function computeStressUpdate(
  strainIncrement: EngineeringStrain,
  state: DruckerPragerPlaneStrainState,
  material: DruckerPragerPlaneStrainMaterial,
): StressUpdate {
  const { youngModulus, poissonRatio, beta, mu, exponent } = material;
  const elastic = createPlaneStrainMaterialResponse(youngModulus, poissonRatio);

  if (mu <= 0) {
    throw new Error('Drucker-Prager parameter mu must be positive.');
  }

  const standardStressTensor = toStressTensor(state.stress, state.outOfPlaneStress);
  const geomechanicsStress = negateTensor(standardStressTensor);
  const geomechanicsStrainIncrement = negateTensor(engineeringIncrementToTensor(strainIncrement));
  const deviatoricStress = deviatoric(geomechanicsStress);
  const deviatoricStrainIncrement = deviatoric(geomechanicsStrainIncrement);
  const volumetricStrainIncrement = trace(geomechanicsStrainIncrement);
  const p = trace(geomechanicsStress) / 3;
  const q = computeQFromDeviatoricStress(deviatoricStress);
  let geomechanicsStressIncrement = addTensor(
    scaleTensor(deviatoricStrainIncrement, 2 * elastic.shearModulus),
    scaleTensor(identityTensor(), elastic.bulkModulus * volumetricStrainIncrement),
  );

  if (p > 1e-12 && q > 1e-12) {
    const numerator =
      3 * elastic.shearModulus * p * doubleContract(deviatoricStress, deviatoricStrainIncrement) -
      elastic.bulkModulus * q * q * volumetricStrainIncrement;
    const denominator =
      3 * elastic.shearModulus * mu * p * p +
      elastic.bulkModulus * beta * q * q;
    const lambda2 = denominator > 1e-12 ? numerator / denominator : 0;
    const plasticMultiplier = Math.max(0, lambda2);
    const ratio = q / (mu * p);

    if (plasticMultiplier > 0 && ratio > 1e-12) {
      const ratioPow = Math.pow(ratio, exponent);
      const ratioPowMinusOne = Math.pow(ratio, exponent - 1);
      const plasticDeviatoricPart = scaleTensor(
        deviatoricStress,
        ((3 * plasticMultiplier * ratioPowMinusOne) / (2 * q)),
      );
      const effectiveDeviatoricStrainIncrement = subtractTensor(deviatoricStrainIncrement, plasticDeviatoricPart);
      const effectiveVolumetricIncrement = volumetricStrainIncrement + beta * plasticMultiplier * ratioPow;

      geomechanicsStressIncrement = addTensor(
        scaleTensor(effectiveDeviatoricStrainIncrement, 2 * elastic.shearModulus),
        scaleTensor(identityTensor(), elastic.bulkModulus * effectiveVolumetricIncrement),
      );
    }
  }

  const nextGeomechanicsStress = addTensor(geomechanicsStress, geomechanicsStressIncrement);
  const nextStandardStress = negateTensor(nextGeomechanicsStress);
  const nextStrain = addEngineeringStrain(state.strain, strainIncrement);

  return {
    stress: toEngineeringStress(nextStandardStress),
    outOfPlaneStress: nextStandardStress[2][2],
    state: {
      kind: 'drucker-prager-plane-strain',
      strain: nextStrain,
      stress: toEngineeringStress(nextStandardStress),
      outOfPlaneStress: nextStandardStress[2][2],
    },
  };
}

function numericalTangent(
  strainIncrement: EngineeringStrain,
  state: DruckerPragerPlaneStrainState,
  material: DruckerPragerPlaneStrainMaterial,
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

export function createDruckerPragerPlaneStrainMaterialModel(
  material: DruckerPragerPlaneStrainMaterial,
): PlaneStrainMaterialModel<DruckerPragerPlaneStrainState> {
  if (material.kind !== 'drucker-prager-plane-strain') {
    throw new Error(`Material '${material.id}' is not a Drucker-Prager plane-strain material.`);
  }

  return {
    kind: material.kind,
    createInitialState(): DruckerPragerPlaneStrainState {
      return {
        kind: 'drucker-prager-plane-strain',
        strain: [0, 0, 0],
        stress: [0, 0, 0],
        outOfPlaneStress: 0,
      };
    },
    evaluate(strainIncrement: EngineeringStrain, state: DruckerPragerPlaneStrainState): PlaneStrainMaterialPointResponse<DruckerPragerPlaneStrainState> {
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