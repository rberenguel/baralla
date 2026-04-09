# Club Fight

## Description

### Setup & Goal
* **Decks:** Deal a 3x3 grid from a standard deck. Keep all clubs in a separate draw pile for your hand (draw up to 4). Add 1 Joker for Easy, or 2 for Hard.
* **Values:** Ace=1, Jack=11, Queen=12, King=13. Jokers lack suit and value. 
* **Turn Sequence:** Play 1 club -> use 1 ability -> refill grid (left-to-right, top-to-bottom) -> draw hand back to 4.
* **Win Condition:** Eliminate the entire grid and the grid draw pile.

### Always-Active Abilities
* **Match:** Discard a club to remove all grid cards sharing that exact number.
* **Sum:** Discard a club to remove a combo of grid cards that mathematically add up to the club's number.
* **Any:** Discard a club to remove one single card (can be used to eliminate Jokers).

### Conditional Abilities
*These abilities are locked and cannot be used if 3 or more of the "blocking suit" are currently visible in the 3x3 grid.*
* **Line (Blocked by Diamonds):** Discard a club to clear an entire row or column that contains a matching number (can eliminate Jokers).
* **Up/Down (Blocked by Spades):** Discard a 2-7 club to remove all strictly lower cards, or a 7-Q club to remove all strictly higher cards.
* **Run (Blocked by Hearts):** Discard a club to clear cards that create a consecutive sequence with it. Suits don't matter; King does not loop back to Ace.

## Setup
- placeholder: (-33, -3) (-28, -3) (-23, -3) (-18, -3) (-7, -8) (-2, -8) (3, -8) (-7, -1) (-2, -1) (3, -1) (-7, 6) (-2, 6) (3, 6)

## Deck
- split clubs clubs
- move clubs (-25, -11)
- move clubs (-38, -3)
- move (0, -18)
- shuffle
- joker
- shuffle clubs
- move (-2, -16)