import { describe, expect, it } from 'vitest';
import { relativeTime, selectClips, type Clip } from './model';

const entries: Clip[] = [
  { id: 1, text: 'older PIN', pinned: true, copiedAt: 1 },
  { id: 2, text: 'latest note', pinned: false, copiedAt: 9 },
  { id: 3, text: 'newer pin', pinned: true, copiedAt: 4 },
];
describe('clipboard search', () => {
  it('puts pins first without changing the source and searches case-insensitively', () => {
    expect(selectClips(entries, ' PIN ', false).map((e) => e.id)).toEqual([
      3, 1,
    ]);
    expect(selectClips(entries, '', false).map((e) => e.id)).toEqual([3, 1, 2]);
    expect(entries[0].id).toBe(1);
    expect(selectClips(entries, 'note', true)).toEqual([]);
  });
  it('handles future and old timestamps without negative time labels', () => {
    expect(relativeTime(200, 100)).toBe('Just now');
    expect(relativeTime(0, 125_000)).toBe('2m ago');
    expect(relativeTime(0, 7_200_000)).toBe('2h ago');
  });
});
