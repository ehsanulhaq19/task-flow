import api from "@/services/api";

const MIN_DELAY_MS = 60 * 1000;
const MAX_DELAY_MS = 10 * 60 * 1000;

export type CaptureState = {
  active: boolean;
  nextAt: number | null;
};

type Listener = (state: CaptureState) => void;

let stream: MediaStream | null = null;
let video: HTMLVideoElement | null = null;
let timeoutId: number | null = null;
let session = 0;
let captureState: CaptureState = { active: false, nextAt: null };
const listeners = new Set<Listener>();

function publish(next: CaptureState) {
  captureState = next;
  listeners.forEach((listener) => listener(captureState));
}

export function getCaptureState() {
  return captureState;
}

export function subscribeCapture(listener: Listener) {
  listeners.add(listener);
  listener(captureState);
  return () => {
    listeners.delete(listener);
  };
}

export function randomCaptureDelayMs(random: () => number = Math.random) {
  const span = MAX_DELAY_MS - MIN_DELAY_MS;
  return MIN_DELAY_MS + Math.floor(random() * (span + 1));
}

export async function saveScreenshot(blob: Blob, takenAt: string) {
  const body = new FormData();
  body.append("file", blob, "screenshot.jpg");
  body.append("takenAt", takenAt);
  await api.post("/screenshots", body);
}

async function grabFrame(source: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.videoWidth;
  canvas.height = source.videoHeight;
  const context = canvas.getContext("2d");
  if (!context || canvas.width === 0 || canvas.height === 0) {
    throw new Error("Screen capture is not ready");
  }
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.72);
  });
  if (!blob) throw new Error("Could not save the screenshot");
  return blob;
}

function liveTrack() {
  return stream?.getVideoTracks().find((track) => track.readyState === "live") ?? null;
}

function pauseTrack() {
  const track = liveTrack();
  if (track) track.enabled = false;
}

function scheduleNext() {
  if (timeoutId !== null || !liveTrack()) return;
  pauseTrack();
  const delay = randomCaptureDelayMs();
  publish({ active: true, nextAt: Date.now() + delay });
  timeoutId = window.setTimeout(() => {
    timeoutId = null;
    void takeScheduledScreenshot();
  }, delay);
}

function waitForFrame(source: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    if (typeof source.requestVideoFrameCallback === "function") {
      source.requestVideoFrameCallback(() => finish());
      window.setTimeout(finish, 1500);
      return;
    }
    window.setTimeout(finish, 400);
  });
}

async function captureFrame() {
  const track = liveTrack();
  if (!track || !video) throw new Error("Screen capture is not ready");
  track.enabled = true;
  if (video.paused) await video.play();
  await waitForFrame(video);
  try {
    return await grabFrame(video);
  } finally {
    if (track.readyState === "live") track.enabled = false;
  }
}

async function takeScheduledScreenshot() {
  try {
    const blob = await captureFrame();
    await saveScreenshot(blob, new Date().toISOString());
  } catch {
    /* The next interval still runs. A failed frame should not stop the session. */
  }
  if (liveTrack()) scheduleNext();
  else publish({ active: false, nextAt: null });
}

function attachVideo(nextStream: MediaStream) {
  if (!video) {
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("data-screen-capture", "true");
    video.style.position = "fixed";
    video.style.width = "1px";
    video.style.height = "1px";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);
  }
  video.srcObject = nextStream;
  return video.play();
}

export function beginScreenCapture() {
  if (liveTrack()) {
    scheduleNext();
    return Promise.resolve();
  }

  const current = ++session;
  const request = navigator.mediaDevices.getDisplayMedia({
    video: { displaySurface: "monitor", frameRate: 1 } as MediaTrackConstraints,
    audio: false,
  });

  return request.then(async (nextStream) => {
    if (current !== session) {
      nextStream.getTracks().forEach((track) => track.stop());
      return;
    }
    stream = nextStream;
    await attachVideo(nextStream);
    nextStream.getVideoTracks().forEach((track) => {
      track.enabled = false;
      track.addEventListener("ended", () => {
        if (stream === nextStream) stopScreenCapture();
      });
    });
    scheduleNext();
  });
}

export function stopScreenCapture() {
  session += 1;
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
    timeoutId = null;
  }
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (video) video.srcObject = null;
  publish({ active: false, nextAt: null });
}
