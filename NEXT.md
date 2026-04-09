# NEXT — Deferred Work

## Deal and single-card tracking not yet recorded

When the user drags a **subset** of cards out of a stack (i.e. fewer than the full stack), this is a "deal" operation. It is currently **not tracked** during recording.

This will eventually generate a new named stack. The proposed format when implemented:

```
## Deck
- deal 10 main hand     // deal top 10 cards from main deck into new stack "hand"
- move hand (x, y)
```

For single-card deal (the draw operation common to many games):

```
- deal 1 main dungeon  // deal 1 card from main into dungeon pile
```

**What needs doing:**

- Detect partial stack drags in `onPointerUp` during recording
- Auto-assign a stack ID (e.g. `stack-1`, `stack-2`, or user-named)
- Track card count: N = dragTargets.length
- Emit `{ type: 'deal', count: N, src: srcId, dest: newId }`
- Serialize as `- deal N {src} {dest}`
- Parse and apply in `applySetup`

## Adding text to placeholders in setup mode is not supported

## Saving pip counts directly is not supported
