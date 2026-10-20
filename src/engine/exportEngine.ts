import {
  CursorEvent,
  CursorSettings,
  ExportSettings,
  StudioSettings,
  ZoomKeyframe,
} from '../types';
import { SpringCursorEngine } from './cursorPhysics';
import { StudioRenderer } from './studioRenderer';

export interface ExportProgress {
  currentFrame: number;
  totalFrames: number;
  progress: number; // 0..1
  elapsedSeconds: number;
  etaSeconds: number;
  statusText: string;
}

export class ExportEngine {
  /**
   * Exports the session composition directly in browser / WebCodecs / MediaRecorder.
   */
  public static async renderClientSide(
    videoElement: HTMLVideoElement,
    session: {
      duration: number;
      inPoint: number;
      outPoint: number;
      cursorTelemetry: CursorEvent[];
      zoomKeyframes: ZoomKeyframe[];
      videoNaturalWidth: number;
      videoNaturalHeight: number;
    },
    studioSettings: StudioSettings,
    cursorSettings: CursorSettings,
    exportSettings: ExportSettings,
    onProgress?: (progress: ExportProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<Blob> {
    const startTime = session.inPoint;
    const endTime = session.outPoint > startTime ? session.outPoint : session.duration;
    const duration = endTime - startTime;
    const fps = exportSettings.fps;
    const totalFrames = Math.max(1, Math.round(duration * fps));

    // Determine target canvas dimensions
    let targetWidth = 1920;
    if (exportSettings.resolution === '4k') targetWidth = 3840;
    else if (exportSettings.resolution === '2k') targetWidth = 2560;
    else if (exportSettings.resolution === '720p') targetWidth = 1280;

    const { width, height } = StudioRenderer.getDimensionsForAspectRatio(
      studioSettings.aspectRatio,
      targetWidth
    );

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;

    const cursorEngine = new SpringCursorEngine(cursorSettings);
    cursorEngine.reset();

    // Setup MediaRecorder capture stream
    const stream = offscreenCanvas.captureStream(fps);
    let mimeType = 'video/webm;codecs=vp9';
    if (exportSettings.format === 'mp4') {
      if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E')) {
        mimeType = 'video/mp4;codecs=avc1.42E01E';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }
    }

    const recordedChunks: Blob[] = [];
    const bitsPerSecond = exportSettings.resolution === '4k' ? 36_000_000 : 18_000_000;

    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
      videoBitsPerSecond: bitsPerSecond,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    const completionPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const outputBlob = new Blob(recordedChunks, { type: recorder.mimeType });
        resolve(outputBlob);
      };
      recorder.onerror = (e) => reject(e);
    });

    recorder.start(100);

    const renderStartTime = performance.now();

    // Iterate through each frame
    for (let frame = 0; frame < totalFrames; frame++) {
      if (abortSignal?.aborted) {
        recorder.stop();
        throw new Error('Export cancelled by user');
      }

      const frameTime = startTime + frame / fps;

      // Seek video to exact frame
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          videoElement.removeEventListener('seeked', onSeeked);
          resolve();
        };
        videoElement.addEventListener('seeked', onSeeked);
        videoElement.currentTime = frameTime;
      });

      // Render composite frame
      StudioRenderer.renderFrame({
        canvas: offscreenCanvas,
        video: videoElement,
        currentTimeSeconds: frameTime,
        studioSettings,
        cursorSettings,
        cursorEngine,
        cursorEvents: session.cursorTelemetry,
        zoomKeyframes: session.zoomKeyframes,
        videoNaturalWidth: session.videoNaturalWidth,
        videoNaturalHeight: session.videoNaturalHeight,
      });

      // Report progress
      if (onProgress) {
        const elapsed = (performance.now() - renderStartTime) / 1000;
        const progress = (frame + 1) / totalFrames;
        const eta = progress > 0 ? (elapsed / progress) * (1 - progress) : 0;

        onProgress({
          currentFrame: frame + 1,
          totalFrames,
          progress,
          elapsedSeconds: Math.round(elapsed),
          etaSeconds: Math.round(eta),
          statusText: `Encoding frame ${frame + 1} of ${totalFrames} (${Math.round(progress * 100)}%)`,
        });
      }

      // Allow event loop breathing room
      if (frame % 5 === 0) {
        await new Promise((r) => setTimeout(r, 2));
      }
    }

    recorder.stop();
    return completionPromise;
  }

  /**
   * Generates a downloadable file from a Blob.
   */
  public static triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
