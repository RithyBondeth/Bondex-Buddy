import { heroNames } from '../../shared/hero-motion';

export const companions = [
  {
    id: 'ember',
    name: 'Ember',
    species: 'The ember fox',
    image: '/pets/idle.png',
    habitat: {
      id: 'garden',
      label: 'Ember’s cozy garden',
      light: 'Warm daylight',
      image: '/habitat/pixel-garden.png',
    },
    color: '#e9b885',
    background: '#463221',
    word: 'A little warmth.',
    trait: 'Warm-hearted · Quietly curious',
    status: 'First companion',
    description:
      'A warm presence for deep work and well-earned breaks. Ember is the first spirit taking shape in the desktop app.',
  },
  {
    id: 'moon',
    name: 'Moon',
    species: 'The moon cat',
    image: '/pets/moon-cat.png',
    habitat: {
      id: 'moonlight',
      label: 'Moon’s moonlit retreat',
      light: 'Soft moonlight',
      image: '/habitat/pixel-moonlight.png',
    },
    color: '#cbc6e3',
    background: '#262e45',
    word: 'A little wonder.',
    trait: 'Dreamy · A natural night owl',
    status: 'Desktop companion',
    description:
      'For late-night ideas and slow mornings. Meet our moon cat, a sleepy little soul with a crescent of sunshine.',
  },
  {
    id: 'moss',
    name: 'Moss',
    species: 'The moss bunny',
    image: '/pets/moss-bunny.png',
    habitat: {
      id: 'forest',
      label: 'Moss’s forest hideaway',
      light: 'Woodland daylight',
      image: '/habitat/pixel-forest.png',
    },
    color: '#b5cca2',
    background: '#253528',
    word: 'A little grounding.',
    trait: 'Gentle · Happiest taking it slow',
    status: 'Desktop companion',
    description:
      'A little patch of green for your digital world. Our moss bunny brings leaf-shaped ears and a very unhurried outlook.',
  },
] as const;

export const avengers = (
  [
    {
      id: 'spider-man',
      trait: 'Your friendly neighborhood companion',
      background: '#4b2b3d',
      platform: {
        id: 'neighborhood-roof',
        label: 'Neighborhood rooftop',
        light: 'City at dusk',
        ground: 35.7,
      },
    },
    {
      id: 'iron-man',
      trait: 'A tiny suit with a lot of heart',
      background: '#284c63',
      platform: {
        id: 'armor-workshop',
        label: 'Armor workshop',
        light: 'Arc glow',
        ground: 27.1,
      },
    },
    {
      id: 'thor',
      trait: 'Brings a little thunder',
      background: '#534265',
      platform: {
        id: 'skybridge',
        label: 'Skybridge',
        light: 'Above the clouds',
        ground: 37.8,
      },
    },
    {
      id: 'hulk',
      trait: 'Big strength, small sprite',
      background: '#354b37',
      platform: {
        id: 'gamma-yard',
        label: 'Gamma test yard',
        light: 'Gamma glow',
        ground: 33.3,
      },
    },
    {
      id: 'captain-america',
      trait: 'Always has your back',
      background: '#34475a',
      platform: {
        id: 'flight-deck',
        label: 'Hangar flight deck',
        light: 'Runway lights',
        ground: 29.4,
      },
    },
    {
      id: 'black-widow',
      trait: 'Cool under pressure',
      background: '#492a3c',
      platform: {
        id: 'ops-balcony',
        label: 'Stealth ops balcony',
        light: 'Night watch',
        ground: 39.1,
      },
    },
    {
      id: 'hawkeye',
      trait: 'Keeps an eye on the range',
      background: '#3a4350',
      platform: {
        id: 'archery-deck',
        label: 'Woodland archery deck',
        light: 'Evening practice',
        ground: 36.7,
      },
    },
  ] as const
).map(({ platform, ...hero }) => ({
  ...hero,
  name: heroNames[hero.id],
  kind: 'hero' as const,
  image: `/pets/avengers/${hero.id}.png`,
  habitat: {
    ...platform,
    image: `/habitat/avengers/${platform.id}.webp`,
    width: 768,
    height: 512,
  },
  status: 'Desktop companion',
}));

export type Companion = (typeof companions)[number] | (typeof avengers)[number];

export const repository = 'https://github.com/RithyBondeth/Bondex-Buddy';
