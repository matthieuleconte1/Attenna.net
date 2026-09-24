import type { ScrollMotion } from "./scroll-motion";
import { OCEAN_TUNING } from "./tuning";

const AT_REST: ScrollMotion = { progress: 0, velocity: 0 };
/** Proportions minimales du champ de vision, celles d'un écran paysage. */
const MIN_VIEW_ASPECT = 1.5;

/**
 * Cinematic camera from the original ocean. The scroll moves it along a path:
 * forward over the swell, sideways and closer to the water as the page goes
 * down, and it dips briefly when the user scrolls fast.
 */
export function oceanCamera(
  size: readonly [number, number],
  motion: ScrollMotion = AT_REST
) {
  const { fovDegrees, near, far } = OCEAN_TUNING.camera;
  const { travel, drift, lift, tilt } = OCEAN_TUNING.scroll;
  const base = OCEAN_TUNING.camera;
  const { progress, velocity } = motion;
  const eye = [
    base.eye[0] + drift * progress,
    base.eye[1] - lift * progress,
    base.eye[2] - travel * progress,
  ] as const;
  const target = [
    base.target[0] + drift * progress,
    base.target[1] - lift * progress,
    base.target[2] - travel * progress,
  ] as const;
  const pitchDegrees = base.pitchDegrees - tilt * velocity;
  const angle =
    Math.atan2(eye[1] - target[1], eye[2] - target[2]) -
    (pitchDegrees * Math.PI) / 180;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // En portrait, un champ vertical fixe rétrécirait le champ horizontal et
  // grossirait la houle : on élargit alors l'angle pour garder la largeur de
  // vue d'un écran paysage, comme le repli Canvas 2D.
  const aspect = size[0] / Math.max(1, size[1]);
  const f =
    (1 / Math.tan((fovDegrees * Math.PI) / 360)) *
    Math.min(1, aspect / MIN_VIEW_ASPECT);

  const view = new Float32Array(16);
  view[0] = view[15] = 1;
  view[5] = view[10] = c;
  view[6] = s;
  view[9] = -s;
  view[12] = -eye[0];
  view[13] = -(c * eye[1] - s * eye[2]);
  view[14] = -(s * eye[1] + c * eye[2]);

  const projection = new Float32Array(16);
  projection[0] = f / aspect;
  projection[5] = f;
  projection[10] = far / (near - far);
  projection[11] = -1;
  projection[14] = (far * near) / (near - far);
  return { view, projection };
}
