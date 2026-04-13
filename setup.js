// setup.js — Game Setup System for Baralla
// Coordinates are stored in snap-grid units (1 unit = 17.5px = ¼ card width)

const GRID = 70 / 4; // 17.5px

const SUIT_TO_NAME = {
  "♠": "spades",
  "♥": "hearts",
  "♣": "clubs",
  "♦": "diamonds",
};
const NAME_TO_SUIT = {
  spades: "♠",
  hearts: "♥",
  clubs: "♣",
  diamonds: "♦",
};

// --- PARSER ---

export function parseSetup(markdown) {
  const lines = markdown.split("\n");
  let section = null;
  const descLines = [];
  const tools = [];
  const deckOps = [];
  const parsed = {
    title: "",
    description: "",
    tools,
    deckOps,
    multicolor: false,
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("# ")) {
      parsed.title = line.slice(2).trim();
    } else if (line.startsWith("## ")) {
      section = line.slice(3).trim().toLowerCase();
    } else if (section === "description") {
      descLines.push(line);
    } else if (section === "setup") {
      if (line.startsWith("- placeholder:")) {
        parseToolsWithData(line.slice(14)).forEach((c) =>
          tools.push({ type: "placeholder", x: c.x, y: c.y, label: c.data }),
        );
      } else if (line.startsWith("- counter:")) {
        parseToolsWithData(line.slice(10)).forEach((c) =>
          tools.push({
            type: "counter",
            x: c.x,
            y: c.y,
            val: c.data ? parseInt(c.data) : null,
          }),
        );
      } else if (line.startsWith("- multicolor")) {
        parsed.multicolor = true;
      }
    } else if (section === "deck") {
      if (line.startsWith("- shuffle")) {
        // "- shuffle" or "- shuffle {id}"
        const rest = line.slice(9).trim();
        deckOps.push({ op: "shuffle", id: rest || null });
      } else if (line.startsWith("- flip")) {
        // "- flip" or "- flip {id}"
        const rest = line.slice(6).trim();
        deckOps.push({ op: "flip", id: rest || null });
      } else if (line.startsWith("- split ")) {
        // "- split {suit} {id}"
        const parts = line.slice(8).trim().split(/\s+/);
        const suitName = parts[0];
        const id = parts[1] || suitName;
        const suit = NAME_TO_SUIT[suitName];
        if (suit) deckOps.push({ op: "split", suit, id });
      } else if (line.startsWith("- move")) {
        // "- move (x, y)" or "- move {id} (x, y)"
        const rest = line.slice(6).trim();
        const m = rest.match(
          /^(?:([a-z][a-z0-9-]*)\s+)?\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/,
        );
        if (m) {
          deckOps.push({
            op: "move",
            id: m[1] || null,
            x: parseFloat(m[2]) * GRID,
            y: parseFloat(m[3]) * GRID,
          });
        }
      } else if (line.startsWith("- joker")) {
        // "- joker" or "- joker {id}"
        const rest = line.slice(7).trim();
        deckOps.push({ op: "joker", id: rest || null });
      } else if (line.startsWith("- remove ")) {
        // "- remove jokers" or "- remove {suit} {rank}..."
        const parts = line.slice(9).trim().split(/\s+/);
        const type = parts[0];
        if (type === "jokers") {
          deckOps.push({ op: "remove", type: "jokers" });
        } else if (NAME_TO_SUIT[type]) {
          deckOps.push({
            op: "remove",
            type: "suit",
            suit: NAME_TO_SUIT[type],
            ranks: parts.slice(1),
          });
        }
      } else if (line.startsWith("- collect ")) {
        // "- collect {rank} {deckname}"
        const parts = line.slice(10).trim().split(/\s+/);
        const rank = parts[0];
        const deckname = parts[1] || `rank-${rank}`;
        deckOps.push({ op: "collect", rank, deckname });
      }
    }
  }

  // If no explicit # title, use first description line as title
  let description = descLines.join("\n");
  if (!parsed.title && descLines.length > 0) {
    parsed.title = descLines[0];
    description = descLines.slice(1).join("\n").trim();
  }
  parsed.description = description;

  return parsed;
}

function parseToolsWithData(str) {
  const results = [];
  const re = /\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)(?:\s+([^()]+))?/g;
  for (const m of str.matchAll(re)) {
    results.push({
      x: parseFloat(m[1]) * GRID,
      y: parseFloat(m[2]) * GRID,
      data: m[3] ? m[3].trim() : null,
    });
  }
  return results;
}

function parseCoords(str) {
  const coords = [];
  for (const m of str.matchAll(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/g)) {
    coords.push({
      x: parseFloat(m[1]) * GRID,
      y: parseFloat(m[2]) * GRID,
    });
  }
  return coords;
}

// --- SERIALIZER ---

export function serializeSetup(title, log, multicolor = false) {
  const lines = [];

  lines.push(`# ${title || "Untitled"}`, "");

  // Description from note widgets recorded during the session
  const notes = log.filter((e) => e.type === "note" && e.text && e.text.trim());
  if (notes.length > 0) {
    lines.push("## Description");
    lines.push(notes[0].text.trim());
    lines.push("");
  }

  // Setup section — tools
  const placeholders = log.filter((e) => e.type === "placeholder");
  const counters = log.filter((e) => e.type === "counter");

  lines.push("## Setup");
  if (placeholders.length > 0) {
    const coords = placeholders
      .map((e) => {
        const c = `(${toUnit(e.x)}, ${toUnit(e.y)})`;
        return e.label ? `${c} ${e.label}` : c;
      })
      .join(" ");
    lines.push(`- placeholder: ${coords}`);
  }
  if (counters.length > 0) {
    const coords = counters
      .map((e) => {
        const c = `(${toUnit(e.x)}, ${toUnit(e.y)})`;
        return e.val !== undefined ? `${c} ${e.val}` : c;
      })
      .join(" ");
    lines.push(`- counter: ${coords}`);
  }
  if (multicolor) {
    lines.push("- multicolor");
  }

  // Deck section — ordered ops
  const deckOps = log.filter(
    (e) =>
      e.type === "shuffle" ||
      e.type === "flip" ||
      e.type === "split" ||
      e.type === "move" ||
      e.type === "joker" ||
      e.type === "collect" ||
      e.type === "remove-card",
  );
  lines.push("", "## Deck");
  for (const op of deckOps) {
    if (op.type === "shuffle") {
      lines.push(op.id ? `- shuffle ${op.id}` : "- shuffle");
    } else if (op.type === "flip") {
      lines.push(op.id ? `- flip ${op.id}` : "- flip");
    } else if (op.type === "split") {
      lines.push(`- split ${SUIT_TO_NAME[op.suit] || op.suit} ${op.id}`);
    } else if (op.type === "move") {
      const coord = `(${toUnit(op.x)}, ${toUnit(op.y)})`;
      lines.push(op.id ? `- move ${op.id} ${coord}` : `- move ${coord}`);
    } else if (op.type === "joker") {
      lines.push(op.id ? `- joker ${op.id}` : "- joker");
    } else if (op.type === "collect") {
      lines.push(`- collect ${op.rank} ${op.id}`);
    } else if (op.type === "remove-card") {
      const suitName = SUIT_TO_NAME[op.suit] || op.suit;
      const rankNum = { A: "1", J: "11", Q: "12", K: "13" }[op.rank] || op.rank;
      lines.push(`- remove ${suitName} ${rankNum}`);
    }
  }

  return lines.join("\n");
}

function toUnit(px) {
  return Math.round(px / GRID);
}

// --- APPLY ---

export function applySetup(app, parsed) {
  // Apply setup flags
  app.setMulticolor(!!parsed.multicolor);

  // Stop any active recording first
  if (app.recording) {
    app.recording = false;
    app.recordingLog = [];
    app.recordingStacks = {};
  }

  // Full deck reset: removes all items (cards, jokers, tools from any previous game)
  // and reinstates a clean standard 52-card deck.
  app.resetToFreshDeck();

  // Spawn tools
  for (const tool of parsed.tools) {
    if (tool.type === "placeholder") {
      _spawnPhantomAt(app, tool.x, tool.y, tool.label);
    } else if (tool.type === "counter") {
      _spawnCounterAt(app, tool.x, tool.y, tool.val);
    }
  }

  // Spawn description note (top-left area of table)
  if (parsed.description) {
    const noteLabel = parsed.title ? `${parsed.title} Rules` : "Rules";
    _spawnNoteAt(app, parsed.description, 5, -3, noteLabel, true);
  }

  // Apply deck ops — maintain a stacks registry: { main: cardArray, [id]: cardArray }
  const stacks = {
    main: app.items.filter((i) => i.type === "card"),
  };

  for (const op of parsed.deckOps) {
    const targetId = op.id || "main";
    const targetCards = stacks[targetId] || stacks.main;

    switch (op.op) {
      case "split": {
        // Split is always from main deck
        const src = stacks.main;
        app.extractSuitFromStack(op.suit, src);
        const extCards = src.filter((c) => c.suit === op.suit);
        stacks[op.id] = extCards;
        stacks.main = src.filter((c) => c.suit !== op.suit);
        break;
      }
      case "move": {
        targetCards.forEach((c) => {
          c.x = app.snap(op.x);
          c.y = app.snap(op.y);
        });
        app.applyItemTransforms();
        break;
      }
      case "shuffle": {
        _shuffleImmediate(app, targetCards);
        break;
      }
      case "flip": {
        targetCards.forEach((c) => {
          c.isFaceUp = !c.isFaceUp;
          c.z = ++app.maxZ;
        });
        app.applyItemTransforms();
        break;
      }
      case "joker": {
        // Delegate to app (recording is already off at this point)
        app.addJokerToStack(targetCards);
        // Keep the local stacks array in sync
        targetCards.push(app.items[app.items.length - 1]);
        break;
      }
      case "collect": {
        // Take all cards of a given rank from the main deck into a named sub-deck
        const src = stacks.main;
        if (!src) break;
        const matching = src.filter((c) => c.rank === op.rank);
        if (matching.length === 0) break;

        if (!stacks[op.deckname]) {
          stacks[op.deckname] = [...matching];
        } else {
          stacks[op.deckname].push(...matching);
        }
        stacks.main = src.filter((c) => c.rank !== op.rank);

        // Stack them at the first card's current position
        const refCard = stacks[op.deckname][0];
        matching.forEach((c) => {
          c.x = app.snap(refCard.x);
          c.y = app.snap(refCard.y);
          c.z = ++app.maxZ;
        });
        app.applyItemTransforms();
        break;
      }
      case "remove": {
        const targetCards = stacks[targetId];
        if (!targetCards) break;

        let toRemove = [];
        if (op.type === "jokers") {
          toRemove = targetCards.filter((c) => c.isJoker);
        } else if (op.type === "suit") {
          const norm = { 1: "A", 11: "J", 12: "Q", 13: "K" };
          const ranks = op.ranks.map((r) => norm[r] || r);
          toRemove = targetCards.filter(
            (c) => c.suit === op.suit && ranks.includes(c.rank),
          );
        }

        toRemove.forEach((c) => {
          const idx = targetCards.indexOf(c);
          if (idx !== -1) targetCards.splice(idx, 1);
          c.el.remove();
          app.items = app.items.filter((i) => i !== c);
        });
        break;
      }
    }
  }

  // Auto-center camera on the new layout
  app.centerOnLayout();
}

// Shuffle without animation — for setup playback
function _shuffleImmediate(app, cards) {
  cards.forEach((c) => (c._rand = Math.random()));
  cards.sort((a, b) => a._rand - b._rand);
  cards.forEach((c) => {
    c.z = ++app.maxZ;
    delete c._rand;
  });
  app.applyItemTransforms();
}

// --- SPAWN HELPERS ---

function _spawnPhantomAt(app, x, y, label) {
  const el = document.createElement("div");
  el.className = "phantom-card";
  if (label) {
    el.innerHTML = `<div class="phantom-label">${label}</div>`;
  }
  app.table.appendChild(el);
  const item = {
    id: `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "phantom",
    el,
    x,
    y,
    rot: 0,
    z: 10,
    label,
  };
  app.items.push(item);
  app.applyItemTransforms();
}

function _spawnCounterAt(app, x, y, val) {
  const el = document.createElement("div");
  el.className = "tool-item counter-widget";
  el.innerHTML = `
        <div class="drag-handle ph-light ph-dots-six-vertical"></div>
        <div class="counter-content">
            <button class="counter-btn ph-light ph-minus-circle" onclick="this.nextElementSibling.innerText=parseInt(this.nextElementSibling.innerText)-1"></button>
            <span class="val">${val !== null && val !== undefined ? val : 20}</span>
            <button class="counter-btn ph-light ph-plus-circle" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1"></button>
        </div>
    `;
  app.table.appendChild(el);
  const item = {
    id: `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "counter",
    el,
    x,
    y,
    rot: 0,
    z: ++app.maxZ,
    val,
  };
  app.items.push(item);
  app.applyItemTransforms();
}

function _spawnNoteAt(app, text, gridX, gridY, label = "Note", collapsed = false) {
  const el = app._makeNoteWidget(text, label, collapsed);
  app.table.appendChild(el);

  const item = {
    id: `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "note",
    el,
    x: gridX * GRID,
    y: gridY * GRID,
    rot: 0,
    z: ++app.maxZ,
  };
  app.items.push(item);
  app.applyItemTransforms();
}
