import type { PetKind, PetMood, PetPose } from './pet-animation';
import { drawHero, type HeroPose } from '../../shared/hero-motion';

export const PET_RESOLUTION = 128;

type Eye = {
  x: number;
  y: number;
  width: number;
  height: number;
  center: number;
};
// Coordinates are on the 128 × 128 preview grid, not the source image resolution.
const faces: Partial<Record<PetKind, { eyes: Eye[]; ink: string }>> = {
  ember: {
    ink: '#4e2f24',
    eyes: [
      { x: 45, y: 51, width: 11, height: 6, center: 50 },
      { x: 71, y: 51, width: 12, height: 6, center: 77 },
    ],
  },
  moon: {
    ink: '#55382a',
    eyes: [
      { x: 34, y: 51, width: 14, height: 7, center: 41 },
      { x: 63, y: 51, width: 15, height: 7, center: 70 },
    ],
  },
  moss: {
    ink: '#615034',
    eyes: [
      { x: 46, y: 65, width: 7, height: 7, center: 50 },
      { x: 73, y: 65, width: 7, height: 7, center: 76 },
    ],
  },
  'blue-jelly': {
    ink: '#153e68',
    eyes: [
      { x: 40, y: 56, width: 8, height: 8, center: 44 },
      { x: 80, y: 56, width: 8, height: 8, center: 84 },
    ],
  },
};

/** Render-time eye layers leave the preserved PNG artwork untouched. */
export function createPetRenderer(
  image: HTMLImageElement,
  kind: PetKind,
  mood: PetMood,
) {
  const base = document.createElement('canvas');
  base.width = base.height = PET_RESOLUTION;
  const context = base.getContext('2d');
  if (!context) return null;
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, PET_RESOLUTION, PET_RESOLUTION);
  const face = faces[kind];
  if (mood === 'idle' && face) {
    const frame = context.getImageData(0, 0, PET_RESOLUTION, PET_RESOLUTION);
    for (const eye of face.eyes) {
      for (let y = eye.y; y < eye.y + eye.height; y++) {
        for (let x = eye.x; x < eye.x + eye.width; x++) {
          const offset = (y * PET_RESOLUTION + x) * 4;
          // Only replace the dark eye pixels, sampling the fur directly above.
          if (
            frame.data[offset + 3] < 128 ||
            frame.data[offset] +
              frame.data[offset + 1] +
              frame.data[offset + 2] >=
              300
          )
            continue;
          const fur = ((eye.y - 2) * PET_RESOLUTION + x) * 4;
          frame.data.set(frame.data.slice(fur, fur + 4), offset);
        }
      }
    }
    context.putImageData(frame, 0, 0);
  }
  const layer = document.createElement('canvas');
  layer.width = layer.height = PET_RESOLUTION;
  const pen = layer.getContext('2d');
  if (!pen) return null;
  pen.imageSmoothingEnabled = false;

  const pixels = context.getImageData(
    0,
    0,
    PET_RESOLUTION,
    PET_RESOLUTION,
  ).data;
  const draw = (
    output: CanvasRenderingContext2D,
    pose: PetPose,
    hero?: HeroPose,
  ) => {
    output.clearRect(0, 0, PET_RESOLUTION, PET_RESOLUTION);
    if (hero) {
      drawHero(output, image, hero, 0, 0, PET_RESOLUTION);
      return;
    }
    pen.clearRect(0, 0, PET_RESOLUTION, PET_RESOLUTION);
    pen.drawImage(base, 0, 0);
    if (mood === 'idle' && face) {
      for (const eye of face.eyes) {
        const x = eye.center + pose.look;
        const y = eye.y + 1;
        pen.fillStyle = face.ink;
        if (kind === 'blue-jelly') {
          const height = pose.happy
            ? 3
            : Math.max(2, Math.round(eye.height * pose.eyes));
          pen.fillRect(
            x - eye.width / 2,
            eye.y + eye.height - height,
            eye.width,
            height,
          );
        } else if (pose.happy) {
          pen.fillRect(x - 2, y + 2, 1, 2);
          pen.fillRect(x - 1, y + 1, 3, 1);
          pen.fillRect(x + 2, y + 2, 1, 2);
        } else if (pose.eyes < 0.25) {
          pen.fillRect(x - 3, y + 3, 6, 1);
          pen.fillRect(x - 2, y + 4, 4, 1);
        } else {
          const height = Math.max(2, Math.round(5 * pose.eyes));
          pen.fillRect(x - 2, y + 5 - height, 4, height);
          if (height >= 4) {
            pen.fillStyle = '#fff2d8';
            pen.fillRect(x - 1, y + 6 - height, 1, 1);
          }
        }
      }
    }
    output.imageSmoothingEnabled = false;
    const split = kind === 'moss' ? 85 : 72;
    // Move the head/shoulders up a pixel; stretch the chest back to the feet.
    output.drawImage(
      layer,
      0,
      0,
      PET_RESOLUTION,
      split,
      pose.lean,
      -pose.lift - pose.inhale,
      PET_RESOLUTION,
      split,
    );
    output.drawImage(
      layer,
      0,
      split,
      PET_RESOLUTION,
      PET_RESOLUTION - split,
      pose.lean,
      split - pose.lift - pose.inhale,
      PET_RESOLUTION,
      PET_RESOLUTION - split + pose.inhale,
    );
  };
  return Object.assign(draw, {
    contains: (x: number, y: number) =>
      x >= 0 &&
      y >= 0 &&
      x < 1 &&
      y < 1 &&
      pixels[
        (Math.floor(y * PET_RESOLUTION) * PET_RESOLUTION +
          Math.floor(x * PET_RESOLUTION)) *
          4 +
          3
      ] >= 128,
  });
}
