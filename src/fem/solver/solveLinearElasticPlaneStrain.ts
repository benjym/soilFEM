import { computeCstTriangleKinematics, computeCstTriangleStiffness, recoverCstTriangleStrain } from '../elements/cstTriangle';
import { createPlaneStrainMaterialModel, type EngineeringStrain, type PlaneStrainMaterialPointState } from '../materials/materialModel';
import type { AnalysisScene, ElementAnalysisResult, LinearElasticAnalysisResult, Material, Node } from '../../model/types';

interface ElementRuntime {
  elementId: string;
  nodeIds: [string, string, string];
  materialId: string;
  nodes: [Node, Node, Node];
  area: number;
  bMatrix: ReturnType<typeof computeCstTriangleKinematics>['bMatrix'];
  dofMap: number[];
  model: ReturnType<typeof createPlaneStrainMaterialModel>;
}

interface AssemblyResult {
  internalForces: number[];
  stressIncrementForces: number[];
  globalStiffness: number[][];
  states: PlaneStrainMaterialPointState[];
}

interface SolverSettings {
  loadSteps: number;
  maxIterations: number;
  tolerance: number;
  minIncrementFactor: number;
  maxCutbacks: number;
}

interface IncrementSolveResult {
  displacements: number[];
  assembly: AssemblyResult;
}

function zeros(size: number): number[] {
  return new Array(size).fill(0);
}

function zeroMatrix(size: number): number[][] {
  return Array.from({ length: size }, () => zeros(size));
}

function vectorNorm(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function subtractVectors(left: number[], right: number[]): number[] {
  return left.map((value, index) => value - right[index]);
}

function addVectors(left: number[], right: number[]): number[] {
  return left.map((value, index) => value + right[index]);
}

function subtractEngineeringStrains(left: EngineeringStrain, right: EngineeringStrain): EngineeringStrain {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function subtractEngineeringStress(
  left: [number, number, number],
  right: [number, number, number],
): [number, number, number] {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function computeElementInternalForce(
  bMatrix: ReturnType<typeof computeCstTriangleKinematics>['bMatrix'],
  stress: [number, number, number],
  area: number,
  thickness = 1,
): [number, number, number, number, number, number] {
  const nodalForces = [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number];

  for (let column = 0; column < 6; column += 1) {
    nodalForces[column] =
      (bMatrix[0][column] * stress[0] + bMatrix[1][column] * stress[1] + bMatrix[2][column] * stress[2]) * area * thickness;
  }

  return nodalForces;
}

function solveDenseLinearSystem(matrix: number[][], vector: number[]): number[] {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let pivotRow = pivot;

    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[pivotRow][pivot])) {
        pivotRow = row;
      }
    }

    if (Math.abs(augmented[pivotRow][pivot]) <= 1e-12) {
      throw new Error('Global stiffness matrix is singular. Add sufficient supports before solving.');
    }

    [augmented[pivot], augmented[pivotRow]] = [augmented[pivotRow], augmented[pivot]];
    const pivotValue = augmented[pivot][pivot];

    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= pivotValue;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }

      const factor = augmented[row][pivot];

      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map((row) => row[size]);
}

function getMaterial(materials: Material[], materialId: string): Material {
  const material = materials.find((candidate) => candidate.id === materialId);

  if (!material) {
    throw new Error(`Missing material '${materialId}' referenced by an element.`);
  }

  return material;
}

function getElementNodes(nodesById: Map<string, Node>, nodeIds: [string, string, string]): [Node, Node, Node] {
  const nodes = nodeIds.map((nodeId) => nodesById.get(nodeId));

  if (nodes.some((node) => !node)) {
    throw new Error('Element references a node that does not exist.');
  }

  return nodes as [Node, Node, Node];
}

function getSolverSettings(materials: Material[]): SolverSettings {
  const nonlinearMaterialCount = materials.filter((material) => material.kind !== 'linear-elastic-plane-strain').length;
  const settings = materials.reduce(
    (settings, material) => {
      if (material.kind === 'linear-elastic-plane-strain') {
        return settings;
      }

      return {
        loadSteps: Math.max(settings.loadSteps, material.loadSteps ?? 12),
        maxIterations: Math.max(settings.maxIterations, material.maxIterations ?? 24),
        tolerance: Math.min(settings.tolerance, material.tolerance ?? 1e-8),
      };
    },
    { loadSteps: 1, maxIterations: 8, tolerance: 1e-8 },
  );

  return {
    ...settings,
    minIncrementFactor: nonlinearMaterialCount > 0 ? 1 / Math.max(256, settings.loadSteps * 32) : 1,
    maxCutbacks: nonlinearMaterialCount > 0 ? 12 : 0,
  };
}

function createElementRuntimes(
  scene: AnalysisScene,
  nodesById: Map<string, Node>,
  nodeIndexById: Map<string, number>,
): ElementRuntime[] {
  return scene.elements.map((element) => {
    const nodes = getElementNodes(nodesById, element.nodeIds);
    const material = getMaterial(scene.materials, element.materialId);
    const { area, bMatrix } = computeCstTriangleKinematics(nodes);

    return {
      elementId: element.id,
      nodeIds: element.nodeIds,
      materialId: element.materialId,
      nodes,
      area,
      bMatrix,
      dofMap: element.nodeIds.flatMap((nodeId) => {
        const nodeIndex = nodeIndexById.get(nodeId);

        if (nodeIndex === undefined) {
          throw new Error(`Element '${element.id}' references missing node '${nodeId}'.`);
        }

        return [nodeIndex * 2, nodeIndex * 2 + 1];
      }),
      model: createPlaneStrainMaterialModel(material),
    };
  });
}

function assembleSystem(
  runtimes: ElementRuntime[],
  dofCount: number,
  displacements: number[],
  referenceStates: PlaneStrainMaterialPointState[],
): AssemblyResult {
  const globalStiffness = zeroMatrix(dofCount);
  const internalForces = zeros(dofCount);
  const stressIncrementForces = zeros(dofCount);
  const states: PlaneStrainMaterialPointState[] = [];

  runtimes.forEach((runtime, index) => {
    const elementDisplacements = runtime.dofMap.map((dof) => displacements[dof]) as [number, number, number, number, number, number];
    const totalStrain = recoverCstTriangleStrain(runtime.nodes, elementDisplacements);
    const strainIncrement = subtractEngineeringStrains(totalStrain, referenceStates[index].strain);
    const materialResponse = runtime.model.evaluate(strainIncrement, referenceStates[index]);
    const elementStiffness = computeCstTriangleStiffness(runtime.nodes, materialResponse.tangent);
    const elementInternalForce = computeElementInternalForce(runtime.bMatrix, materialResponse.stress, runtime.area);
    const elementStressIncrement = subtractEngineeringStress(materialResponse.stress, referenceStates[index].stress);
    const elementStressIncrementForce = computeElementInternalForce(runtime.bMatrix, elementStressIncrement, runtime.area);

    states[index] = materialResponse.state;

    for (let row = 0; row < 6; row += 1) {
      internalForces[runtime.dofMap[row]] += elementInternalForce[row];
      stressIncrementForces[runtime.dofMap[row]] += elementStressIncrementForce[row];

      for (let column = 0; column < 6; column += 1) {
        globalStiffness[runtime.dofMap[row]][runtime.dofMap[column]] += elementStiffness[row][column];
      }
    }
  });

  return {
    internalForces,
    stressIncrementForces,
    globalStiffness,
    states,
  };
}

function solveLoadIncrement(
  runtimes: ElementRuntime[],
  dofCount: number,
  freeDofs: number[],
  freeDofIndexByDof: Map<number, number>,
  referenceDisplacements: number[],
  referenceStates: PlaneStrainMaterialPointState[],
  loadIncrementVector: number[],
  maxIterations: number,
  tolerance: number,
): IncrementSolveResult | null {
  let trialDisplacements = [...referenceDisplacements];

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const stepAssembly = assembleSystem(runtimes, dofCount, trialDisplacements, referenceStates);
    const residual = subtractVectors(loadIncrementVector, stepAssembly.stressIncrementForces);
    const reducedResidual = freeDofs.map((dof) => residual[dof]);
    const residualNorm = vectorNorm(reducedResidual);
    const targetNorm = Math.max(1, vectorNorm(freeDofs.map((dof) => loadIncrementVector[dof])));

    if (residualNorm <= tolerance * targetNorm) {
      return {
        displacements: trialDisplacements,
        assembly: stepAssembly,
      };
    }

    const reducedMatrix = freeDofs.map((rowIndex) => freeDofs.map((columnIndex) => stepAssembly.globalStiffness[rowIndex][columnIndex]));
    const displacementCorrection = solveDenseLinearSystem(reducedMatrix, reducedResidual);

    trialDisplacements = addVectors(
      trialDisplacements,
      Array.from({ length: dofCount }, (_, dof) => {
        const freeIndex = freeDofIndexByDof.get(dof);
        return freeIndex === undefined ? 0 : displacementCorrection[freeIndex];
      }),
    );
  }

  return null;
}

export function solveLinearElasticPlaneStrain(scene: AnalysisScene): LinearElasticAnalysisResult {
  const nodesById = new Map(scene.nodes.map((node) => [node.id, node]));
  const nodeIndexById = new Map(scene.nodes.map((node, index) => [node.id, index]));
  const dofCount = scene.nodes.length * 2;
  const loadVector = zeros(dofCount);
  const runtimes = createElementRuntimes(scene, nodesById, nodeIndexById);
  const solverSettings = getSolverSettings(scene.materials);

  for (const load of scene.loads) {
    const nodeIndex = nodeIndexById.get(load.nodeId);

    if (nodeIndex === undefined) {
      throw new Error(`Load '${load.id}' references node '${load.nodeId}', which does not exist.`);
    }

    loadVector[nodeIndex * 2] += load.fx;
    loadVector[nodeIndex * 2 + 1] += load.fy;
  }

  const fixedDofs = new Set<number>();

  for (const support of scene.supports) {
    const nodeIndex = nodeIndexById.get(support.nodeId);

    if (nodeIndex === undefined) {
      throw new Error(`Support references node '${support.nodeId}', which does not exist.`);
    }

    if (support.direction === 'x') {
      fixedDofs.add(nodeIndex * 2);
    }

    if (support.direction === 'y') {
      fixedDofs.add(nodeIndex * 2 + 1);
    }
  }

  const freeDofs = Array.from({ length: dofCount }, (_, index) => index).filter((index) => !fixedDofs.has(index));

  if (freeDofs.length === 0) {
    throw new Error('No free degrees of freedom remain after applying supports.');
  }

  const freeDofIndexByDof = new Map(freeDofs.map((dof, index) => [dof, index]));
  let convergedDisplacements = zeros(dofCount);
  let convergedStates = runtimes.map((runtime) => runtime.model.createInitialState());
  let convergedAssembly: AssemblyResult = assembleSystem(runtimes, dofCount, convergedDisplacements, convergedStates);
  const baseLoadFactor = 1 / solverSettings.loadSteps;
  let remainingLoadFactor = 1;
  let proposedLoadFactor = baseLoadFactor;

  while (remainingLoadFactor > 1e-12) {
    let attemptedLoadFactor = Math.min(proposedLoadFactor, remainingLoadFactor);
    let cutbackCount = 0;
    let accepted = false;

    while (!accepted) {
      const loadIncrementVector = loadVector.map((value) => value * attemptedLoadFactor);
      const incrementResult = solveLoadIncrement(
        runtimes,
        dofCount,
        freeDofs,
        freeDofIndexByDof,
        convergedDisplacements,
        convergedStates,
        loadIncrementVector,
        solverSettings.maxIterations,
        solverSettings.tolerance,
      );

      if (incrementResult) {
        convergedDisplacements = incrementResult.displacements;
        convergedStates = incrementResult.assembly.states;
        convergedAssembly = incrementResult.assembly;
        remainingLoadFactor = Math.max(0, remainingLoadFactor - attemptedLoadFactor);
        proposedLoadFactor = Math.min(
          cutbackCount > 0 ? Math.min(baseLoadFactor, attemptedLoadFactor * 2) : baseLoadFactor,
          remainingLoadFactor,
        );
        accepted = true;
        continue;
      }

      if (solverSettings.maxCutbacks === 0 || attemptedLoadFactor / 2 < solverSettings.minIncrementFactor || cutbackCount >= solverSettings.maxCutbacks) {
        throw new Error(
          `Nonlinear solve failed to converge within ${solverSettings.maxIterations} iterations after reducing the load increment to ${attemptedLoadFactor.toExponential(3)}.`,
        );
      }

      attemptedLoadFactor /= 2;
      cutbackCount += 1;
    }
  }

  const displacements = convergedDisplacements;
  const reactionVector = convergedAssembly.internalForces.map((value, index) => value - loadVector[index]);
  const nodalDisplacements = scene.nodes.map((node, index) => {
    const ux = displacements[index * 2];
    const uy = displacements[index * 2 + 1];

    return {
      nodeId: node.id,
      ux,
      uy,
      magnitude: Math.hypot(ux, uy),
    };
  });
  const nodalReactions = scene.nodes
    .map((node, index) => {
      const rx = reactionVector[index * 2];
      const ry = reactionVector[index * 2 + 1];

      return {
        nodeId: node.id,
        rx,
        ry,
        magnitude: Math.hypot(rx, ry),
      };
    })
    .filter((reaction) => reaction.magnitude > 1e-9 || scene.supports.some((support) => support.nodeId === reaction.nodeId));

  const elementResults: ElementAnalysisResult[] = runtimes.map((runtime, index) => {
    const state = convergedStates[index];
    const [sxx, syy, txy] = state.stress;
    const szz = state.outOfPlaneStress;
    const meanStress = (sxx + syy + szz) / 3;
    const deviatoricStress = Math.sqrt(((sxx - syy) ** 2 + (syy - szz) ** 2 + (szz - sxx) ** 2 + 6 * txy ** 2) / 2);

    return {
      elementId: runtime.elementId,
      nodeIds: runtime.nodeIds,
      materialId: runtime.materialId,
      area: runtime.area,
      strain: {
        exx: state.strain[0],
        eyy: state.strain[1],
        gxy: state.strain[2],
        volumetric: state.strain[0] + state.strain[1],
      },
      stress: {
        sxx,
        syy,
        szz,
        txy,
        meanStress,
        deviatoricStress,
      },
    };
  });

  const meanStresses = elementResults.map((result) => result.stress.meanStress);
  const deviatoricStresses = elementResults.map((result) => result.stress.deviatoricStress);

  return {
    displacements: nodalDisplacements,
    reactions: nodalReactions,
    elementResults,
    summary: {
      maxDisplacement: Math.max(0, ...nodalDisplacements.map((result) => result.magnitude)),
      maxReaction: Math.max(0, ...nodalReactions.map((result) => result.magnitude)),
      minMeanStress: meanStresses.length ? Math.min(...meanStresses) : 0,
      maxMeanStress: meanStresses.length ? Math.max(...meanStresses) : 0,
      maxDeviatoricStress: deviatoricStresses.length ? Math.max(...deviatoricStresses) : 0,
    },
  };
}