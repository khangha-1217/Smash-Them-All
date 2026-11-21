import type { CockroachState, GameMode, GameState, Pose, Vec3 } from '../core/types';
import type { EventEmitter } from '../utils/event-emitter';
import type { ProfileStorage } from '../utils/storage';
import { assetUrl } from '../utils/asset-url';

const OUTCOMES = ['hit', 'miss'] as const;
const EFFECTS = [...OUTCOMES, 'scurry', 'buzz', 'ui-click', 'combo-chime', 'timer-tick', 'gameover'] as const;
const MUSIC = {
  normal: 'normal-bgm',
  hell: 'hell-bgm',
} as const;
type Clip = typeof EFFECTS[number] | typeof MUSIC[GameMode];
type OneShot = Exclude<typeof EFFECTS[number], 'scurry' | 'buzz'>;
type AmbientClip = 'scurry' | 'buzz';

const MAX_SPATIAL_VOICES = 5;
const AUDIBLE_DISTANCE = 4.5;
const OUTCOME_WAIT_MS = 1_200;
const DOWNLOAD_TIMEOUT_MS = 3_000;

interface Roach {
  position: Vec3;
  state: CockroachState;
}

interface SpatialVoice {
  clip: AmbientClip;
  source: AudioBufferSourceNode;
  panner: PannerNode;
  level: GainNode;
  distance: number;
}

interface AudioGraph {
  context: AudioContext;
  master: GainNode;
  effects: GainNode;
  music: GainNode;
  ambience: GainNode;
}

function setPosition(node: AudioListener | PannerNode, { x, y, z }: Vec3): void {
  node.positionX.value = x;
  node.positionY.value = y;
  node.positionZ.value = z;
}

function makeGain(context: AudioContext, output: AudioNode, level: number): GainNode {
  const gain = context.createGain();
  gain.gain.value = level;
  gain.connect(output);
  return gain;
}

function ambientClip(state: CockroachState): AmbientClip | undefined {
  if (state === 'crawling') return 'scurry';
  if (state === 'preflight' || state === 'flying') return 'buzz';
  return undefined;
}

export class AudioManager {
  private enabled: boolean;
  private graph?: AudioGraph;
  private state: GameState = 'MENU';
  private pose?: Pose;
  private mode?: GameMode;
  private music?: AudioBufferSourceNode;
  private musicStartedAt = 0;
  private musicOffset = 0;
  private cueGeneration = 0;
  private resume?: Promise<void>;
  private readonly downloads = new Map<Clip, Promise<ArrayBuffer | null>>();
  private readonly decoding = new Map<Clip, Promise<void>>();
  private readonly buffers = new Map<Clip, AudioBuffer>();
  private readonly roaches = new Map<number, Roach>();
  private readonly voices = new Map<number, SpatialVoice>();
  private readonly cues = new Set<AudioBufferSourceNode>();

  constructor(events: EventEmitter, storage: ProfileStorage) {
    this.enabled = storage.load().soundEnabled;
    events.on('SOUND_TOGGLED', ({ enabled }) => {
      this.enabled = enabled;
      if (this.graph) this.graph.master.gain.value = Number(enabled);
      if (enabled) this.activate();
      else this.stopPlayback();
      storage.setSoundEnabled(enabled);
    });
    if (globalThis.AudioContext) {
      for (const clip of OUTCOMES) this.queueDownload(clip, 'sfx');
    }
  }

  activate(): void {
    if (!globalThis.AudioContext) return;
    try {
      if (!this.graph) {
        const context = new AudioContext();
        const master = makeGain(context, context.destination, Number(this.enabled));
        this.graph = {
          context,
          master,
          effects: makeGain(context, master, 0.72),
          music: makeGain(context, master, 0.21),
          ambience: makeGain(context, master, 0.46),
        };
        context.addEventListener('statechange', () => this.startMusic());
        if (this.pose) this.setListenerPose(this.pose);
      }
      const { context } = this.graph;
      this.decode(context);
      if (context.state === 'running') this.startMusic();
      else if (context.state !== 'closed') {
        // Resume must be requested inside the original user gesture.
        const resume = context.resume().catch(() => {}).finally(() => {
          if (this.resume === resume) this.resume = undefined;
        });
        this.resume = resume;
      }
    } catch (error) {
      console.warn('Game audio is unavailable', error);
    }
  }

  async waitForOutcomes(): Promise<void> {
    if (!this.graph || OUTCOMES.every(clip => this.buffers.has(clip))) return;
    let timeout: number | undefined;
    try {
      await Promise.race([
        Promise.all(OUTCOMES.map(clip => this.decoding.get(clip))),
        new Promise<void>(resolve => { timeout = window.setTimeout(resolve, OUTCOME_WAIT_MS); }),
      ]);
    } finally {
      if (timeout !== undefined) window.clearTimeout(timeout);
    }
  }

  setState(state: GameState): void {
    this.state = state;
    if (state === 'PLAYING') {
      this.startMusic();
      return;
    }
    this.stopPlayback();
    if (state !== 'PAUSED') {
      this.roaches.clear();
      this.mode = undefined;
      this.musicOffset = 0;
    }
  }

  setMode(mode: GameMode): void {
    this.stopMusic();
    this.musicOffset = 0;
    this.mode = mode;
    this.startMusic();
  }

  setListenerPose(pose: Pose): void {
    this.pose = pose;
    if (!this.graph) return;
    const { listener } = this.graph.context;
    const { x: pitch, y: yaw } = pose.rotation;
    const sinPitch = Math.sin(pitch);
    const cosPitch = Math.cos(pitch);
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    setPosition(listener, pose.position);
    listener.forwardX.value = -sinYaw * cosPitch;
    listener.forwardY.value = sinPitch;
    listener.forwardZ.value = -cosYaw * cosPitch;
    listener.upX.value = sinYaw * sinPitch;
    listener.upY.value = cosPitch;
    listener.upZ.value = cosYaw * sinPitch;
  }

  setRoach(id: number, position: Vec3, state: CockroachState): void {
    this.roaches.set(id, { position, state });
    const voice = this.voices.get(id);
    if (voice && voice.clip !== ambientClip(state)) this.stopVoice(id);
  }

  despawn(id: number): void {
    this.roaches.delete(id);
    this.stopVoice(id);
  }

  updateAmbience(seconds: number): void {
    const graph = this.graph;
    const listener = this.pose?.position;
    if (!this.enabled || this.state !== 'PLAYING' || graph?.context.state !== 'running' || !listener) return;

    const nearby = [];
    for (const [id, roach] of this.roaches) {
      const clip = ambientClip(roach.state);
      if (!clip || !this.buffers.has(clip)) continue;
      const { x, y, z } = roach.position;
      const distance = Math.hypot(x - listener.x, y - listener.y, z - listener.z);
      if (distance >= AUDIBLE_DISTANCE) continue;
      // Keep a voice through small changes in the ordering of nearby roaches.
      const priority = distance - (this.voices.has(id) ? 0.25 : 0) - (clip === 'buzz' ? 0.5 : 0);
      nearby.push({ id, roach, clip, distance, priority });
    }
    nearby.sort((a, b) => a.priority - b.priority);
    const audible = nearby.slice(0, MAX_SPATIAL_VOICES);
    const ids = new Set(audible.map(({ id }) => id));
    for (const id of this.voices.keys()) if (!ids.has(id)) this.stopVoice(id);

    const { context } = graph;
    for (const { id, roach, clip, distance } of audible) {
      const level = roach.state === 'preflight' ? 0.08 : clip === 'buzz' ? 0.20 : 0.24;
      const voice = this.voices.get(id);
      if (!voice) {
        this.startVoice(graph, id, roach.position, clip, distance, level);
        continue;
      }
      setPosition(voice.panner, roach.position);
      voice.level.gain.setTargetAtTime(level, context.currentTime, 0.035);
      if (clip === 'buzz' && seconds > 0) {
        const approach = (voice.distance - distance) / seconds;
        const pitch = 1 + Math.max(-0.12, Math.min(0.12, approach * 0.028));
        voice.source.playbackRate.setTargetAtTime(pitch, context.currentTime, 0.04);
      }
      voice.distance = distance;
    }
  }

  play(clip: OneShot): void {
    if (!this.enabled || !this.graph) return;
    if (this.graph.context.state === 'running' && this.startCue(clip)) return;

    // An in-flight decode or resume may finish shortly after the triggering gesture.
    // Expire pending cues before a slow load can play them out of sync.
    const generation = this.cueGeneration;
    const deadline = performance.now() + (clip === 'hit' || clip === 'miss' ? 90 : 300);
    void Promise.all([this.decoding.get(clip), this.resume]).then(() => {
      if (this.enabled && generation === this.cueGeneration && performance.now() <= deadline) this.startCue(clip);
    }).catch(error => console.warn('Game sound could not be played', clip, error));
  }

  private startCue(clip: OneShot): boolean {
    const graph = this.graph;
    const buffer = this.buffers.get(clip);
    if (!buffer || graph?.context.state !== 'running') return false;
    const source = this.createSource(graph.context, buffer, graph.effects);
    this.cues.add(source);
    source.onended = () => {
      source.disconnect();
      this.cues.delete(source);
    };
    source.start();
    return true;
  }

  private startMusic(): void {
    const graph = this.graph;
    if (!this.enabled || this.state !== 'PLAYING' || graph?.context.state !== 'running' || !this.mode || this.music) return;
    const { context, music } = graph;
    const buffer = this.buffers.get(MUSIC[this.mode]);
    if (!buffer) return;
    this.music = this.createSource(context, buffer, music);
    this.music.loop = true;
    this.musicStartedAt = context.currentTime;
    this.music.start(0, this.musicOffset % buffer.duration);
  }

  private stopMusic(): void {
    if (!this.music || !this.graph) return;
    this.musicOffset += this.graph.context.currentTime - this.musicStartedAt;
    this.music.stop();
    this.music.disconnect();
    this.music = undefined;
  }

  private startVoice(graph: AudioGraph, id: number, position: Vec3, clip: AmbientClip, distance: number, volume: number): void {
    const buffer = this.buffers.get(clip);
    if (!buffer) return;
    const { context, ambience } = graph;
    const level = makeGain(context, ambience, 0);
    const panner = context.createPanner();
    panner.distanceModel = 'linear';
    panner.refDistance = 0.45;
    panner.maxDistance = AUDIBLE_DISTANCE;
    setPosition(panner, position);
    panner.connect(level);
    const source = this.createSource(context, buffer, panner);
    source.loop = true;
    source.start(0, buffer.duration * ((id * 0.618) % 1));
    level.gain.linearRampToValueAtTime(volume, context.currentTime + 0.035);
    this.voices.set(id, { clip, source, panner, level, distance });
  }

  private stopVoice(id: number): void {
    const voice = this.voices.get(id);
    if (!voice) return;
    voice.source.stop();
    voice.source.disconnect();
    voice.panner.disconnect();
    voice.level.disconnect();
    this.voices.delete(id);
  }

  private stopPlayback(): void {
    this.stopMusic();
    for (const id of this.voices.keys()) this.stopVoice(id);
    this.cueGeneration++;
    for (const source of this.cues) {
      source.onended = null;
      source.stop();
      source.disconnect();
    }
    this.cues.clear();
  }

  private createSource(context: AudioContext, buffer: AudioBuffer, output: AudioNode): AudioBufferSourceNode {
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    return source;
  }

  private preload(): void {
    for (const clip of EFFECTS) this.queueDownload(clip, 'sfx');
    for (const clip of Object.values(MUSIC)) this.queueDownload(clip, 'music');
  }

  private queueDownload(clip: Clip, folder: 'sfx' | 'music'): void {
    if (!this.downloads.has(clip) && !this.decoding.has(clip) && !this.buffers.has(clip)) {
      this.downloads.set(clip, this.download('audio/' + folder + '/' + clip + '.mp3').catch(() => null));
    }
  }

  private decode(context: AudioContext): void {
    this.preload();
    for (const [clip, download] of this.downloads) {
      const result = download.then(async bytes => {
        if (!bytes) return;
        this.buffers.set(clip, await context.decodeAudioData(bytes));
        this.startMusic();
      }).catch(error => console.warn('Game sound could not be loaded', clip, error))
        .finally(() => this.decoding.delete(clip));
      this.decoding.set(clip, result);
    }
    this.downloads.clear();
  }

  private async download(path: string): Promise<ArrayBuffer | null> {
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const response = await fetch(assetUrl(path), { signal: abort.signal });
      return response.ok ? await response.arrayBuffer() : null;
    } finally {
      window.clearTimeout(timeout);
    }
  }
}
