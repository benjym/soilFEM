import type { Material } from '../../model/types';
import { createDruckerPragerPlaneStrainMaterialModel } from './druckerPragerPlaneStrain';
import { createLinearElasticPlaneStrainMaterialModel } from './linearElasticPlaneStrain';
import { createTerraCottaPlaneStrainMaterialModel } from './terraCottaPlaneStrain';

export type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export type EngineeringStrain = [number, number, number];
export type EngineeringStress = [number, number, number];

export interface PlaneStrainMaterialPointState {
  readonly kind: string;
  strain: EngineeringStrain;
  stress: EngineeringStress;
  outOfPlaneStress: number;
}

export interface PlaneStrainMaterialPointResponse<TState extends PlaneStrainMaterialPointState = PlaneStrainMaterialPointState> {
  tangent: Matrix3x3;
  stress: EngineeringStress;
  outOfPlaneStress: number;
  state: TState;
}

export interface PlaneStrainMaterialModel<TState extends PlaneStrainMaterialPointState = PlaneStrainMaterialPointState> {
  kind: Material['kind'];
  createInitialState(): TState;
  evaluate(strainIncrement: EngineeringStrain, state: TState): PlaneStrainMaterialPointResponse<TState>;
}

export function createPlaneStrainMaterialModel(material: Material): PlaneStrainMaterialModel {
  switch (material.kind) {
    case 'linear-elastic-plane-strain':
      return createLinearElasticPlaneStrainMaterialModel(material);
    case 'drucker-prager-plane-strain':
      return createDruckerPragerPlaneStrainMaterialModel(material);
    case 'terra-cotta-plane-strain':
      return createTerraCottaPlaneStrainMaterialModel(material);
  }

  throw new Error('Unsupported plane-strain material kind.');
}