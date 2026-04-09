# Scoundrel

## Description

|         |                                                                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authors | [Zach Gage](https://boardgamegeek.com/boardgamedesigner/60260/zach-gage) & [Kurt Bieg](https://boardgamegeek.com/boardgamedesigner/12161/kurt-bieg) |
|         | [Official Website](http://stfj.net/art/2011/Scoundrel.pdf)                                                                                          |
|         | [BGG](https://boardgamegeek.com/boardgame/191095/scoundrel)                                                                                         |

### Setup & Goal

- **Deck:** Use a standard 52-card deck. Remove all Jokers, Red Face Cards (Jacks, Queens, Kings of Hearts and Diamonds), and Red Aces. The remaining cards form the "Dungeon" draw pile.
- **Values:** Number cards 2-10 equal their face value. Jack=11, Queen=12, King=13, Ace=14.
- **Player Stats:** Start with 20 Health. Your Health can never exceed 20.
- **Turn Sequence:** Deal 4 cards face up to form a "Room". You must interact with exactly 3 of the 4 cards. Leave the 4th card on the table to become part of the next Room.
- **Running:** Instead of interacting, you may choose to "Run" by picking up all 4 Room cards and placing them at the bottom of the Dungeon deck. You cannot Run from two Rooms in a row.
- **Win Condition:** Defeat the entire Dungeon deck. Your remaining Health is your score. If you drop to 0 Health, you lose, and your score is the negative sum of all remaining monsters.

### Card Types & Combat

- **Monsters (Spades & Clubs):** To defeat a monster barehanded, subtract its full value from your Health and discard it.
- **Weapons (Diamonds):** You may only equip one weapon at a time (equipping a new one discards the old). When attacking with a weapon, subtract the weapon's value from the monster's value, and you take the remaining damage (e.g., a 5 Weapon vs an 8 Monster = 3 damage to your Health).
  - _Durability Rule:_ Once a weapon has slain a monster, that weapon can only be used against subsequent monsters if their value is **strictly lower** than the last monster it defeated.
- **Health Potions (Hearts):** Add the card's value to your Health (up to the max of 20). You may only use **one** potion per Room. If you are forced to take a second potion in the same Room, it is discarded for 0 healing.

## Setup

- multicolor
- placeholder: (-7, 0) (-2, 0) (3, 0) (8, 0)
- placeholder: (-2, 8) weapon
- placeholder: (8, 8) discard
- counter: (-14, 8)

## Deck

- remove hearts 11 12 13 1
- remove diamonds 11 12 13 1
- shuffle
- move (0, -17)
