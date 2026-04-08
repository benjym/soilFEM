import type { Material } from '../../model/types';
import type {
  EngineeringStrain,
  EngineeringStress,
  PlaneStrainMaterialModel,
  PlaneStrainMaterialPointResponse,
  PlaneStrainMaterialPointState,
  Matrix3x3,
} from './materialModel';

export interface LinearElasticPlaneStrainState extends PlaneStrainMaterialPointState {
  readonly kind: 'linear-elastic-plane-strain';
}

export interface PlaneStrainMaterialResponse {
  constitutiveMatrix: Matrix3x3;
  bulkModulus: number;
  lameLambda: number;
  shearModulus: number;
}

function addEngineeringStrain(left: EngineeringStrain, right: EngineeringStrain): EngineeringStrain {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function addEngineeringStress(left: EngineeringStress, right: EngineeringStress): EngineeringStress {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function createPlaneStrainMaterialResponse(youngModulus: number, poissonRatio: number): PlaneStrainMaterialResponse {
  if (youngModulus <= 0) {
    throw new Error('Young modulus must be positive.');
  }

  if (poissonRatio <= -1 || poissonRatio >= 0.5) {
    throw new Error('Poisson ratio must lie in the open interval (-1, 0.5).');
  }

  const shearModulus = youngModulus / (2 * (1 + poissonRatio));
  const bulkModulus = youngModulus / (3 * (1 - 2 * poissonRatio));
  const lameLambda = (youngModulus * poissonRatio) / ((1 + poissonRatio) * (1 - 2 * poissonRatio));
  const multiplier = youngModulus / ((1 + poissonRatio) * (1 - 2 * poissonRatio));

  return {
    constitutiveMatrix: [
      [multiplier * (1 - poissonRatio), multiplier * poissonRatio, 0],
      [multiplier * poissonRatio, multiplier * (1 - poissonRatio), 0],
      [0, 0, multiplier * ((1 - 2 * poissonRatio) / 2)],
    ],
    bulkModulus,
    lameLambda,
    shearModulus,
  };
}

export function evaluateLinearElasticPlaneStrain(
  strainIncrement: EngineeringStrain,
  state: LinearElasticPlaneStrainState,
  youngModulus: number,
  poissonRatio: number,
): PlaneStrainMaterialPointResponse<LinearElasticPlaneStrainState> {
  const response = createPlaneStrainMaterialResponse(youngModulus, poissonRatio);
  const [dexx, deyy, dgxy] = strainIncrement;
  const [dsxx, dsyy, dtxy] = response.constitutiveMatrix.map(
    (row) => row[0] * dexx + row[1] * deyy + row[2] * dgxy,
  ) as EngineeringStrain;
  const nextStrain = addEngineeringStrain(state.strain, strainIncrement);
  const nextStress = addEngineeringStress(state.stress, [dsxx, dsyy, dtxy]);
  const nextOutOfPlaneStress = state.outOfPlaneStress + response.lameLambda * (dexx + deyy);

  return {
    tangent: response.constitutiveMatrix,
    stress: nextStress,
    outOfPlaneStress: nextOutOfPlaneStress,
    state: {
      kind: 'linear-elastic-plane-strain',
      strain: nextStrain,
      stress: nextStress,
      outOfPlaneStress: nextOutOfPlaneStress,
    },
  };
}

export function createLinearElasticPlaneStrainMaterialModel(material: Material): PlaneStrainMaterialModel<LinearElasticPlaneStrainState> {
  if (material.kind !== 'linear-elastic-plane-strain') {
    throw new Error(`Material '${material.id}' is not a linear-elastic plane-strain material.`);
  }

  return {
    kind: material.kind,
    createInitialState(): LinearElasticPlaneStrainState {
      return {
        kind: 'linear-elastic-plane-strain',
        strain: [0, 0, 0],
        stress: [0, 0, 0],
        outOfPlaneStress: 0,
      };
    },
    evaluate(strainIncrement: EngineeringStrain, state: LinearElasticPlaneStrainState): PlaneStrainMaterialPointResponse<LinearElasticPlaneStrainState> {
      return evaluateLinearElasticPlaneStrain(strainIncrement, state, material.youngModulus, material.poissonRatio);
    },
  };
}
