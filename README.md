# soilFEM

soilFEM is a browser-based 2D finite element sandbox for small teaching and prototyping problems in geomechanics. It combines a direct SVG editor, a small plane-strain FEM solver, and multiple constitutive models in a Vite + TypeScript app.

The app currently focuses on:

- hand-built or structured triangular meshes
- plane-strain analysis with CST triangles
- nodal supports, nodal loads, and optional gravity body force settings
- linear elastic, Drucker-Prager, and Terra Cotta material models
- contour visualization, deformation display, reactions, and displacement vectors

## Use the app

The app is live at [https://benjym.github.io/soilFEM/](https://benjym.github.io/soilFEM/). The source code is available in this repository.

## Current Capabilities

- Direct editor tools for:
  - select / pan
  - add node
  - add element
  - fix X
  - fix Y
  - stamp load
- Structured rectangular mesh generator
- Built-in example scenes
- Material editing in the right panel
- Material-model element fill mode when contours are off
- Contour legend with color bar when contour fields are enabled
- Per-element stress and strain recovery for:
  - mean stress
  - deviatoric stress
  - sigma xx
  - sigma yy
  - tau xy
  - volumetric strain

## Material Models

### Linear Elastic

Standard plane-strain elasticity parameterized by:

- Young's modulus `E`
- Poisson ratio `nu`
- density

### Drucker-Prager

Plane-strain Drucker-Prager response with nonlinear global load stepping and iteration controls.

Parameters include:

- `E`
- `nu`
- density
- `beta`
- `mu`
- exponent
- load-step and solver settings

### Terra Cotta

Tensorial Terra Cotta plane-strain model with nonlinear elasticity and internal-variable evolution.

Unlike the elastic and Drucker-Prager models, Terra Cotta is not parameterized by `E` and `nu`. It uses intrinsic stiffness parameters:

- bulk modulus `K~`
- shear modulus `G~`
- density
- confinement, solid fraction, meso-temperature, and dissipation-related parameters
- load-step and solver settings

The working constitutive note is in [constitutive-models/terra-cotta.md](constitutive-models/terra-cotta.md).

## Getting Started

### Requirements

- Node.js
- npm

### Install

```bash
npm install
```

### Run The App

```bash
npm run dev
```

Vite will start a local development server.

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

### Preview The Production Build

```bash
npm run preview
```

## Editor Workflow

1. Choose an example scene or start from the default scene.
2. Add or move nodes.
3. Create triangular elements.
4. Assign materials.
5. Add directional supports with `Fix X` and `Fix Y`.
6. Stamp nodal loads.
7. Optionally enable gravity and set `gx` / `gy`.
8. Solve the model.
9. Inspect contours, vectors, reactions, and material-dependent fills.

## Keyboard Shortcuts

- `1`: Select / Pan
- `2`: Add Node
- `3`: Add Element
- `4`: Fix X
- `5`: Fix Y
- `6`: Stamp Load
- `M`: Open structured mesh dialog
- `Delete` / `Backspace`: Delete selection

## Project Structure

- [src/app/App.ts](src/app/App.ts): app shell, UI wiring, panels
- [src/editor/SvgEditor.ts](src/editor/SvgEditor.ts): SVG rendering and direct manipulation
- [src/store/AppStore.ts](src/store/AppStore.ts): application state and editor actions
- [src/fem/solver/solveLinearElasticPlaneStrain.ts](src/fem/solver/solveLinearElasticPlaneStrain.ts): global FEM solve loop
- [src/fem/materials](src/fem/materials): constitutive models
- [src/examples](src/examples): built-in scenes
- [constitutive-models](constitutive-models): derivation notes and references

## Notes

- The solver is currently built around CST triangles in plane strain.
- The app is intentionally small and browser-first, so the codebase favors directness over heavy framework structure.
- Terra Cotta support includes adaptive local substepping and global cutback in the nonlinear solve path.

## Status

The repository currently builds and tests cleanly with:

- `npm test`
- `npm run build`
