import React, { useState } from 'react';
import {
  ZoomIn,
  MousePointer,
  Palette,
  Layers,
  Sparkles,
  Sliders,
  Box,
  Eye,
  Trash2,
} from 'lucide-react';
import {
  AspectRatio,
  BackgroundTheme,
  CursorSettings,
  CursorStyle,
  StudioSettings,
  WindowFrameStyle,
  ZoomKeyframe,
} from '../types';

interface InspectorProps {
  studioSettings: StudioSettings;
  cursorSettings: CursorSettings;
  zoomKeyframes: ZoomKeyframe[];
  onUpdateStudioSettings: (settings: Partial<StudioSettings>) => void;
  onUpdateCursorSettings: (settings: Partial<CursorSettings>) => void;
  onRegenerateAutoZoom: () => void;
  onUpdateKeyframe: (id: string, updates: Partial<ZoomKeyframe>) => void;
  onRemoveKeyframe: (id: string) => void;
  onSeek: (time: number) => void;
}

export const Inspector: React.FC<InspectorProps> = ({
  studioSettings,
  cursorSettings,
  zoomKeyframes,
  onUpdateStudioSettings,
  onUpdateCursorSettings,
  onRegenerateAutoZoom,
  onUpdateKeyframe,
  onRemoveKeyframe,
  onSeek,
}) => {
  const [activeTab, setActiveTab] = useState<'canvas' | 'zoom' | 'cursor'>('canvas');

  const bgThemes: Array<{ id: BackgroundTheme; name: string; class: string }> = [
    { id: 'sunset', name: 'Sunset', class: 'canvas-bg-sunset' },
    { id: 'cosmic', name: 'Cosmic', class: 'canvas-bg-cosmic' },
    { id: 'emerald', name: 'Emerald', class: 'canvas-bg-emerald' },
    { id: 'cyberpunk', name: 'Cyberpunk', class: 'canvas-bg-cyberpunk' },
    { id: 'velvet', name: 'Velvet', class: 'canvas-bg-velvet' },
    { id: 'obsidian', name: 'Obsidian', class: 'canvas-bg-obsidian' },
    { id: 'slate', name: 'Slate', class: 'canvas-bg-slate' },
    { id: 'clean-white', name: 'Clean White', class: 'canvas-bg-clean-white' },
  ];

  return (
    <aside className="w-80 border-l border-neutral-800/80 bg-neutral-900/90 backdrop-blur-md flex flex-col z-20 select-none overflow-hidden">
      {/* Top Tab Switcher */}
      <div className="h-12 border-b border-neutral-800/80 px-2 flex items-center justify-between bg-neutral-950/40">
        <button
          onClick={() => setActiveTab('canvas')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'canvas'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-rose-400" />
          <span>Canvas</span>
        </button>

        <button
          onClick={() => setActiveTab('zoom')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'zoom'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <ZoomIn className="w-3.5 h-3.5 text-pink-400" />
          <span>Auto-Zoom</span>
        </button>

        <button
          onClick={() => setActiveTab('cursor')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'cursor'
              ? 'bg-neutral-800 text-white shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <MousePointer className="w-3.5 h-3.5 text-sky-400" />
          <span>Cursor</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* ================= CANVAS & STUDIO TAB ================= */}
        {activeTab === 'canvas' && (
          <>
            {/* Background Mesh Theme */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold tracking-wider uppercase text-neutral-400">
                Studio Background
              </label>
              <div className="grid grid-cols-4 gap-2">
                {bgThemes.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() =>
                      onUpdateStudioSettings({
                        backgroundTheme: theme.id,
                        backgroundType: 'mesh',
                      })
                    }
                    className={`h-11 rounded-lg border relative overflow-hidden transition-all ${
                      theme.class
                    } ${
                      studioSettings.backgroundTheme === theme.id
                        ? 'ring-2 ring-rose-500 border-white'
                        : 'border-neutral-700/60 hover:opacity-90'
                    }`}
                    title={theme.name}
                  />
                ))}
              </div>
            </div>

            {/* Inset Padding & Corner Radius */}
            <div className="space-y-4 pt-2 border-t border-neutral-800/80">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-neutral-300">Canvas Inset Margin</span>
                  <span className="font-mono text-neutral-400">
                    {studioSettings.padding}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="25"
                  value={studioSettings.padding}
                  onChange={(e) =>
                    onUpdateStudioSettings({ padding: Number(e.target.value) })
                  }
                  className="w-full accent-rose-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-neutral-300">Corner Radius</span>
                  <span className="font-mono text-neutral-400">
                    {studioSettings.borderRadius}px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="36"
                  value={studioSettings.borderRadius}
                  onChange={(e) =>
                    onUpdateStudioSettings({ borderRadius: Number(e.target.value) })
                  }
                  className="w-full accent-rose-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-neutral-300">Drop Shadow Depth</span>
                  <span className="font-mono text-neutral-400">
                    {studioSettings.shadowStrength}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={studioSettings.shadowStrength}
                  onChange={(e) =>
                    onUpdateStudioSettings({ shadowStrength: Number(e.target.value) })
                  }
                  className="w-full accent-rose-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Window Frame Style */}
            <div className="space-y-2.5 pt-2 border-t border-neutral-800/80">
              <label className="text-xs font-bold tracking-wider uppercase text-neutral-400">
                Window Frame & Chrome
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                {(['macOS', 'sleek', 'none'] as WindowFrameStyle[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => onUpdateStudioSettings({ windowFrame: style })}
                    className={`py-1 text-xs font-semibold rounded capitalize transition-all ${
                      studioSettings.windowFrame === style
                        ? 'bg-neutral-800 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={studioSettings.windowTitle}
                onChange={(e) =>
                  onUpdateStudioSettings({ windowTitle: e.target.value })
                }
                placeholder="Window Title..."
                className="w-full px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* 2.5D Perspective 3D Tilt */}
            <div className="space-y-3 pt-2 border-t border-neutral-800/80">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-xs font-bold text-neutral-300">
                    2.5D Perspective 3D Tilt
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={studioSettings.perspective3D.enabled}
                  onChange={(e) =>
                    onUpdateStudioSettings({
                      perspective3D: {
                        ...studioSettings.perspective3D,
                        enabled: e.target.checked,
                      },
                    })
                  }
                  className="rounded accent-rose-500 cursor-pointer"
                />
              </div>

              {studioSettings.perspective3D.enabled && (
                <div className="space-y-2.5 pl-2 border-l border-neutral-800">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-neutral-400">
                      <span>Pitch (Rotate X)</span>
                      <span className="font-mono">
                        {studioSettings.perspective3D.rotateX}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      value={studioSettings.perspective3D.rotateX}
                      onChange={(e) =>
                        onUpdateStudioSettings({
                          perspective3D: {
                            ...studioSettings.perspective3D,
                            rotateX: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-rose-500 h-1 bg-neutral-800 rounded cursor-pointer"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-neutral-400">
                      <span>Yaw (Rotate Y)</span>
                      <span className="font-mono">
                        {studioSettings.perspective3D.rotateY}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      value={studioSettings.perspective3D.rotateY}
                      onChange={(e) =>
                        onUpdateStudioSettings({
                          perspective3D: {
                            ...studioSettings.perspective3D,
                            rotateY: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full accent-rose-500 h-1 bg-neutral-800 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* ================= AUTO-ZOOM TAB ================= */}
        {activeTab === 'zoom' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Auto-Zoom Engine
              </span>
              <button
                onClick={onRegenerateAutoZoom}
                className="px-2 py-1 text-[11px] font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded transition-all flex items-center gap-1"
                title="Re-run telemetry clustering"
              >
                <Sparkles className="w-3 h-3 text-rose-400" />
                <span>Re-Analyze</span>
              </button>
            </div>

            <div className="space-y-3">
              <span className="text-[11px] text-neutral-400 block leading-relaxed">
                Smart Auto-Zoom clusters cursor clicks and dwell periods into
                cinematic camera glide tracks with safe viewport boundary
                clamping.
              </span>

              {/* Keyframes list */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-neutral-300">
                  Timeline Keyframes ({zoomKeyframes.length})
                </span>
                <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {zoomKeyframes.length === 0 ? (
                    <div className="p-3 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded-lg">
                      No zoom keyframes. Click "+ Add Zoom" on timeline or hit
                      Re-Analyze.
                    </div>
                  ) : (
                    zoomKeyframes.map((kf, i) => (
                      <div
                        key={kf.id}
                        onClick={() => onSeek(kf.startTime)}
                        className="p-2 bg-neutral-950/70 border border-neutral-800 rounded-lg hover:border-neutral-700 transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div>
                          <div className="text-xs font-semibold text-neutral-200">
                            {kf.label || `Zoom #${i + 1}`}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-400">
                            {kf.startTime.toFixed(1)}s - {kf.endTime.toFixed(1)}s •{' '}
                            {kf.scale}x
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1.2"
                            max="3.5"
                            step="0.1"
                            value={kf.scale}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onUpdateKeyframe(kf.id, {
                                scale: Number(e.target.value),
                              })
                            }
                            className="w-14 px-1 py-0.5 text-xs bg-neutral-900 border border-neutral-700 rounded text-center text-white"
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveKeyframe(kf.id);
                            }}
                            className="p-1 text-neutral-500 hover:text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ================= CURSOR PHYSICS TAB ================= */}
        {activeTab === 'cursor' && (
          <>
            {/* Visibility Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Cursor Rendering
              </span>
              <input
                type="checkbox"
                checked={cursorSettings.visible}
                onChange={(e) =>
                  onUpdateCursorSettings({ visible: e.target.checked })
                }
                className="rounded accent-rose-500 cursor-pointer"
              />
            </div>

            {/* Spring Smoothing Strength */}
            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-neutral-300">
                    Spring Smoothing Strength
                  </span>
                  <span className="font-mono text-rose-400 font-bold">
                    {cursorSettings.smoothing}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={cursorSettings.smoothing}
                  onChange={(e) =>
                    onUpdateCursorSettings({ smoothing: Number(e.target.value) })
                  }
                  className="w-full accent-rose-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
                <span className="text-[10px] text-neutral-500 block">
                  Simulates second-order mass-spring-damper physics to eliminate
                  erratic mouse jitters.
                </span>
              </div>

              {/* Cursor Style */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-300">
                  Cursor Pointer Style
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                  {(
                    [
                      { id: 'macos', label: 'macOS Crisp' },
                      { id: 'dark', label: 'Obsidian Dark' },
                      { id: 'glow-ring', label: 'Glow Ring' },
                      { id: 'neon-dot', label: 'Neon Dot' },
                    ] as Array<{ id: CursorStyle; label: string }>
                  ).map((style) => (
                    <button
                      key={style.id}
                      onClick={() => onUpdateCursorSettings({ style: style.id })}
                      className={`py-1.5 px-2 text-xs font-semibold rounded text-left transition-all ${
                        cursorSettings.style === style.id
                          ? 'bg-neutral-800 text-white shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cursor Size */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-neutral-300">Pointer Scale</span>
                  <span className="font-mono text-neutral-400">
                    {cursorSettings.size}px
                  </span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="44"
                  value={cursorSettings.size}
                  onChange={(e) =>
                    onUpdateCursorSettings({ size: Number(e.target.value) })
                  }
                  className="w-full accent-rose-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Click Ripple Wave Animations */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-300">
                    Tactile Click Ripples
                  </span>
                  <input
                    type="checkbox"
                    checked={cursorSettings.showRipples}
                    onChange={(e) =>
                      onUpdateCursorSettings({ showRipples: e.target.checked })
                    }
                    className="rounded accent-rose-500 cursor-pointer"
                  />
                </div>

                {cursorSettings.showRipples && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Ripple Color</span>
                    <input
                      type="color"
                      value={cursorSettings.rippleColor}
                      onChange={(e) =>
                        onUpdateCursorSettings({ rippleColor: e.target.value })
                      }
                      className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
