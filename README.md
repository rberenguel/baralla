# Baralla

A card sandbox — drag, stack, fan, shuffle, and flip a standard 52-card deck on a virtual felt table. Supports pinch-to-zoom and pan.

## Setup Language

Baralla uses a lightweight markdown dialect to describe and share game setups. Setups can be recorded live (the app watches what you do and generates the text) or written by hand.

### Format

```
# Game Title

## Description
Optional description text.
First line is used as the title if no explicit # title is present.

## Setup
- placeholder: (x, y) (x, y) ...   // one or more placeholder card areas
- counter: (x, y) ...               // one or more life/point counters

## Deck
- shuffle                           // shuffle main deck
- split clubs clubs                 // split clubs out into a new stack named "clubs"
- move clubs (-5, 3)                // move the "clubs" stack to position
- shuffle clubs                     // shuffle the "clubs" stack
- move (-2, -1)                     // move the main deck (no name = main deck)
- flip                              // flip the main deck face-up
```

### Coordinates

Positions use **snap-grid units**: integers where `1 unit = ¼ card width = 17.5 px`. The origin is the table center.

- Positive X → right, negative X → left
- Positive Y → down, negative Y → up

Example: `(-4, 2)` means 4 quarter-card-widths to the left and 2 down from center.

---

### `## Setup` operations

| Line | Effect |
|---|---|
| `- placeholder: (x,y) ...` | Spawn dashed placeholder card areas at the given positions |
| `- counter: (x,y) ...` | Spawn life/point counter widgets at the given positions |

Multiple coordinates on one line spawn multiple items of that type.

---

### `## Deck` operations

All deck ops are applied in order during setup playback.

#### Stacks

The **main deck** is the default stack and needs no name. Named stacks are created by `split` and can be referenced by name in subsequent operations. Omitting a name always targets the main deck.

| Operation | Syntax | Effect |
|---|---|---|
| Shuffle | `- shuffle [name]` | Randomly reorder a stack |
| Flip | `- flip [name]` | Flip all cards in a stack face-up/down |
| Split by suit | `- split {suit} {name}` | Extract all cards of a suit from the main deck into a new named stack |
| Move | `- move [name] (x, y)` | Move a stack to the given position |
| Add joker | `- joker [name]` | Add a joker card on top of a stack |

**Suit names:** `spades`, `hearts`, `clubs`, `diamonds`

#### Examples

Simple setup — shuffled deck in the middle:
```
# My Game

## Deck
- shuffle
```

Two-stack setup — courts separated from pip cards:

```
# Courts Out

## Deck
- split spades spades
- split hearts hearts
- split clubs clubs
- split diamonds diamonds
```

*(The four suit stacks land adjacent to the main deck by default; use `move` ops to position them explicitly.)*

Scoundrel-style setup:
```
# Scoundrel

## Description
A solo dungeon-crawling card game. Survive the dungeon with only your wits.

## Setup
- placeholder: (-5, 2) (-3, 2) (-1, 2) (1, 2)
- counter: (5, 2)

## Deck
- shuffle
```

---

## Recording

Long-press on empty table → opens radial menu → tap the **record** button (circle icon). The icon turns red while recording.

While recording, the following actions are tracked:
- Adding a placeholder or counter (position captured when recording stops, not when placed — so you can drag to adjust)
- Shuffling a stack
- Flipping a stack
- Splitting a suit out of a stack
- Moving an entire stack to a new position

Tap the red **stop** button to finish. A modal appears with the generated setup markdown, ready to copy or edit.

**Not yet tracked during recording:**
- Dealing individual cards or subsets out of a stack (see [NEXT.md](./NEXT.md))

---

## Loading a Setup

Long-press on empty table → **load** button (folder icon). Paste or type a setup, then tap **Apply**. The board resets and the setup is replayed.

---

## Sharing

### URL Parameters
You can auto-load a game setup by appending its name as a query parameter:
`index.html?scoundrel`

This will attempt to fetch the setup from `games/scoundrel.md`. If the file is not found, a "Game Not Found" modal will appear.

### Encoding *(future)*
Setups will eventually be shareable as base64-encoded URLs, so you can send a game configuration as a link.
