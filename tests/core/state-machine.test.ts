import { describe, expect, it } from 'vitest';
import { StateMachine } from '../../src/core/state-machine';
import type { GameState } from '../../src/core/types';
import { EventEmitter, type GameEvents } from '../../src/utils/event-emitter';

const paths: Record<GameState, GameState[]> = {
  MENU: [],
  LOADING: ['LOADING'],
  READY: ['LOADING', 'READY'],
  PLAYING: ['LOADING', 'READY', 'PLAYING'],
  PAUSED: ['LOADING', 'READY', 'PLAYING', 'PAUSED'],
  GAME_OVER: ['LOADING', 'READY', 'PLAYING', 'GAME_OVER'],
};

const allowed: Record<GameState, GameState[]> = {
  MENU: ['LOADING'],
  LOADING: ['READY', 'MENU'],
  READY: ['PLAYING'],
  PLAYING: ['PAUSED', 'GAME_OVER'],
  PAUSED: ['PLAYING', 'MENU'],
  GAME_OVER: ['MENU', 'LOADING'],
};

describe('StateMachine', () => {
  it('starts at the menu', () => {
    const state = new StateMachine(new EventEmitter());

    expect(state.current).toBe('MENU');
  });

  it.each(Object.keys(paths) as GameState[])('only accepts the documented transitions from %s', (from) => {
    for (const to of Object.keys(paths) as GameState[]) {
      const bus = new EventEmitter();
      const state = new StateMachine(bus);
      for (const step of paths[from]) state.transition(step);
      const changes: GameEvents['STATE_CHANGED'][] = [];
      bus.on('STATE_CHANGED', (event) => {
        expect(state.current).toBe(event.to);
        changes.push(event);
      });

      const accepted = state.transition(to);

      if (allowed[from].includes(to)) {
        expect(accepted).toBe(true);
        expect(state.current).toBe(to);
        expect(changes).toEqual([{ from, to }]);
      } else {
        expect(accepted).toBe(false);
        expect(state.current).toBe(from);
        expect(changes).toEqual([]);
      }
    }
  });
});
