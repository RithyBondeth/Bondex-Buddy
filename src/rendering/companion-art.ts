import ember from '../../assets/pets/ember-fox/portrait.png';
import moon from '../../website/public/pets/moon-cat.png';
import moss from '../../website/public/pets/moss-bunny.png';
import blueJelly from '../../website/public/pets/blue-jelly.png';
import spiderMan from '../../website/public/pets/avengers/spider-man.png';
import ironMan from '../../website/public/pets/avengers/iron-man.png';
import thor from '../../website/public/pets/avengers/thor.png';
import hulk from '../../website/public/pets/avengers/hulk.png';
import captainAmerica from '../../website/public/pets/avengers/captain-america.png';
import blackWidow from '../../website/public/pets/avengers/black-widow.png';
import hawkeye from '../../website/public/pets/avengers/hawkeye.png';
import type { CompanionId } from '../engine/companions';

export const companionArt: Record<CompanionId, string> = {
  ember,
  moon,
  moss,
  'blue-jelly': blueJelly,
  'spider-man': spiderMan,
  'iron-man': ironMan,
  thor,
  hulk,
  'captain-america': captainAmerica,
  'black-widow': blackWidow,
  hawkeye,
};
