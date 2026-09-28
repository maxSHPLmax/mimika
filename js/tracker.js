// Камера + MediaPipe Face Landmarker. Всё считается на телефоне, кадры никуда не отправляются.
import { FaceLandmarker, FilesetResolver } from '../vendor/mediapipe/vision_bundle.mjs';

const WASM_BASE = new URL('../vendor/mediapipe/wasm', import.meta.url).href;
const LOCAL_MODEL = new URL('../models/face_landmarker.task', import.meta.url).href;
const REMOTE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarker = null;
let fileset = null;
let modelBytes = null;

async function fetchModel() {
  for (const url of [LOCAL_MODEL, REMOTE_MODEL]) {
    try {
      const r = await fetch(url);
      if (r.ok) return new Uint8Array(await r.arrayBuffer());
    } catch { /* пробуем следующий источник */ }
  }
  throw new Error('model');
}

async function create(delegate) {
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetBuffer: modelBytes, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  });
}

export async function loadLandmarker() {
  if (landmarker) return landmarker;
  fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  modelBytes = await fetchModel();
  try {
    landmarker = await create('GPU');
  } catch {
    landmarker = await create('CPU');
  }
  return landmarker;
}

async function fallbackToCPU() {
  try { landmarker.close(); } catch { /* ignore */ }
  landmarker = await create('CPU');
}

export class Tracker {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.running = false;
    this.lastTs = 0;
    this.onFrame = null;
    this.frameCount = 0;
    this.brightness = 128;
    this._probe = document.createElement('canvas');
    this._probe.width = 32; this._probe.height = 24;
    this._pctx = this._probe.getContext('2d', { willReadFrequently: true });
    this._busy = false;
  }

  async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
    });
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();
    await new Promise((res) => (this.video.readyState >= 2 ? res() : this.video.addEventListener('loadeddata', res, { once: true })));
  }

  start(onFrame) {
    this.onFrame = onFrame;
    if (this.running) return;
    this.running = true;
    this._schedule();
  }

  _schedule() {
    if (!this.running) return;
    if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
      this.video.requestVideoFrameCallback(() => this._tick());
    } else {
      requestAnimationFrame(() => this._tick());
    }
  }

  async _tick() {
    if (!this.running) return;
    if (this._busy) { this._schedule(); return; }
    const v = this.video;
    let now = performance.now();
    if (now <= this.lastTs) now = this.lastTs + 1;
    if (v.readyState >= 2 && v.videoWidth) {
      let result = null;
      try {
        result = landmarker.detectForVideo(v, now);
      } catch (e) {
        this._busy = true;
        try { await fallbackToCPU(); } finally { this._busy = false; }
      }
      this.lastTs = now;
      this.frameCount++;
      if (this.frameCount % 20 === 0) this._measureLight();
      const lms = result?.faceLandmarks?.[0] || null;
      if (this.onFrame) this.onFrame({ t: now, landmarks: lms, w: v.videoWidth, h: v.videoHeight, brightness: this.brightness });
    }
    this._schedule();
  }

  _measureLight() {
    try {
      this._pctx.drawImage(this.video, 0, 0, 32, 24);
      const d = this._pctx.getImageData(0, 0, 32, 24).data;
      let s = 0;
      for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      this.brightness = s / (d.length / 4);
    } catch { /* ignore */ }
  }

  stop() {
    this.running = false;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
