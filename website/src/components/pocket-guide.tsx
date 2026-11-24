'use client';
import { useState } from 'react';

const tools = [
  {
    name: 'Focus',
    icon: '◷',
    title: 'Give one task your attention.',
    description:
      'Pick a to-do and start a 25-minute session. Your pet keeps the task beside the clock, counts completed sessions, and takes a five-minute break with you.',
    sample: '25:00',
    caption: 'Focus session',
    rows: ['Sketch the onboarding flow', 'Next up · Review the first draft'],
  },
  {
    name: 'Clipboard',
    icon: '≡',
    title: 'Find the line you copied earlier.',
    description:
      'Enable clipboard capture in Settings to keep recent clips on this device. Search your history, copy a snippet again, or turn its text into a task.',
    sample: 'Aa',
    caption: 'Recent clip',
    rows: [
      'Try the alternate color palette',
      'Text clip · available to turn into a task',
    ],
  },
  {
    name: 'Files',
    icon: '▱',
    title: 'A pocket for the file in transit.',
    description:
      'Drop a file onto your pet to tuck away a temporary copy. Drag it back into Finder or File Explorer, remove it, or extend its default 24-hour stay.',
    sample: '24h',
    caption: 'File pouch',
    rows: ['color-study.png', 'Temporary copy · extend by 24 hours'],
  },
  {
    name: 'Agents',
    icon: '⌁',
    title: 'Catch the handoff.',
    description:
      'Connect a supported coding agent in Settings. The pocket shows session activity and requests for input. Open a handoff to return to the provider.',
    sample: '↗',
    caption: 'Agent handoff',
    rows: ['Review requested', 'Session shortcut · return to provider'],
  },
] as const;

export function PocketGuide() {
  const [index, setIndex] = useState(0);
  const item = tools[index];
  return (
    <div className="guide-console">
      <div
        className="guide-controls"
        role="group"
        aria-label="Explore pocket tools"
      >
        {tools.map((tool, i) => (
          <button
            type="button"
            aria-pressed={index === i}
            key={tool.name}
            onClick={() => setIndex(i)}
          >
            <span aria-hidden="true">{tool.icon}</span>
            {tool.name}
          </button>
        ))}
      </div>
      <div className="guide-page" key={item.name} aria-live="polite">
        <div>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </div>
        <div className="guide-sample">
          <small>{item.caption} · example</small>
          <strong>{item.sample}</strong>
          <b>{item.rows[0]}</b>
          <small>{item.rows[1]}</small>
        </div>
      </div>
    </div>
  );
}
