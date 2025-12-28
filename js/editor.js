/**
 * editor.js
 * Handles the Canvas, Game Loop, Object Interaction, Properties Panel, Zoom, and Resizing.
 */

window.Editor = {
	canvas: null,
	ctx: null,
	propPanel: null,
	wrapper: null,
	treeview: null,

	// State
	data: null,
	images: {},
	isPlaying: false,
	selectedId: 'scene',
	isDragging: false,
	dragOffset: { x: 0, y: 0 },
	lastTime: 0,
	animState: {},

	// Zoom State
	zoom: 1.0,

	// Resize State
	resizingHandle: null,
	resizeStart: { x: 0, y: 0, w: 0, h: 0, mx: 0, my: 0 },
	aspectLocked: true, // Default aspect ratio lock is on

	// Constants
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
		this.propPanel = document.getElementById('prop-content');
		this.wrapper = document.getElementById('canvas-wrapper');
		this.treeview = document.getElementById('treeview-content');

		// UI Listeners
		document.getElementById('btn-play').onclick = () => { this.isPlaying = true; };
		document.getElementById('btn-pause').onclick = () => { this.isPlaying = false; };

		document.getElementById('chk-grid-visible').onchange = (e) => {
			if (this.data) this.data.meta.grid.enabled = e.target.checked;
		};
		document.getElementById('chk-grid-snap').onchange = (e) => {
			if (this.data) this.data.meta.grid.snap = e.target.checked;
		};

		document.getElementById('btn-zoom-in').onclick = () => this.setZoom(this.zoom + 0.1);
		document.getElementById('btn-zoom-out').onclick = () => this.setZoom(this.zoom - 0.1);
		document.getElementById('inp-zoom-percent').onchange = (e) => {
			const val = parseFloat(e.target.value);
			if (!isNaN(val)) this.setZoom(val / 100);
		};

		document.getElementById('btn-assets-modal').onclick = () => {
			document.getElementById('modal-assets').style.display = 'block';
		};

		this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
		window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
		window.addEventListener('mouseup', () => this.handleMouseUp());

		document.querySelectorAll('.close').forEach(span => {
			span.onclick = function () {
				this.closest('.modal').style.display = 'none';
			};
		});

		requestAnimationFrame((t) => this.gameLoop(t));
	},

	loadSceneData: function (newData) {
		this.data = newData;
		document.getElementById('chk-grid-visible').checked = this.data.meta.grid.enabled;
		document.getElementById('chk-grid-snap').checked = this.data.meta.grid.snap;

		this.canvas.width = this.data.meta.width;
		this.canvas.height = this.data.meta.height;

		this.images = {};
		this.animState = {};
		this.selectedId = 'scene';
		this.updatePropertiesPanel();
		this.renderTreeview(); // Initial treeview render
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
		const newObj = {
			id: 'obj_' + Date.now(),
			name: 'New Object',
			type: 'static',
			asset: assetPath,
			x: this.canvas.width / 2 - 32,
			y: this.canvas.height / 2 - 32,
			width: 64,
			height: 64,
			opacity: 1,
			zIndex: this.data.objects.length, // Add to top
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
			this.updatePropertiesPanel();
			this.renderTreeview(); // Update treeview when adding asset
			document.getElementById('modal-assets').style.display = 'none';
		});
	},

	// --- Treeview Logic ---

	renderTreeview: function () {
		if (!this.data) return;
		this.treeview.innerHTML = '';

		// Root Scene Item
		const rootEl = document.createElement('div');
		rootEl.className = `tree-item scene-root ${this.selectedId === 'scene' ? 'selected' : ''}`;
		rootEl.innerHTML = `<span>🎬</span> ${this.data.meta.sceneName || 'Scene'}`;
		rootEl.onclick = () => {
			this.selectedId = 'scene';
			this.updatePropertiesPanel();
			this.renderTreeview();
		};
		this.treeview.appendChild(rootEl);

		// Objects sorted by Z-Index (Descending so top of list is top of render)
		const sorted = [...this.data.objects].sort((a, b) => b.zIndex - a.zIndex);
		sorted.forEach(obj => {
			const el = document.createElement('div');
			el.className = `tree-item ${this.selectedId === obj.id ? 'selected' : ''}`;
			const icon = obj.type === 'sprite' ? '👾' : '🖼️';
			el.innerHTML = `<span>${icon}</span> ${obj.name}`;
			el.onclick = () => {
				this.selectedId = obj.id;
				this.updatePropertiesPanel();
				this.renderTreeview();
			};
			this.treeview.appendChild(el);
		});
	},

	// --- Game Loop & Rendering ---

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
			if (!obj.visible) return;
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
		const s = this.HANDLE_SIZE / this.zoom;
		this.ctx.fillStyle = '#fff';
		this.ctx.strokeStyle = '#000';
		this.ctx.lineWidth = 1;
		const handles = this.getHandleCoords(obj);
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

	// --- Interaction ---

	getMousePos: function (e) {
		const r = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / r.width;
		const scaleY = this.canvas.height / r.height;
		return {
			x: (e.clientX - r.left) * scaleX,
			y: (e.clientY - r.top) * scaleY
		};
	},

	handleMouseDown: function (e) {
		if (!this.data) return;
		const pos = this.getMousePos(e);

		if (this.selectedId && this.selectedId !== 'scene') {
			const obj = this.data.objects.find(o => o.id === this.selectedId);
			if (obj && !obj.locked) {
				const handles = this.getHandleCoords(obj);
				for (const key in handles) {
					const h = handles[key];
					if (pos.x >= h.x && pos.x <= h.x + h.w && pos.y >= h.y && pos.y <= h.y + h.h) {
						this.resizingHandle = key;
						this.resizeStart = { x: obj.x, y: obj.y, w: obj.width, h: obj.height, mx: pos.x, my: pos.y };
						return;
					}
				}
			}
		}

		const sorted = [...this.data.objects].sort((a, b) => b.zIndex - a.zIndex);
		const clicked = sorted.find(o => pos.x >= o.x && pos.x <= o.x + o.width && pos.y >= o.y && pos.y <= o.y + o.height);

		if (clicked) {
			this.selectedId = clicked.id;
			if (!clicked.locked) {
				this.isDragging = true;
				this.dragOffset = { x: pos.x - clicked.x, y: pos.y - clicked.y };
			}
		} else {
			this.selectedId = 'scene';
		}
		this.updatePropertiesPanel();
		this.renderTreeview(); // Sync treeview selection
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
				this.updatePropertiesPanel();
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
		this.updatePropertiesPanel();
	},

	handleMouseUp: function () {
		this.isDragging = false;
		this.resizingHandle = null;
	},

	updatePropertiesPanel: function () {
		if (!this.data) return;

		if (this.selectedId === 'scene') {
			const meta = this.data.meta;
			let presetOpts = '';
			for (const name in this.resolutions) {
				presetOpts += `<option value="${name}">${name}</option>`;
			}
			this.propPanel.innerHTML = `
        <h4>Scene Properties</h4>
        <div class="prop-row"><label>Name</label><input value="${meta.sceneName}" onchange="Editor.updateSceneProp('sceneName', this.value)"></div>
        <div class="prop-row"><label>Preset Size</label><select onchange="Editor.applyResolutionPreset(this.value)">${presetOpts}</select></div>
        <div class="prop-row-dual">
            <div><label>Width</label><input type="number" value="${meta.width}" onchange="Editor.updateSceneProp('width', Number(this.value))"></div>
            <div><label>Height</label><input type="number" value="${meta.height}" onchange="Editor.updateSceneProp('height', Number(this.value))"></div>
        </div>
        <div class="prop-row"><label>Bg Color</label><input type="color" value="${meta.backgroundColor}" onchange="Editor.updateSceneProp('backgroundColor', this.value)"></div>
        <div class="prop-row"><label>Grid Size</label><input type="number" value="${meta.grid.size}" onchange="Editor.updateSceneProp('gridSize', Number(this.value))"></div>
      `;
			return;
		}

		const obj = this.data.objects.find(o => o.id === this.selectedId);
		if (!obj) return;

		this.propPanel.innerHTML = `
      <h4>Object Properties</h4>
      <div class="prop-row"><label>Name</label><input value="${obj.name}" onchange="Editor.updateProp('${obj.id}', 'name', this.value)"></div>
      
      <div class="prop-row-check">
        <label><input type="checkbox" ${obj.visible ? 'checked' : ''} onchange="Editor.updateProp('${obj.id}', 'visible', this.checked)"> Visible</label>
        <label><input type="checkbox" ${obj.locked ? 'checked' : ''} onchange="Editor.updateProp('${obj.id}', 'locked', this.checked)"> Locked</label>
      </div>

      <div class="prop-row-dual" style="margin-top:10px;">
        <div><label>X</label><input type="number" value="${Math.round(obj.x)}" onchange="Editor.updateProp('${obj.id}', 'x', Number(this.value))"></div>
        <div><label>Y</label><input type="number" value="${Math.round(obj.y)}" onchange="Editor.updateProp('${obj.id}', 'y', Number(this.value))"></div>
      </div>

      <div class="prop-row-dual">
        <div><label>Width</label><input type="number" value="${Math.round(obj.width)}" onchange="Editor.updateProp('${obj.id}', 'width', Number(this.value))"></div>
        <button class="btn-lock-aspect ${this.aspectLocked ? 'active' : ''}" onclick="Editor.toggleAspect()" title="Lock Aspect Ratio">🔗</button>
        <div><label>Height</label><input type="number" value="${Math.round(obj.height)}" onchange="Editor.updateProp('${obj.id}', 'height', Number(this.value))"></div>
      </div>

      <div class="prop-row">
        <label>Opacity</label>
        <div class="opacity-ctrl">
            <input type="range" min="0" max="1" step="0.01" value="${obj.opacity}" oninput="Editor.updateProp('${obj.id}', 'opacity', Number(this.value))">
            <input type="number" min="0" max="1" step="0.1" value="${obj.opacity}" onchange="Editor.updateProp('${obj.id}', 'opacity', Number(this.value))">
        </div>
      </div>

      <div class="prop-row"><label>Z-Index</label><input type="number" value="${obj.zIndex}" onchange="Editor.updateProp('${obj.id}', 'zIndex', Number(this.value))"></div>
      <button class="primary-btn" style="width:100%" onclick="Editor.fitObjectToScene('${obj.id}')">Fit to Scene</button>
    `;
	},

	toggleAspect: function () {
		this.aspectLocked = !this.aspectLocked;
		this.updatePropertiesPanel();
	},

	updateProp: function (id, key, val) {
		const obj = this.data.objects.find(o => o.id === id);
		if (!obj) return;

		const oldW = obj.width;
		const oldH = obj.height;

		obj[key] = val;

		// Handle Aspect Ratio Lock
		if (this.aspectLocked) {
			const ratio = oldW / oldH;
			if (key === 'width') obj.height = val / ratio;
			if (key === 'height') obj.width = val * ratio;
		}

		if (key === 'name' || key === 'zIndex') this.renderTreeview();
		if (key !== 'opacity') this.updatePropertiesPanel(); // Avoid re-rendering panel while sliding opacity
	},

	updateSceneProp: function (key, val) {
		if (key === 'gridSize') this.data.meta.grid.size = val;
		else this.data.meta[key] = val;

		if (key === 'width' || key === 'height') {
			this.canvas[key] = val;
			this.setZoom(this.zoom);
		}
		if (key === 'sceneName') this.renderTreeview();
	},

	applyResolutionPreset: function (name) {
		const res = this.resolutions[name];
		if (res && res.w > 0) {
			this.updateSceneProp('width', res.w);
			this.updateSceneProp('height', res.h);
			this.updatePropertiesPanel();
			this.fitZoomToScreen();
		}
	},

	fitObjectToScene: function (id) {
		const obj = this.data.objects.find(o => o.id === id);
		if (!obj) return;
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
		this.updatePropertiesPanel();
	}
};

window.addAssetToScene = function (path) {
	window.Editor.addAssetToScene(path);
};

document.addEventListener('DOMContentLoaded', () => {
	window.Editor.init();
});