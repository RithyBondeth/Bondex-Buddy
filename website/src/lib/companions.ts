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
    background: '#362c37',
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
    background: '#293246',
    word: 'A little wonder.',
    trait: 'Dreamy · A natural night owl',
    status: 'In development',
    description:
      'For late-night ideas and slow mornings. Meet our moon cat concept, a sleepy little soul with a crescent of sunshine.',
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
    background: '#2d2935',
    word: 'A little grounding.',
    trait: 'Gentle · Happiest taking it slow',
    status: 'In development',
    description:
      'A little patch of green for your digital world. Our moss bunny concept brings leaf-shaped ears and a very unhurried outlook.',
  },
] as const;
export const repository = 'https://github.com/RithyBondeth/Bondex-Buddy';
