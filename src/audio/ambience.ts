/** Original procedural ambience. No files, microphone, network, or startup audio. */
export class Ambience {
  private context: AudioContext | undefined;
  private rain: AudioBufferSourceNode | undefined;
  private readonly voices = new Set<OscillatorNode>();
  private visible = true;
  private disposed = false;
  enabled = false;

  constructor(
    private readonly createContext = () =>
      new AudioContext({ latencyHint: 'playback' }),
  ) {}

  async setEnabled(enabled: boolean): Promise<boolean> {
    if (this.disposed) return false;
    if (!enabled) {
      this.enabled = false;
      this.stopVoices();
      await this.context?.suspend();
      return false;
    }
    // Only an explicit Settings action enables playback.
    const context = (this.context ??= this.createContext());
    try {
      await context.resume();
      if (this.disposed) return false;
      if (!this.rain) this.createRain(context);
      this.enabled = true;
      if (!this.visible) await context.suspend();
      return true;
    } catch (error) {
      this.enabled = false;
      void context.suspend().catch(() => {});
      throw error;
    }
  }

  private createRain(context: AudioContext): void {
    const buffer = context.createBuffer(
      1,
      context.sampleRate * 2,
      context.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    let seed = 173;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
      samples[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1500;
    const volume = context.createGain();
    volume.gain.value = 0.025;
    source.connect(filter).connect(volume).connect(context.destination);
    source.start();
    this.rain = source;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.stopVoices();
    const context = this.context;
    if (!context || this.disposed) return;
    const operation =
      visible && this.enabled ? context.resume() : context.suspend();
    void operation.catch(() => {
      this.enabled = false;
    });
  }

  chime(completion = false): void {
    const context = this.context;
    if (
      !this.enabled ||
      !this.visible ||
      this.disposed ||
      context?.state !== 'running'
    )
      return;
    const now = context.currentTime;
    const frequencies = completion ? [440, 660] : [440];
    frequencies.forEach((frequency, index) => {
      const tone = context.createOscillator();
      const volume = context.createGain();
      const start = now + index * 0.12;
      tone.type = 'sine';
      tone.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.018, start + 0.025);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
      tone.connect(volume).connect(context.destination);
      this.voices.add(tone);
      tone.onended = () => {
        this.voices.delete(tone);
        tone.disconnect();
        volume.disconnect();
      };
      tone.start(start);
      tone.stop(start + 0.42);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.enabled = false;
    this.rain?.stop();
    this.rain?.disconnect();
    this.rain = undefined;
    this.stopVoices();
    if (this.context && this.context.state !== 'closed')
      void this.context.close().catch(() => {});
  }

  private stopVoices(): void {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
}
