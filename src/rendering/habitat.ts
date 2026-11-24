import idleUrl from '../../assets/pets/ember-fox/reference.png';
import workingUrl from '../../assets/pets/ember-fox/artwork/working.png';
import sleepingUrl from '../../assets/pets/ember-fox/artwork/sleeping.png';
import teaUrl from '../../assets/pets/ember-fox/artwork/tea-break.png';
import happyUrl from '../../assets/pets/ember-fox/artwork/happy.png';
import { normalizeFoxPixels } from './palette';
import {
  anchorOffset,
  motionAt,
  spriteBands,
  type MotionFrame,
} from './motion';
import type { Mood } from '../engine/spirit';
import type { CompanionId } from '../engine/companions';
import { companionArt } from './companion-art';
import {
  drawHero,
  HERO_BASELINE,
  HERO_GRID,
  heroPose,
  isHero,
  type HeroAction,
  type HeroPose,
} from '../../website/shared/hero-motion';
import type { Decor, Outfit } from '../engine/progress';
import {
  ABILITY_MS,
  abilityTime,
  abilityPose,
  placeBody,
  type AbilityPose,
} from '../../website/shared/abilities';
import { createHeroRig } from '../../website/shared/hero-rig';
import { drawAbility } from '../../website/shared/ability-effects';
import {
  createPetRenderer,
  PET_RESOLUTION,
} from '../../website/src/lib/pet-renderer';
import { petPose, type PetPose } from '../../website/src/lib/pet-animation';
import { drawParticles } from './particles';
import { lifeAt, type LifeFrame } from './life';
import {
  playPose,
  spriteForPlay,
  loadPlayFrames,
  type PetPlay,
  type PlayAction,
} from './playful';

const heroMoods: Record<Mood, HeroAction> = {
  Idle: 'idle',
  Working: 'working',
  Sleeping: 'rest',
  TeaBreak: 'break',
  Happy: 'greet',
};
const heroRoaming: Record<PlayAction, HeroAction> = {
  rest: 'idle',
  climbUp: 'walk',
  climbDown: 'walk',
  cling: 'crouch',
  walk: 'walk',
  run: 'run',
  pounce: 'greet',
  hide: 'crouch',
  peek: 'idle',
};

type GardenFrame = {
  id: 'moon' | 'moss';
  paint: NonNullable<ReturnType<typeof createPetRenderer>>;
  pose: PetPose;
};
type HeroFrame = { id: CompanionId; image: HTMLImageElement; pose: HeroPose };

/** Crop transparent padding at render time; source artwork stays untouched. */
function opaqueBounds(
  image: HTMLImageElement,
): [number, number, number, number] {
  const source = document.createElement('canvas');
  source.width = image.naturalWidth;
  source.height = image.naturalHeight;
  const context = source.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas is unavailable.');
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, source.width, source.height);
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      if (data[(y * source.width + x) * 4 + 3]! < 128) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left) throw new Error('The fox artwork is empty.');
  return [left, top, right - left + 1, bottom - top + 1];
}

export async function createHabitatRenderer(
  canvas: HTMLCanvasElement,
): Promise<{
  replayAbility: () => void;
  setAttention: (horizontal: number | null) => void;
  draw: (
    mood: Mood,
    elapsedMs?: number,
    reduced?: boolean,
    appearance?: {
      decor: Decor;
      night: boolean;
      outfit?: Outfit;
      companion?: CompanionId;
      play?: PetPlay;
    },
  ) => number[];
}> {
  const output = canvas.getContext('2d');
  if (!output) throw new Error('Canvas is unavailable.');
  const petLayer = document.createElement('canvas');
  petLayer.width = canvas.width;
  petLayer.height = canvas.height;
  const petContext = petLayer.getContext('2d');
  if (!petContext) throw new Error('Canvas is unavailable.');
  petContext.imageSmoothingEnabled = false;
  const petScale = 0.6;
  const baseline = 94;
  const petWidth = Math.round(petLayer.width * petScale);
  const petHeight = Math.round(petLayer.height * petScale);
  const petLeft = Math.round((petLayer.width - petWidth) / 2);
  const petTop = baseline - Math.round(baseline * petScale);
  const sources: Record<Mood, string> = {
    Idle: idleUrl,
    Working: workingUrl,
    Sleeping: sleepingUrl,
    TeaBreak: teaUrl,
    Happy: happyUrl,
  };
  const sprites = new Map<Mood, HTMLCanvasElement>();
  await Promise.all(
    Object.entries(sources).map(async ([mood, url]) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      const bounds = opaqueBounds(image);
      const ratio = 48 / Math.max(bounds[2], bounds[3]);
      const sprite = document.createElement('canvas');
      sprite.width = Math.round(bounds[2] * ratio);
      sprite.height = Math.round(bounds[3] * ratio);
      const pixels = sprite.getContext('2d');
      if (!pixels) throw new Error('Canvas is unavailable.');
      pixels.imageSmoothingEnabled = false;
      pixels.drawImage(image, ...bounds, 0, 0, sprite.width, sprite.height);
      const frame = pixels.getImageData(0, 0, sprite.width, sprite.height);
      normalizeFoxPixels(frame.data);
      pixels.putImageData(frame, 0, 0);
      sprites.set(mood as Mood, sprite);
    }),
  );

  const heroImages = new Map<CompanionId, HTMLImageElement>();
  const heroRigs = new Map<CompanionId, ReturnType<typeof createHeroRig>>();
  const gardenPets = new Map<'moon' | 'moss', GardenFrame['paint']>();
  const gardenSprite = document.createElement('canvas');
  gardenSprite.width = gardenSprite.height = PET_RESOLUTION;
  const gardenPen = gardenSprite.getContext('2d')!;
  const [playFrames] = await Promise.all([
    loadPlayFrames(),
    Promise.all(
      Object.entries(companionArt).map(async ([id, url]) => {
        if (id === 'ember') return;
        const image = new Image();
        image.src = url;
        await image.decode();
        if (id === 'moon' || id === 'moss') {
          const paint = createPetRenderer(image, id, 'idle');
          if (!paint) throw new Error('Canvas is unavailable.');
          gardenPets.set(id, paint);
        } else if (isHero(id)) {
          heroImages.set(id, image);
          heroRigs.set(id, createHeroRig(id, image));
        }
      }),
    ),
  ]);
  const rigs = new Map<string, HTMLCanvasElement>();
  const rigFor = (source: HTMLCanvasElement, mood: Mood, life: LifeFrame) => {
    if (mood === 'Sleeping' || mood === 'TeaBreak') return source;
    const key = `${mood}:${life.blink}:${life.ear}:${life.tail}:${life.look}`;
    const cached = rigs.get(key);
    if (cached) return cached;
    const rig = document.createElement('canvas');
    rig.width = source.width + 4;
    rig.height = source.height;
    const ctx = rig.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const headEnd = Math.floor(source.height * 0.58);
    const earEnd = Math.floor(source.height * 0.2);
    const tailStart = Math.floor(source.height * 0.8);
    // Move connected rows rather than rotating the raster and softening its pixels.
    for (let y = 0; y < source.height; y++) {
      const tailWeight = Math.max(
        0,
        (y - tailStart) / (source.height - tailStart),
      );
      const dx = y < headEnd ? life.look : Math.round(life.tail * tailWeight);
      if (y < earEnd) {
        const split = Math.floor(source.width / 2);
        ctx.drawImage(source, 0, y, split, 1, 2 + dx, y, split, 1);
        ctx.drawImage(
          source,
          split,
          y,
          source.width - split,
          1,
          split + 2 + dx,
          y + life.ear,
          source.width - split,
          1,
        );
      } else {
        ctx.drawImage(
          source,
          0,
          y,
          source.width,
          1,
          2 + dx,
          y,
          source.width,
          1,
        );
      }
    }
    if (mood === 'Idle') {
      const eyeY = Math.round(source.height * 0.35);
      for (const fraction of [0.28, 0.65]) {
        const eyeX = 2 + Math.round(source.width * fraction) + life.look;
        // The reference has sleepy lids. Open, highlighted eyes make idle attentive.
        ctx.fillStyle = '#d77641';
        ctx.fillRect(eyeX - 1, eyeY, 5, 3);
        ctx.fillStyle = '#372018';
        ctx.fillRect(eyeX, eyeY + (life.blink ? 1 : 0), 3, life.blink ? 1 : 3);
        if (!life.blink) {
          ctx.fillStyle = '#ffe4be';
          ctx.fillRect(eyeX, eyeY, 1, 1);
        }
      }
    } else if (life.blink && mood === 'Working') {
      // A slight contented squint while concentrating, without changing the pose.
      const eyeY = Math.round(source.height * 0.35);
      ctx.fillStyle = '#d77641';
      for (const fraction of [0.28, 0.65])
        ctx.fillRect(2 + Math.round(source.width * fraction), eyeY, 3, 1);
    }
    if (rigs.size >= 120) rigs.delete(rigs.keys().next().value!);
    rigs.set(key, rig);
    return rig;
  };

  const runners = new Map<string, HTMLCanvasElement>();
  const frames = new Map<
    string,
    { canvas: HTMLCanvasElement; mask: number[]; signature: number }
  >();
  let lastCanvas: HTMLCanvasElement | undefined;
  let lastHadParticles = false;
  let lastNight = false;
  let replayAt = -Infinity;
  let attention: number | null = null;
  let gaze = 0;
  let lastElapsed = 0;
  const frameFor = (
    mood: Mood,
    motion: MotionFrame,
    decor: Decor,
    outfit: Outfit,
    life: LifeFrame,
    play: ReturnType<typeof playPose>,
    hero?: HeroFrame,
    garden?: GardenFrame,
    acting?: AbilityPose,
    cell?: number,
  ) => {
    const { pose, x: sway, lift, breath } = motion;
    const baseKey = hero
      ? `${hero.id}:${mood}:${decor}:${outfit}:${JSON.stringify(hero.pose)}:${play.facing}:${play.free}`
      : garden
        ? `${garden.id}:${mood}:${JSON.stringify(garden.pose)}:${decor}:${outfit}:${play.facing}:${play.free}`
        : `${mood}:${pose}:${sway}:${lift}:${breath}:${decor}:${outfit}:${life.blink}:${life.ear}:${life.tail}:${life.look}:${play.sheet}:${play.frame}:${play.facing}:${play.free}`;
    const gaitKey = play.free
      ? ':' +
        play.wall +
        ':' +
        play.grip +
        ':' +
        play.stride +
        ':' +
        play.sheet +
        ':' +
        play.frame
      : '';
    const key =
      baseKey + gaitKey + (cell !== undefined ? ':ability:' + cell : '');
    const cached = frames.get(key);
    if (cached) return cached;
    const frame = document.createElement('canvas');
    frame.width = canvas.width;
    frame.height = canvas.height;
    const context = frame.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable.');
    context.imageSmoothingEnabled = false;
    const shadowWidth = hero ? 15 : 19;
    const shadow = Math.max(
      4,
      Math.round(
        shadowWidth - Math.min(acting?.lift ?? hero?.pose.lift ?? 0, 10) * 0.6,
      ),
    );
    context.fillStyle = hero ? '#42313b' : '#4d3025';
    if (play.grip < 0.5)
      context.fillRect(
        Math.round((canvas.width - shadow) / 2),
        baseline - 1,
        shadow,
        1,
      );
    context.save();
    if (play.wall && !acting) {
      const pivotY = baseline - 14;
      context.translate(canvas.width / 2, pivotY);
      const angle = hero
        ? 12 + play.stride
        : play.wall === -1
          ? -37 + play.stride
          : -58 + play.stride;
      context.rotate((angle * play.grip * play.facing * Math.PI) / 180);
      context.translate(-canvas.width / 2, -pivotY);
    }
    if (acting)
      placeBody(context, acting, canvas.width / 2, baseline, 1, play.facing);
    if (hero) {
      const left = Math.floor((canvas.width - HERO_GRID) / 2);
      const top = baseline - HERO_BASELINE;
      const rig = heroRigs.get(hero.id);
      if (rig && cell !== undefined)
        rig(context, cell / 40, left, top, HERO_GRID, play.facing);
      else if (
        rig &&
        play.free &&
        (play.wall || (play.frame >= 0 && play.sheet !== 'play'))
      ) {
        rig(context, 0, left, top, HERO_GRID, play.facing, {
          stride: play.stride,
          wall: play.grip,
          running: play.sheet === 'run',
        });
      } else
        drawHero(
          context,
          hero.image,
          hero.pose,
          left,
          top,
          HERO_GRID,
          play.facing,
        );
      const offset = hero.pose.headX * play.facing;
      const head = top + hero.pose.headY - hero.pose.lift;
      const center = left + HERO_GRID / 2;
      if (mood !== 'Sleeping' && outfit === 'beanie') {
        context.fillStyle = '#708b9a';
        context.fillRect(center - 8 + offset, head + 3, 16, 3);
        context.fillRect(center - 6 + offset, head + 1, 12, 2);
      } else if (mood !== 'Sleeping' && outfit === 'scarf') {
        context.fillStyle = '#c67557';
        context.fillRect(center - 6, top + 20 - hero.pose.lift, 12, 2);
      }
      if (mood === 'Working' && !acting) {
        const deskY = top + 24 - hero.pose.lift;
        context.fillStyle = '#594435';
        context.fillRect(center - 5, deskY, 10, 4);
        context.fillStyle = '#e8d1b2';
        context.fillRect(center - 4, deskY, 8, 2);
        context.fillStyle = '#aa866b';
        context.fillRect(center, deskY, 1, 2);
      }
    } else if (garden) {
      garden.paint(gardenPen, garden.pose);
      context.translate(canvas.width / 2, baseline);
      context.scale(play.facing, 1);
      const feet = garden.id === 'moon' ? 34 : 35;
      context.drawImage(gardenSprite, -18, -feet, 36, 36);
      const dy = (-garden.pose.lift * 36) / PET_RESOLUTION;
      if (mood !== 'Sleeping' && outfit === 'beanie') {
        const hat = (garden.id === 'moon' ? -29 : -25) + dy;
        context.fillStyle = '#708b9a';
        context.fillRect(-7, hat, 13, 3);
        context.fillRect(-5, hat - 2, 9, 2);
      } else if (mood !== 'Sleeping' && outfit === 'scarf') {
        context.fillStyle = '#c67557';
        context.fillRect(-6, -12 + dy, 12, 2);
        context.fillRect(-4, -11 + dy, 3, 4);
      }
    } else {
      const original = sprites.get(mood)!;
      let sprite = rigFor(original, mood, life);
      if (play.frame >= 0) {
        const key = `${play.sheet}:${play.frame}:${outfit}`;
        let runner = runners.get(key);
        if (!runner) {
          runner = spriteForPlay(play.frame, play.sheet, outfit, playFrames);
          runners.set(key, runner);
        }
        sprite = runner;
      }
      const x = Math.floor((110 - sprite.width) / 2);
      const y = baseline - sprite.height;
      // The shadow stays grounded while the character and wardrobe travel together.
      petContext.clearRect(0, 0, petLayer.width, petLayer.height);
      petContext.save();
      petContext.translate(sway, -lift);
      if (play.facing === -1) {
        petContext.translate(110, 0);
        petContext.scale(-1, 1);
      }
      for (const band of spriteBands(sprite.height, pose, breath)) {
        petContext.drawImage(
          sprite,
          0,
          band.sourceY,
          sprite.width,
          band.sourceHeight,
          x,
          y + band.destinationY,
          sprite.width,
          band.destinationHeight,
        );
      }
      const head = anchorOffset(sprite.height, 0, pose, breath);
      const collar = anchorOffset(
        sprite.height,
        Math.min(sprite.height - 1, 76 - y),
        pose,
        breath,
      );
      petContext.translate(life.look, 0);
      if (play.frame < 0 && mood !== 'Sleeping' && outfit === 'beanie') {
        petContext.fillStyle = '#6c8390';
        petContext.fillRect(38, 49 + head, 31, 5);
        petContext.fillRect(42, 46 + head, 23, 4);
        petContext.fillRect(51, 43 + head, 5, 3);
        petContext.fillStyle = '#b9c6cb';
        petContext.fillRect(38, 53 + head, 31, 2);
      } else if (play.frame < 0 && mood !== 'Sleeping' && outfit === 'scarf') {
        petContext.fillStyle = '#b65e50';
        petContext.fillRect(42, 76 + collar, 23, 3);
        petContext.fillRect(43, 79 + collar, 5, 9);
      }
      petContext.restore();
      // Resize the assembled pose once to keep the wardrobe and animation bands aligned.
      context.drawImage(petLayer, petLeft, petTop, petWidth, petHeight);
    }
    context.restore();
    if (!play.free && decor === 'plant') {
      context.fillStyle = '#77513c';
      context.fillRect(23, 86, 12, 8);
      context.fillStyle = '#b98963';
      context.fillRect(24, 87, 10, 2);
      context.fillStyle = '#638260';
      context.fillRect(28, 77, 2, 10);
      context.fillRect(23, 79, 6, 3);
      context.fillRect(30, 76, 5, 3);
    } else if (!play.free && decor === 'lantern') {
      context.fillStyle = '#77513c';
      context.fillRect(24, 80, 11, 14);
      context.fillRect(27, 77, 5, 3);
      context.fillStyle = '#edc574';
      context.fillRect(26, 82, 7, 9);
    }
    // Read pixels only when a cached pose is created, never on every RAF frame.
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let signature = 2166136261;
    let mask: number[] = Array.from(
      { length: canvas.width * canvas.height },
      (_, pixel) => {
        if (!data[pixel * 4 + 3]) return 0;
        signature = Math.imul(signature ^ pixel, 16777619);
        return 1;
      },
    );
    // Share identical silhouettes, so color-only pose changes need no native IPC.
    for (const cached of frames.values()) {
      if (
        signature === cached.signature &&
        mask.every((value, index) => value === cached.mask[index])
      ) {
        mask = cached.mask;
        break;
      }
    }
    const result = { canvas: frame, mask, signature };
    if (frames.size >= 240) frames.delete(frames.keys().next().value!);
    frames.set(key, result);
    return result;
  };

  return {
    replayAbility() {
      replayAt = performance.now();
    },
    setAttention(horizontal) {
      attention =
        horizontal === null || !Number.isFinite(horizontal)
          ? null
          : Math.max(-1, Math.min(1, horizontal));
    },
    draw(
      mood,
      elapsedMs = 0,
      reduced = false,
      appearance = { decor: 'none', night: false },
    ) {
      const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
      const play = playPose(appearance.play, reduced);
      const displayMood: Mood = play.free ? 'Idle' : mood;
      const motion =
        play.frame >= 0
          ? { pose: 'rest' as const, x: 0, lift: play.lift, breath: 0 }
          : motionAt(displayMood, elapsed, reduced);
      const life =
        play.frame >= 0
          ? { blink: false, ear: 0, tail: 0, look: 0 }
          : { ...lifeAt(displayMood, elapsed, reduced) };
      const delta = Math.max(0, Math.min(100, elapsed - lastElapsed));
      lastElapsed = elapsed;
      gaze += ((attention ?? 0) - gaze) * (1 - Math.exp(-delta / 150));
      if (
        !reduced &&
        displayMood === 'Idle' &&
        play.frame < 0 &&
        (attention !== null || Math.abs(gaze) > 0.1)
      )
        life.look = Math.round(gaze);
      const id = appearance.companion ?? 'ember';
      const image = id && heroImages.get(id);
      const excursion = play.free ? appearance.play : undefined;
      const manualAge = performance.now() - replayAt;
      const reactionAge =
        manualAge < ABILITY_MS
          ? manualAge
          : displayMood === 'Happy'
            ? elapsed
            : excursion?.action === 'pounce'
              ? excursion.elapsedMs
              : manualAge;
      const t = abilityTime(
        elapsed,
        reactionAge,
        !play.free && displayMood === 'Idle',
        reduced,
      );
      // Cache silhouettes at animation-cell cadence. The light and particle passes still run at display cadence.
      const cell = t === null ? undefined : Math.floor(t * 40);
      const acting =
        cell === undefined ? undefined : abilityPose(id, cell / 40);
      const gardenPaint =
        id === 'moon' || id === 'moss' ? gardenPets.get(id) : undefined;
      let garden: GardenFrame | undefined;
      if (gardenPaint && (id === 'moon' || id === 'moss')) {
        const petMood =
          displayMood === 'Sleeping'
            ? 'sleeping'
            : displayMood === 'Working'
              ? 'working'
              : displayMood === 'TeaBreak'
                ? 'break'
                : 'idle';
        const pose = petPose({
          kind: id,
          mood: petMood,
          elapsed,
          curious: attention !== null,
          look: gaze,
          reduced,
        });
        // The face renderer uses five discrete eyelid heights.
        pose.eyes = Math.round(pose.eyes * 5) / 5;
        if (excursion?.action === 'walk' || excursion?.action === 'run') {
          const running = excursion.action === 'run';
          if (id === 'moss') {
            // A rabbit gathers its hind legs, springs, then settles onto both feet.
            pose.lift = Math.max(0, play.stride) * (running ? 3 : 2);
            pose.inhale = Math.min(0, play.stride);
          } else {
            pose.lift = Math.abs(play.stride) * (running ? 1 : 0.5);
            pose.inhale = Math.round(play.stride / 3);
          }
          pose.lean = Math.round(play.stride / 2);
        } else if (play.wall) {
          pose.lift = Math.abs(play.stride);
          pose.lean = play.stride;
          pose.inhale = Math.round(play.stride / 2);
        } else if (excursion?.action === 'hide') pose.inhale = -4;
        garden = { id, paint: gardenPaint, pose };
      }
      const hero =
        isHero(id) && image
          ? {
              id,
              image,
              pose: heroPose(
                id,
                acting
                  ? 'idle'
                  : excursion
                    ? heroRoaming[excursion.action]
                    : heroMoods[displayMood],
                excursion &&
                  (excursion.action === 'walk' ||
                    excursion.action === 'run' ||
                    play.wall)
                  ? (excursion.gaitMs ?? excursion.elapsedMs)
                  : (excursion?.elapsedMs ?? elapsed),
                reduced,
                gaze,
              ),
            }
          : undefined;
      const frame = frameFor(
        displayMood,
        motion,
        appearance.decor,
        appearance.outfit ?? 'none',
        life,
        play,
        hero,
        garden,
        acting,
        cell,
      );
      const particles =
        !reduced && (displayMood === 'TeaBreak' || displayMood === 'Sleeping');
      if (
        lastCanvas !== frame.canvas ||
        particles ||
        acting ||
        lastHadParticles ||
        lastNight !== appearance.night
      ) {
        output.clearRect(0, 0, canvas.width, canvas.height);
        output.imageSmoothingEnabled = false;
        if (acting && t !== null)
          drawAbility(
            output,
            id,
            t,
            acting,
            canvas.width / 2,
            baseline,
            1,
            play.facing,
            false,
            cell! / 40,
          );
        output.drawImage(frame.canvas, 0, 0);
        if (acting && t !== null)
          drawAbility(
            output,
            id,
            t,
            acting,
            canvas.width / 2,
            baseline,
            1,
            play.facing,
            true,
            cell! / 40,
          );
        if (particles) drawParticles(output, displayMood, elapsed);
        if (appearance.night) {
          output.save();
          output.globalCompositeOperation = 'source-atop';
          output.fillStyle = 'rgba(224, 158, 77, 0.12)';
          output.fillRect(0, 0, canvas.width, canvas.height);
          output.restore();
        }
      }
      lastCanvas = frame.canvas;
      lastHadParticles = particles || !!acting;
      lastNight = appearance.night;
      // Particles remain decorative and click-through, even where visibly painted.
      return frame.mask;
    },
  };
}
