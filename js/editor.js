/**
 * js/editor.js
 * Core editor logic for rendering and object manipulation.
 */

window.Editor = {
	canvas: null,
	ctx: null,
	wrapper: null,
	data: null,
	images: {},
	isPlaying: false,
	selectedId: 'scene',
	isDragging: false,
	dragOffset: { x: 0, y: 0 },
	lastTime: 0,
	animState: {},
	zoom: 1.0,
	resizingHandle: null,
	resizeStart: { x: 0, y: 0, w: 0, h: 0, mx: 0, my: 0 },
	aspectLocked: true,
	HANDLE_SIZE: 10,

	resolutions: {
		'Custom': { w: 0, h: 0 },
		'iPhone 14 Pro': { w: 1179, h: 2556 },
		'Pixel 7': { w: 1080, h: 2400 },
		'iPad Pro 12.9': { w: 2048, h: 2732 },
		'HD Desktop': { w: 1920, h: 1080 },
		'FHD Portrait': { w: 1080, h: 1920 },
		'4K Desktop': { w: 3840, h: 2160 }
	},

	init: function () {
		this.canvas = document.getElementById('gameCanvas');
		this.ctx = this.canvas.getContext('2d');
		this.wrapper = document.getElementById('canvas-wrapper');

		// Toolbar Actions
		document.getElementById('btn-play').onclick = () => { this.isPlaying = true; };
		document.getElementById('btn-pause').onclick = () => { this.isPlaying = false; };

		// History Actions
		document.getElementById('btn-undo').onclick = () => window.History.undo();
		document.getElementById('btn-redo').onclick = () => window.History.redo();

		// Grid Controls
		document.getElementById('chk-grid-visible').onchange = (e) => {
			if (this.data) this.data.meta.grid.enabled = e.target.checked;
		};
		document.getElementById('chk-grid-snap').onchange = (e) => {
			if (this.data) this.data.meta.grid.snap = e.target.checked;
		};

		// Zoom Controls
		document.getElementById('btn-zoom-in').onclick = () => this.setZoom(this.zoom + 0.1);
		document.getElementById('btn-zoom-out').onclick = () => this.setZoom(this.zoom - 0.1);
		document.getElementById('inp-zoom-percent').onchange = (e) => {
			const val = parseFloat(e.target.value);
			if (!isNaN(val)) this.setZoom(val / 100);
		};

		document.getElementById('btn-assets-modal').onclick = () => {
			document.getElementById('modal-assets').style.display = 'block';
		};

		// Mouse Events
		this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
		window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
		window.addEventListener('mouseup', () => this.handleMouseUp());

		// Modal Close Logic
		document.querySelectorAll('.close').forEach(span => {
			span.onclick = function () {
				this.closest('.modal').style.display = 'none';
			};
		});

		requestAnimationFrame((t) => this.gameLoop(t));
	},

	// --- Custom Dialog API ---

	alert: function (msg) {
		return new Promise((resolve) => {
			const dlg = document.getElementById('dlg-alert');
			document.getElementById('dlg-alert-msg').innerText = msg;
			document.getElementById('dlg-alert-close').onclick = () => {
				dlg.close();
				resolve();
			};
			dlg.showModal();
		});
	},

	confirm: function (msg) {
		return new Promise((resolve) => {
			const dlg = document.getElementById('dlg-confirm');
			document.getElementById('dlg-confirm-msg').innerText = msg;
			document.getElementById('dlg-confirm-yes').onclick = () => {
				dlg.close();
				resolve(true);
			};
			document.getElementById('dlg-confirm-no').onclick = () => {
				dlg.close();
				resolve(false);
			};
			dlg.showModal();
		});
	},

	prompt: function (msg, defaultVal = '') {
		return new Promise((resolve) => {
			const dlg = document.getElementById('dlg-prompt');
			const input = document.getElementById('dlg-prompt-input');
			document.getElementById('dlg-prompt-msg').innerText = msg;
			input.value = defaultVal;
			document.getElementById('dlg-prompt-ok').onclick = () => {
				const val = input.value;
				dlg.close();
				resolve(val);
			};
			document.getElementById('dlg-prompt-cancel').onclick = () => {
				dlg.close();
				resolve(null);
			};
			dlg.showModal();
		});
	},

	// --- Scene Logic ---

	loadSceneData: function (newData) {
		this.data = newData;
		this.data.objects.forEach(obj => {
			if (obj.parentId === undefined) obj.parentId = null;
		});

		document.getElementById('chk-grid-visible').checked = this.data.meta.grid.enabled;
		document.getElementById('chk-grid-snap').checked = this.data.meta.grid.snap;

		this.canvas.width = this.data.meta.width;
		this.canvas.height = this.data.meta.height;

		this.images = {};
		this.animState = {};
		this.selectedId = 'scene';

		window.History.undoStack = [];
		window.History.redoStack = [];
		window.History.updateButtons();

		window.PropertiesPanel.update();
		window.Treeview.render();
		this.fitZoomToScreen();
		this.loadAssets();
	},

	setZoom: function (val) {
		this.zoom = Math.max(0.1, Math.min(5.0, val));
		this.canvas.style.width = (this.data.meta.width * this.zoom) + 'px';
		this.canvas.style.height = (this.data.meta.height * this.zoom) + 'px';
		document.getElementById('inp-zoom-percent').value = Math.round(this.zoom * 100) + '%';
	},

	fitZoomToScreen: function () {
		if (!this.wrapper || !this.data) return;
		const availW = this.wrapper.clientWidth - 40;
		const availH = this.wrapper.clientHeight - 40;
		const scaleW = availW / this.data.meta.width;
		const scaleH = availH / this.data.meta.height;
		let newZoom = Math.min(scaleW, scaleH);
		if (newZoom > 1) newZoom = 1;
		this.setZoom(newZoom);
	},

	loadAssets: function () {
		const promises = [];
		if (this.data.meta.backgroundImage) promises.push(this.loadImage('bg', this.data.meta.backgroundImage));
		this.data.objects.forEach(obj => {
			if (obj.type === 'static' && obj.asset) promises.push(this.loadImage(obj.asset, obj.asset));
		});
		const library = this.data.library.sprites;
		for (const key in library) {
			if (library[key].sourceFile) promises.push(this.loadImage(library[key].sourceFile, library[key].sourceFile));
		}
		return Promise.all(promises);
	},

	loadImage: function (key, src) {
		return new Promise((resolve) => {
			if (this.images[key]) return resolve();
			const img = new Image();
			img.src = src;
			img.onload = () => { this.images[key] = img; resolve(); };
			img.onerror = () => { console.warn(`Missing: ${src}`); this.images[key] = null; resolve(); };
		});
	},

	addAssetToScene: function (assetPath) {
		if (!this.data) return;

		window.History.saveState();

		let parentId = null;
		const selected = this.data.objects.find(o => o.id === this.selectedId);
		if (selected) {
			parentId = (selected.type === 'folder') ? selected.id : selected.parentId;
		}

		// MODIFIED: Generate unique name based on filename
		const fileName = assetPath.split('/').pop().replace(/\.[^/.]+$/, "");
		let uniqueName = fileName;
		let suffix = 1;

		// Check if name exists and append numeric suffix until unique
		while (this.data.objects.some(o => o.name === uniqueName)) {
			uniqueName = `${fileName}_${suffix}`;
			suffix++;
		}

		const newObj = {
			id: 'obj_' + Date.now(),
			name: uniqueName, // NEW: Uses unique filename-based name
			type: 'static',
			asset: assetPath,
			parentId: parentId,
			x: this.canvas.width / 2 - 32,
			y: this.canvas.height / 2 - 32,
			width: 64,
			height: 64,
			opacity: 1,
			zIndex: 0,
			visible: true,
			locked: false
		};

		this.loadImage(assetPath, assetPath).then(() => {
			const img = this.images[assetPath];
			if (img) {
				newObj.width = img.width;
				newObj.height = img.height;
			}
			this.data.objects.push(newObj);
			this.selectedId = newObj.id;

			window.PropertiesPanel.update();
			window.Treeview.render();
			document.getElementById('modal-assets').style.display = 'none';
		});
	},

	// --- Rendering Loop ---

	gameLoop: function (timestamp) {
		if (!this.data) {
			requestAnimationFrame((t) => this.gameLoop(t));
			return;
		}
		const dt = (timestamp - this.lastTime) / 1000;
		this.lastTime = timestamp;
		if (this.isPlaying) this.updateAnimations(dt);
		this.render();
		requestAnimationFrame((t) => this.gameLoop(t));
	},

	updateAnimations: function (dt) {
		this.data.objects.forEach(obj => {
			if (obj.type !== 'sprite') return;
			if (!this.animState[obj.id]) this.animState[obj.id] = { frameIndex: 0, timer: 0 };
			const config = this.data.library.sprites[obj.spriteConfigId];
			if (!config) return;
			const anim = config.animations[obj.currentAnimation];
			if (!anim) return;
			const state = this.animState[obj.id];
			state.timer += dt;
			if (state.timer >= (1 / anim.fps)) {
				state.timer = 0;
				state.frameIndex++;
				if (state.frameIndex >= anim.frames.length) {
					state.frameIndex = anim.loop ? 0 : anim.frames.length - 1;
				}
			}
		});
	},

	render: function () {
		this.ctx.fillStyle = this.data.meta.backgroundColor;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

		if (this.data.meta.backgroundImage && this.images.bg) {
			if (this.data.meta.backgroundMode === 'tile') {
				const p = this.ctx.createPattern(this.images.bg, 'repeat');
				this.ctx.fillStyle = p;
				this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
			} else {
				this.ctx.drawImage(this.images.bg, 0, 0, this.canvas.width, this.canvas.height);
			}
		}

		if (this.data.meta.grid.enabled) this.drawGrid();

		const sorted = [...this.data.objects].sort((a, b) => a.zIndex - b.zIndex);
		sorted.forEach(obj => {
			if (!obj.visible || obj.type === 'folder') return;
			this.ctx.save();
			this.ctx.globalAlpha = obj.opacity;

			if (obj.type === 'static') {
				const img = this.images[obj.asset];
				if (img) this.ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
				else { this.ctx.fillStyle = '#666'; this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height); }
			} else if (obj.type === 'sprite') {
				this.drawSprite(obj);
			}

			if (this.selectedId === obj.id) {
				this.ctx.strokeStyle = '#00FF00'; this.ctx.lineWidth = 2;
				this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
				if (!obj.locked) this.drawResizeHandles(obj);
			}
			this.ctx.restore();
		});
	},

	drawSprite: function (obj) {
		const config = this.data.library.sprites[obj.spriteConfigId];
		if (!config) return;
		const img = this.images[config.sourceFile];
		if (!img) return;
		const anim = config.animations[obj.currentAnimation];
		const state = this.animState[obj.id] || { frameIndex: 0 };
		const frameId = anim.frames[state.frameIndex];
		const cols = Math.floor(img.width / config.frameWidth);
		const col = frameId % cols;
		const row = Math.floor(frameId / cols);
		this.ctx.drawImage(img, col * config.frameWidth, row * config.frameHeight, config.frameWidth, config.frameHeight, obj.x, obj.y, obj.width, obj.height);
	},

	drawGrid: function () {
		const sz = this.data.meta.grid.size;
		this.ctx.beginPath(); this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
		for (let x = 0; x <= this.canvas.width; x += sz) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, this.canvas.height); }
		for (let y = 0; y <= this.canvas.height; y += sz) { this.ctx.moveTo(0, y); this.ctx.lineTo(this.canvas.width, y); }
		this.ctx.stroke();
	},

	drawResizeHandles: function (obj) {
		const handles = this.getHandleCoords(obj);
		this.ctx.fillStyle = '#fff';
		this.ctx.strokeStyle = '#000';
		this.ctx.lineWidth = 1;
		for (const key in handles) {
			const h = handles[key];
			this.ctx.fillRect(h.x, h.y, h.w, h.h);
			this.ctx.strokeRect(h.x, h.y, h.w, h.h);
		}
	},

	getHandleCoords: function (obj) {
		const s = this.HANDLE_SIZE / this.zoom;
		return {
			tl: { x: obj.x - s / 2, y: obj.y - s / 2, w: s, h: s },
			tr: { x: obj.x + obj.width - s / 2, y: obj.y - s / 2, w: s, h: s },
			bl: { x: obj.x - s / 2, y: obj.y + obj.height - s / 2, w: s, h: s },
			br: { x: obj.x + obj.width - s / 2, y: obj.y + obj.height - s / 2, w: s, h: s }
		};
	},

	getMousePos: function (e) {
		const r = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / r.width;
		const scaleY = this.canvas.height / r.height;
		return {
			x: (e.clientX - r.left) * scaleX,
			y: (e.clientY - r.top) * scaleY
		};
	},

	// --- Input Handling ---

	handleMouseDown: function (e) {
		if (!this.data) return;
		const pos = this.getMousePos(e);

		// Check Resize Handles
		if (this.selectedId && this.selectedId !== 'scene') {
			const obj = this.data.objects.find(o => o.id === this.selectedId);
			if (obj && !obj.locked && obj.type !== 'folder') {
				const handles = this.getHandleCoords(obj);
				for (const key in handles) {
					const h = handles[key];
					if (pos.x >= h.x && pos.x <= h.x + h.w && pos.y >= h.y && pos.y <= h.y + h.h) {
						window.History.saveState();
						this.resizingHandle = key;
						this.resizeStart = { x: obj.x, y: obj.y, w: obj.width, h: obj.height, mx: pos.x, my: pos.y };
						return;
					}
				}
			}
		}

		// MODIFIED: Check Object Selection with Z-Index, Visibility, and Lock priority
		const sorted = [...this.data.objects]
			.filter(o => o.visible && !o.locked && o.type !== 'folder') // NEW: Filter out hidden/locked/folders
			.sort((a, b) => b.zIndex - a.zIndex); // NEW: Highest Z-index first

		const clicked = sorted.find(o => pos.x >= o.x && pos.x <= o.x + o.width && pos.y >= o.y && pos.y <= o.y + o.height);

		if (clicked) {
			this.selectedId = clicked.id;
			// Note: Filter already handles !locked, but we keep the safety check
			if (!clicked.locked) {
				window.History.saveState();
				this.isDragging = true;
				this.dragOffset = { x: pos.x - clicked.x, y: pos.y - clicked.y };
			}
		} else {
			this.selectedId = 'scene';
		}

		window.PropertiesPanel.update();
		window.Treeview.render();
	},

	handleMouseMove: function (e) {
		const pos = this.getMousePos(e);

		if (this.resizingHandle) {
			const obj = this.data.objects.find(o => o.id === this.selectedId);
			if (!obj) return;
			const dx = pos.x - this.resizeStart.mx;
			const ratio = this.resizeStart.w / this.resizeStart.h;
			let newW = this.resizeStart.w;
			let newH = this.resizeStart.h;
			let newX = this.resizeStart.x;
			let newY = this.resizeStart.y;

			if (this.resizingHandle === 'br') {
				newW = this.resizeStart.w + dx;
				newH = this.aspectLocked ? newW / ratio : this.resizeStart.h + (pos.y - this.resizeStart.my);
			} else if (this.resizingHandle === 'bl') {
				newW = this.resizeStart.w - dx;
				newX = this.resizeStart.x + dx;
				newH = this.aspectLocked ? newW / ratio : this.resizeStart.h + (pos.y - this.resizeStart.my);
			} else if (this.resizingHandle === 'tr') {
				newW = this.resizeStart.w + dx;
				newH = this.aspectLocked ? newW / ratio : this.resizeStart.h - (pos.y - this.resizeStart.my);
				newY = this.aspectLocked ? this.resizeStart.y - (newH - this.resizeStart.h) : pos.y;
			} else if (this.resizingHandle === 'tl') {
				newW = this.resizeStart.w - dx;
				newX = this.resizeStart.x + dx;
				newH = this.aspectLocked ? newW / ratio : this.resizeStart.h - (pos.y - this.resizeStart.my);
				newY = this.aspectLocked ? this.resizeStart.y - (newH - this.resizeStart.h) : pos.y;
			}

			if (newW > 5 && newH > 5) {
				obj.width = newW; obj.height = newH; obj.x = newX; obj.y = newY;
				window.PropertiesPanel.update();
			}
			return;
		}

		if (!this.isDragging || !this.selectedId || this.selectedId === 'scene') return;
		const obj = this.data.objects.find(o => o.id === this.selectedId);
		if (!obj) return;
		let nx = pos.x - this.dragOffset.x;
		let ny = pos.y - this.dragOffset.y;
		if (this.data.meta.grid.snap) {
			const sz = this.data.meta.grid.size;
			nx = Math.round(nx / sz) * sz;
			ny = Math.round(ny / sz) * sz;
		}
		obj.x = nx; obj.y = ny;
		window.PropertiesPanel.update();
	},

	handleMouseUp: function () {
		this.isDragging = false;
		this.resizingHandle = null;
	},

	// --- Object Actions ---

	fitObjectToScene: function (id) {
		const obj = this.data.objects.find(o => o.id === id);
		if (!obj || obj.type === 'folder') return;

		window.History.saveState();

		const sceneW = this.data.meta.width;
		const sceneH = this.data.meta.height;
		const objRatio = obj.width / obj.height;
		const sceneRatio = sceneW / sceneH;

		if (objRatio > sceneRatio) {
			obj.width = sceneW; obj.height = sceneW / objRatio;
			obj.x = 0; obj.y = (sceneH - obj.height) / 2;
		} else {
			obj.height = sceneH; obj.width = sceneH * objRatio;
			obj.y = 0; obj.x = (sceneW - obj.width) / 2;
		}
		window.PropertiesPanel.update();
	},

	deleteObject: async function (id) {
		const index = this.data.objects.findIndex(o => o.id === id);
		if (index !== -1) {
			const confirmed = await this.confirm('Are you sure you want to delete this?');
			if (confirmed) {
				window.History.saveState();
				this.data.objects.splice(index, 1);
				this.selectedId = 'scene';
				window.PropertiesPanel.update();
				window.Treeview.render();
			}
		}
	}
};

document.addEventListener('DOMContentLoaded', () => {
	window.Editor.init();
});