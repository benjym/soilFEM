# Terracotta Tensorial Constitutive Formulation

This note collects the tensorial Terracotta constitutive model from Masi and Einav (2025), Section 2.2, with the paper's equation numbers kept in the text for traceability. The final tensorial constitutive equations are the paper's Eq. (21a) and Eq. (21b); the definitions below gather the quantities they depend on.

## Basic Invariants and Tensors

Mean stress and elastic volumetric strain:

$$
p = \frac{1}{3}\sigma_{kk},
\qquad
\varepsilon_v^e = \varepsilon_{kk}^e.
$$

Deviatoric stress and elastic strain tensors:

$$
s_{ij} = \sigma_{ij} - p\,\delta_{ij},
\qquad
e_{ij}^e = \varepsilon_{ij}^e - \frac{\varepsilon_v^e}{3}\delta_{ij}.
$$

Stress and strain invariants:

$$
q = \left(\frac{3}{2}s_{ij}s_{ij}\right)^{1/2},
\qquad
\varepsilon_s^e = \left(\frac{2}{3}e_{ij}^e e_{ij}^e\right)^{1/2}.
$$

Rate invariants used in the viscous law:

$$
\dot\varepsilon_v = \dot\varepsilon_{kk},
\qquad
\dot e_{ij} = \dot\varepsilon_{ij} - \frac{\dot\varepsilon_v}{3}\delta_{ij}.
$$

## Energy Split and Elastic Response

Paper Eq. (8) splits the internal energy into elastic and meso-related parts:

For implementation purposes, this model is parameterized directly by the intrinsic stiffnesses $\tilde K$ and $\tilde G$; it is not posed in terms of Young's modulus $E$ and Poisson ratio $\nu$.

$$
u = u^e(\phi, \varepsilon_{ij}^e) + u^m(s^m),
$$

$$
u^e = \phi^6\left(\frac{\tilde K}{6}(\varepsilon_v^e)^3 + \tilde G\,\varepsilon_v^e\,e_{ij}^e e_{ij}^e\right),
\qquad
u^m = \frac{\Gamma}{4}(s^m)^2.
$$

The stress invariants are decomposed as in paper Eq. (9):

$$
p = p^e + p^d + p^T,
\qquad
q = q^e + q^d.
$$

From paper Eq. (10), the elastic pressure, elastic deviatoric invariant, and thermodynamic pressure are:

$$
p^e = \phi^6\left(\frac{\tilde K}{2}(\varepsilon_v^e)^2 + \frac{3\tilde G}{2}(\varepsilon_s^e)^2\right),
$$

$$
q^e = 3\tilde G\,\phi^6\,\varepsilon_v^e\,\varepsilon_s^e,
$$

$$
p^T = \frac{(T^m)^2}{\Gamma},
\qquad
T^m = \frac{\Gamma}{2}s^m.
$$

The tensorial elastic stress from paper Eq. (14) is:

$$
\sigma_{ij}^e = \phi^6\left(\frac{\tilde K}{2}(\varepsilon_v^e)^2\delta_{ij} + \tilde G\,\delta_{ij}\,e_{kl}^e e_{kl}^e + 2\tilde G\,\varepsilon_v^e e_{ij}^e\right).
$$

## Dissipative Structure and Calibration

The generalized viscous-stress and plastic-strain-rate structure in paper Eq. (17) is:

$$
\begin{bmatrix}
p^d \\
s_{ij}^d
\end{bmatrix}
=
\frac{2T^m}{\Gamma}
\begin{bmatrix}
a^d & b_{kl}^d \\
b_{ij}^d & c_{ijkl}^d
\end{bmatrix}
\begin{bmatrix}
\dot\varepsilon_v \\
\dot e_{kl}
\end{bmatrix},
$$

$$
\begin{bmatrix}
\dot\varepsilon_v^p \\
\dot e_{ij}^p
\end{bmatrix}
=
T^m
\begin{bmatrix}
a^p & b_{kl}^p \\
b_{ij}^p & c_{ijkl}^p
\end{bmatrix}
\begin{bmatrix}
p^e \\
s_{kl}^e
\end{bmatrix}.
$$

After neglecting non-local terms and using $\bar\eta = 2\eta T^m$, the meso-temperature evolution in paper Eq. (18) becomes:

$$
\dot T^m = a\,\dot\varepsilon_v^2 + \frac{2}{3}c\,\dot e_{ij}\dot e_{ij} - \eta (T^m)^2.
$$

The dissipative coefficients chosen in paper Eq. (19) are:

$$
a^d = a,
\qquad
b_{ij}^d \equiv 0_{ij},
\qquad
c_{ijkl}^d = \frac{2}{3}c\,\delta_{ik}\delta_{jl},
$$

with $a > 0$ and $c > 0$.

The plastic transport coefficients from paper Eq. (20) are:

$$
a^p = \sqrt{\frac{\eta}{a}}\frac{1}{p_c(\phi)},
$$

$$
b_{ij}^p = -\frac{3}{2}\frac{a^p}{M^2}\frac{s_{ij}^e}{p^e},
$$

$$
c_{ijkl}^p = \frac{3}{2}\left(\sqrt{\frac{\eta}{c}}\frac{1}{M\omega\,p_c(\phi)} + \frac{a^p}{M^2}\right)\delta_{ik}\delta_{jl},
$$

$$
p_c(\phi) = p_I\phi^{\lambda},
\qquad
p_I = \phi_I^{-\lambda}\,\mathrm{kPa}.
$$

## Final Tensorial Constitutive Equations

Paper Eq. (21a), viscous stress:

$$
\sigma_{ij}^d = \frac{2T^m}{\Gamma}\left(a\,\dot\varepsilon_v\,\delta_{ij} + \frac{2}{3}c\,\dot e_{ij}\right).
$$

Paper Eq. (21b), plastic strain rate:

$$
\dot\varepsilon_{ij}^p = \frac{T^m}{M^2 p_I \phi^{\lambda}}\sqrt{\frac{\eta}{a}}
\left[
\left(M^2 - \left(\frac{q^e}{p^e}\right)^2\right)\frac{p^e}{3}\delta_{ij}
+ \frac{3}{2}\sqrt{\frac{a}{c}}\frac{M}{\omega}s_{ij}^e
\right].
$$

## State Evolution Needed for a General FEM Constitutive Update

For a tensorial material-point update, the Terracotta state is not closed by Eq. (21a) and Eq. (21b) alone. The evolving internal variables are

$$
\{\phi,\; T^m,\; \varepsilon_{ij}^e\}.
$$

The full stress decomposition from paper Eq. (2) is:

$$
\sigma_{ij} = \sigma_{ij}^e + \sigma_{ij}^d + p^T\delta_{ij}.
$$

The solid-fraction evolution from paper Eq. (3) is:

$$
\dot\phi + v_i\nabla_i\phi = \phi\dot\varepsilon_v.
$$

The elastic-strain evolution from paper Eq. (4) is:

$$
\dot\varepsilon_{ij}^e + v_k\nabla_k\varepsilon_{ij}^e + \Omega_{ik}\varepsilon_{kj}^e - \varepsilon_{ik}^e\Omega_{kj} = \dot\varepsilon_{ij} - \dot\varepsilon_{ij}^p,
$$

where $\Omega_{ij}$ is the skew-symmetric part of the spatial velocity gradient.

Together with the meso-temperature evolution already listed above,

$$
\dot T^m = a\,\dot\varepsilon_v^2 + \frac{2}{3}c\,\dot e_{ij}\dot e_{ij} - \eta (T^m)^2,
$$

these equations define the local constitutive dynamics.

## Material-Point Form Commonly Used in Small-Strain FEM

For a standard local constitutive update at an integration point, the paper's direct-shear reduction is not needed. A practical small-strain form is obtained by neglecting advection and spin terms at the material point:

$$
v_i\nabla_i(\cdot) \approx 0,
\qquad
\Omega_{ij} \approx 0.
$$

Under these assumptions, the state update simplifies to:

$$
\dot\phi = \phi\dot\varepsilon_v,
$$

$$
\dot\varepsilon_{ij}^e = \dot\varepsilon_{ij} - \dot\varepsilon_{ij}^p,
$$

$$
\dot T^m = a\,\dot\varepsilon_v^2 + \frac{2}{3}c\,\dot e_{ij}\dot e_{ij} - \eta (T^m)^2.
$$

The total stress is then reconstructed as

$$
\sigma_{ij} = \sigma_{ij}^e(\phi, \varepsilon_{ij}^e) + \sigma_{ij}^d(T^m, \dot\varepsilon_{ij}) + p^T(T^m)\delta_{ij}.
$$

In expanded form,

$$
\sigma_{ij} = \phi^6\left(\frac{\tilde K}{2}(\varepsilon_v^e)^2\delta_{ij} + \tilde G\,\delta_{ij}\,e_{kl}^e e_{kl}^e + 2\tilde G\,\varepsilon_v^e e_{ij}^e\right)
+ \frac{2T^m}{\Gamma}\left(a\,\dot\varepsilon_v\,\delta_{ij} + \frac{2}{3}c\,\dot e_{ij}\right)
+ \frac{(T^m)^2}{\Gamma}\delta_{ij}.
$$

## Minimal Local Update Recipe

Given the strain increment $\Delta\varepsilon_{ij}$ over a time step $\Delta t$, define

$$
\dot\varepsilon_{ij} \approx \frac{\Delta\varepsilon_{ij}}{\Delta t},
\qquad
\dot\varepsilon_v = \dot\varepsilon_{kk},
\qquad
\dot e_{ij} = \dot\varepsilon_{ij} - \frac{\dot\varepsilon_v}{3}\delta_{ij}.
$$

Then a local constitutive integration step requires:

1. Start from the previous state $\{\phi_n, T^m_n, \varepsilon_{ij,n}^e\}$.
2. Compute $\sigma_{ij,n}^e$, $p_n^e$, $q_n^e$, and $s_{ij,n}^e$ from the previous elastic state.
3. Evaluate $\dot\varepsilon_{ij,n}^p$ from Eq. (21b).
4. Integrate the internal variables:

$$
\phi_{n+1} = \phi_n + \Delta t\,\phi_n\dot\varepsilon_{v,n},
$$

$$
\varepsilon_{ij,n+1}^e = \varepsilon_{ij,n}^e + \Delta t\left(\dot\varepsilon_{ij,n} - \dot\varepsilon_{ij,n}^p\right),
$$

$$
T^m_{n+1} = T^m_n + \Delta t\left(a\,\dot\varepsilon_{v,n}^2 + \frac{2}{3}c\,\dot e_{ij,n}\dot e_{ij,n} - \eta (T_n^m)^2\right).
$$

1. Recompute $\sigma_{ij,n+1}$ from the updated state.

The above is the minimal explicit Euler update. In practice, because the model is nonlinear and the plastic rate depends on the elastic state, a midpoint, backward-Euler, or local Newton solve is likely to be more robust for large time steps.

## Symbol Notes

- $\phi$ is the current solid fraction.
- $T^m$ is the meso-temperature.
- $\Gamma$ is the positive meso-related energetic constant appearing in $u^m$.
- $\tilde K$ and $\tilde G$ are the intrinsic bulk and shear stiffness constants.
- $M$ and $\omega$ are the critical-state-line parameters.
- $\lambda$ and $\phi_I$ define the isotropic compression relation $p_c(\phi)$.
- $a$, $c$, and $\eta$ are positive rheological or dissipation parameters.
- $\delta_{ij}$ is the Kronecker delta.
- $\Omega_{ij}$ is the skew-symmetric part of the spatial velocity gradient.

With the state laws above, this note is sufficient for a general local constitutive update in small-strain FEM. A finite-strain or Eulerian implementation would need to retain the advection and spin terms in the elastic-strain evolution equation.
