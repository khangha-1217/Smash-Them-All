# Smash ’Em All

Smash ’Em All is a first-person 3D arcade game that runs in your browser. You have **60 seconds** to find and smash cockroaches, build combos, and score as many points as you can.

Play in the **Kitchen**, **Living Room**, or **Bedroom** with a **Slipper**, **Flyswatter**, or **Cardboard**. In **Normal** mode, cockroaches crawl around the room. In **Hell** mode, they can also fly toward you after a warning. The game supports Vietnamese and English and saves your best scores, achievements, and settings in your browser.

## Installation and startup

You need **Node.js 18.12 or later**, **pnpm 10.33.0** or npm, and a browser that supports **WebGL 2**.

Open a terminal in the directory that contains `package.json`. If you have the game checked out as a linked worktree, run the following PowerShell command from the parent checkout to enter it.

```powershell
Set-Location ".worktrees\smash-em-all"
```

Install the dependencies and start the development server.

```sh
pnpm install
pnpm dev --strictPort
```

To use npm on Windows PowerShell, run the following commands instead.

```powershell
npm.cmd install --no-package-lock
npm.cmd run dev -- --strictPort
```

Keep the terminal open and visit [http://localhost:5173](http://localhost:5173). Press **Ctrl+C** in the terminal to stop the server.

## How to play

Choose a room, mode, and weapon, then press **Start**. Track a cockroach with the crosshair and swing when it is within range. The game checks your aim at the moment of impact, so you can adjust your aim mid-swing.

| Action | Desktop | Phone in landscape |
| --- | --- | --- |
| Move | **WASD** | Left-side joystick |
| Aim | Move the mouse | Swipe on the right half of the screen |
| Swing | Left click | Tap the play area outside the joystick |
| Pause | **Esc** | On-screen pause button |
| Toggle sound | **M** or the sound button | Sound button |

When time runs out, the results screen shows your score, rank, number of cockroaches smashed, accuracy, and best combo. Press **Play Again** to start another round with the same settings.

## Testing and production build

```sh
pnpm test --coverage
pnpm build
pnpm exec vite preview --strictPort
```

Open [http://localhost:4173](http://localhost:4173) to preview the production build.

The project uses **TypeScript**, **Three.js**, and **Vite**. GLB models are in `public/assets/models/` and the Blender source files are in `blender/`.

See the [validation guide](specs/001-smash-em-all/quickstart.md) and [game specification](specs/001-smash-em-all/spec.md) for more details.
