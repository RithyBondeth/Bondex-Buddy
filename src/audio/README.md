# Optional procedural sound

`Ambience` creates no AudioContext or sample buffer until the user enables sound. It provides an original deterministic filtered-noise loop as provisional rain ambience and sine tones with gain envelopes for gentle chimes. No recordings, microphone, network requests, or third-party audio assets are used.

Sound is muted by default and is not persisted. Muting/hidden windows suspend audio processing and stop pending chimes so stale tones do not replay later. Disposal stops sources and closes the context, including when startup/resume is pending.

These are prototype sounds. Approved Foley and ambient assets remain future work, as do subjective listening checks on macOS and Windows.
