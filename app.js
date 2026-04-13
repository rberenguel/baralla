import { parseSetup, applySetup, serializeSetup } from "./setup.js";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];
const SUIT_NAMES = {
  "♠": "spades",
  "♥": "hearts",
  "♣": "clubs",
  "♦": "diamonds",
};
const SUIT_ICONS = {
  "♠": "ph-spade",
  "♥": "ph-heart",
  "♣": "ph-club",
  "♦": "ph-diamond",
};

class App {
  constructor() {
    this.table = document.getElementById("table");
    this.items = [];
    this.maxZ = 100;

    this.panX = window.innerWidth / 2;
    this.panY = window.innerHeight / 2;
    this.zoomLevel = 1;

    this.activePointers = new Map();
    this.dragMode = null;
    this.dragTargets = [];

    this.longPressTimer = null;
    this.stackLifted = false;

    this.currentIntent = null;
    this.intentTarget = null;

    this.pointerDownPos = { x: 0, y: 0 };
    this.hasMoved = false;
    this.startAngle = null;
    this.startRots = [];
    this.startPinchDist = null;

    this.radialMenuOpen = false;
    this.radialMenuData = null;
    this.radialMenuType = null;

    // Recording state
    this.recording = false;
    this.recordingLog = [];
    this.recordingStacks = {}; // { main: Set<cardRef>, [id]: Set<cardRef> }

    this.currentSetupMarkdown = null;
    this.multicolor = false;

    this.initDeck();
    this.setupEvents();
    this.updateTransform();
    this.initSetupModal();
    this.initLauncher();

    this.checkUrlForGame();
  }

  snap(value) {
    const GRID_SIZE = 70 / 4; // 17.5px (1/4 of --card-w)
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }

  initDeck() {
    SUITS.forEach((suit) => {
      RANKS.forEach((rank) => {
        let isRed = suit === "♥" || suit === "♦";
        let id = `card-${suit}-${rank}`;

        let el = document.createElement("div");
        let suitClass = `suit-${SUIT_NAMES[suit]}`;
        el.className = `card face-down ${isRed ? "red" : "black"} ${suitClass}`;
        let icon = SUIT_ICONS[suit];
        el.innerHTML = `
                    <div class="card-back"></div>
                    <div class="card-face">
                        <div class="card-corner"><i class="ph-light ${icon}"></i> ${rank}</div>
                        <div class="card-center">${rank}</div>
                        <div class="card-corner bottom">${rank} <i class="ph-light ${icon}"></i></div>
                    </div>
                `;

        this.table.appendChild(el);

        let cardObj = {
          id,
          type: "card",
          el,
          suit,
          rank,
          x: 0,
          y: 0,
          rot: 0,
          z: ++this.maxZ,
          isFaceUp: false,
        };
        this.items.push(cardObj);
      });
    });
    this.actionGatherAll();
  }

  resetToFreshDeck() {
    // Wipe every item (cards, jokers, tools) from the DOM and internal state,
    // then rebuild a clean standard 52-card deck.
    this.items.forEach((item) => item.el.remove());
    this.items = [];
    this.maxZ = 100;
    this.initDeck();
  }

  applyItemTransforms() {
    const noteCounter = Math.min(1, 2 / (this.zoomLevel + 1));
    this.items.forEach((item) => {
      if (!item._tempTransform) {
        if (item.type === "note") {
          item.el.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rot}deg) scale(${noteCounter.toFixed(4)})`;
        } else {
          let rotY = item.type === "card" && !item.isFaceUp ? "180deg" : "0deg";
          item.el.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rot}deg) rotateY(${rotY})`;
        }
      }
      item.el.style.zIndex = item.z;
    });
  }

  updateTransform() {
    this.table.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    if (this._lastNoteZoom !== this.zoomLevel) {
      this._lastNoteZoom = this.zoomLevel;
      const noteCounter = Math.min(1, 2 / (this.zoomLevel + 1));
      this.items.forEach((item) => {
        if (item.type === "note" && !item._tempTransform) {
          item.el.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rot}deg) scale(${noteCounter.toFixed(4)})`;
        }
      });
    }
  }

  centerOnLayout() {
    const GRID = 70 / 4;
    const CARD_W = 70;
    const CARD_H = 100;
    const PADDING = 0.82; // fraction of viewport to fill

    const playArea = this.items.filter(
      (i) => i.type === "card" || i.type === "phantom",
    );
    const notes = this.items.filter((i) => i.type === "note");

    if (playArea.length === 0) return;

    // Calculate bounding box of play area
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;

    playArea.forEach((i) => {
      minX = Math.min(minX, i.x);
      maxX = Math.max(maxX, i.x);
      minY = Math.min(minY, i.y);
      maxY = Math.max(maxY, i.y);
    });

    // Include card dimensions so the full card extent is considered
    const layoutW = maxX - minX + CARD_W;
    const layoutH = maxY - minY + CARD_H;

    // Fit to viewport — clamp so we never zoom in past 2× or out past 0.3×
    const zoomX = (window.innerWidth * PADDING) / layoutW;
    const zoomY = (window.innerHeight * PADDING) / layoutH;
    this.zoomLevel = Math.min(Math.max(Math.min(zoomX, zoomY), 0.3), 2);

    // Reposition notes centered above the top card row
    const NOTE_W = 450;
    const noteCenterX = (minX + maxX + CARD_W) / 2;
    notes.forEach((note, idx) => {
      note.x = noteCenterX - NOTE_W / 2;
      note.y = minY - 36 - idx * 28; // stack upward if multiple, 28px per collapsed bar
    });

    // Center camera on geometric center of the bounding box
    const cx = (minX + maxX) / 2 + CARD_W / 2;
    const cy = (minY + maxY) / 2 + CARD_H / 2;
    this.panX = window.innerWidth / 2 - cx * this.zoomLevel;
    this.panY = window.innerHeight / 2 - cy * this.zoomLevel;

    this.applyItemTransforms();
    this.updateTransform();
  }

  getStackAt(x, y) {
    return this.items
      .filter(
        (i) =>
          i.type === "card" && Math.abs(i.x - x) < 2 && Math.abs(i.y - y) < 2,
      )
      .sort((a, b) => a.z - b.z);
  }

  setupEvents() {
    window.addEventListener("pointerdown", this.onPointerDown.bind(this));
    window.addEventListener("pointermove", this.onPointerMove.bind(this));
    window.addEventListener("pointerup", this.onPointerUp.bind(this));
    window.addEventListener("pointercancel", this.onPointerUp.bind(this));
    window.addEventListener("wheel", this.onWheel.bind(this), {
      passive: false,
    });
  }

  getPointerLocal(e) {
    return {
      x: (e.clientX - this.panX) / this.zoomLevel,
      y: (e.clientY - this.panY) / this.zoomLevel,
    };
  }

  onWheel(e) {
    if (!this._setupModal.classList.contains("hidden")) return;
    e.preventDefault();
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100);
    const newZoom = Math.min(Math.max(this.zoomLevel * factor, 0.1), 5);

    // Zoom toward cursor
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoomLevel);
    this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoomLevel);

    this.zoomLevel = newZoom;
    this.updateTransform();
  }

  onPointerDown(e) {
    if (this.radialMenuOpen) {
      if (!e.target.closest(".radial-item")) {
        this.hideRadialMenu();
      }
      return;
    }

    if (e.target.tagName === "BUTTON" || e.target.tagName === "TEXTAREA")
      return;

    this.activePointers.set(e.pointerId, e);

    if (this.activePointers.size === 1) {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.hasMoved = false;
      this.stackLifted = false;
    }

    if (this.activePointers.size > 1) {
      clearTimeout(this.longPressTimer);
      this.startAngle = null;
      this.startPinchDist = null;
    }

    let cardEl = e.target.closest(".card");
    let toolEl =
      e.target.closest(".tool-item") || e.target.closest(".phantom-card");
    let itemEl = cardEl || toolEl;

    // TAPPED AN ITEM
    if (itemEl && this.activePointers.size === 1) {
      let item = this.items.find((i) => i.el === itemEl);
      if (!item) return;

      this.dragMode = "item";
      this.dragTargets = [item];

      item.z = ++this.maxZ;
      item.el.classList.add("dragging");

      let local = this.getPointerLocal(e);
      item._offX = item.x - local.x;
      item._offY = item.y - local.y;

      if (item.type === "card") {
        this.longPressTimer = setTimeout(() => {
          let stack = this.getStackAt(item.x, item.y);
          if (stack.length > 1) {
            this.dragMode = "stack";
            this.dragTargets = stack;
            this.stackLifted = true;

            stack.forEach((c) => {
              c.z = ++this.maxZ;
              c.el.classList.add("dragging");
              c._offX = c.x - local.x;
              c._offY = c.y - local.y;
            });
            if (navigator.vibrate) navigator.vibrate(50);
          } else if (!this.hasMoved) {
            this.dragMode = "card-menu-wait";
            if (navigator.vibrate) navigator.vibrate(50);
          }
        }, 400);
      } else if (
        item.type === "note" ||
        item.type === "counter" ||
        item.type === "phantom"
      ) {
        this.longPressTimer = setTimeout(() => {
          if (!this.hasMoved) {
            this.dragMode = "tool-menu-wait";
            if (navigator.vibrate) navigator.vibrate(50);
          }
        }, 400);
      }
      this.applyItemTransforms();
    }
    // TAPPED EMPTY TABLE
    else if (!itemEl && this.activePointers.size === 1) {
      this.dragMode = "pan";
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;

      this.longPressTimer = setTimeout(() => {
        if (!this.hasMoved) {
          this.dragMode = "table-menu-wait";
          if (navigator.vibrate) navigator.vibrate(50);
        }
      }, 400);
    }
  }

  onPointerMove(e) {
    if (!this.activePointers.has(e.pointerId)) return;
    this.activePointers.set(e.pointerId, e);

    if (this.activePointers.size === 1 && !this.hasMoved) {
      let dist = Math.hypot(
        e.clientX - this.pointerDownPos.x,
        e.clientY - this.pointerDownPos.y,
      );
      if (dist > 5) {
        this.hasMoved = true;
        clearTimeout(this.longPressTimer);

        // Revert to dragging if we started moving after long press triggered but before releasing
        if (this.dragMode === "table-menu-wait") this.dragMode = "pan";
        if (this.dragMode === "tool-menu-wait") this.dragMode = "item";
        if (this.dragMode === "card-menu-wait") this.dragMode = "item";
      }
    }

    if (this.activePointers.size === 2) {
      let pts = Array.from(this.activePointers.values());

      if (this.dragTargets.length > 0 && this.dragTargets[0].type === "card") {
        this.dragMode = "rotate";
        let angle =
          (Math.atan2(
            pts[1].clientY - pts[0].clientY,
            pts[1].clientX - pts[0].clientX,
          ) *
            180) /
          Math.PI;

        if (this.startAngle === null) {
          this.startAngle = angle;
          this.startRots = this.dragTargets.map((t) => t.rot);
        } else {
          let delta = angle - this.startAngle;
          this.dragTargets.forEach((t, i) => {
            let newRot = this.startRots[i] + delta;
            t.rot = Math.round(newRot / 45) * 45;
          });
          this.applyItemTransforms();
        }
        return;
      } else {
        let dist = Math.hypot(
          pts[1].clientX - pts[0].clientX,
          pts[1].clientY - pts[0].clientY,
        );
        if (this.startPinchDist === null) {
          this.startPinchDist = dist;
          this.startZoom = this.zoomLevel;
          this.pinchCenterX = (pts[0].clientX + pts[1].clientX) / 2;
          this.pinchCenterY = (pts[0].clientY + pts[1].clientY) / 2;
        } else {
          let factor = dist / this.startPinchDist;
          let newZoom = Math.max(0.3, Math.min(this.startZoom * factor, 3));
          let zoomRatio = newZoom / this.zoomLevel;

          this.panX =
            this.pinchCenterX - (this.pinchCenterX - this.panX) * zoomRatio;
          this.panY =
            this.pinchCenterY - (this.pinchCenterY - this.panY) * zoomRatio;
          this.zoomLevel = newZoom;
          this.updateTransform();
        }
        return;
      }
    }

    if (this.dragMode === "pan" && this.activePointers.size === 1) {
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      this.updateTransform();
    } else if (
      (this.dragMode === "item" || this.dragMode === "stack") &&
      this.activePointers.size === 1
    ) {
      let local = this.getPointerLocal(e);
      this.dragTargets.forEach((item) => {
        if (!item._tempTransform) {
          item.x = this.snap(local.x + item._offX);
          item.y = this.snap(local.y + item._offY);
        }
      });
      this.applyItemTransforms();
      this.updateDragIntent();
    }
  }

  updateDragIntent() {
    let intent = null;
    let intentTarget = null;

    if (
      (this.dragMode === "item" || this.dragMode === "stack") &&
      this.dragTargets.length > 0
    ) {
      let leadItem = this.dragTargets[0];

      for (let i = this.items.length - 1; i >= 0; i--) {
        let target = this.items[i];
        if (target.type !== "card" || this.dragTargets.includes(target))
          continue;

        let dx = leadItem.x - target.x;
        let dy = leadItem.y - target.y;
        let dist = Math.hypot(dx, dy);

        // Prioritize "fan" if dragged downwards to prevent accidental stack absorption
        if (Math.abs(dx) < 25 && dy >= 10 && dy < 80) {
          intent = "fan";
          intentTarget = target;
          break;
        } else if (dist < 15) {
          intent = "top";
          intentTarget = target;
          break;
        } else if (
          dist >= 15 &&
          dist < 70 &&
          leadItem.isFaceUp === target.isFaceUp
        ) {
          intent = "bottom";
          intentTarget = target;
          break;
        }
      }
    }

    this.currentIntent = intent;
    this.intentTarget = intentTarget;

    // For the bottom indicator, show it on the visually top card of the target
    // stack, not just whichever card the distance check happened to hit first
    // (items are in insertion order, not z-order).
    let indicatorCard = null;
    if (intent === "bottom" && intentTarget) {
      const stack = this.getStackAt(intentTarget.x, intentTarget.y);
      indicatorCard = stack[stack.length - 1]; // getStackAt sorts ascending by z
    }

    this.items.forEach((item) => {
      if (item.type === "card") {
        if (item === indicatorCard) {
          item.el.classList.add("preview-bottom");
        } else {
          item.el.classList.remove("preview-bottom");
        }
      }
    });
  }

  onPointerUp(e) {
    this.activePointers.delete(e.pointerId);
    clearTimeout(this.longPressTimer);

    if (this.activePointers.size < 2) {
      this.startAngle = null;
      this.startPinchDist = null;
    }

    /// Catch intents for radial menus
    let openedMenu = false;
    if (this.dragMode === "table-menu-wait" && !this.hasMoved) {
      this.showRadialMenu(e.clientX, e.clientY, "table");
      openedMenu = true;
    } else if (this.dragMode === "tool-menu-wait" && !this.hasMoved) {
      this.showRadialMenu(e.clientX, e.clientY, "tool", this.dragTargets[0]);
      openedMenu = true;
    } else if (this.dragMode === "card-menu-wait" && !this.hasMoved) {
      this.showRadialMenu(e.clientX, e.clientY, "card", this.dragTargets[0]);
      openedMenu = true;
      this.dragTargets.forEach((item) => {
        item.el.classList.remove("dragging");
        delete item._offX;
        delete item._offY;
      });
      this.dragTargets = [];
      this.applyItemTransforms();
    } else if (
      this.stackLifted &&
      !this.hasMoved &&
      this.dragMode === "stack"
    ) {
      this.showRadialMenu(e.clientX, e.clientY, "stack", this.dragTargets);
      openedMenu = true;
    } else if (
      !this.hasMoved &&
      this.dragMode === "item" &&
      this.dragTargets.length > 0
    ) {
      // Tapped a single item without moving it
      let item = this.dragTargets[0];
      if (item.type === "card") {
        item.isFaceUp = !item.isFaceUp;
        this.applyItemTransforms();
        openedMenu = true; // Use this flag to safely bypass the drag-drop grouping logic below
      }
    }

    if (
      (this.dragMode === "item" ||
        this.dragMode === "stack" ||
        this.dragMode === "rotate") &&
      this.dragTargets.length > 0
    ) {
      let leadItem = this.dragTargets[0];

      if (
        this.dragMode !== "rotate" &&
        !openedMenu &&
        leadItem.type === "card"
      ) {
        if (this.currentIntent === "top" || this.currentIntent === "fan") {
          let offsetX = this.intentTarget.x - leadItem.x;
          let offsetY =
            this.currentIntent === "fan"
              ? this.intentTarget.y + 25 - leadItem.y
              : this.intentTarget.y - leadItem.y;

          this.dragTargets.forEach((t) => {
            t.x = this.snap(t.x + offsetX);
            t.y = this.snap(t.y + offsetY);
            t.rot = this.intentTarget.rot;
          });
        } else if (this.currentIntent === "bottom") {
          let targetStack = this.getStackAt(
            this.intentTarget.x,
            this.intentTarget.y,
          );
          let minZ =
            targetStack.length > 0 ? targetStack[0].z : this.intentTarget.z;

          let offsetX = this.intentTarget.x - leadItem.x;
          let offsetY = this.intentTarget.y - leadItem.y;

          let zBase = minZ - this.dragTargets.length - 1;

          this.dragTargets.forEach((t, i) => {
            t.x = this.snap(t.x + offsetX);
            t.y = this.snap(t.y + offsetY);
            t.rot = this.intentTarget.rot;
            t.z = zBase + i;
          });
        }
      }

      this.dragTargets.forEach((item) => {
        item.el.classList.remove("dragging");
        delete item._offX;
        delete item._offY;
      });

      this.currentIntent = null;
      this.intentTarget = null;
      this.items.forEach(
        (i) => i.el && i.el.classList.remove("preview-bottom"),
      );

      this.applyItemTransforms();

      // Record full-stack move during recording
      if (
        this.recording &&
        leadItem.type === "card" &&
        this.dragMode !== "rotate" &&
        !openedMenu
      ) {
        const draggedSet = new Set(this.dragTargets);
        for (const [id, stackSet] of Object.entries(this.recordingStacks)) {
          if (this._setsEqual(draggedSet, stackSet)) {
            const rep = this.dragTargets[0];
            this.recordingLog.push({
              type: "move",
              id: id === "main" ? null : id,
              x: rep.x,
              y: rep.y,
            });
            break;
          }
        }
      }
    }

    this.stackLifted = false;
    if (this.activePointers.size === 0) {
      this.dragMode = null;
      this.dragTargets = [];
    }
  }

  // --- RADIAL MENU CONTROLLER ---

  showRadialMenu(clientX, clientY, type, targetData = null) {
    this.radialMenuType = type;
    this.radialMenuData = targetData;

    const menu = document.getElementById("radial-menu");
    menu.innerHTML = "";
    let actions = [];

    if (type === "stack") {
      actions = [
        {
          icon: "ph-shuffle",
          handler: () => this.actionStackShuffle(this.radialMenuData),
        },
        {
          icon: "ph-device-rotate",
          handler: () => this.actionStackFlip(this.radialMenuData),
        },
        {
          icon: "ph-tray-arrow-down",
          handler: () => this.actionToBottom(this.radialMenuData),
        },
        {
          icon: "ph-spade",
          class: "black-suit",
          handler: () => this.extractSuitFromStack("♠", this.radialMenuData),
        },
        {
          icon: "ph-heart",
          class: "red-suit",
          handler: () => this.extractSuitFromStack("♥", this.radialMenuData),
        },
        {
          icon: "ph-club",
          class: "black-suit",
          handler: () => this.extractSuitFromStack("♣", this.radialMenuData),
        },
        {
          icon: "ph-diamond",
          class: "red-suit",
          handler: () => this.extractSuitFromStack("♦", this.radialMenuData),
        },
        {
          icon: "ph-crown",
          handler: () => this.addJokerToStack(this.radialMenuData),
        },
      ];
    } else if (type === "table") {
      actions = [
        { icon: "ph-arrows-in", handler: () => this.actionGatherAll() },
        {
          icon: "ph-dice-five",
          handler: () => this.addCounter(clientX, clientY),
        },
        {
          icon: "ph-note-pencil",
          handler: () => this.addNote(clientX, clientY),
        },
        {
          icon: "ph-bounding-box",
          handler: () => this.addPhantom(clientX, clientY),
        },
        { icon: "ph-folder-open", handler: () => this.openSetupModal("load", this.currentSetupMarkdown || "") },
        {
          icon: this.recording ? "ph-stop-circle" : "ph-record",
          class: this.recording ? "recording" : "",
          handler: () =>
            this.recording ? this.stopRecording() : this.startRecording(),
        },
      ];
    } else if (type === "tool") {
      actions = [
        {
          icon: "ph-trash",
          handler: () => this.actionDeleteTool(this.radialMenuData),
        },
      ];
    } else if (type === "card") {
      const card = targetData;
      actions = [
        {
          icon: "ph-minus-circle",
          handler: () => this.actionRemoveCard(this.radialMenuData),
        },
        {
          label: card.isJoker ? "JKR" : card.rank,
          handler: () => this.actionCollectRank(this.radialMenuData),
        },
      ];
    }

    const radius = actions.length <= 1 ? 0 : actions.length > 4 ? 70 : 60;

    actions.forEach((act, i) => {
      const el = document.createElement("div");
      el.className = "radial-item " + (act.class || "");
      el.innerHTML = act.label
        ? `<span class="radial-label">${act.label}</span>`
        : `<i class="ph-light ${act.icon}"></i>`;

      let angle = 0;
      if (actions.length > 1) {
        // Offset angle to start from top
        angle = -0.5 * Math.PI + ((2 * Math.PI) / actions.length) * i;
      }

      el.style.left = `calc(50% + ${radius * Math.cos(angle)}px)`;
      el.style.top = `calc(50% + ${radius * Math.sin(angle)}px)`;

      el.onpointerdown = (e) => {
        e.stopPropagation();
        e.preventDefault();
        act.handler();
        this.hideRadialMenu();
      };
      menu.appendChild(el);
    });

    menu.style.left = clientX + "px";
    menu.style.top = clientY + "px";
    menu.classList.add("show");
    this.radialMenuOpen = true;
  }

  hideRadialMenu() {
    const menu = document.getElementById("radial-menu");
    menu.classList.remove("show");
    this.radialMenuOpen = false;
    this.radialMenuData = null;
    this.radialMenuType = null;
  }

  // --- ACTIONS ---

  actionToBottom(stack) {
    if (!stack || stack.length === 0) return;
    let targetCard = stack[stack.length - 1]; // the top-most card
    let minZ = stack[0].z;
    targetCard.z = minZ - 1;
    this.applyItemTransforms();
  }

  actionRemoveCard(card) {
    if (!card) return;
    if (this.recording) {
      this.recordingLog.push({ type: "remove-card", suit: card.suit, rank: card.rank });
      for (const sset of Object.values(this.recordingStacks)) {
        sset.delete(card);
      }
    }
    card.el.remove();
    this.items = this.items.filter((i) => i !== card);
  }

  actionCollectRank(card) {
    if (!card) return;
    const rank = card.rank;
    const allSameRank = this.items.filter((i) => i.type === "card" && i.rank === rank);
    if (allSameRank.length === 0) return;
    allSameRank.forEach((c) => {
      c.x = card.x;
      c.y = card.y;
      c.z = ++this.maxZ;
    });
    if (navigator.vibrate) navigator.vibrate(30);
    if (this.recording) {
      const id = this._autoStackId(`rank-${rank}`);
      this.recordingStacks[id] = new Set(allSameRank);
      for (const [sid, sset] of Object.entries(this.recordingStacks)) {
        if (sid !== id) allSameRank.forEach((c) => sset.delete(c));
      }
      this.recordingLog.push({ type: "collect", rank, id });
    }
    this.applyItemTransforms();
  }

  actionStackFlip(stack) {
    if (!stack || stack.length === 0) return;
    if (this.recording) {
      const id = this._stackIdForCards(stack);
      this.recordingLog.push({ type: "flip", id });
    }
    stack.reverse().forEach((c) => {
      c.z = ++this.maxZ;
      c.isFaceUp = !c.isFaceUp;
    });
    this.applyItemTransforms();
  }

  actionDeleteTool(tool) {
    if (!tool) return;
    tool.el.remove();
    this.items = this.items.filter((i) => i !== tool);
  }

  extractSuitFromStack(targetSuit, stack) {
    let extCards = stack.filter((c) => c.suit === targetSuit);
    if (extCards.length === 0) return;
    if (this.recording) {
      const suitName = SUIT_NAMES[targetSuit] || targetSuit;
      const id = this._autoStackId(suitName);
      // Update registry: remove from main, create new stack
      if (this.recordingStacks.main) {
        extCards.forEach((c) => this.recordingStacks.main.delete(c));
      }
      this.recordingStacks[id] = new Set(extCards);
      this.recordingLog.push({ type: "split", suit: targetSuit, id });
    }

    let leadItem = stack[0];
    let newX = this.snap(leadItem.x + 90);
    let newY = this.snap(leadItem.y + 20);

    extCards.forEach((c) => {
      c.x = newX;
      c.y = newY;
      c.z = ++this.maxZ;
      c.rot = leadItem.rot;
    });

    if (navigator.vibrate) navigator.vibrate(30);
    this.applyItemTransforms();
  }

  addJokerToStack(stack) {
    if (!stack || stack.length === 0) return;
    const leadItem = stack[stack.length - 1]; // place on top

    const el = document.createElement("div");
    el.className = "card joker";
    el.innerHTML = `
            <div class="card-back"></div>
            <div class="card-face">
                <div class="card-corner"><i class="ph-light ph-crown"></i> JKR</div>
                <div class="card-center"><i class="ph-light ph-crown"></i></div>
                <div class="card-corner bottom">JKR <i class="ph-light ph-crown"></i></div>
            </div>
        `;
    this.table.appendChild(el);

    const jokerObj = {
      id: `joker-${Date.now()}`,
      type: "card",
      el,
      suit: null,
      rank: "JKR",
      isJoker: true,
      x: leadItem.x,
      y: leadItem.y,
      rot: leadItem.rot,
      z: ++this.maxZ,
      isFaceUp: false,
    };
    this.items.push(jokerObj);

    if (this.recording) {
      const id = this._stackIdForCards(stack);
      this.recordingLog.push({ type: "joker", id });
      // Add joker to registry so future ops can find the full stack
      const regKey = id === null ? "main" : id;
      if (this.recordingStacks[regKey]) {
        this.recordingStacks[regKey].add(jokerObj);
      }
    }

    if (navigator.vibrate) navigator.vibrate(20);
    this.applyItemTransforms();
  }

  actionStackShuffle(stack) {
    if (!stack || stack.length <= 1) return;
    if (this.recording) {
      const id = this._stackIdForCards(stack);
      this.recordingLog.push({ type: "shuffle", id });
    }

    stack.forEach((c) => {
      c._tempTransform = true;
      c.el.style.transition = "transform 0.15s ease-out";
      let rX = (Math.random() - 0.5) * 20;
      let rY = (Math.random() - 0.5) * 20;
      let rRot = (Math.random() - 0.5) * 15;

      let rotY = c.type === "card" && !c.isFaceUp ? "180deg" : "0deg";
      c.el.style.transform = `translate(${c.x + rX}px, ${c.y + rY}px) rotate(${c.rot + rRot}deg) rotateY(${rotY})`;
    });

    setTimeout(() => {
      stack.forEach((c) => (c._rand = Math.random()));
      stack.sort((a, b) => a._rand - b._rand);
      stack.forEach((c) => {
        c.z = ++this.maxZ;
        delete c._rand;
        delete c._tempTransform;
        c.el.style.transition = "box-shadow 0.1s, border 0.1s";
      });

      if (this.dragMode === "stack" && this.dragTargets.length > 0) {
        this.dragTargets.sort((a, b) => a.z - b.z);
      }

      this.applyItemTransforms();
      if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
    }, 150);
  }

  actionGatherAll() {
    // Reset pan and zoom to initial state so the deck is always centered and visible
    this.panX = window.innerWidth / 2;
    this.panY = window.innerHeight / 2;
    this.zoomLevel = 1;
    this.updateTransform();

    let cxL = this.snap(-35);
    let cyL = this.snap(-50);

    let cards = this.items.filter((i) => i.type === "card");
    cards.forEach((c) => {
      c.x = cxL;
      c.y = cyL;
      c.rot = 0;
      c.isFaceUp = false;
      c.z = ++this.maxZ;
    });
    this.applyItemTransforms();
  }

  addCounter(clientX, clientY) {
    let el = document.createElement("div");
    el.className = "tool-item counter-widget";
    el.innerHTML = `
            <div class="drag-handle">≡</div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="counter-btn" onclick="this.nextElementSibling.innerText=parseInt(this.nextElementSibling.innerText)-1">-</button>
                <span class="val">20</span>
                <button class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button>
            </div>
        `;
    this.spawnTool(el, "counter", clientX, clientY);
    if (this.recording) {
      // Store reference — position resolved at stop time to capture any drag
      this.recordingLog.push({
        type: "counter",
        _item: this.items[this.items.length - 1],
      });
    }
  }

  addNote(clientX, clientY) {
    const el = this._makeNoteWidget("");
    this.spawnTool(el, "note", clientX, clientY);
    if (this.recording) {
      // Store reference — text and position resolved at stop time
      this.recordingLog.push({
        type: "note",
        _item: this.items[this.items.length - 1],
      });
    }
  }

  _makeNoteWidget(initialText, label = "Note", collapsed = false) {
    const el = document.createElement("div");
    el.className = "tool-item note-widget";

    // --- Drag handle with collapse toggle ---
    const handle = document.createElement("div");
    handle.className = "drag-handle";

    const handleLabel = document.createElement("span");
    handleLabel.className = "note-title";
    handleLabel.textContent = `≡ ${label}`;

    const collapseBtn = document.createElement("button");
    collapseBtn.className = "note-collapse-btn";
    collapseBtn.title = "Collapse / expand";
    collapseBtn.textContent = collapsed ? "▸" : "▾";
    if (collapsed) el.classList.add("note-collapsed");
    collapseBtn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      el.classList.toggle("note-collapsed");
      collapseBtn.textContent = el.classList.contains("note-collapsed")
        ? "▸"
        : "▾";
    });

    handle.appendChild(handleLabel);
    handle.appendChild(collapseBtn);

    // --- Rendered markdown view ---
    const preview = document.createElement("div");
    preview.className = "note-preview";

    // --- Raw source textarea (hidden while previewing) ---
    const textarea = document.createElement("textarea");
    textarea.className = "note-source";
    textarea.placeholder = "Write notes (markdown supported)…";
    textarea.value = initialText;

    const render = () => {
      const md = textarea.value.trim();
      if (md) {
        preview.innerHTML = window.marked.parse(md);
        // Per-heading collapse: clicking a heading toggles its following content
        Array.from(preview.children).forEach((child) => {
          if (/^H[123]$/.test(child.tagName) && !child._collapseWired) {
            child._collapseWired = true;
            child.classList.add("collapsible-heading");
            child.addEventListener("click", () => {
              child.classList.toggle("heading-collapsed");
              const collapsed = child.classList.contains("heading-collapsed");
              let sib = child.nextElementSibling;
              while (sib && !/^H[123]$/.test(sib.tagName)) {
                sib.style.display = collapsed ? "none" : "";
                sib = sib.nextElementSibling;
              }
            });
          }
        });
      } else {
        preview.innerHTML =
          '<span class="note-empty">Double-tap to edit…</span>';
      }
    };

    render();

    const startEdit = (e) => {
      e.stopPropagation();
      textarea.style.display = "block";
      preview.style.display = "none";
      textarea.focus();
    };

    preview.addEventListener("dblclick", startEdit);
    preview.addEventListener(
      "touchend",
      (() => {
        let last = 0;
        return (e) => {
          const now = Date.now();
          if (now - last < 350) startEdit(e);
          last = now;
        };
      })(),
    );

    textarea.addEventListener("blur", () => {
      render();
      textarea.style.display = "none";
      preview.style.display = "";
    });

    textarea.addEventListener("pointerdown", (e) => e.stopPropagation());

    el.appendChild(handle);
    el.appendChild(preview);
    el.appendChild(textarea);

    return el;
  }

  addPhantom(clientX, clientY) {
    let el = document.createElement("div");
    el.className = "phantom-card";
    this.spawnTool(el, "phantom", clientX, clientY);

    // Push it down to z=10 so the deck starts naturally above it
    let item = this.items[this.items.length - 1];
    item.z = 10;
    this.applyItemTransforms();
    if (this.recording) {
      // Store reference — position resolved at stop time to capture any drag
      this.recordingLog.push({ type: "placeholder", _item: item });
    }
  }

  spawnTool(el, type, clientX, clientY) {
    this.table.appendChild(el);

    // Spawn right at the tap coordinate, offset slightly so it's centered
    let localX = this.snap((clientX - this.panX) / this.zoomLevel - 40);
    let localY = this.snap((clientY - this.panY) / this.zoomLevel - 20);

    let item = {
      id: `tool-${Date.now()}`,
      type,
      el,
      x: localX,
      y: localY,
      rot: 0,
      z: ++this.maxZ,
    };
    this.items.push(item);
    this.applyItemTransforms();
  }
  // --- SETUP MODAL ---

  initSetupModal() {
    this._setupModal = document.getElementById("setup-modal");
    this._setupTextarea = document.getElementById("setup-textarea");
    this._setupTitle = document.querySelector(".setup-modal-title");

    document
      .getElementById("setup-modal-close")
      .addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.closeSetupModal();
      });
    document
      .getElementById("setup-apply-btn")
      .addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        this.loadSetup(this._setupTextarea.value);
        this.closeSetupModal();
      });
    document
      .getElementById("setup-copy-btn")
      .addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        const btn = document.getElementById("setup-copy-btn");
        navigator.clipboard.writeText(this._setupTextarea.value).then(() => {
          btn.textContent = "Copied!";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = "Copy";
            btn.classList.remove("copied");
          }, 1800);
        });
      });
    // Prevent table pointer events from eating textarea interaction
    this._setupModal.addEventListener("pointerdown", (e) =>
      e.stopPropagation(),
    );
  }

  openSetupModal(mode = "load", content = "") {
    this._setupTitle.textContent = mode === "save" ? "Recorded Setup" : "Setup";
    this._setupTextarea.value = content;
    this._setupModal.classList.remove("hidden");
    // Focus the textarea so the keyboard appears on mobile
    setTimeout(() => this._setupTextarea.focus(), 50);
  }

  closeSetupModal() {
    this._setupModal.classList.add("hidden");
  }

  loadSetup(markdown) {
    if (!markdown.trim()) return;
    this.currentSetupMarkdown = markdown;
    applySetup(this, parseSetup(markdown));
  }

  // --- RECORDING ---

  startRecording() {
    this.recording = true;
    this.recordingLog = [];
    // Snapshot all current cards into the main stack registry
    this.recordingStacks = {
      main: new Set(this.items.filter((i) => i.type === "card")),
    };
    if (navigator.vibrate) navigator.vibrate(30);
  }

  stopRecording() {
    this.recording = false;
    // Resolve final positions and content from live item references
    const resolvedLog = this.recordingLog.map((entry) => {
      if (entry._item) {
        const resolved = {
          type: entry.type,
          x: entry._item.x,
          y: entry._item.y,
        };
        if (entry.type === "note") {
          const ta = entry._item.el.querySelector(".note-source");
          resolved.text = ta ? ta.value : "";
        } else if (entry.type === "phantom") {
          resolved.type = "placeholder";
          resolved.label = entry._item.label;
        } else if (entry.type === "counter") {
          const valEl = entry._item.el.querySelector(".val");
          resolved.val = valEl ? parseInt(valEl.innerText) : 20;
        }
        return resolved;
      }
      return entry;
    });
    this.recordingLog = [];
    const markdown = serializeSetup("", resolvedLog, this.multicolor);
    this.openSetupModal("save", markdown);
    if (navigator.vibrate) navigator.vibrate([20, 20]);
  }

  setMulticolor(enabled) {
    this.multicolor = !!enabled;
    if (this.multicolor) {
      this.table.classList.add("multicolor-mode");
    } else {
      this.table.classList.remove("multicolor-mode");
    }
  }

  checkUrlForGame() {
    // Look for ?game-name
    const query = window.location.search.substring(1).split("&")[0];
    if (query && /^[a-zA-Z0-9_-]+$/.test(query)) {
      this.fetchGame(query);
      this.hideLauncher();
    } else {
      this.showLauncher();
    }
  }

  initLauncher() {
    this.launcherModal = document.getElementById("launcher-modal");
    this.gameSelector = document.getElementById("game-selector");
    this.launchBtn = document.getElementById("launch-btn");
    this.menuBtn = document.getElementById("menu-btn");
    this.launcherClose = document.getElementById("launcher-close");

    this.launchBtn.addEventListener("click", () => {
      const selected = this.gameSelector.value;
      if (selected) {
        // Update URL without reload
        const newUrl =
          window.location.origin + window.location.pathname + "?" + selected;
        window.history.pushState({ path: newUrl }, "", newUrl);
        this.fetchGame(selected);
      } else {
        // Blank canvas
        const newUrl = window.location.origin + window.location.pathname;
        window.history.pushState({ path: newUrl }, "", newUrl);
        this.actionGatherAll();
      }
      this.hideLauncher();
    });

    this.menuBtn.addEventListener("click", () => this.showLauncher());
    this.launcherClose.addEventListener("click", () => this.hideLauncher());

    // Close on clicking overlay
    this.launcherModal.addEventListener("click", (e) => {
      if (e.target === this.launcherModal) this.hideLauncher();
    });
  }

  showLauncher() {
    this.launcherModal.classList.add("visible");
  }

  hideLauncher() {
    this.launcherModal.classList.remove("visible");
  }

  async fetchGame(name) {
    try {
      const resp = await fetch(`games/${name}.md`);
      if (!resp.ok) throw new Error("Not found");
      const text = await resp.text();
      this.loadSetup(text);
    } catch (err) {
      console.error("Failed to fetch game:", err);
      document.getElementById("error-modal").classList.remove("hidden");
    }
  }

  // --- RECORDING HELPERS ---

  _autoStackId(baseName) {
    if (!this.recordingStacks[baseName]) return baseName;
    let n = 2;
    while (this.recordingStacks[`${baseName}-${n}`]) n++;
    return `${baseName}-${n}`;
  }

  _stackIdForCards(cards) {
    const s = new Set(cards);
    for (const [id, stackSet] of Object.entries(this.recordingStacks)) {
      if (this._setsEqual(s, stackSet)) return id === "main" ? null : id;
    }
    return null; // default: main deck
  }

  _setsEqual(a, b) {
    if (a.size !== b.size) return false;
    for (const item of a) if (!b.has(item)) return false;
    return true;
  }
}

window.app = new App();
