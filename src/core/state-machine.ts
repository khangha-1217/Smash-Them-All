import type { EventEmitter } from '../utils/event-emitter';
import type { GameState } from './types';

const transitions: Record<GameState, readonly GameState[]> = {
  MENU: ['LOADING'],
  LOADING: ['READY', 'MENU'],
  READY: ['PLAYING'],
  PLAYING: ['PAUSED', 'GAME_OVER'],
  PAUSED: ['PLAYING', 'MENU'],
  GAME_OVER: ['MENU', 'LOADING'],
};

export class StateMachine {
  private state: GameState = 'MENU';

  constructor(private readonly events: EventEmitter) {}

  get current(): GameState {
    return this.state;
  }

  transition(to: GameState): boolean {
    const from = this.state;
    if (!transitions[from].includes(to)) return false;

    this.state = to;
    this.events.emit('STATE_CHANGED', { from, to });
    return true;
  }
}
