import { phase, type AbilityPose, type CompanionId } from './abilities';
import { handPosition } from './hero-rig';

type Pen = CanvasRenderingContext2D;
type Point = readonly [number, number];
type Effects = (
  c: Pen,
  t: number,
  body: AbilityPose,
  front: boolean,
  bodyTime: number,
) => void;
const tau = Math.PI * 2;
const wave = (t: number) => Math.sin(t * Math.PI);
const fade = (t: number) => Math.min(1, t * 7, (1 - t) * 5);

function stroke(c: Pen, points: Point[], color: string, width = 1) {
  c.beginPath();
  c.moveTo(...points[0]);
  for (const point of points.slice(1)) c.lineTo(...point);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function ring(
  c: Pen,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  width = 1,
  from = 0,
  to = tau,
) {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, from, to);
  c.strokeStyle = color;
  c.lineWidth = width;
  c.stroke();
}
function dot(c: Pen, x: number, y: number, color: string, size = 1) {
  c.fillStyle = color;
  c.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}
function glint(c: Pen, x: number, y: number, size: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      r = i % 2 ? size * 0.26 : size;
    const xx = x + Math.cos(a) * r,
      yy = y + Math.sin(a) * r;
    if (i === 0) c.moveTo(xx, yy);
    else c.lineTo(xx, yy);
  }
  c.closePath();
  c.fill();
}
function motes(
  c: Pen,
  x: number,
  y: number,
  t: number,
  radius: number,
  color: string,
  count = 9,
) {
  for (let i = 0; i < count; i++) {
    const a = i * 2.4;
    const spread = radius * (0.6 + (i % 4) * 0.13) * t;
    dot(
      c,
      x + Math.cos(a) * spread,
      y + Math.sin(a) * spread + 5 * t * t,
      color,
      i % 3 === 0 ? 2 : 1,
    );
  }
}

const foxfire: Effects = (c, t, _, front) => {
  for (let i = 0; i < 3; i++) {
    const a = t * tau * 1.35 + (i * tau) / 3;
    if (Math.sin(a) > 0 !== front) continue;
    const point = (d: number): Point => [
      Math.cos(a - d) * (13 + 10 * wave(t)),
      -5 - 22 * t + Math.sin(a - d) * 5 + d * 2,
    ];
    const trail = Array.from({ length: 12 }, (_, j) => point((11 - j) * 0.085));
    stroke(c, trail, '#e56a3c', 2.6);
    stroke(c, trail.slice(5), '#ffbc58', 1.6);
    const [x, y] = point(0);
    glint(c, x, y, 3.3, '#fff1a4');
    dot(c, x - 1, y - 4, '#ffad53');
  }
};
const constellation: Effects = (c, t, _, front) => {
  const stars: Point[] = [
    [-24, -20],
    [-18, -37],
    [-5, -40],
    [9, -45],
    [21, -32],
    [26, -17],
  ];
  if (!front) {
    const draw = phase(t, 0, 0.57) * (stars.length - 1);
    for (let i = 0; i < stars.length - 1 && i < draw; i++) {
      const [x, y] = stars[i],
        [xx, yy] = stars[i + 1],
        u = Math.min(1, draw - i);
      stroke(
        c,
        [
          [x, y],
          [x + (xx - x) * u, y + (yy - y) * u],
        ],
        '#aeabe6',
        0.65,
      );
    }
    stars.forEach(([x, y], i) => {
      if (i <= draw + 0.1) glint(c, x, y, 1.5 + wave(t) * 0.9, '#fff1cb');
    });
  } else {
    const angle = t * tau * 0.85;
    const x = Math.cos(angle) * 21,
      y = -21 - Math.sin(angle) * 9;
    // Two offset arcs outline the crescent without punching through the scene.
    c.beginPath();
    c.moveTo(x + 2, y - 4);
    c.bezierCurveTo(x - 6, y - 2, x - 5, y + 6, x + 3, y + 4);
    c.bezierCurveTo(x - 1, y + 3, x - 1, y - 1, x + 2, y - 4);
    c.fillStyle = '#ffe5a2';
    c.fill();
    for (let j = 1; j <= 5; j++)
      dot(
        c,
        Math.cos(angle - j * 0.09) * 21,
        -21 - Math.sin(angle - j * 0.09) * 9,
        '#c9b9ff',
      );
  }
};
const bloom: Effects = (c, t, _, front) => {
  for (let i = 0; i < 7; i++) {
    if ((i % 2 === 0) !== front) continue;
    const u = phase(t, i * 0.035, 0.64 + i * 0.035),
      x = (i - 3) * 7.7;
    const h = (8 + ((i * 7) % 12)) * u,
      sway = Math.sin(t * tau + i) * 2;
    if (!u) continue;
    c.beginPath();
    c.moveTo(x, 0);
    c.quadraticCurveTo(x - 2, -h * 0.5, x + sway, -h);
    c.strokeStyle = '#73ba74';
    c.lineWidth = 1.1;
    c.stroke();
    stroke(
      c,
      [
        [x, -h * 0.35],
        [x + 3, -h * 0.56],
        [x, -h * 0.5],
      ],
      '#abdb85',
      1.2,
    );
    if (u > 0.58) {
      const size = 2.2 * phase(u, 0.58, 1);
      for (let j = 0; j < 5; j++)
        dot(
          c,
          x + sway + Math.cos((j * tau) / 5) * size,
          -h + Math.sin((j * tau) / 5) * size,
          i % 3 ? '#f5bbbd' : '#e7d7ff',
          2,
        );
      dot(c, x + sway, -h, '#ffdf7b', 2);
    }
    if (t > 0.54)
      dot(
        c,
        x + sway + Math.sin(i + t * 4) * 5,
        -h - 14 * phase(t, 0.54, 1),
        '#e0eea2',
      );
  }
};
const webs: Effects = (c, t, body, front, bodyTime) => {
  const hand = handPosition('spider-man', bodyTime, body, 'right', 26, 26);
  if (!front) {
    const reach = phase(t, 0.03, 0.22),
      release = phase(t, 0.65, 0.88);
    if (reach <= 0 || release >= 1) return;
    const anchor: Point = [22, -51];
    const end: Point = [
      hand[0] + (anchor[0] - hand[0]) * reach,
      hand[1] + (anchor[1] - hand[1]) * reach,
    ];
    const start: Point = [
      hand[0] + (end[0] - hand[0]) * release,
      hand[1] + (end[1] - hand[1]) * release,
    ];
    stroke(
      c,
      [
        start,
        [(start[0] + end[0]) / 2 - 2 * (1 - reach), (start[1] + end[1]) / 2],
        end,
      ],
      '#ddf5ff',
      1.2,
    );
    if (reach === 1) {
      const knots: Point[] = [];
      for (let i = 0; i < 7; i++) {
        const a = (i * tau) / 7;
        knots.push([anchor[0] + Math.cos(a) * 3, anchor[1] + Math.sin(a) * 3]);
        stroke(
          c,
          [anchor, [anchor[0] + Math.cos(a) * 6, anchor[1] + Math.sin(a) * 6]],
          '#a5c9e4',
          0.6,
        );
      }
      stroke(c, [...knots, knots[0]], '#edfaff', 0.6);
    }
  } else if (t > 0.25 && t < 0.77) {
    for (let i = 0; i < 3; i++)
      ring(
        c,
        1,
        -34,
        24 + i * 3,
        22 + i * 2,
        i === 1 ? '#eeeeff' : '#92b4db',
        0.8,
        1.5 + t * 0.5,
        2.65 - t * 0.45,
      );
  } else if (t > 0.77) motes(c, 5, -1, phase(t, 0.77, 1), 12, '#c2d4ee', 7);
};
const repulsor: Effects = (c, t, body, front, bodyTime) => {
  const y = -body.lift;
  if (!front) {
    for (const boot of [-5, 5]) {
      const x = body.x + boot,
        length =
          (7 + body.lift) * wave(t) * (1 + 0.12 * Math.sin(t * 32 + boot));
      stroke(
        c,
        [
          [x, y - 2],
          [x - 1, y + length * 0.45],
          [x - 2, y + length],
        ],
        '#48aada',
        3.4,
      );
      stroke(
        c,
        [
          [x, y - 2],
          [x - 1, y + length * 0.65],
        ],
        '#e1ffff',
        1.5,
      );
    }
    ring(c, body.x, 1, 10 + wave(t) * 12, 2 + wave(t) * 2, '#67d6f0', 0.7);
  } else {
    const [x, hand] = handPosition('iron-man', bodyTime, body, 'right', 26, 26);
    const blast = wave(phase(t, 0.38, 0.79));
    ring(c, x, hand, 2 + wave(t) * 2, 2 + wave(t) * 2, '#a6f4ff', 1);
    if (blast > 0.01) {
      const tip: Point = [x + 33 * blast, hand - 9 * blast];
      stroke(c, [[x, hand], tip], '#55cfea', 3.4 * blast);
      stroke(c, [[x, hand], tip], '#edffff', 1.3 * blast);
      glint(c, ...tip, 3 * blast, '#c3fcff');
    }
  }
};
const thunder: Effects = (c, t, body, front, bodyTime) => {
  const hammer = handPosition('thor', bodyTime, body, 'left', 6, 19);
  if (!front) {
    const charge = phase(t, 0, 0.4);
    for (let i = 0; i < 3; i++)
      ring(
        c,
        hammer[0],
        hammer[1],
        4 + i * 2 + charge * 3,
        4 + i * 2 + charge * 3,
        '#acbcff',
        0.8,
        t * 5 + i * 2,
        t * 5 + i * 2 + 1.25,
      );
    const u = phase(t, 0.32, 0.57);
    if (!u || t > 0.83) return;
    const points: Point[] = [
      [-8, -53],
      [2, -45],
      [-3, -40],
      [8, -39],
      [4, -31],
      hammer,
    ];
    const n = u * (points.length - 1);
    const bolt = points.slice(0, Math.floor(n) + 1);
    const last = bolt[bolt.length - 1],
      next = points[Math.min(points.length - 1, bolt.length)];
    bolt.push([
      last[0] + (next[0] - last[0]) * (n % 1),
      last[1] + (next[1] - last[1]) * (n % 1),
    ]);
    c.globalAlpha *= 1 - phase(t, 0.61, 0.83);
    stroke(c, bolt, '#819dff', 3);
    stroke(c, bolt, '#f4fcff', 1.15);
    if (u > 0.62)
      stroke(
        c,
        [
          [-3, -40],
          [-12, -37],
          [-10, -33],
          [-18, -30],
        ],
        '#bcdbff',
        0.9,
      );
  } else if (t > 0.53) {
    const u = phase(t, 0.53, 1);
    ring(c, 3, 0, 3 + u * 26, 1 + u * 4, '#88c7ff', 1.3);
    motes(c, ...hammer, u, 15, '#d6eaff', 8);
  }
};
const gamma: Effects = (c, t, body, front) => {
  const u = phase(t, 0.54, 1);
  if (!front && t < 0.54) {
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 5;
      stroke(
        c,
        [
          [x, -2 - body.lift],
          [x + 1, -5 - body.lift - wave(t * 1.6) * 6],
        ],
        '#9ce37e',
        0.9,
      );
    }
  } else if (u > 0 && !front) {
    for (let i = 0; i < 2; i++) {
      const p = phase(u, i * 0.2, 1);
      if (p > 0)
        ring(c, 2, 0, 3 + p * 32, 1 + p * 4, i ? '#b4ff93' : '#71c578', 1.3);
    }
  } else if (u > 0) {
    for (let i = 0; i < 12; i++) {
      const sign = i % 2 ? 1 : -1,
        x = 2 + sign * (6 + (10 + (i % 5) * 4) * u),
        y = -wave(u) * (5 + ((i * 3) % 12));
      dot(c, x, y, i % 3 ? '#a0ae7c' : '#cef79a', i % 4 === 0 ? 3 : 2);
    }
    for (const side of [-1, 1])
      stroke(
        c,
        [
          [2, 0],
          [2 + side * 9 * u, -1],
          [2 + side * 13 * u, 1],
          [2 + side * 24 * u, 0],
        ],
        '#e5ffc4',
        1,
      );
  }
};
const shield: Effects = (c, t, body, front, bodyTime) => {
  const p = phase(t, 0.22, 0.83);
  if (p <= 0 || p >= 1) return;
  const [startX, startY] = handPosition(
    'captain-america',
    bodyTime,
    body,
    'left',
    10,
    26,
  );
  const orbit = (v: number): Point => [
    startX + Math.sin(v * tau) * 24,
    startY - 16 * wave(v) + 4 * Math.sin(v * tau),
  ];
  if (p > 0.5 !== front) return;
  const trail = Array.from({ length: 10 }, (_, i) =>
    orbit(Math.max(0, p - (9 - i) * 0.013)),
  );
  stroke(c, trail, '#8ac1ed', 1.8);
  const [x, y] = orbit(p),
    rx = 2.3 + Math.abs(Math.cos(p * tau * 2)) * 2.5;
  c.fillStyle = '#e96562';
  c.beginPath();
  c.ellipse(x, y, rx, 4.6, p * 0.7, 0, tau);
  c.fill();
  ring(c, x, y, rx * 0.72, 3.2, '#fcf2dd', 1);
  ring(c, x, y, rx * 0.39, 1.8, '#66a5d8', 1.6);
  glint(c, x, y, 1.6, '#fffaf0');
};
const widow: Effects = (c, t, body, front, bodyTime) => {
  const left = t > 0.46,
    u = left ? phase(t, 0.46, 0.88) : phase(t, 0.13, 0.52);
  if (!u || u >= 1) return;
  const d = left ? -1 : 1,
    [x, y] = handPosition(
      'black-widow',
      bodyTime,
      body,
      left ? 'left' : 'right',
      left ? 10 : 26,
      26,
    );
  if (!front) {
    for (let i = 0; i < 3; i++)
      stroke(
        c,
        [
          [body.x - d * (10 + i * 4), y + i * 2],
          [body.x - d * (21 + i * 2), y + 3 + i * 2],
        ],
        '#eb7a8a',
        0.9,
      );
  } else {
    const end: Point = [x + d * (4 + 17 * wave(u)), y - 7 * wave(u)];
    const arc: Point[] = [
      [x, y],
      [x + d * 6, y - 4],
      [x + d * 8, y - 1],
      [end[0] - d * 4, end[1] - 2],
      end,
    ];
    stroke(c, arc, '#6e90ff', 2.7);
    stroke(c, arc, '#cef5ff', 1);
    glint(c, ...end, 3 * wave(u), '#edfaff');
  }
};
const trickShot: Effects = (c, t, body, front, bodyTime) => {
  const hand = handPosition('hawkeye', bodyTime, body, 'right', 28, 22),
    target: Point = [35, -28];
  if (!front) {
    const r = 5 + 4 * (1 - phase(t, 0, 0.44));
    for (let i = 0; i < 4; i++)
      ring(
        c,
        ...target,
        r,
        r,
        '#dbb8ff',
        0.85,
        (i * Math.PI) / 2 + 0.15,
        (i * Math.PI) / 2 + 1.15,
      );
    dot(c, ...target, '#f6e7ff');
    return;
  }
  if (t < 0.49) {
    const pull = phase(t, 0.02, 0.43) * 6;
    stroke(
      c,
      [
        [hand[0] + 2, hand[1] - 6],
        [hand[0] - pull, hand[1]],
        [hand[0] + 3, hand[1] + 6],
      ],
      '#e8ccfe',
      0.7,
    );
    stroke(
      c,
      [
        [hand[0] - pull, hand[1]],
        [hand[0] + 7, hand[1] - 2],
      ],
      '#ffd79a',
      1,
    );
  } else if (t < 0.72) {
    const u = phase(t, 0.49, 0.72),
      x = 7 + 28 * u,
      y = -16 - 12 * u - 3 * wave(u);
    stroke(
      c,
      [
        [x - 12, y + 4],
        [x, y],
      ],
      '#a777dd',
      2,
    );
    stroke(
      c,
      [
        [x - 7, y + 2],
        [x, y],
      ],
      '#f8d7a2',
      1,
    );
    stroke(
      c,
      [
        [x - 2, y - 1],
        [x, y],
        [x - 1, y + 2],
      ],
      '#ffeccb',
      1,
    );
  } else {
    const u = phase(t, 0.72, 1);
    ring(c, ...target, 2 + u * 7, 2 + u * 7, '#efc9ff', 0.8);
    motes(c, ...target, u, 9, '#eac1ff', 8);
  }
};

const effects: Record<CompanionId, Effects> = {
  ember: foxfire,
  moon: constellation,
  moss: bloom,
  'spider-man': webs,
  'iron-man': repulsor,
  thor: thunder,
  hulk: gamma,
  'captain-america': shield,
  'black-widow': widow,
  hawkeye: trickShot,
};
export function drawAbility(
  c: Pen,
  id: CompanionId,
  t: number,
  body: AbilityPose,
  x: number,
  y: number,
  scale: number,
  facing: number,
  front: boolean,
  bodyTime = t,
) {
  c.save();
  c.translate(x, y);
  c.scale(scale * facing, scale);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.globalAlpha *= fade(t);
  effects[id](c, t, body, front, bodyTime);
  c.restore();
}
