# ScreenForge Architecture & Technical Specifications

ScreenForge is designed around a multi-stage video composition pipeline that synchronizes raw screen recordings with high-frequency cursor telemetry, computes virtual camera paths, applies physical smoothing to mouse positions, and renders the composite image into an isolated canvas.

## System Components

### 1. Telemetry Capture Layer
ScreenForge samples cursor positions and mouse click events at up to 60Hz. Each telemetry packet records:
- `x`, `y`: Normalized screen coordinates (0.0 to 1.0)
- `timestamp`: Elapsed milliseconds from recording start
- `type`: `move`, `mousedown`, `mouseup`, `click`, `dblclick`, or `keydown`
- `button`: Primary (0), middle (1), or secondary (2)

### 2. Auto-Zoom Analysis Engine (`src/engine/autoZoom.ts`)
The auto-zoom subsystem identifies clusters of user actions and converts them into time-bounded camera keyframes:
1. **Filtering**: Extracts user clicks and focus periods from the telemetry array.
2. **Temporal and Spatial Clustering**: Evaluates distance $\Delta d = \sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}$ and time interval $\Delta t = t_2 - t_1$. When $\Delta t \le 2.2\text{s}$ and $\Delta d \le 0.35$, subsequent clicks are coalesced into a single camera focus track with weighted center coordinates.
3. **Viewport Safety Clamping**: Given zoom scale $S$, the visible width is $W_v = 1 / S$. The camera center $(c_x, c_y)$ is clamped within $[0.5/S, 1 - 0.5/S]$ to prevent revealing empty canvas space outside the recording boundaries.
4. **Camera Trajectory Interpolation**: Employs quintic ease-in-out curves for entering, holding, and exiting zooms without abrupt velocity changes.

### 3. Spring Physics Cursor Engine (`src/engine/cursorPhysics.ts`)
Raw human mouse movements exhibit physiological jitter and discrete step intervals. ScreenForge models the cursor as a point mass attached to a virtual spring anchored to the interpolated mouse target:

$$m \frac{d^2 x}{dt^2} + c \frac{dx}{dt} + k (x - x_{\text{target}}) = 0$$

- $m$: Virtual mass (default 1.0)
- $k$: Spring stiffness coefficient (default 160.0)
- $c$: Damping coefficient (default 22.0)

Numerical integration is evaluated via sub-stepped Euler integration to maintain numerical stability regardless of frame time variances.

### 4. Studio Canvas Compositor (`src/engine/studioRenderer.ts`)
Each frame is composed onto an offscreen canvas at the target resolution:
1. Studio background fill (procedural mesh gradient or flat fill).
2. 2.5D affine transformation matrix application when perspective tilt is active.
3. Ambient and directional drop shadow generation.
4. Rounded rectangle window shell clipping.
5. Window header bar and macOS traffic lights rendering.
6. Camera-transformed video source blit.
7. Projected vector cursor pointer and click ripple expansion waves.

### 5. Multi-Engine Exporter (`src/engine/exportEngine.ts`)
- **WebCodecs and MediaRecorder**: Browser-native rendering loop that iterates through all video frames, executes the composition pass, and streams frames directly to a MediaRecorder or VideoEncoder instance.
- **Native FFmpeg Bridge**: When running under the Tauri desktop host, ScreenForge can invoke local FFmpeg binaries with hardware-accelerated profiles (`h264_nvenc`, `h264_qsv`, `h264_amf`) and two-pass GIF palette generation.
