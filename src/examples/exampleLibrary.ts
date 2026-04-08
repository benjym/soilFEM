import type { AnalysisScene } from '../model/types';
import { defaultScene } from './defaultScene';
import { druckerPragerSlopeScene } from './druckerPragerSlopeScene';

export interface ExampleSceneDefinition {
  id: string;
  label: string;
  description: string;
  scene: AnalysisScene;
}

export const exampleScenes: ExampleSceneDefinition[] = [
  {
    id: 'elastic-benchmark',
    label: 'Elastic Benchmark',
    description: 'Two-element plane-strain benchmark with a single nodal load.',
    scene: defaultScene,
  },
  {
    id: 'drucker-prager-slope',
    label: 'DP Slope Stability',
    description: 'Prebuilt slope mesh with Drucker-Prager material and gravity-style nodal loading.',
    scene: druckerPragerSlopeScene,
  },
];

export function getExampleSceneById(id: string): ExampleSceneDefinition | undefined {
  return exampleScenes.find((example) => example.id === id);
}