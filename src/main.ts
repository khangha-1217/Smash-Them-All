import { AchievementTracker } from './core/achievement-tracker';
import { RoundController } from './core/round';
import type { MapId, RoundConfig } from './core/types';
import { AudioManager } from './audio/audio-manager';
import { I18n } from './i18n/i18n';
import { InputManager } from './input/input-manager';
import { CameraController } from './rendering/camera-controller';
import { CockroachRenderer } from './rendering/cockroach-renderer';
import { disposeModel, loadMap, loadModel } from './rendering/map-loader';
import type { LoadedMap } from './rendering/map-loader';
import { SceneManager } from './rendering/scene-manager';
import { Vfx } from './rendering/vfx';
import { WeaponViewmodel } from './rendering/weapon-viewmodel';
import { GameOverScreen } from './ui/game-over-screen';
import { Hud } from './ui/hud';
import { OrientationPrompt } from './ui/orientation-prompt';
import { PauseOverlay } from './ui/pause-overlay';
import { StartScreen } from './ui/start-screen';
import { TrophyCabinet } from './ui/trophy-cabinet';
import { EventEmitter } from './utils/event-emitter';
import { ProfileStorage } from './utils/storage';
import './ui/styles.css';

interface MapRequest {
  id: MapId;
  abort: AbortController;
  loaded: Promise<LoadedMap>;
  progress: number;
}

function mountGame(canvas: HTMLCanvasElement, ui: HTMLElement) {
  const scene = new SceneManager(canvas);
  const events = new EventEmitter();
  const round = new RoundController(events);
  const storage = new ProfileStorage();
  const achievements = new AchievementTracker(storage, events);
  const i18n = new I18n(storage, events);
  const audio = new AudioManager(events, storage.load().soundEnabled);
  const camera = new CameraController(scene.camera, events);
  const hud = new Hud(i18n, events, pauseRound);
  const vfx = new Vfx(scene.world, scene.camera, hud.reticle, hud.effects, i18n);

  let map: LoadedMap | undefined;
  let mapRequest: MapRequest | undefined;
  let pendingRound: AbortController | undefined;
  let reportMapProgress: ((fraction: number) => void) | undefined;
  let weapon: WeaponViewmodel | undefined;
  let roaches: CockroachRenderer | undefined;
  let loadFailed = false;
  let lastFrame = performance.now();
  let resumeRequested = false;
  let rotationPaused = false;
  let trophyOpen = false;

  const input = new InputManager(canvas, hud.joystick, {
    move: (right, forward, seconds) => camera.move(right, forward, seconds),
    look: (horizontal, vertical) => camera.look(horizontal, vertical),
    swing: () => {
      const { position, direction } = camera.aim();
      round.swing(position, direction);
    },
    pause: pauseRound,
    lockChanged: locked => {
      if (locked) {
        if (!focused()) input.release();
        else if (round.state === 'PAUSED' && (resumeRequested || rotationPaused)) resumeWhenAllowed();
        else startWhenReady();
      } else if (round.state === 'PLAYING') {
        pauseRound();
      } else if (round.state === 'PAUSED' && resumeRequested) {
        resumeRequested = false;
        if (focused()) pause.lockFailed();
      } else if (round.state === 'READY') {
        startWhenReady();
      }
    },
    modeChanged: mode => {
      hud.root.classList.toggle('touch-hud', mode === 'touch');
      ui.classList.toggle('mobile-layout', orientation.mobile || mode === 'touch');
    },
  });

  const start = new StartScreen(i18n, begin, ({ mapId }) => preview(mapId), () => {
    if (round.state !== 'MENU' || orientation.portrait) return;
    trophyOpen = true;
    refreshOverlayVisibility();
    trophies.show();
  });
  const pause = new PauseOverlay(i18n, () => {
    if (round.state !== 'PAUSED' || !focused() || orientation.portrait) return;
    resumeRequested = true;
    void audio.activate();
    input.acquire();
    resumeWhenAllowed();
  }, () => {
    const selection = round.selection;
    if (round.state !== 'PAUSED' || !selection || orientation.portrait) return;
    if (round.quit()) begin(selection);
  }, () => round.quit());
  const results = new GameOverScreen(i18n, () => {
    if (orientation.portrait) return;
    if (!round.replay()) return;
    void prepareFromGesture();
  }, () => round.quit());
  const trophies = new TrophyCabinet(i18n, storage, () => {
    trophyOpen = false;
    refreshOverlayVisibility();
    start.focusTrophies();
  });
  const orientation = new OrientationPrompt(i18n, updateOrientation);

  ui.append(start.root, hud.root, pause.root, results.root, trophies.root, orientation.root);
  ui.classList.toggle('mobile-layout', orientation.mobile);
  localizeDocument();
  events.on('LANGUAGE_CHANGED', () => {
    localizeDocument();
    for (const component of [start, hud, pause, results, trophies, orientation, vfx]) component.localize();
  });

  events.on('STATE_CHANGED', ({ to }) => {
    input.setEnabled(to === 'PLAYING');
    if (to !== 'GAME_OVER') results.hide();
    if (to !== 'MENU') trophyOpen = false;
    refreshOverlayVisibility();
    resumeRequested = false;
    if (to !== 'PAUSED') rotationPaused = false;
    if (to === 'PLAYING') {
      lastFrame = performance.now();
    } else if (to === 'LOADING') {
      releaseRoundAssets();
      loadFailed = false;
      start.loading();
    } else if (to === 'PAUSED') {
      if (!rotationPaused) input.release();
      pause.show();
    } else if (to === 'MENU') {
      input.release();
      releaseRoundAssets();
      start.menu(loadFailed);
      preview(start.selection.mapId);
    } else if (to === 'GAME_OVER') {
      input.release();
    }
  });

  events.on('WEAPON_SWING', () => weapon?.swing());
  events.on('COCKROACH_SPAWNED', event => roaches?.spawn(event));
  events.on('COCKROACH_MOVED', event => roaches?.moveTo(event));
  events.on('COCKROACH_DESPAWNED', event => roaches?.despawn(event));
  events.on('COCKROACH_HIT', event => vfx.hit(event));
  events.on('COCKROACH_NEAR_MISS', () => vfx.nearMiss());
  events.on('ROUND_ENDED', ({ roundResult }) => {
    const { mapId, mode, score } = roundResult;
    const previous = storage.recordPersonalBest(mapId, mode, score);
    const newlyUnlocked = achievements.completeRound(roundResult);
    results.show(roundResult, previous, newlyUnlocked);
    refreshOverlayVisibility();
  });

  window.addEventListener('pointerdown', () => void audio.activate(), { once: true });
  window.addEventListener('blur', onFocusLoss);
  window.addEventListener('focus', updateOrientation);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onFocusLoss();
    else updateOrientation();
  });

  updateOrientation();
  preview(start.selection.mapId);
  requestAnimationFrame(frame);

  function localizeDocument(): void {
    document.documentElement.lang = i18n.language;
    document.title = i18n.t('brand.title');
  }

  function focused(): boolean {
    return !document.hidden && document.hasFocus();
  }

  function pauseRound(): void {
    round.pause();
  }

  function onFocusLoss(): void {
    resumeRequested = false;
    rotationPaused = false;
    input.release();
    pauseRound();
    if (round.state === 'READY') startWhenReady();
  }

  function refreshOverlayVisibility(): void {
    const portrait = orientation.portrait;
    const { state } = round;
    start.root.hidden = portrait || trophyOpen || (state !== 'MENU' && state !== 'LOADING' && state !== 'READY');
    trophies.root.hidden = portrait || !trophyOpen;
    hud.root.hidden = portrait || state !== 'PLAYING';
    pause.root.hidden = portrait || state !== 'PAUSED';
    results.root.hidden = portrait || state !== 'GAME_OVER';
  }

  function updateOrientation(): void {
    const portrait = orientation.portrait;
    refreshOverlayVisibility();
    orientation.show(portrait);
    if (portrait && round.state === 'PLAYING') {
      rotationPaused = true;
      round.pause();
    } else if (!portrait) {
      if (rotationPaused) resumeWhenAllowed();
      startWhenReady();
    }
  }

  function resumeWhenAllowed(): void {
    if (round.state === 'PAUSED' && !orientation.portrait && focused() && (input.touch || input.locked)) {
      round.resume();
    }
  }

  function startWhenReady(): void {
    if (round.state !== 'READY') return;
    if (!orientation.portrait && focused() && (input.touch || input.locked)) round.start();
    else start.ready(!input.touch && !input.lockPending, input.lockPending);
  }

  function begin(config: RoundConfig): void {
    if (orientation.portrait) return;
    if (round.state === 'READY') {
      if (focused()) input.acquire();
      startWhenReady();
    } else if (round.configure(config)) {
      void prepareFromGesture();
    }
  }

  function prepareFromGesture(): Promise<void> {
    const audioReady = audio.activate();
    if (focused()) input.acquire();
    return prepareRound(round.selection!, audioReady);
  }

  function preview(mapId: MapId): void {
    void ensureMap(mapId).catch(() => {});
  }

  function ensureMap(mapId: MapId): Promise<LoadedMap> {
    if (map?.data.id === mapId) {
      mapRequest?.abort.abort();
      mapRequest = undefined;
      reportMapProgress?.(1);
      return Promise.resolve(map);
    }
    if (mapRequest?.id === mapId) {
      reportMapProgress?.(mapRequest.progress);
      return mapRequest.loaded;
    }

    mapRequest?.abort.abort();

    const abort = new AbortController();
    const loaded = loadMap(mapId, abort.signal, fraction => {
      if (mapRequest !== request) return;
      request.progress = fraction;
      reportMapProgress?.(fraction);
    }).then(next => {
      if (mapRequest !== request || abort.signal.aborted) {
        disposeModel(next.scene);
        throw new DOMException('Map request was replaced', 'AbortError');
      }

      if (map) disposeModel(map.scene);
      map = next;
      scene.world.add(next.scene);
      camera.reset(next.data);
      return next;
    }).finally(() => {
      if (mapRequest === request) mapRequest = undefined;
    });
    const request: MapRequest = { id: mapId, abort, loaded, progress: 0 };
    mapRequest = request;
    return loaded;
  }

  async function prepareRound(config: RoundConfig, audioReady: Promise<void>): Promise<void> {
    const abort = new AbortController();
    pendingRound = abort;
    const progress = [0, 0, 0];
    const report = (index: number, fraction: number) => {
      if (pendingRound !== abort || abort.signal.aborted) return;
      progress[index] = fraction;
      start.setProgress(progress.reduce((total, value) => total + value, 0) / 3);
    };
    reportMapProgress = fraction => report(0, fraction);
    const keptPreview = map?.data.id === config.mapId;
    const cancelSiblings = (error: unknown): never => {
      if (pendingRound === abort) {
        abort.abort();
        mapRequest?.abort.abort();
      }
      throw error;
    };

    const [mapResult, weaponResult, roachResult] = await Promise.allSettled([
      ensureMap(config.mapId).catch(cancelSiblings),
      WeaponViewmodel.preload(config.weaponId, abort.signal, fraction => report(1, fraction)).catch(cancelSiblings),
      loadModel('cockroach', abort.signal, fraction => report(2, fraction)).catch(cancelSiblings),
    ] as const);
    let preparedWeapon: WeaponViewmodel | undefined;
    let preparedRoaches: CockroachRenderer | undefined;
    try {
      if (mapResult.status === 'rejected') throw mapResult.reason;
      if (weaponResult.status === 'rejected') throw weaponResult.reason;
      if (roachResult.status === 'rejected') throw roachResult.reason;
      await audioReady;
      if (pendingRound !== abort || round.state !== 'LOADING' || abort.signal.aborted) return;

      preparedWeapon = new WeaponViewmodel(weaponResult.value, scene.viewmodel, scene.weaponCamera);
      const poolSize = config.mode === 'hell' ? 40 : 25;
      preparedRoaches = new CockroachRenderer(roachResult.value, poolSize, mapResult.value.data.spawnPoints);
      if (!round.ready(mapResult.value.data)) throw new Error('Round rejected the selected map');

      weapon = preparedWeapon;
      roaches = preparedRoaches;
      scene.world.add(roaches.group);
      camera.reset(mapResult.value.data);
      startWhenReady();
    } catch (error) {
      if (pendingRound !== abort) return;

      console.warn('Round assets could not be loaded', error);
      if (!keptPreview && map?.data.id === config.mapId) {
        disposeModel(map.scene);
        map = undefined;
      }
      loadFailed = true;
      round.failLoad();
    } finally {
      if (preparedWeapon !== weapon || !preparedWeapon) {
        if (preparedWeapon) preparedWeapon.dispose();
        else if (weaponResult.status === 'fulfilled') disposeModel(weaponResult.value.scene);
      }
      if (preparedRoaches !== roaches || !preparedRoaches) {
        if (preparedRoaches) preparedRoaches.dispose();
        else if (roachResult.status === 'fulfilled') disposeModel(roachResult.value.scene);
      }
      if (pendingRound === abort) {
        pendingRound = undefined;
        reportMapProgress = undefined;
      }
    }
  }

  function releaseRoundAssets(): void {
    if (pendingRound) {
      pendingRound.abort();
      pendingRound = undefined;
      reportMapProgress = undefined;
    }

    weapon?.dispose();
    roaches?.dispose();
    weapon = undefined;
    roaches = undefined;
    vfx.reset();
  }

  function frame(now: number): void {
    const elapsedMs = Math.max(0, now - lastFrame);
    lastFrame = now;
    const seconds = Math.min(elapsedMs, 50) / 1_000;
    if (round.state === 'PLAYING') {
      const walking = input.update(seconds);
      round.updatePlayerPosition(scene.camera.position);
      round.tick(elapsedMs);
      if (round.state === 'PLAYING') {
        roaches?.update(seconds);
        weapon?.update(seconds, walking);
        vfx.update(seconds, (x, y) => camera.shake(x, y));
      }
    } else if (round.state === 'MENU' || round.state === 'LOADING') {
      camera.preview(now / 1_000);
    }
    scene.render(round.state === 'PLAYING' || round.state === 'PAUSED' || round.state === 'GAME_OVER');
    requestAnimationFrame(frame);
  }

  return { scene, round, camera, events };
}

const canvas = document.querySelector('#game');
const ui = document.querySelector('#ui');
if (!(canvas instanceof HTMLCanvasElement) || !(ui instanceof HTMLElement)) {
  throw new Error('Game canvas and UI overlay are required.');
}

export const game = mountGame(canvas, ui);
