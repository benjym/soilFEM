import type { Node } from '../../model/types';
import type { Matrix3x3 } from '../materials/materialModel';

export type Matrix3x6 = [
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
];

export type Matrix6x6 = [
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
];

export interface CstTriangleKinematics {
  area: number;
  signedDoubleArea: number;
  bMatrix: Matrix3x6;
}

function zeroMatrix6(): Matrix6x6 {
  return [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ];
}

export function computeCstTriangleKinematics(nodes: [Node, Node, Node]): CstTriangleKinematics {
  const [node1, node2, node3] = nodes;
  const signedDoubleArea =
    node1.x * (node2.y - node3.y) +
    node2.x * (node3.y - node1.y) +
    node3.x * (node1.y - node2.y);
  const area = Math.abs(signedDoubleArea) / 2;

  if (area <= 1e-12) {
    throw new Error('Encountered a degenerate CST triangle with near-zero area.');
  }

  const beta1 = node2.y - node3.y;
  const beta2 = node3.y - node1.y;
  const beta3 = node1.y - node2.y;
  const gamma1 = node3.x - node2.x;
  const gamma2 = node1.x - node3.x;
  const gamma3 = node2.x - node1.x;
  const denominator = signedDoubleArea;

  return {
    area,
    signedDoubleArea,
    bMatrix: [
      [beta1 / denominator, 0, beta2 / denominator, 0, beta3 / denominator, 0],
      [0, gamma1 / denominator, 0, gamma2 / denominator, 0, gamma3 / denominator],
      [gamma1 / denominator, beta1 / denominator, gamma2 / denominator, beta2 / denominator, gamma3 / denominator, beta3 / denominator],
    ],
  };
}

export function computeCstTriangleStiffness(
  nodes: [Node, Node, Node],
  constitutiveMatrix: Matrix3x3,
  thickness = 1,
): Matrix6x6 {
  const { area, bMatrix } = computeCstTriangleKinematics(nodes);
  const stiffness = zeroMatrix6();

  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      let entry = 0;

      for (let alpha = 0; alpha < 3; alpha += 1) {
        for (let beta = 0; beta < 3; beta += 1) {
          entry += bMatrix[alpha][row] * constitutiveMatrix[alpha][beta] * bMatrix[beta][column];
        }
      }

      stiffness[row][column] = entry * area * thickness;
    }
  }

  return stiffness;
}

export function recoverCstTriangleStrain(
  nodes: [Node, Node, Node],
  elementDisplacements: [number, number, number, number, number, number],
): [number, number, number] {
  const { bMatrix } = computeCstTriangleKinematics(nodes);

  return [
    bMatrix[0][0] * elementDisplacements[0] + bMatrix[0][1] * elementDisplacements[1] + bMatrix[0][2] * elementDisplacements[2] + bMatrix[0][3] * elementDisplacements[3] + bMatrix[0][4] * elementDisplacements[4] + bMatrix[0][5] * elementDisplacements[5],
    bMatrix[1][0] * elementDisplacements[0] + bMatrix[1][1] * elementDisplacements[1] + bMatrix[1][2] * elementDisplacements[2] + bMatrix[1][3] * elementDisplacements[3] + bMatrix[1][4] * elementDisplacements[4] + bMatrix[1][5] * elementDisplacements[5],
    bMatrix[2][0] * elementDisplacements[0] + bMatrix[2][1] * elementDisplacements[1] + bMatrix[2][2] * elementDisplacements[2] + bMatrix[2][3] * elementDisplacements[3] + bMatrix[2][4] * elementDisplacements[4] + bMatrix[2][5] * elementDisplacements[5],
  ];
}
