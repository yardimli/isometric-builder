/**
 * js/properties.js
 * Handles the rendering and logic for the Properties Panel.
 */

window.PropertiesPanel = {
	// Panel References
	panelEmpty: null,
	panelScene: null,
	panelObject: null,
	panelMulti: null,
	editingSequenceIndex: -1, // Tracks which sequence step is being edited
	
	init: function () {
		this.panelEmpty = document.getElementById('prop-empty');
		this.panelScene = document.getElementById('prop-scene');
		this.panelObject = document.getElementById('prop-object');
		this.panelMulti = document.getElementById('prop-multi');
		
		// Populate Scene Presets
		const presetSelect = document.getElementById('sel-scene-preset');
		if (presetSelect && window.Editor && window.Editor.resolutions) {
			let opts = '';
			for (const name in window.Editor.resolutions) {
				opts += `<option value="${name}">${name}</option>`;
			}
			presetSelect.innerHTML = opts;
		}
	},
	
	/**
	 * Main update function. Determines which panel to show.
	 */
	update: function () {
		if (!window.Editor || !window.Editor.data) return;
		
		const selectedIds = window.Editor.selectedIds;
		
		// Hide all panels first
		this.panelEmpty.style.display = 'none';
		this.panelScene.style.display = 'none';
		this.panelObject.style.display = 'none';
		this.panelMulti.style.display = 'none';
		
		// If nothing is selected, or "scene" is explicitly selected, show Scene Properties
		if (selectedIds.length === 0 || (selectedIds.length === 1 && selectedIds[0] === 'scene')) {
			this.updateSceneView();
			this.panelScene.style.display = 'block';
		} else if (selectedIds.length === 1) {
			const id = selectedIds[0];
			this.updateObjectView(id);
			this.panelObject.style.display = 'block';
		} else {
			// Multi-selection
			this.updateMultiView(selectedIds);
			this.panelMulti.style.display = 'block';
		}
	},
	
	// --- Scene View Logic ---
	
	updateSceneView: function () {
		const meta = window.Editor.data.meta;
		document.getElementById('inp-scene-name').value = meta.sceneName;
		document.getElementById('inp-scene-w').value = meta.width;
		document.getElementById('inp-scene-h').value = meta.height;
		document.getElementById('inp-scene-bg').value = meta.backgroundColor;
		document.getElementById('inp-scene-grid').value = meta.grid.size;
	},
	
	updateSceneProp: function (key, val) {
		window.History.saveState();
		if (key === 'gridSize') {
			window.Editor.data.meta.grid.size = val;
		} else {
			window.Editor.data.meta[key] = val;
		}
		
		if (key === 'width' || key === 'height') {
			window.Editor.canvas[key] = val;
			window.Editor.setZoom(window.Editor.zoom);
		}
		if (key === 'sceneName') window.Treeview.render();
	},
	
	applyResolutionPreset: function (name) {
		const res = window.Editor.resolutions[name];
		if (res && res.w > 0) {
			window.History.saveState();
			window.Editor.data.meta.width = res.w;
			window.Editor.data.meta.height = res.h;
			window.Editor.canvas.width = res.w;
			window.Editor.canvas.height = res.h;
			window.Editor.setZoom(window.Editor.zoom);
			window.Editor.fitZoomToScreen();
			this.updateSceneView();
		}
	},
	
	// --- Object View Logic ---
	
	updateObjectView: function (id) {
		const obj = window.Editor.data.objects.find(o => o.id === id);
		if (!obj) return;
		
		const isFolder = obj.type === 'folder';
		const isSpriteAnim = obj.type === 'sprite-anim';
		const sceneW = window.Editor.data.meta.width;
		const sceneH = window.Editor.data.meta.height;
		
		// Header
		let typeLabel = 'Object Properties';
		if (isFolder) typeLabel = 'Folder Properties';
		else if (isSpriteAnim) typeLabel = 'Sprite Animation';
		document.getElementById('lbl-obj-type').innerText = typeLabel;
		
		// Common Props
		document.getElementById('inp-obj-name').value = obj.name;
		document.getElementById('chk-obj-visible').checked = obj.visible;
		document.getElementById('chk-obj-locked').checked = obj.locked;
		document.getElementById('inp-obj-z').value = obj.zIndex;
		
		// Transform Group (Hide for folders)
		const transformGroup = document.getElementById('grp-obj-transform');
		const fitBtn = document.getElementById('btn-obj-fit');
		const spriteGroup = document.getElementById('grp-obj-sprite');
		const sequencerGroup = document.getElementById('grp-obj-sequencer');
		
		// Handle Sprite Animation Specifics
		if (isSpriteAnim) {
			spriteGroup.style.display = 'block';
			sequencerGroup.style.display = 'block'; // Always show sequencer
			
			// Ensure settings object exists
			if (!obj.animSettings) obj.animSettings = {};
			if (!obj.sequence) obj.sequence = [];
			
			// Populate Animation Dropdowns
			const animSelect = document.getElementById('sel-obj-anim'); // For editing settings
			const animSelectSeq = document.getElementById('sel-seq-anim'); // For adding to sequence
			animSelect.innerHTML = '';
			animSelectSeq.innerHTML = '';
			
			const spriteData = window.SpriteAnimator ? window.SpriteAnimator.spriteData[obj.spriteName] : null;
			
			if (spriteData) {
				for (const animName in spriteData) {
					// Main dropdown (Settings)
					const opt = document.createElement('option');
					opt.value = animName;
					opt.innerText = animName;
					// Select the animation currently being edited (stored in currentAnim)
					if (obj.currentAnim === animName) opt.selected = true;
					animSelect.appendChild(opt);
					
					// Sequencer dropdown
					const optSeq = document.createElement('option');
					optSeq.value = animName;
					optSeq.innerText = animName;
					animSelectSeq.appendChild(optSeq);
				}
			} else {
				animSelect.innerHTML = '<option>Loading...</option>';
			}
			
			// Render the Sequence List
			this.renderSequencerList(obj);
			
			// Reset Edit Mode if we switched objects
			if (this.editingSequenceIndex !== -1) {
				this.cancelEdit();
			}
			
			// Render Settings for the *currently selected animation in the dropdown*
			// Note: obj.currentAnim here acts as "currently editing settings for..."
			const currentSettings = obj.animSettings[obj.currentAnim] || { fps: 10, stepX: 0, stepY: 0 };
			document.getElementById('inp-obj-fps').value = currentSettings.fps || 10;
			document.getElementById('inp-obj-step-x').value = currentSettings.stepX || 0;
			document.getElementById('inp-obj-step-y').value = currentSettings.stepY || 0;
			
		} else {
			spriteGroup.style.display = 'none';
			sequencerGroup.style.display = 'none';
		}
		
		if (isFolder) {
			transformGroup.style.display = 'none';
			fitBtn.style.display = 'none';
		} else {
			transformGroup.style.display = 'block';
			fitBtn.style.display = 'block';
			
			// Values
			document.getElementById('inp-obj-x').value = Math.round(obj.x);
			document.getElementById('inp-obj-y').value = Math.round(obj.y);
			document.getElementById('inp-obj-w').value = Math.round(obj.width);
			document.getElementById('inp-obj-h').value = Math.round(obj.height);
			
			// Percentages
			const widthPct = sceneW > 0 ? ((obj.width / sceneW) * 100).toFixed(2) : 0;
			const heightPct = sceneH > 0 ? ((obj.height / sceneH) * 100).toFixed(2) : 0;
			document.getElementById('inp-obj-w-pct').value = widthPct;
			document.getElementById('inp-obj-h-pct').value = heightPct;
			
			// Opacity
			document.getElementById('rng-obj-opacity').value = obj.opacity;
			document.getElementById('inp-obj-opacity').value = obj.opacity;
			
			// Aspect Lock Button State
			const lockBtn = document.getElementById('btn-aspect-lock');
			if (window.Editor.aspectLocked) lockBtn.classList.add('active');
			else lockBtn.classList.remove('active');
		}
		
		// Delete Button Logic
		const delBtn = document.getElementById('btn-obj-delete');
		delBtn.innerText = `Delete ${isFolder ? 'Folder' : 'Asset'}`;
		delBtn.disabled = false;
		delBtn.title = isFolder ? 'Deletes folder and moves contents to root' : 'Deletes selected object';
	},
	
	updateObjProp: function (key, val, isContinuous = false) {
		if (window.Editor.selectedIds.length !== 1) return;
		const id = window.Editor.selectedIds[0];
		const obj = window.Editor.data.objects.find(o => o.id === id);
		if (!obj) return;
		
		if (!isContinuous) window.History.saveState();
		
		const oldW = obj.width;
		const oldH = obj.height;
		obj[key] = val;
		
		// Aspect Ratio Logic
		if (window.Editor.aspectLocked && obj.type !== 'folder') {
			const ratio = oldW / oldH;
			if (key === 'width' && ratio !== 0) obj.height = val / ratio;
			if (key === 'height') obj.width = val * ratio;
		}
		
		if (key === 'name' || key === 'zIndex') window.Treeview.render();
		
		// If changing the "Edit Settings For" dropdown
		if (key === 'currentAnim') {
			// Ensure settings entry exists for the new animation
			if (!obj.animSettings[val]) {
				obj.animSettings[val] = { fps: 10, stepX: 0, stepY: 0 };
			}
			this.update(); // Force update to refresh FPS/Step inputs for the new animation
			return;
		}
		
		if (isContinuous) {
			if (key === 'opacity') {
				document.getElementById('inp-obj-opacity').value = val;
			}
			window.Editor.render();
		} else {
			if (key !== 'currentAnim') {
				this.update();
			}
			window.Editor.render();
		}
	},
	
	// Update specific settings for the current animation being edited
	updateSpriteSetting: function (key, val) {
		if (window.Editor.selectedIds.length !== 1) return;
		const id = window.Editor.selectedIds[0];
		const obj = window.Editor.data.objects.find(o => o.id === id);
		if (!obj || obj.type !== 'sprite-anim') return;
		
		window.History.saveState();
		
		// Ensure settings object exists
		if (!obj.animSettings) obj.animSettings = {};
		if (!obj.animSettings[obj.currentAnim]) {
			obj.animSettings[obj.currentAnim] = { fps: 10, stepX: 0, stepY: 0 };
		}
		
		obj.animSettings[obj.currentAnim][key] = val;
		
		// No need to full update(), just render to see FPS/Offset changes
		// Note: Changes will only be visible if the Sequencer is currently playing this animation
		window.Editor.render();
	},
	
	updateObjPropPct: function (key, pctVal) {
		if (window.Editor.selectedIds.length !== 1) return;
		const sceneW = window.Editor.data.meta.width;
		const sceneH = window.Editor.data.meta.height;
		let pxVal = 0;
		
		if (key === 'width') pxVal = (pctVal / 100) * sceneW;
		if (key === 'height') pxVal = (pctVal / 100) * sceneH;
		
		this.updateObjProp(key, pxVal);
	},
	
	fitObject: function () {
		if (window.Editor.selectedIds.length === 1) {
			window.Editor.fitObjectToScene(window.Editor.selectedIds[0]);
		}
	},
	
	toggleAspect: function () {
		window.Editor.aspectLocked = !window.Editor.aspectLocked;
		this.update();
	},
	
	// --- Sequencer Logic ---
	
	toggleSequenceType: function () {
		const type = document.querySelector('input[name="seq-type"]:checked').value;
		const animGroup = document.getElementById('seq-input-anim');
		const pauseGroup = document.getElementById('seq-input-pause');
		
		if (type === 'pause') {
			animGroup.style.display = 'none';
			pauseGroup.style.display = 'block';
		} else {
			animGroup.style.display = 'flex';
			pauseGroup.style.display = 'none';
		}
	},
	
	renderSequencerList: function (obj) {
		const list = document.getElementById('seq-list');
		list.innerHTML = '';
		
		obj.sequence.forEach((item, index) => {
			const row = document.createElement('div');
			row.className = 'seq-item';
			row.style.display = 'flex';
			row.style.gap = '5px';
			row.style.marginBottom = '5px';
			row.style.alignItems = 'center';
			row.style.background = (index === this.editingSequenceIndex) ? '#444' : '#333';
			row.style.border = (index === this.editingSequenceIndex) ? '1px solid #d9a521' : '1px solid transparent';
			row.style.padding = '4px';
			
			let label = '';
			let subLabel = '';
			
			if (item.type === 'pause') {
				label = '⏸ Pause';
				subLabel = `${item.duration}s`;
			} else {
				// Default to animation if type is missing (backward compatibility)
				label = `🎬 ${item.anim}`;
				subLabel = (item.limit > 0) ? `${item.limit} steps` : 'Infinite';
			}
			
			const isFirst = index === 0;
			const isLast = index === obj.sequence.length - 1;
			
			// Button styles
			const btnStyle = 'background:#444; border:1px solid #555; color:#ccc; cursor:pointer; padding:2px 5px; font-size:10px;';
			const btnDisabledStyle = 'background:#333; border:1px solid #444; color:#666; cursor:default; padding:2px 5px; font-size:10px; opacity:0.5;';
			
			row.innerHTML = `
        <span style="font-size:11px; color:#888; width:15px;">${index + 1}.</span>
        <span style="flex:1; font-size:12px;">${label}</span>
        <span style="font-size:11px; color:#aaa;">(${subLabel})</span>
        <div style="display:flex; gap:2px;">
            <button class="btn-seq-up" style="${isFirst ? btnDisabledStyle : btnStyle}" ${isFirst ? 'disabled' : ''}>▲</button>
            <button class="btn-seq-down" style="${isLast ? btnDisabledStyle : btnStyle}" ${isLast ? 'disabled' : ''}>▼</button>
            <button class="btn-seq-edit" style="background:#007acc; border:none; color:white; cursor:pointer; padding:2px 6px; margin-left:2px;">✎</button>
            <button class="btn-seq-del" style="background:#a31515; border:none; color:white; cursor:pointer; padding:2px 6px;">x</button>
        </div>
      `;
			
			row.querySelector('.btn-seq-up').onclick = () => this.moveSequenceStep(index, -1);
			row.querySelector('.btn-seq-down').onclick = () => this.moveSequenceStep(index, 1);
			
			row.querySelector('.btn-seq-edit').onclick = () => {
				this.editSequenceStep(index, item);
			};
			
			row.querySelector('.btn-seq-del').onclick = () => {
				this.removeSequenceStep(index);
			};
			
			list.appendChild(row);
		});
	},
	
	moveSequenceStep: function (index, direction) {
		if (window.Editor.selectedIds.length !== 1) return;
		const id = window.Editor.selectedIds[0];
		const obj = window.Editor.data.objects.find(o => o.id === id);
		if (!obj) return;
		
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= obj.sequence.length) return;
		
		window.History.saveState();
		
		// Cancel editing if moving to avoid index mismatch
		if (this.editingSequenceIndex !== -1) {
			this.cancelEdit();
		}
		
		// Swap elements
		const temp = obj.sequence[index];
		obj.sequence[index] = obj.sequence[newIndex];
		obj.sequence[newIndex] = temp;
		
		if (window.SpriteAnimator) window.SpriteAnimator.resetState(obj.id);
		this.update();
	},
	
	addSequenceStep: function () {
		if (window.Editor.selectedIds.length !== 1) return;
		const id = window.Editor.selectedIds[0];
		const obj = window.Editor.data.objects.find(o => o.id === id);
		if (!obj) return;
		
		const type = document.querySelector('input[name="seq-type"]:checked').value;
		let newItem = {};
		
		if (type === 'pause') {
			const duration = parseFloat(document.getElementById('inp-seq-duration').value) || 1.0;
			newItem = { type: 'pause', duration: duration };
		} else {
			const anim = document.getElementById('sel-seq-anim').value;
			const limit = parseInt(document.getElementById('inp-seq-limit').value) || 0;
			if (!anim) return;
			newItem = { type: 'anim', anim: anim, limit: limit };
			
			// Ensure settings exist for this animation
			if (!obj.animSettings[anim]) {
				obj.animSettings[anim] = { fps: 10, stepX: 0, stepY: 0 };
			}
		}
		
		window.History.saveState();
		obj.sequence.push(newItem);
		
		if (window.SpriteAnimator) window.SpriteAnimator.resetState(obj.id);
		this.update();
	},
	
	editSequenceStep: function (index, item) {
		this.editingSequenceIndex = index;
		
		// Set UI to Edit Mode
		document.getElementById('btn-seq-add').style.display = 'none';
		document.getElementById('btn-seq-update').style.display = 'block';
		document.getElementById('btn-seq-cancel').style.display = 'block';
		
		// Populate inputs
		const type = item.type || 'anim';
		const radios = document.getElementsByName('seq-type');
		for (const r of radios) {
			r.checked = (r.value === type);
		}
		this.toggleSequenceType();
		
		if (type === 'pause') {
			document.getElementById('inp-seq-duration').value = item.duration;
		} else {
			document.getElementById('sel-seq-anim').value = item.anim;
			document.getElementById('inp-seq-limit').value = item.limit;
		}
		
		// Refresh list to show highlight
		if (window.Editor.selectedIds.length === 1) {
			const obj = window.Editor.data.objects.find(o => o.id === window.Editor.selectedIds[0]);
			this.renderSequencerList(obj);
		}
	},
	
	updateSequenceStep: function () {
		if (this.editingSequenceIndex === -1) return;
		if (window.Editor.selectedIds.length !== 1) return;
		const id = window.Editor.selectedIds[0];
		const obj = window.Editor.data.objects.find(o => o.id === id);
		if (!obj) return;
		
		const type = document.querySelector('input[name="seq-type"]:checked').value;
		let updatedItem = {};
		
		if (type === 'pause') {
			const duration = parseFloat(document.getElementById('inp-seq-duration').value) || 1.0;
			updatedItem = { type: 'pause', duration: duration };
		} else {
			const anim = document.getElementById('sel-seq-anim').value;
			const limit = parseInt(document.getElementById('inp-seq-limit').value) || 0;
			if (!anim) return;
			updatedItem = { type: 'anim', anim: anim, limit: limit };
			
			if (!obj.animSettings[anim]) {
				obj.animSettings[anim] = { fps: 10, stepX: 0, stepY: 0 };
			}
		}
		
		window.History.saveState();
		obj.sequence[this.editingSequenceIndex] = updatedItem;
		
		// Reset UI
		this.cancelEdit();
		if (window.SpriteAnimator) window.SpriteAnimator.resetState(obj.id);
	},
	
	cancelEdit: function () {
		this.editingSequenceIndex = -1;
		document.getElementById('btn-seq-add').style.display = 'block';
		document.getElementById('btn-seq-update').style.display = 'none';
		document.getElementById('btn-seq-cancel').style.display = 'none';
		
		// Reset inputs to default
		document.getElementById('inp-seq-limit').value = '';
		document.getElementById('inp-seq-duration').value = '1.0';
		
		if (window.Editor.selectedIds.length === 1) {
			const obj = window.Editor.data.objects.find(o => o.id === window.Editor.selectedIds[0]);
			this.renderSequencerList(obj);
		}
	},
	
	removeSequenceStep: function (index) {
		if (window.Editor.selectedIds.length !== 1) return;
		const id = window.Editor.selectedIds[0];
		const obj = window.Editor.data.objects.find(o => o.id === id);
		if (!obj) return;
		
		window.History.saveState();
		
		// If deleting the item currently being edited, cancel edit mode
		if (index === this.editingSequenceIndex) {
			this.cancelEdit();
		} else if (index < this.editingSequenceIndex) {
			this.editingSequenceIndex--; // Shift index if deleting item above
		}
		
		obj.sequence.splice(index, 1);
		if (window.SpriteAnimator) window.SpriteAnimator.resetState(obj.id);
		this.update();
	},
	
	// --- Multi Selection Logic ---
	
	updateMultiView: function (ids) {
		document.getElementById('lbl-multi-count').innerText = ids.length;
		
		// Calculate Average Percentages
		const sceneW = window.Editor.data.meta.width;
		const sceneH = window.Editor.data.meta.height;
		let totalPctW = 0;
		let totalPctH = 0;
		let count = 0;
		
		ids.forEach(id => {
			const obj = window.Editor.data.objects.find(o => o.id === id);
			if (obj && obj.type !== 'folder') {
				totalPctW += (obj.width / sceneW) * 100;
				totalPctH += (obj.height / sceneH) * 100;
				count++;
			}
		});
		
		const avgW = count > 0 ? (totalPctW / count).toFixed(2) : 0;
		const avgH = count > 0 ? (totalPctH / count).toFixed(2) : 0;
		
		document.getElementById('inp-multi-w-pct').value = avgW;
		document.getElementById('inp-multi-h-pct').value = avgH;
	},
	
	updateMultiPropPct: function (key, pctVal) {
		if (window.Editor.selectedIds.length === 0) return;
		window.History.saveState();
		
		const sceneW = window.Editor.data.meta.width;
		const sceneH = window.Editor.data.meta.height;
		
		window.Editor.selectedIds.forEach(id => {
			const obj = window.Editor.data.objects.find(o => o.id === id);
			if (obj && obj.type !== 'folder') {
				if (key === 'width') {
					obj.width = (pctVal / 100) * sceneW;
				} else if (key === 'height') {
					obj.height = (pctVal / 100) * sceneH;
				}
			}
		});
		
		window.Editor.render();
	}
};

document.addEventListener('DOMContentLoaded', () => {
	window.PropertiesPanel.init();
});
