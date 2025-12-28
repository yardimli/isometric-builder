/**
 * editor.js
 * Handles the Canvas, Game Loop, Object Interaction, and Properties Panel.
 */

window.Editor = {
	canvas: null,
	ctx: null,
	propPanel: null,
	
	// State
	data: null,
	images: {},
	isPlaying: false,
	selectedId: 'scene', // 'scene' or object ID
	isDragging: false,
	dragOffset: { x: 0, y: 0 },
	lastTime: 0,
	animState: {},
	
	init: function () {
		this.canvas = document.getElementById('gameCanvas');
		this.ctx = this.canvas.getContext('2d');
		this.propPanel = document.getElementById('prop-content');
		
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
		this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
		this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
		this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
		
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
		
		this.loadAssets();
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
			
			if (this.selectedId === obj.id) {
				this.ctx.strokeStyle = '#00FF00'; this.ctx.lineWidth = 2;
				this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
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
	
	// --- Interaction ---
	
	getMousePos: function (e) {
		const r = this.canvas.getBoundingClientRect();
		return { x: (e.clientX - r.left) * (this.canvas.width / r.width), y: (e.clientY - r.top) * (this.canvas.height / r.height) };
	},
	
	handleMouseDown: function (e) {
		if (!this.data) return;
		const pos = this.getMousePos(e);
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
		if (!this.isDragging || !this.selectedId || this.selectedId === 'scene') return;
		const pos = this.getMousePos(e);
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
	
	handleMouseUp: function () { this.isDragging = false; },
	
	updatePropertiesPanel: function () {
		if (!this.data) return;
		
		if (this.selectedId === 'scene') {
			const meta = this.data.meta;
			const html = `
        <h4>Scene Properties</h4>
        <div class="prop-row"><label>Name</label><input value="${meta.sceneName}" onchange="Editor.updateSceneProp('sceneName', this.value)"></div>
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
      <div class="prop-row"><label>X</label><input type="number" id="inp-x" value="${obj.x}" onchange="Editor.updateProp('${obj.id}', 'x', Number(this.value))"></div>
      <div class="prop-row"><label>Y</label><input type="number" id="inp-y" value="${obj.y}" onchange="Editor.updateProp('${obj.id}', 'y', Number(this.value))"></div>
      <div class="prop-row"><label>W</label><input type="number" value="${obj.width}" onchange="Editor.updateProp('${obj.id}', 'width', Number(this.value))"></div>
      <div class="prop-row"><label>H</label><input type="number" value="${obj.height}" onchange="Editor.updateProp('${obj.id}', 'height', Number(this.value))"></div>
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
		if (key === 'width') this.canvas.width = val;
		if (key === 'height') this.canvas.height = val;
	}
};

// Global Bridge for Asset Browser
window.addAssetToScene = function (path) {
	window.Editor.addAssetToScene(path);
};

document.addEventListener('DOMContentLoaded', () => {
	window.Editor.init();
});
