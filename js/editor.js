/**
 * editor.js
 * Handles the Canvas, Game Loop, Object Interaction, Properties Panel, Zoom, and Resizing.
 */

window.Editor = {
	canvas: null,
	ctx: null,
	propPanel: null,
	wrapper: null,
	
	// State
	data: null,
	images: {},
	isPlaying: false,
	selectedId: 'scene', // 'scene' or object ID
	isDragging: false,
	dragOffset: { x: 0, y: 0 },
	lastTime: 0,
	animState: {},
	
	// Zoom State
	zoom: 1.0,
	
	// Resize State
	resizingHandle: null, // 'tl', 'tr', 'bl', 'br' or null
	resizeStart: { x: 0, y: 0, w: 0, h: 0, mx: 0, my: 0 },
	
	// Constants
	HANDLE_SIZE: 10, // Visual size of handles in pixels
	
	// Scene Presets
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
		
		// UI Listeners
		document.getElementById('btn-play').onclick = () => { this.isPlaying = true; };
		document.getElementById('btn-pause').onclick = () => { this.isPlaying = false; };
		
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
		
		// Scene Properties Button
		document.getElementById('btn-scene-props').onclick = () => {
			this.selectedId = 'scene';
			this.updatePropertiesPanel();
		};
		
		// Asset Modal Trigger
		document.getElementById('btn-assets-modal').onclick = () => {
			document.getElementById('modal-assets').style.display = 'block';
		};
		
		// Canvas Interaction
		// mousedown remains on canvas to start interaction
		this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
		
		// mousemove and mouseup are attached to window to track dragging outside canvas
		window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
		window.addEventListener('mouseup', () => this.handleMouseUp());
		
		// Close Modals Logic (Generic)
		document.querySelectorAll('.close').forEach(span => {
			span.onclick = function () {
				this.closest('.modal').style.display = 'none';
			};
		});
		window.onclick = (event) => {
			if (event.target.classList.contains('modal')) {
				event.target.style.display = 'none';
			}
		};
		
		// Start Loop
		requestAnimationFrame((t) => this.gameLoop(t));
	},
	
	// Called by SceneManager when JSON is fetched
	loadSceneData: function (newData) {
		this.data = newData;
		
		// Sync UI
		document.getElementById('chk-grid-visible').checked = this.data.meta.grid.enabled;
		document.getElementById('chk-grid-snap').checked = this.data.meta.grid.snap;
		
		this.canvas.width = this.data.meta.width;
		this.canvas.height = this.data.meta.height;
		
		// Reset State
		this.images = {};
		this.animState = {};
		this.selectedId = 'scene';
		this.updatePropertiesPanel();
		
		// Initial Zoom: Fit to Screen
		this.fitZoomToScreen();
		
		this.loadAssets();
	},
	
	// --- Zoom Logic ---
	
	setZoom: function (val) {
		this.zoom = Math.max(0.1, Math.min(5.0, val)); // Clamp 10% to 500%
		
		// We control zoom by setting CSS width/height, keeping internal resolution same
		this.canvas.style.width = (this.data.meta.width * this.zoom) + 'px';
		this.canvas.style.height = (this.data.meta.height * this.zoom) + 'px';
		
		document.getElementById('inp-zoom-percent').value = Math.round(this.zoom * 100) + '%';
	},
	
	fitZoomToScreen: function () {
		if (!this.wrapper || !this.data) return;
		const availW = this.wrapper.clientWidth - 40; // Padding
		const availH = this.wrapper.clientHeight - 40;
		
		const scaleW = availW / this.data.meta.width;
		const scaleH = availH / this.data.meta.height;
		
		// Fit entire scene
		let newZoom = Math.min(scaleW, scaleH);
		if (newZoom > 1) newZoom = 1; // Don't zoom in if it fits, optional
		
		this.setZoom(newZoom);
	},
	
	// --- Asset Loading ---
	
	loadAssets: function () {
		const promises = [];
		if (this.data.meta.backgroundImage) promises.push(this.loadImage('bg', this.data.meta.backgroundImage));
		
		this.data.objects.forEach(obj => {
			if (obj.type === 'static' && obj.asset) promises.push(this.loadImage(obj.asset, obj.asset));
		});
		
		const library = this.data.library.sprites;
		for (let key in library) {
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
			zIndex: 5,
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
			document.getElementById('modal-assets').style.display = 'none';
		});
	},
	
	// --- Game Loop ---
	
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
	
	// --- Rendering ---
	
	render: function () {
		this.ctx.fillStyle = this.data.meta.backgroundColor;
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
		
		if (this.data.meta.backgroundImage && this.images['bg']) {
			if (this.data.meta.backgroundMode === 'tile') {
				const p = this.ctx.createPattern(this.images['bg'], 'repeat');
				this.ctx.fillStyle = p;
				this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
			} else {
				this.ctx.drawImage(this.images['bg'], 0, 0, this.canvas.width, this.canvas.height);
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
			
			// Selection Outline
			if (this.selectedId === obj.id) {
				this.ctx.strokeStyle = '#00FF00'; this.ctx.lineWidth = 2;
				this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
				
				// Draw Resize Handles
				if (!obj.locked) {
					this.drawResizeHandles(obj);
				}
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
		// Calculate handle size based on zoom so they stay constant visually
		const s = this.HANDLE_SIZE / this.zoom;
		this.ctx.fillStyle = '#fff';
		this.ctx.strokeStyle = '#000';
		this.ctx.lineWidth = 1;
		
		const handles = this.getHandleCoords(obj);
		
		for (let key in handles) {
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
		// Adjust for Zoom
		const scaleX = this.canvas.width / r.width;
		const scaleY = this.canvas.height / r.height;
		return {
			x: (e.clientX - r.left) * scaleX,
			y: (e.clientY - r.top) * scaleY
		};
	},
	
	handleMouseDown: function (e) {
		e.preventDefault(); // Prevent default browser drag/select
		if (!this.data) return;
		const pos = this.getMousePos(e);
		
		// Check Resize Handles first if object selected
		if (this.selectedId && this.selectedId !== 'scene') {
			const obj = this.data.objects.find(o => o.id === this.selectedId);
			if (obj && !obj.locked) {
				const handles = this.getHandleCoords(obj);
				for (let key in handles) {
					const h = handles[key];
					if (pos.x >= h.x && pos.x <= h.x + h.w && pos.y >= h.y && pos.y <= h.y + h.h) {
						this.resizingHandle = key;
						this.resizeStart = {
							x: obj.x, y: obj.y, w: obj.width, h: obj.height,
							mx: pos.x, my: pos.y
						};
						return; // Stop propagation
					}
				}
			}
		}
		
		// Check Object Selection
		const sorted = [...this.data.objects].sort((a, b) => b.zIndex - a.zIndex);
		const clicked = sorted.find(o => pos.x >= o.x && pos.x <= o.x + o.width && pos.y >= o.y && pos.y <= o.y + o.height);
		
		if (clicked) {
			this.selectedId = clicked.id;
			this.updatePropertiesPanel();
			if (!clicked.locked) {
				this.isDragging = true;
				this.dragOffset = { x: pos.x - clicked.x, y: pos.y - clicked.y };
			}
		} else {
			this.selectedId = 'scene';
			this.updatePropertiesPanel();
		}
	},
	
	handleMouseMove: function (e) {
		const pos = this.getMousePos(e);
		
		// Handle Resizing
		if (this.resizingHandle) {
			const obj = this.data.objects.find(o => o.id === this.selectedId);
			if (!obj) return;
			
			const dx = pos.x - this.resizeStart.mx;
			// Calculate aspect ratio
			const ratio = this.resizeStart.w / this.resizeStart.h;
			
			let newW = this.resizeStart.w;
			let newH = this.resizeStart.h;
			let newX = this.resizeStart.x;
			let newY = this.resizeStart.y;
			
			// Simple aspect ratio resizing logic based on corner
			// We use dx (horizontal drag) as the primary driver for simplicity
			
			if (this.resizingHandle === 'br') {
				newW = this.resizeStart.w + dx;
				newH = newW / ratio;
			} else if (this.resizingHandle === 'bl') {
				newW = this.resizeStart.w - dx;
				newH = newW / ratio;
				newX = this.resizeStart.x + dx;
			} else if (this.resizingHandle === 'tr') {
				newW = this.resizeStart.w + dx;
				newH = newW / ratio;
				newY = this.resizeStart.y - (newH - this.resizeStart.h);
			} else if (this.resizingHandle === 'tl') {
				newW = this.resizeStart.w - dx;
				newH = newW / ratio;
				newX = this.resizeStart.x + dx;
				newY = this.resizeStart.y - (newH - this.resizeStart.h);
			}
			
			// Minimum size check
			if (newW > 10 && newH > 10) {
				obj.width = newW;
				obj.height = newH;
				obj.x = newX;
				obj.y = newY;
				this.updatePropertiesPanel();
			}
			return;
		}
		
		// Handle Dragging
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
			
			// Build Preset Options
			let presetOpts = '';
			for (let name in this.resolutions) {
				presetOpts += `<option value="${name}">${name}</option>`;
			}
			
			const html = `
        <h4>Scene Properties</h4>
        <div class="prop-row"><label>Name</label><input value="${meta.sceneName}" onchange="Editor.updateSceneProp('sceneName', this.value)"></div>
        <div class="prop-row">
            <label>Preset Size</label>
            <select onchange="Editor.applyResolutionPreset(this.value)">${presetOpts}</select>
        </div>
        <div class="prop-row"><label>Width</label><input type="number" value="${meta.width}" onchange="Editor.updateSceneProp('width', Number(this.value))"></div>
        <div class="prop-row"><label>Height</label><input type="number" value="${meta.height}" onchange="Editor.updateSceneProp('height', Number(this.value))"></div>
        <div class="prop-row"><label>Bg Color</label><input type="color" value="${meta.backgroundColor}" onchange="Editor.updateSceneProp('backgroundColor', this.value)"></div>
        <div class="prop-row"><label>Grid Size</label><input type="number" value="${meta.grid.size}" onchange="Editor.updateSceneProp('gridSize', Number(this.value))"></div>
      `;
			this.propPanel.innerHTML = html;
			return;
		}
		
		const obj = this.data.objects.find(o => o.id === this.selectedId);
		if (!obj) return;
		
		let html = `
      <h4>Object Properties</h4>
      <div class="prop-row"><label>ID</label><input id="inp-id" value="${obj.id}" disabled></div>
      <div class="prop-row"><label>Name</label><input value="${obj.name}" onchange="Editor.updateProp('${obj.id}', 'name', this.value)"></div>
      <div class="prop-row"><button class="primary-btn" style="width:100%" onclick="Editor.fitObjectToScene('${obj.id}')">Fit to Scene</button></div>
      <div class="prop-row"><label>X</label><input type="number" id="inp-x" value="${Math.round(obj.x)}" onchange="Editor.updateProp('${obj.id}', 'x', Number(this.value))"></div>
      <div class="prop-row"><label>Y</label><input type="number" id="inp-y" value="${Math.round(obj.y)}" onchange="Editor.updateProp('${obj.id}', 'y', Number(this.value))"></div>
      <div class="prop-row"><label>W</label><input type="number" value="${Math.round(obj.width)}" onchange="Editor.updateProp('${obj.id}', 'width', Number(this.value))"></div>
      <div class="prop-row"><label>H</label><input type="number" value="${Math.round(obj.height)}" onchange="Editor.updateProp('${obj.id}', 'height', Number(this.value))"></div>
      <div class="prop-row"><label>Opacity</label><input type="number" step="0.1" min="0" max="1" value="${obj.opacity}" onchange="Editor.updateProp('${obj.id}', 'opacity', Number(this.value))"></div>
      <div class="prop-row"><label>Z-Index</label><input type="number" value="${obj.zIndex}" onchange="Editor.updateProp('${obj.id}', 'zIndex', Number(this.value))"></div>
    `;
		this.propPanel.innerHTML = html;
	},
	
	// Helpers exposed for HTML onchange events
	updateProp: function (id, key, val) {
		const obj = this.data.objects.find(o => o.id === id);
		if (obj) obj[key] = val;
	},
	
	updateSceneProp: function (key, val) {
		if (key === 'gridSize') {
			this.data.meta.grid.size = val;
		} else {
			this.data.meta[key] = val;
		}
		if (key === 'width') {
			this.canvas.width = val;
			this.setZoom(this.zoom); // Refresh CSS size
		}
		if (key === 'height') {
			this.canvas.height = val;
			this.setZoom(this.zoom);
		}
	},
	
	applyResolutionPreset: function (name) {
		const res = this.resolutions[name];
		if (res && res.w > 0) {
			this.updateSceneProp('width', res.w);
			this.updateSceneProp('height', res.h);
			this.updatePropertiesPanel();
			this.fitZoomToScreen(); // Auto fit when changing resolution
		}
	},
	
	fitObjectToScene: function (id) {
		const obj = this.data.objects.find(o => o.id === id);
		if (!obj) return;
		
		const sceneW = this.data.meta.width;
		const sceneH = this.data.meta.height;
		const objRatio = obj.width / obj.height;
		const sceneRatio = sceneW / sceneH;
		
		// Determine fit based on aspect ratios
		if (objRatio > sceneRatio) {
			// Object is wider than scene relative to height -> Fit to Width
			obj.width = sceneW;
			obj.height = sceneW / objRatio;
			obj.x = 0;
			obj.y = (sceneH - obj.height) / 2; // Center Y
		} else {
			// Object is taller -> Fit to Height
			obj.height = sceneH;
			obj.width = sceneH * objRatio;
			obj.y = 0;
			obj.x = (sceneW - obj.width) / 2; // Center X
		}
		this.updatePropertiesPanel();
	}
};

// Global Bridge for Asset Browser
window.addAssetToScene = function (path) {
	window.Editor.addAssetToScene(path);
};

document.addEventListener('DOMContentLoaded', () => {
	window.Editor.init();
});
