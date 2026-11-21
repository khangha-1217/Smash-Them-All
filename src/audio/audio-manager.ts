import type { EventEmitter } from '../utils/event-emitter';
import { assetUrl } from '../utils/asset-url';

type Outcome = 'hit' | 'miss';
const OUTCOMES: Outcome[] = ['hit', 'miss'];

export class AudioManager {
  private context?: AudioContext;
  private effects?: GainNode;
  private loading?: Promise<void>;
  private readonly buffers = new Map<Outcome, AudioBuffer>();
  private readonly downloads = new Map<Outcome, Promise<ArrayBuffer | null>>();

  constructor(events: EventEmitter, private enabled: boolean) {
    events.on('COCKROACH_HIT', () => this.play('hit'));
    events.on('WEAPON_MISS', () => this.play('miss'));
    events.on('SOUND_TOGGLED', ({ enabled }) => {
      this.enabled = enabled;
      if (this.effects) this.effects.gain.value = Number(enabled);
      if (enabled) void this.activate();
    });
    if (enabled) this.preload();
  }

  activate(): Promise<void> {
    if (!this.enabled || !globalThis.AudioContext) return Promise.resolve();

    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.effects = this.context.createGain();
        this.effects.connect(this.context.destination);
      } catch (error) {
        console.warn('Game audio is unavailable', error);
        return Promise.resolve();
      }
    }

    const context = this.context;
    // Call resume on the original user gesture. Decode can finish afterward.
    void context.resume().catch(() => {});
    this.preload();
    this.loading ??= Promise.allSettled(OUTCOMES.map(async outcome => {
      const bytes = await this.downloads.get(outcome);
      if (bytes) this.buffers.set(outcome, await context.decodeAudioData(bytes));
    })).then(results => {
      this.downloads.clear();
      for (const result of results) {
        if (result.status === 'rejected') console.warn('Game sound could not be loaded', result.reason);
      }
    });
    return this.loading;
  }

  private preload(): void {
    if (this.loading) return;
    for (const outcome of OUTCOMES) {
      if (this.downloads.has(outcome)) continue;
      this.downloads.set(outcome, this.download(outcome).catch(() => null));
    }
  }

  private async download(outcome: Outcome): Promise<ArrayBuffer | null> {
    const abort = new AbortController();
    // An unavailable cue should never keep the loading screen open indefinitely.
    const timeout = window.setTimeout(() => abort.abort(), 3_000);
    try {
      const response = await fetch(assetUrl(`audio/sfx/${outcome}.mp3`), { signal: abort.signal });
      return response.ok ? await response.arrayBuffer() : null;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  private play(outcome: Outcome): void {
    const buffer = this.buffers.get(outcome);
    if (!this.enabled || !buffer || !this.context || this.context.state === 'closed' || !this.effects) return;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.effects);
    source.onended = () => source.disconnect();
    source.start();
  }
}
