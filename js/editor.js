document.addEventListener('DOMContentLoaded', () => {
	const canvas = document.getElementById('gameCanvas');
	const ctx = canvas.getContext('2d');
	const propPanel = document.getElementById('prop-content');
	
	// State
	let data = null; // Will be loaded via AJAX
	let images = {};
	let isPlaying = false;
	let selectedId = null;
	let isDragging = false;
	let dragOffset = { x: 0, y: 0 };
	let lastTime = 0;
	let animState = {};
	
	// --- Initialization ---
	
	function init() {
		// Setup UI Listeners
		document.getElementById('btn-play').onclick = () => isPlaying = true;
		document.getElementById('btn-pause').onclick = () => isPlaying = false;
		document.getElementById('chk-grid').onchange = (e) => { if(data) data.meta.grid.enabled = e.target.checked; };
		
		// Canvas Interaction
		canvas.addEventListener('mousedown', handleMouseDown);
		canvas.addEventListener('mousemove', handleMouseMove);
		canvas.addEventListener('mouseup', handleMouseUp);
		
		// Modal Logic
		setupModals();
		
		// Load Default Scene
		loadScene('forest_level_1.json');
	}
	
	// --- AJAX Operations ---
	
	function loadScene(filename) {
		const formData = new FormData();
		formData.append('action', 'load_scene');
		formData.append('filename', filename);
		
		fetch('php/file_manager.php', { method: 'POST', body: formData })
			.then(r => r.json())
			.then(res => {
				if (res.success) {
					data = res.data;
					document.getElementById('scene-name').innerText = data.meta.sceneName;
					canvas.width = data.meta.width;
					canvas.height = data.meta.height;
					
					// Reset State
					images = {};
					animState = {};
					selectedId = null;
					propPanel.innerHTML = '<p class="hint">Select an object.</p>';
					
					loadAssets().then(() => {
						requestAnimationFrame(gameLoop);
					});
				} else {
					alert('Error loading scene: ' + res.message);
					// Initialize empty if failed
					if(!data) createEmptyScene();
				}
			});
	}
	
	function saveScene(filename) {
		if (!data) return;
		data.meta.sceneName = filename.replace('.json', '');
		
		const formData = new FormData();
		formData.append('action', 'save_scene');
		formData.append('filename', filename);
		formData.append('data', JSON.stringify(data, null, 2));
		
		fetch('php/file_manager.php', { method: 'POST', body: formData })
			.then(r => r.json())
			.then(res => {
				alert(res.message);
				if(res.success) document.getElementById('scene-name').innerText = data.meta.sceneName;
			});
	}
	
	function listScenes() {
		const formData = new FormData();
		formData.append('action', 'list_scenes');
		
		fetch('php/file_manager.php', { method: 'POST', body: formData })
			.then(r => r.json())
			.then(res => {
				const list = document.getElementById('scene-list');
				list.innerHTML = '';
				if (res.success) {
					res.data.forEach(file => {
						const li = document.createElement('li');
						li.innerText = file;
						li.onclick = () => {
							loadScene(file);
							document.getElementById('modal-open').style.display = 'none';
						};
						list.appendChild(li);
					});
				}
			});
	}
	
	function createEmptyScene() {
		data = {
			meta: { version: "1.0", sceneName: "New Scene", width: 800, height: 600, backgroundColor: "#333", grid: { enabled: true, size: 32, snap: true } },
			library: { sprites: {} },
			objects: []
		};
		canvas.width = 800; canvas.height = 600;
		requestAnimationFrame(gameLoop);
	}
	
	// --- Modal Handling ---
	
	function setupModals() {
		const openModal = document.getElementById('modal-open');
		const saveModal = document.getElementById('modal-save');
		const assetsModal = document.getElementById('modal-assets');
		
		// Open
		document.getElementById('btn-open-modal').onclick = () => {
			listScenes();
			openModal.style.display = 'block';
		};
		
		// Save
		document.getElementById('btn-save-modal').onclick = () => {
			document.getElementById('inp-save-name').value = data ? (data.meta.sceneName + '.json') : '';
			saveModal.style.display = 'block';
		};
		document.getElementById('btn-confirm-save').onclick = () => {
			const name = document.getElementById('inp-save-name').value;
			if(name) {
				saveScene(name);
				saveModal.style.display = 'none';
			}
		};
		
		// Assets
		document.getElementById('btn-assets-modal').onclick = () => {
			assetsModal.style.display = 'block';
			// Trigger scan in assets.js if needed, though it inits on load
		};
		
		// Close Buttons
		document.querySelectorAll('.close').forEach(span => {
			span.onclick = function() {
				this.closest('.modal').style.display = 'none';
			}
		});
		
		// Click outside to close
		window.onclick = (event) => {
			if (event.target.classList.contains('modal')) {
				event.target.style.display = 'none';
			}
		};
	}
	
	// --- Asset Loading (Same logic, just updated references) ---
	
	function loadAssets() {
		const promises = [];
		if (data.meta.backgroundImage) promises.push(loadImage('bg', data.meta.backgroundImage));
		
		data.objects.forEach(obj => {
			if (obj.type === 'static' && obj.asset) promises.push(loadImage(obj.asset, obj.asset));
		});
		
		const library = data.library.sprites;
		for (let key in library) {
			if (library[key].sourceFile) promises.push(loadImage(library[key].sourceFile, library[key].sourceFile));
		}
		return Promise.all(promises);
	}
	
	function loadImage(key, src) {
		return new Promise((resolve) => {
			if (images[key]) return resolve();
			const img = new Image();
			img.src = src; // Relative path handled by browser
			img.onload = () => { images[key] = img; resolve(); };
			img.onerror = () => { console.warn(`Missing: ${src}`); images[key] = null; resolve(); };
		});
	}
	
	// --- Game Loop (Standard) ---
	
	function gameLoop(timestamp) {
		if (!data) return;
		const dt = (timestamp - lastTime) / 1000;
		lastTime = timestamp;
		
		if (isPlaying) updateAnimations(dt);
		render();
		requestAnimationFrame(gameLoop);
	}
	
	function updateAnimations(dt) {
		data.objects.forEach(obj => {
			if (obj.type !== 'sprite') return;
			if (!animState[obj.id]) animState[obj.id] = { frameIndex: 0, timer: 0 };
			
			const config = data.library.sprites[obj.spriteConfigId];
			if (!config) return;
			const anim = config.animations[obj.currentAnimation];
			if (!anim) return;
			
			const state = animState[obj.id];
			state.timer += dt;
			if (state.timer >= (1 / anim.fps)) {
				state.timer = 0;
				state.frameIndex++;
				if (state.frameIndex >= anim.frames.length) {
					state.frameIndex = anim.loop ? 0 : anim.frames.length - 1;
				}
			}
		});
	}
	
	// --- Rendering ---
	
	function render() {
		ctx.fillStyle = data.meta.backgroundColor;
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		
		if (data.meta.backgroundImage && images['bg']) {
			if (data.meta.backgroundMode === 'tile') {
				const p = ctx.createPattern(images['bg'], 'repeat');
				ctx.fillStyle = p; ctx.fillRect(0, 0, canvas.width, canvas.height);
			} else {
				ctx.drawImage(images['bg'], 0, 0, canvas.width, canvas.height);
			}
		}
		
		if (data.meta.grid.enabled) drawGrid();
		
		const sorted = [...data.objects].sort((a, b) => a.zIndex - b.zIndex);
		sorted.forEach(obj => {
			if (!obj.visible) return;
			ctx.save();
			ctx.globalAlpha = obj.opacity;
			
			if (obj.type === 'static') {
				const img = images[obj.asset];
				if (img) ctx.drawImage(img, obj.x, obj.y, obj.width, obj.height);
				else { ctx.fillStyle = '#666'; ctx.fillRect(obj.x, obj.y, obj.width, obj.height); }
			} else if (obj.type === 'sprite') {
				drawSprite(obj);
			}
			
			if (selectedId === obj.id) {
				ctx.strokeStyle = '#00FF00'; ctx.lineWidth = 2;
				ctx.strokeRect(obj.x, obj.y, obj.width, obj.height);
			}
			ctx.restore();
		});
	}
	
	function drawSprite(obj) {
		const config = data.library.sprites[obj.spriteConfigId];
		if (!config) return;
		const img = images[config.sourceFile];
		if (!img) return;
		
		const anim = config.animations[obj.currentAnimation];
		const state = animState[obj.id] || { frameIndex: 0 };
		const frameId = anim.frames[state.frameIndex];
		
		const cols = Math.floor(img.width / config.frameWidth);
		const col = frameId % cols;
		const row = Math.floor(frameId / cols);
		
		ctx.drawImage(img, col * config.frameWidth, row * config.frameHeight, config.frameWidth, config.frameHeight, obj.x, obj.y, obj.width, obj.height);
	}
	
	function drawGrid() {
		const sz = data.meta.grid.size;
		ctx.beginPath(); ctx.strokeStyle = 'rgba(255,255,255,0.2)';
		for (let x = 0; x <= canvas.width; x += sz) { ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); }
		for (let y = 0; y <= canvas.height; y += sz) { ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); }
		ctx.stroke();
	}
	
	// --- Interaction ---
	
	function getMousePos(e) {
		const r = canvas.getBoundingClientRect();
		return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
	}
	
	function handleMouseDown(e) {
		if(!data) return;
		const pos = getMousePos(e);
		const sorted = [...data.objects].sort((a, b) => b.zIndex - a.zIndex);
		const clicked = sorted.find(o => pos.x >= o.x && pos.x <= o.x + o.width && pos.y >= o.y && pos.y <= o.y + o.height);
		
		if (clicked) {
			selectedId = clicked.id;
			updatePropertiesPanel(clicked);
			if (!clicked.locked) {
				isDragging = true;
				dragOffset = { x: pos.x - clicked.x, y: pos.y - clicked.y };
			}
		} else {
			selectedId = null;
			propPanel.innerHTML = '<p class="hint">Select an object.</p>';
		}
	}
	
	function handleMouseMove(e) {
		if (!isDragging || !selectedId) return;
		const pos = getMousePos(e);
		const obj = data.objects.find(o => o.id === selectedId);
		if (!obj) return;
		
		let nx = pos.x - dragOffset.x;
		let ny = pos.y - dragOffset.y;
		
		if (data.meta.grid.snap) {
			const sz = data.meta.grid.size;
			nx = Math.round(nx / sz) * sz;
			ny = Math.round(ny / sz) * sz;
		}
		obj.x = nx; obj.y = ny;
		updatePropertiesPanel(obj);
	}
	
	function handleMouseUp() { isDragging = false; }
	
	function updatePropertiesPanel(obj) {
		const existing = document.getElementById('inp-id');
		if (existing && existing.value === obj.id) {
			document.getElementById('inp-x').value = obj.x;
			document.getElementById('inp-y').value = obj.y;
			return;
		}
		let html = `
            <div class="prop-row"><label>ID</label><input id="inp-id" value="${obj.id}" disabled></div>
            <div class="prop-row"><label>Name</label><input value="${obj.name}" onchange="updateProp('${obj.id}', 'name', this.value)"></div>
            <div class="prop-row"><label>X</label><input type="number" id="inp-x" value="${obj.x}" onchange="updateProp('${obj.id}', 'x', Number(this.value))"></div>
            <div class="prop-row"><label>Y</label><input type="number" id="inp-y" value="${obj.y}" onchange="updateProp('${obj.id}', 'y', Number(this.value))"></div>
            <div class="prop-row"><label>W</label><input type="number" value="${obj.width}" onchange="updateProp('${obj.id}', 'width', Number(this.value))"></div>
            <div class="prop-row"><label>H</label><input type="number" value="${obj.height}" onchange="updateProp('${obj.id}', 'height', Number(this.value))"></div>
        `;
		propPanel.innerHTML = html;
	}
	
	window.updateProp = function(id, key, val) {
		const obj = data.objects.find(o => o.id === id);
		if (obj) obj[key] = val;
	};
	
	init();
});
