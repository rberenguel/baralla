const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

class App {
    constructor() {
        this.table = document.getElementById('table');
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

        this.pointerDownPos = {x: 0, y: 0};
        this.hasMoved = false;
        this.startAngle = null;
        this.startRots = [];
        this.startPinchDist = null;

        this.radialMenuOpen = false;
        this.radialMenuData = null;
        this.radialMenuType = null;

        this.initDeck();
        this.setupEvents();
        this.updateTransform();
    }

    snap(value) {
        const GRID_SIZE = 70 / 4; // 17.5px (1/4 of --card-w)
        return Math.round(value / GRID_SIZE) * GRID_SIZE;
    }

    initDeck() {
        SUITS.forEach(suit => {
            RANKS.forEach(rank => {
                let isRed = suit === '♥' || suit === '♦';
                let id = `card-${suit}-${rank}`;

                let el = document.createElement('div');
                el.className = `card face-down ${isRed ? 'red' : 'black'}`;
                el.innerHTML = `
                    <div class="card-back"></div>
                    <div class="card-face">
                        <div class="card-corner">${suit} ${rank}</div>
                        <div class="card-center">${rank}</div>
                        <div class="card-corner bottom">${rank} ${suit}</div>
                    </div>
                `;

                this.table.appendChild(el);

                let cardObj = {
                    id, type: 'card', el, suit, rank,
                    x: 0, y: 0, rot: 0, z: ++this.maxZ, isFaceUp: false
                };
                this.items.push(cardObj);
            });
        });
        this.actionGatherAll();
    }

    applyItemTransforms() {
        this.items.forEach(item => {
            if (!item._tempTransform) {
                // Fix for reflexed tools: Only apply rotateY(180deg) to explicitly face-down cards
                let rotY = (item.type === 'card' && !item.isFaceUp) ? '180deg' : '0deg';
                item.el.style.transform = `translate(${item.x}px, ${item.y}px) rotate(${item.rot}deg) rotateY(${rotY})`;
            }
            item.el.style.zIndex = item.z;
        });
    }

    updateTransform() {
        this.table.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    }

    getStackAt(x, y) {
        return this.items.filter(i => i.type === 'card' && Math.abs(i.x - x) < 2 && Math.abs(i.y - y) < 2).sort((a, b) => a.z - b.z);
    }

    setupEvents() {
        window.addEventListener('pointerdown', this.onPointerDown.bind(this));
        window.addEventListener('pointermove', this.onPointerMove.bind(this));
        window.addEventListener('pointerup', this.onPointerUp.bind(this));
        window.addEventListener('pointercancel', this.onPointerUp.bind(this));
    }

    getPointerLocal(e) {
        return {
            x: (e.clientX - this.panX) / this.zoomLevel,
            y: (e.clientY - this.panY) / this.zoomLevel
        };
    }

    onPointerDown(e) {
        if (this.radialMenuOpen) {
            if (!e.target.closest('.radial-item')) {
                this.hideRadialMenu();
            }
            return;
        }

        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'TEXTAREA') return;

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

        let cardEl = e.target.closest('.card');
        let toolEl = e.target.closest('.tool-item') || e.target.closest('.phantom-card');
        let itemEl = cardEl || toolEl;

        // TAPPED AN ITEM
        if (itemEl && this.activePointers.size === 1) {
            let item = this.items.find(i => i.el === itemEl);
            if (!item) return;

            this.dragMode = 'item';
            this.dragTargets = [item];

            item.z = ++this.maxZ;
            item.el.classList.add('dragging');

            let local = this.getPointerLocal(e);
            item._offX = item.x - local.x;
            item._offY = item.y - local.y;

            if (item.type === 'card') {
                this.longPressTimer = setTimeout(() => {
                    let stack = this.getStackAt(item.x, item.y);
                    if (stack.length > 1) {
                        this.dragMode = 'stack';
                        this.dragTargets = stack;
                        this.stackLifted = true;

                        stack.forEach(c => {
                            c.z = ++this.maxZ;
                            c.el.classList.add('dragging');
                            c._offX = c.x - local.x;
                            c._offY = c.y - local.y;
                        });
                        if (navigator.vibrate) navigator.vibrate(50);
                    }
                }, 400);
            } else if (item.type === 'note' || item.type === 'counter' || item.type === 'phantom') {
                this.longPressTimer = setTimeout(() => {
                    if (!this.hasMoved) {
                        this.dragMode = 'tool-menu-wait';
                        if (navigator.vibrate) navigator.vibrate(50);
                    }
                }, 400);
            }
            this.applyItemTransforms();

        }
        // TAPPED EMPTY TABLE
        else if (!itemEl && this.activePointers.size === 1) {
            this.dragMode = 'pan';
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;

            this.longPressTimer = setTimeout(() => {
                if (!this.hasMoved) {
                    this.dragMode = 'table-menu-wait';
                    if (navigator.vibrate) navigator.vibrate(50);
                }
            }, 400);
        }
    }

    onPointerMove(e) {
        if (!this.activePointers.has(e.pointerId)) return;
        this.activePointers.set(e.pointerId, e);

        if (this.activePointers.size === 1 && !this.hasMoved) {
            let dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
            if (dist > 5) {
                this.hasMoved = true;
                clearTimeout(this.longPressTimer);

                // Revert to dragging if we started moving after long press triggered but before releasing
                if (this.dragMode === 'table-menu-wait') this.dragMode = 'pan';
                if (this.dragMode === 'tool-menu-wait') this.dragMode = 'item';
            }
        }

        if (this.activePointers.size === 2) {
            let pts = Array.from(this.activePointers.values());

            if (this.dragTargets.length > 0 && this.dragTargets[0].type === 'card') {
                this.dragMode = 'rotate';
                let angle = Math.atan2(pts[1].clientY - pts[0].clientY, pts[1].clientX - pts[0].clientX) * 180 / Math.PI;

                if (this.startAngle === null) {
                    this.startAngle = angle;
                    this.startRots = this.dragTargets.map(t => t.rot);
                } else {
                    let delta = angle - this.startAngle;
                    this.dragTargets.forEach((t, i) => {
                        let newRot = this.startRots[i] + delta;
                        t.rot = Math.round(newRot / 45) * 45;
                    });
                    this.applyItemTransforms();
                }
                return;
            }
            else {
                let dist = Math.hypot(pts[1].clientX - pts[0].clientX, pts[1].clientY - pts[0].clientY);
                if (this.startPinchDist === null) {
                    this.startPinchDist = dist;
                    this.startZoom = this.zoomLevel;
                    this.pinchCenterX = (pts[0].clientX + pts[1].clientX) / 2;
                    this.pinchCenterY = (pts[0].clientY + pts[1].clientY) / 2;
                } else {
                    let factor = dist / this.startPinchDist;
                    let newZoom = Math.max(0.3, Math.min(this.startZoom * factor, 3));
                    let zoomRatio = newZoom / this.zoomLevel;

                    this.panX = this.pinchCenterX - (this.pinchCenterX - this.panX) * zoomRatio;
                    this.panY = this.pinchCenterY - (this.pinchCenterY - this.panY) * zoomRatio;
                    this.zoomLevel = newZoom;
                    this.updateTransform();
                }
                return;
            }
        }

        if (this.dragMode === 'pan' && this.activePointers.size === 1) {
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            this.updateTransform();
        } else if ((this.dragMode === 'item' || this.dragMode === 'stack') && this.activePointers.size === 1) {
            let local = this.getPointerLocal(e);
            this.dragTargets.forEach(item => {
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

        if ((this.dragMode === 'item' || this.dragMode === 'stack') && this.dragTargets.length > 0) {
            let leadItem = this.dragTargets[0];

            for (let i = this.items.length - 1; i >= 0; i--) {
                let target = this.items[i];
                if (target.type !== 'card' || this.dragTargets.includes(target)) continue;

                let dx = leadItem.x - target.x;
                let dy = leadItem.y - target.y;
                let dist = Math.hypot(dx, dy);

                // Prioritize "fan" if dragged downwards to prevent accidental stack absorption
                if (Math.abs(dx) < 25 && dy >= 10 && dy < 80) {
                    intent = 'fan';
                    intentTarget = target;
                    break;
                } else if (dist < 15) {
                    intent = 'top';
                    intentTarget = target;
                    break;
                } else if (dist >= 15 && dist < 70 && leadItem.isFaceUp === target.isFaceUp) {
                    intent = 'bottom';
                    intentTarget = target;
                    break;
                }
            }
        }

        this.currentIntent = intent;
        this.intentTarget = intentTarget;

        this.items.forEach(item => {
            if (item.type === 'card') {
                if (item === intentTarget && intent === 'bottom') {
                    item.el.classList.add('preview-bottom');
                } else {
                    item.el.classList.remove('preview-bottom');
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
        if (this.dragMode === 'table-menu-wait' && !this.hasMoved) {
            this.showRadialMenu(e.clientX, e.clientY, 'table');
            openedMenu = true;
        } else if (this.dragMode === 'tool-menu-wait' && !this.hasMoved) {
            this.showRadialMenu(e.clientX, e.clientY, 'tool', this.dragTargets[0]);
            openedMenu = true;
        } else if (this.stackLifted && !this.hasMoved && this.dragMode === 'stack') {
            this.showRadialMenu(e.clientX, e.clientY, 'stack', this.dragTargets);
            openedMenu = true;
        } else if (!this.hasMoved && this.dragMode === 'item' && this.dragTargets.length > 0) {
            // Tapped a single item without moving it
            let item = this.dragTargets[0];
            if (item.type === 'card') {
                item.isFaceUp = !item.isFaceUp;
                this.applyItemTransforms();
                openedMenu = true; // Use this flag to safely bypass the drag-drop grouping logic below
            }
        }

        if ((this.dragMode === 'item' || this.dragMode === 'stack' || this.dragMode === 'rotate') && this.dragTargets.length > 0) {
            let leadItem = this.dragTargets[0];

            if (this.dragMode !== 'rotate' && !openedMenu && leadItem.type === 'card') {
                if (this.currentIntent === 'top' || this.currentIntent === 'fan') {
                    let offsetX = this.intentTarget.x - leadItem.x;
                    let offsetY = this.currentIntent === 'fan' ? (this.intentTarget.y + 25) - leadItem.y : this.intentTarget.y - leadItem.y;

                    this.dragTargets.forEach(t => {
                        t.x = this.snap(t.x + offsetX);
                        t.y = this.snap(t.y + offsetY);
                        t.rot = this.intentTarget.rot;
                    });
                } else if (this.currentIntent === 'bottom') {
                    let targetStack = this.getStackAt(this.intentTarget.x, this.intentTarget.y);
                    let minZ = targetStack.length > 0 ? targetStack[0].z : this.intentTarget.z;

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

            this.dragTargets.forEach(item => {
                item.el.classList.remove('dragging');
                delete item._offX;
                delete item._offY;
            });

            this.currentIntent = null;
            this.intentTarget = null;
            this.items.forEach(i => i.el && i.el.classList.remove('preview-bottom'));

            this.applyItemTransforms();
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

        const menu = document.getElementById('radial-menu');
        menu.innerHTML = '';
        let actions = [];

        if (type === 'stack') {
            actions = [
                { icon: '🔀', handler: () => this.actionStackShuffle(this.radialMenuData) },
                { icon: '🗘', handler: () => this.actionStackFlip(this.radialMenuData) },
                { icon: '⇩', handler: () => this.actionToBottom(this.radialMenuData) },
                { icon: '♠', class: 'black-suit', handler: () => this.extractSuitFromStack('♠', this.radialMenuData) },
                { icon: '♥', class: 'red-suit', handler: () => this.extractSuitFromStack('♥', this.radialMenuData) },
                { icon: '♣', class: 'black-suit', handler: () => this.extractSuitFromStack('♣', this.radialMenuData) },
                { icon: '♦', class: 'red-suit', handler: () => this.extractSuitFromStack('♦', this.radialMenuData) },
            ];
        } else if (type === 'table') {
            actions = [
                { icon: '📥', handler: () => this.actionGatherAll() },
                { icon: '🎲', handler: () => this.addCounter(clientX, clientY) },
                { icon: '📝', handler: () => this.addNote(clientX, clientY) },
                { icon: '🔲', handler: () => this.addPhantom(clientX, clientY) },
            ];
        } else if (type === 'tool') {
            actions = [
                { icon: '🗑️', handler: () => this.actionDeleteTool(this.radialMenuData) }
            ];
        }

        const radius = actions.length <= 1 ? 0 : (actions.length > 4 ? 70 : 60);

        actions.forEach((act, i) => {
            const el = document.createElement('div');
            el.className = 'radial-item ' + (act.class || '');
            el.innerText = act.icon;

            let angle = 0;
            if (actions.length > 1) {
                // Offset angle to start from top
                angle = -0.5 * Math.PI + (2 * Math.PI / actions.length) * i;
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

        menu.style.left = clientX + 'px';
        menu.style.top = clientY + 'px';
        menu.classList.add('show');
        this.radialMenuOpen = true;
    }

    hideRadialMenu() {
        const menu = document.getElementById('radial-menu');
        menu.classList.remove('show');
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

    actionStackFlip(stack) {
        if (!stack || stack.length === 0) return;
        stack.reverse().forEach((c) => {
            c.z = ++this.maxZ;
            c.isFaceUp = !c.isFaceUp;
        });
        this.applyItemTransforms();
    }

    actionDeleteTool(tool) {
        if (!tool) return;
        tool.el.remove();
        this.items = this.items.filter(i => i !== tool);
    }

    extractSuitFromStack(targetSuit, stack) {
        let extCards = stack.filter(c => c.suit === targetSuit);
        if (extCards.length === 0) return;

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

    actionStackShuffle(stack) {
        if (!stack || stack.length <= 1) return;

        stack.forEach(c => {
            c._tempTransform = true;
            c.el.style.transition = 'transform 0.15s ease-out';
            let rX = (Math.random() - 0.5) * 20;
            let rY = (Math.random() - 0.5) * 20;
            let rRot = (Math.random() - 0.5) * 15;

            let rotY = (c.type === 'card' && !c.isFaceUp) ? '180deg' : '0deg';
            c.el.style.transform = `translate(${c.x + rX}px, ${c.y + rY}px) rotate(${c.rot + rRot}deg) rotateY(${rotY})`;
        });

        setTimeout(() => {
            stack.forEach(c => c._rand = Math.random());
            stack.sort((a, b) => a._rand - b._rand);
            stack.forEach(c => {
                c.z = ++this.maxZ;
                delete c._rand;
                delete c._tempTransform;
                c.el.style.transition = 'box-shadow 0.1s, border 0.1s';
            });

            if (this.dragMode === 'stack' && this.dragTargets.length > 0) {
                this.dragTargets.sort((a, b) => a.z - b.z);
            }

            this.applyItemTransforms();
            if (navigator.vibrate) navigator.vibrate([20, 30, 20]);
        }, 150);
    }

    actionGatherAll() {
        let cxL = this.snap((window.innerWidth/2 - this.panX) / this.zoomLevel - 35);
        let cyL = this.snap((window.innerHeight/2 - this.panY) / this.zoomLevel - 50);

        let cards = this.items.filter(i => i.type === 'card');
        cards.forEach(c => {
            c.x = cxL; c.y = cyL; c.rot = 0; c.isFaceUp = false; c.z = ++this.maxZ;
        });
        this.applyItemTransforms();
    }

    addCounter(clientX, clientY) {
        let el = document.createElement('div');
        el.className = 'tool-item counter-widget';
        el.innerHTML = `
            <div class="drag-handle">≡</div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button class="counter-btn" onclick="this.nextElementSibling.innerText=parseInt(this.nextElementSibling.innerText)-1">-</button>
                <span class="val">20</span>
                <button class="counter-btn" onclick="this.previousElementSibling.innerText=parseInt(this.previousElementSibling.innerText)+1">+</button>
            </div>
        `;
        this.spawnTool(el, 'counter', clientX, clientY);
    }

    addNote(clientX, clientY) {
        let el = document.createElement('div');
        el.className = 'tool-item note-widget';
        el.innerHTML = `
            <div class="drag-handle">≡ Note</div>
            <textarea placeholder="Rules or notes..."></textarea>
        `;
        this.spawnTool(el, 'note', clientX, clientY);
    }

    addPhantom(clientX, clientY) {
        let el = document.createElement('div');
        el.className = 'phantom-card';
        this.spawnTool(el, 'phantom', clientX, clientY);

        // Push it down to z=10 so the deck starts naturally above it
        let item = this.items[this.items.length - 1];
        item.z = 10;
        this.applyItemTransforms();
    }

    spawnTool(el, type, clientX, clientY) {
        this.table.appendChild(el);

        // Spawn right at the tap coordinate, offset slightly so it's centered
        let localX = this.snap((clientX - this.panX) / this.zoomLevel - 40);
        let localY = this.snap((clientY - this.panY) / this.zoomLevel - 20);

        let item = {
            id: `tool-${Date.now()}`, type, el,
            x: localX, y: localY, rot: 0, z: ++this.maxZ
        };
        this.items.push(item);
        this.applyItemTransforms();
    }
}

window.app = new App();

window.oncontextmenu = function(event) {
    event.preventDefault();
    event.stopPropagation();
    return false;
};
