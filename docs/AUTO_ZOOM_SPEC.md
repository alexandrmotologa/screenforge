# Auto-Zoom Algorithm Specification

The ScreenForge Auto-Zoom subsystem evaluates discrete telemetry interactions and generates continuous camera paths.

## Keyframe Generation Algorithm

### Input
- `telemetry`: An ordered list of `CursorEvent` items sorted by timestamp.
- `duration`: Total duration of the recording session in seconds.
- `options`:
  - `defaultScale`: Target magnification factor (default 2.0x).
  - `transitionDuration`: Duration of the lead-in zoom transition (default 0.45s).
  - `holdDuration`: Duration of camera dwell after the last action in a cluster (default 1.4s).
  - `clusterTimeThreshold`: Maximum gap between proximate clicks to form a cluster (default 2.2s).
  - `clusterDistThreshold`: Maximum normalized spatial distance between clicks (default 0.35).

### Clustering Pseudocode
```typescript
for each action in telemetry:
  if currentCluster is null:
    currentCluster = createCluster(action)
  else:
    dt = action.time - currentCluster.lastActionTime
    dist = hypot(action.x - currentCluster.targetX, action.y - currentCluster.targetY)
    if dt <= clusterTimeThreshold and dist <= clusterDistThreshold:
      // Merge into active cluster with updated weighted center
      currentCluster.targetX = currentCluster.targetX * 0.4 + action.x * 0.6
      currentCluster.targetY = currentCluster.targetY * 0.4 + action.y * 0.6
      currentCluster.endTime = action.time + holdDuration
    else:
      clusters.append(currentCluster)
      currentCluster = createCluster(action)
```

## Viewport Safety Clamping

To ensure that the magnified viewport never scrolls past the edge of the source video:

```typescript
function clampCenter(cx: number, cy: number, scale: number): { x: number, y: number } {
  if (scale <= 1.0) return { x: 0.5, y: 0.5 };
  const halfViewport = 0.5 / scale;
  return {
    x: Math.min(1.0 - halfViewport, Math.max(halfViewport, cx)),
    y: Math.min(1.0 - halfViewport, Math.max(halfViewport, cy))
  };
}
```

## Smooth Transition Function

ScreenForge uses a quintic ease-in-out formula for zero first and second derivatives at endpoints:

$$f(t) = \begin{cases} 16 t^5 & t < 0.5 \\ 1 - \frac{(-2t + 2)^5}{2} & t \ge 0.5 \end{cases}$$
