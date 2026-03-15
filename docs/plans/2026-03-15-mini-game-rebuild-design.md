# Mini-Game Rebuild Design

## Context

The egg-hatching flow uses mini-games as a gate before breeding completes. The current 4 games are all tap-heavy. We're rebuilding with 6 games, each using a distinct touch gesture, inspired by WarioWare: Touched! microgames. All games must be touch-first for mobile play.

## Orchestrator

- Pick 1 random game from the pool of 6
- Win = egg hatches, proceed to breed API call
- Lose = back to breed selection screen ("The egg didn't hatch...")
- Keep intro screen ("An egg appeared!") and hatching animation
- Remove multi-game progress tracking (dots, win/loss counters)

## Games

### 1. Tap Frenzy (tap)
Tap the egg 20 times in 5 seconds. Progress bar fills. Timer bar drains. Large circular tap target.

- **Input**: Tap/click
- **Win**: 20 taps before time runs out
- **Kept from current codebase**, already mobile-friendly

### 2. Egg Roll (drag)
Egg at top of screen. Drag left/right to guide it down a path into a nest, dodging 3-4 obstacles that scroll upward. Continuous touch drag controls horizontal position.

- **Input**: Touch drag (horizontal), mouse move as fallback
- **Win**: Egg reaches nest at bottom without hitting 2 obstacles
- **Duration**: ~6 seconds

### 3. Shell Scratch (rub/scratch)
Egg covered by a dark overlay. Touch and drag across the surface to scratch it away, revealing the glowing egg. Progress bar tracks percentage revealed.

- **Input**: Touch move / mouse drag across a canvas area
- **Win**: Scratch away 80%+ of overlay within time limit
- **Duration**: ~5 seconds

### 4. Warm the Egg (circular motion)
Draw circles around the egg to warm it. Temperature gauge on the side rises with each completed revolution. Track angle changes from center of egg to detect circular motion.

- **Input**: Continuous circular touch/drag around a center point
- **Win**: Fill temperature gauge (5-6 revolutions) within time limit
- **Duration**: ~6 seconds

### 5. Egg Toss (swipe/flick)
Egg sits at bottom. A nest target floats at a random height. Swipe upward to toss — swipe speed determines height. Too soft undershoots, too hard overshoots. Best of 3 tosses.

- **Input**: Vertical swipe gesture (track touch start/end + velocity)
- **Win**: Land 2 of 3 tosses in the nest
- **Duration**: Self-paced, ~8 seconds typical

### 6. Crack Timing (tap timing)
A power indicator oscillates back and forth across a bar. A green target zone sits in the middle. Tap when the indicator is in the zone. 3 rounds, each faster.

- **Input**: Single tap per round
- **Win**: Hit the green zone 2 of 3 times
- **Duration**: ~5 seconds

## Component Interface

Each game exports a component with the signature:
```tsx
interface MiniGameProps {
  onComplete: (won: boolean) => void;
}
```

## File Structure

```
src/components/mini-games/
  index.ts
  tap-frenzy.tsx      (rebuild from current)
  egg-roll.tsx        (new)
  shell-scratch.tsx   (new)
  warm-the-egg.tsx    (new)
  egg-toss.tsx        (new)
  crack-timing.tsx    (new)
```

Delete: `timing-ring.tsx`, `pattern-memory.tsx`, `egg-catch.tsx`

## Tech

- React + framer-motion (`motion/react`)
- Touch events: `onTouchStart`, `onTouchMove`, `onTouchEnd` with `touch-none` CSS
- Mouse fallback: `onMouseDown`, `onMouseMove`, `onMouseUp`
- Canvas not needed — all games use DOM elements + CSS transforms
- Retro pixel art aesthetic (existing design system)
