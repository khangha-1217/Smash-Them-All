const canvas = document.querySelector('#game');
const ui = document.querySelector('#ui');

if (!(canvas instanceof HTMLCanvasElement) || !(ui instanceof HTMLElement)) {
  throw new Error('Game canvas and UI overlay are required.');
}
