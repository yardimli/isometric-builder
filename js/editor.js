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
	// spriteData removed, delegated to SpriteAnimator
	isPlaying: false,
	selectedIds: [],
	lastTime: 0,
	// animState removed, delegated to SpriteAnimator
	zoom: 1.0,
	aspectLocked: true,
	isDirty: false,
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
	
	get selectedId () {
		if (this.selectedIds.length === 0) return null;
		return this.selectedIds[0];
	},
	
	set selectedId (val) {
		if (val === null || val === undefined) this.selectedIds = [];
		else this.selectedIds = [val];
	},
	
	init: function () {
		this.canvas = document.getElementById('gameCanvas');
		this.ctx = this.canvas.getContext('2d');
		this.wrapper = document.getElementById('canvas-wrapper');
		
		// Initialize Animator
		if (window.SpriteAnimator) window.SpriteAnimator.init();
		
		// Toolbar Actions
		document.getElementById('btn-play').onclick = () => { this.isPlaying = true; };
		document.getElementById('btn-pause').onclick = () => { this.isPlaying = false; };
		document.getElementById('btn-duplicate').onclick = () => window.Interaction.duplicateSelected();
		
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
		
		// Keyboard Shortcuts
		window.addEventListener('keydown', (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
				e.preventDefault();
				window.Interaction.duplicateSelected();
			}
			if (e.key === 'Delete') {
				if (this.selectedIds.length > 0) {
					this.deleteSelected();
				}
			}
		});
		
		// Modal Close Logic
		document.querySelectorAll('.close').forEach(span => {
			span.onclick = function () {
				this.closest('.modal').style.display = 'none';
			};
		});
		
		requestAnimationFrame((t) => this.gameLoop(t));
	},
	
	// --- UI Helpers ---
	
	updateTitle: function () {
		if (!this.data) return;
		const el = document.getElementById('scene-name');
		let name = this.data.meta.sceneName;
		if (this.isDirty) name += '*';
		el.innerText = name;
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
			if (obj.type === 'sprite-anim') {
				if (!obj.animSettings) obj.animSettings = {};
				// Ensure sequence array exists
				if (!obj.sequence) obj.sequence = [];
			}
		});
		
		document.getElementById('chk-grid-visible').checked = this.data.meta.grid.enabled;
		document.getElementById('chk-grid-snap').checked = this.data.meta.grid.snap;
		
		this.canvas.width = this.data.meta.width;
		this.canvas.height = this.data.meta.height;
		
		this.images = {};
		if (window.SpriteAnimator) window.SpriteAnimator.init();
		this.selectedIds = [];
		
		window.History.undoStack = [];
		window.History.redoStack = [];
		window.History.updateButtons();
		
		window.PropertiesPanel.update();
		window.Treeview.render();
		this.fitZoomToScreen();
		this.loadAssets();
		
		this.isDirty = false;
		this.updateTitle();
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
			if (obj.type === 'static' && obj.asset) {
				promises.push(this.loadImage(obj.asset, obj.asset));
			} else if (obj.type === 'sprite-anim' && window.SpriteAnimator) {
				promises.push(window.SpriteAnimator.loadSpriteData(obj.spriteName));
			}
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
		if (this.selectedIds.length === 1 && this.selectedIds[0] !== 'scene') {
			const selected = this.data.objects.find(o => o.id === this.selectedIds[0]);
			if (selected) {
				parentId = (selected.type === 'folder') ? selected.id : selected.parentId;
			}
		}
		
		const fileName = assetPath.split('/').pop().replace(/\.[^/.]+$/, '');
		let uniqueName = fileName;
		let suffix = 1;
		while (this.data.objects.some(o => o.name === uniqueName)) {
			uniqueName = `${fileName}_${suffix}`;
			suffix++;
		}
		
		const newObj = {
			id: 'obj_' + Date.now(),
			name: uniqueName,
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
			this.selectedIds = [newObj.id];
			window.PropertiesPanel.update();
			window.Treeview.render();
			document.getElementById('modal-assets').style.display = 'none';
		});
	},
	
	addSpriteToScene: function (spriteName) {
		if (!this.data) return;
		window.History.saveState();
		
		let parentId = null;
		if (this.selectedIds.length === 1 && this.selectedIds[0] !== 'scene') {
			const selected = this.data.objects.find(o => o.id === this.selectedIds[0]);
			if (selected) {
				parentId = (selected.type === 'folder') ? selected.id : selected.parentId;
			}
		}
		
		let uniqueName = spriteName;
		let suffix = 1;
		while (this.data.objects.some(o => o.name === uniqueName)) {
			uniqueName = `${spriteName}_${suffix}`;
			suffix++;
		}
		
		const newObj = {
			id: 'obj_' + Date.now(),
			name: uniqueName,
			type: 'sprite-anim',
			spriteName: spriteName,
			currentAnim: '',
			animSettings: {},
			sequence: [], // New sequence array
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
		
		if (window.SpriteAnimator) {
			window.SpriteAnimator.loadSpriteData(spriteName).then(() => {
				const anims = window.SpriteAnimator.spriteData[spriteName];
				if (anims) {
					const animKeys = Object.keys(anims);
					if (animKeys.length > 0) {
						newObj.currentAnim = animKeys[0];
						newObj.animSettings[newObj.currentAnim] = { fps: 10, stepX: 0, stepY: 0, resetLimit: 0 };
						
						// Add default sequence step (infinite loop)
						newObj.sequence.push({ anim: newObj.currentAnim, limit: 0 });
						
						const firstFrame = anims[newObj.currentAnim][0];
						const path = `assets/sprite-animation/${spriteName}/${newObj.currentAnim}/${firstFrame}`;
						const img = this.images[path];
						if (img) {
							newObj.width = img.width;
							newObj.height = img.height;
						}
					}
				}
				
				this.data.objects.push(newObj);
				this.selectedIds = [newObj.id];
				window.PropertiesPanel.update();
				window.Treeview.render();
			});
		}
	},
	
	gameLoop: function (timestamp) {
		if (!this.data) {
			requestAnimationFrame((t) => this.gameLoop(t));
			return;
		}
		const dt = (timestamp - this.lastTime) / 1000;
		this.lastTime = timestamp;
		
		if (this.isPlaying && window.SpriteAnimator) {
			window.SpriteAnimator.update(dt, this.data.objects);
		}
		this.render();
		requestAnimationFrame((t) => this.gameLoop(t));
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
		
		const sorted = this.data.objects.map((obj, index) => ({ obj, index }));
		sorted.sort((a, b) => {
			if (a.obj.zIndex !== b.obj.zIndex) {
				return a.obj.zIndex - b.obj.zIndex;
			}
			return a.index - b.index;
		});
		
		sorted.forEach(item => {
			const obj = item.obj;
			if (!obj.visible || obj.type === 'folder') return;
			this.ctx.save();
			this.ctx.globalAlpha = obj.opacity;
			
			if (obj.type === 'static') {
				const img = this.images[obj.asset];
				if (img) this.ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
				else { this.ctx.fillStyle = '#666'; this.ctx.fillRect(obj.x, obj.y, obj.width, obj.height); }
			} else if (obj.type === 'sprite-anim' && window.SpriteAnimator) {
				window.SpriteAnimator.draw(this.ctx, obj);
			}
			
			if (this.selectedIds.includes(obj.id)) {
				this.ctx.strokeStyle = '#00FF00'; this.ctx.lineWidth = 2;
				this.ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
				if (this.selectedIds.length === 1 && !obj.locked) {
					this.drawResizeHandles(obj);
				}
			}
			this.ctx.restore();
		});
		
		if (this.data.meta.grid.enabled) this.drawGrid();
	},
	
	drawGrid: function () {
		const sz = this.data.meta.grid.size;
		this.ctx.beginPath(); this.ctx.strokeStyle = 'rgba(255,255,255,0.4)';
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
		this.selectedIds = [id];
		this.deleteSelected();
	},
	
	deleteSelected: async function () {
		if (this.selectedIds.length === 0) return;
		const confirmed = await this.confirm(`Delete ${this.selectedIds.length} item(s)?\n(Folders will be unwrapped, keeping contents)`);
		if (confirmed) {
			window.History.saveState();
			const foldersToDelete = [];
			const objectsToDelete = [];
			this.selectedIds.forEach(id => {
				const obj = this.data.objects.find(o => o.id === id);
				if (obj) {
					if (obj.type === 'folder') foldersToDelete.push(obj.id);
					else objectsToDelete.push(obj.id);
				}
			});
			if (foldersToDelete.length > 0) {
				this.data.objects.forEach(obj => {
					if (foldersToDelete.includes(obj.parentId)) {
						obj.parentId = null;
					}
				});
			}
			this.data.objects = this.data.objects.filter(o => !this.selectedIds.includes(o.id));
			this.selectedIds = [];
			window.PropertiesPanel.update();
			window.Treeview.render();
		}
	},
	
	duplicateSelected: function () {
		if (window.Interaction) {
			window.Interaction.duplicateSelected();
		}
	},
	
	groupSelected: async function () {
		if (this.selectedIds.length < 2) return;
		let groupIndex = 1;
		while (this.data.objects.some(o => o.name === `group${groupIndex}`)) {
			groupIndex++;
		}
		const defaultName = `group${groupIndex}`;
		const name = await this.prompt('Enter group name:', defaultName);
		if (!name) return;
		window.History.saveState();
		const newFolder = {
			id: 'folder_' + Date.now(),
			name: name,
			type: 'folder',
			parentId: null,
			zIndex: 0,
			visible: true,
			locked: false
		};
		const firstObj = this.data.objects.find(o => o.id === this.selectedIds[0]);
		if (firstObj) newFolder.parentId = firstObj.parentId;
		this.data.objects.push(newFolder);
		this.selectedIds.forEach(id => {
			const obj = this.data.objects.find(o => o.id === id);
			if (obj) obj.parentId = newFolder.id;
		});
		this.selectedIds = [newFolder.id];
		window.Treeview.render();
		window.PropertiesPanel.update();
	},
	
	toggleMultiProperty: function (prop, value) {
		if (this.selectedIds.length === 0) return;
		window.History.saveState();
		this.selectedIds.forEach(id => {
			const obj = this.data.objects.find(o => o.id === id);
			if (obj) obj[prop] = value;
		});
		window.Treeview.render();
		window.PropertiesPanel.update();
	}
};

document.addEventListener('DOMContentLoaded', () => {
	window.Editor.init();
});
