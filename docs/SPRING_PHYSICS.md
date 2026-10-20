# Spring Physics Cursor Smoothing Specification

Human hand movements captured through optical mouse sensors exhibit high-frequency micro-tremors, uneven sampling intervals, and jagged directional adjustments. ScreenForge applies a second-order mass-spring-damper physical simulation to generate continuous, organic cursor curves.

## Physics Model

The system simulates a virtual pointer particle of mass $m$ tethered via a damped spring to the target mouse coordinate $x_t$:

$$F_{\text{net}} = F_{\text{spring}} + F_{\text{damping}}$$
$$F_{\text{net}} = -k (x - x_t) - c \cdot v$$
$$a = \frac{F_{\text{net}}}{m}$$

Where:
- $k$: Spring stiffness ($120 \le k \le 240$)
- $c$: Damping coefficient ($18 \le c \le 30$)
- $m$: Mass ($m = 1.0$)
- $v$: Current velocity vector
- $x$: Current simulated position vector
- $x_t$: Raw or Hermite-interpolated mouse target

## Critical Damping Condition

To achieve swift convergence without oscillatory overshoot, the damping ratio $\zeta$ is tuned near the critical damping threshold ($\zeta \approx 1.0$):

$$\zeta = \frac{c}{2 \sqrt{k \cdot m}} \approx 1.0$$

When the user adjusts the smoothing slider in the ScreenForge Inspector:
- Higher smoothing increases damping $c$ and adjusts stiffness $k$ to extend the glide trajectory.
- A smoothing value of 0 bypasses physical integration and renders raw sensor telemetry directly.

## Multi-Substep Numerical Integration

To avoid numerical instability during sudden pointer acceleration or frame time drops:

```typescript
const substeps = 3;
const subDt = Math.min(dt, 0.05) / substeps;

for (let s = 0; s < substeps; s++) {
  const dx = currentX - targetX;
  const dy = currentY - targetY;

  const ax = (-k * dx - c * vx) / m;
  const ay = (-k * dy - c * vy) / m;

  vx += ax * subDt;
  vy += ay * subDt;

  currentX += vx * subDt;
  currentY += vy * subDt;
}
```
