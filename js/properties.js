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
	
	init: function () {
		this.panelEmpty = document.getElementById('prop-empty')
		this.panelScene = document.getElementById('prop-scene')
		this.panelObject = document.getElementById('prop-object')
		this.panelMulti = document.getElementById('prop-multi')
		
		// Populate Scene Presets
		const presetSelect = document.getElementById('sel-scene-preset')
		if (presetSelect && window.Editor && window.Editor.resolutions) {
			let opts = ''
			for (const name in window.Editor.resolutions) {
				opts += `<option value="${name}">${name}</option>`
			}
			presetSelect.innerHTML = opts
		}
	},
	
	/**
	 * Main update function. Determines which panel to show.
	 */
	update: function () {
		if (!window.Editor || !window.Editor.data) return
		
		const selectedIds = window.Editor.selectedIds
		
		// Hide all panels first
		this.panelEmpty.style.display = 'none'
		this.panelScene.style.display = 'none'
		this.panelObject.style.display = 'none'
		this.panelMulti.style.display = 'none'
		
		// If nothing is selected, or "scene" is explicitly selected, show Scene Properties
		if (selectedIds.length === 0 || (selectedIds.length === 1 && selectedIds[0] === 'scene')) {
			this.updateSceneView()
			this.panelScene.style.display = 'block'
		} else if (selectedIds.length === 1) {
			const id = selectedIds[0]
			this.updateObjectView(id)
			this.panelObject.style.display = 'block'
		} else {
			// Multi-selection
			this.updateMultiView(selectedIds)
			this.panelMulti.style.display = 'block'
		}
	},
	
	// --- Scene View Logic ---
	
	updateSceneView: function () {
		const meta = window.Editor.data.meta
		document.getElementById('inp-scene-name').value = meta.sceneName
		document.getElementById('inp-scene-w').value = meta.width
		document.getElementById('inp-scene-h').value = meta.height
		document.getElementById('inp-scene-bg').value = meta.backgroundColor
		document.getElementById('inp-scene-grid').value = meta.grid.size
	},
	
	updateSceneProp: function (key, val) {
		window.History.saveState()
		if (key === 'gridSize') {
			window.Editor.data.meta.grid.size = val
		} else {
			window.Editor.data.meta[key] = val
		}
		
		if (key === 'width' || key === 'height') {
			window.Editor.canvas[key] = val
			window.Editor.setZoom(window.Editor.zoom)
		}
		if (key === 'sceneName') window.Treeview.render()
	},
	
	applyResolutionPreset: function (name) {
		const res = window.Editor.resolutions[name]
		if (res && res.w > 0) {
			window.History.saveState()
			window.Editor.data.meta.width = res.w
			window.Editor.data.meta.height = res.h
			window.Editor.canvas.width = res.w
			window.Editor.canvas.height = res.h
			window.Editor.setZoom(window.Editor.zoom)
			window.Editor.fitZoomToScreen()
			this.updateSceneView()
		}
	},
	
	// --- Object View Logic ---
	
	updateObjectView: function (id) {
		const obj = window.Editor.data.objects.find(o => o.id === id)
		if (!obj) return
		
		const isFolder = obj.type === 'folder'
		const isSpriteAnim = obj.type === 'sprite-anim'
		const sceneW = window.Editor.data.meta.width
		const sceneH = window.Editor.data.meta.height
		
		// Header
		let typeLabel = 'Object Properties'
		if (isFolder) typeLabel = 'Folder Properties'
		else if (isSpriteAnim) typeLabel = 'Sprite Animation'
		document.getElementById('lbl-obj-type').innerText = typeLabel
		
		// Common Props
		document.getElementById('inp-obj-name').value = obj.name
		document.getElementById('chk-obj-visible').checked = obj.visible
		document.getElementById('chk-obj-locked').checked = obj.locked
		document.getElementById('inp-obj-z').value = obj.zIndex
		
		// Transform Group (Hide for folders)
		const transformGroup = document.getElementById('grp-obj-transform')
		const fitBtn = document.getElementById('btn-obj-fit')
		const spriteGroup = document.getElementById('grp-obj-sprite')
		
		// Handle Sprite Animation Specifics
		if (isSpriteAnim) {
			spriteGroup.style.display = 'block'
			
			// Ensure settings object exists
			if (!obj.animSettings) obj.animSettings = {}
			
			// Get settings for current animation, default to standard values if missing
			const currentSettings = obj.animSettings[obj.currentAnim] || { fps: 10, stepX: 0, stepY: 0, resetLimit: 0 }
			
			document.getElementById('inp-obj-fps').value = currentSettings.fps || 10
			document.getElementById('inp-obj-step-x').value = currentSettings.stepX || 0
			document.getElementById('inp-obj-step-y').value = currentSettings.stepY || 0
			document.getElementById('inp-obj-reset-limit').value = currentSettings.resetLimit || 0
			
			// Populate Animation Dropdown
			const animSelect = document.getElementById('sel-obj-anim')
			animSelect.innerHTML = ''
			const spriteData = window.Editor.spriteData[obj.spriteName]
			if (spriteData) {
				for (const animName in spriteData) {
					const opt = document.createElement('option')
					opt.value = animName
					opt.innerText = animName
					if (obj.currentAnim === animName) opt.selected = true
					animSelect.appendChild(opt)
				}
			} else {
				animSelect.innerHTML = '<option>Loading...</option>'
			}
		} else {
			spriteGroup.style.display = 'none'
		}
		
		if (isFolder) {
			transformGroup.style.display = 'none'
			fitBtn.style.display = 'none'
		} else {
			transformGroup.style.display = 'block'
			fitBtn.style.display = 'block'
			
			// Values
			document.getElementById('inp-obj-x').value = Math.round(obj.x)
			document.getElementById('inp-obj-y').value = Math.round(obj.y)
			document.getElementById('inp-obj-w').value = Math.round(obj.width)
			document.getElementById('inp-obj-h').value = Math.round(obj.height)
			
			// Percentages
			const widthPct = sceneW > 0 ? ((obj.width / sceneW) * 100).toFixed(2) : 0
			const heightPct = sceneH > 0 ? ((obj.height / sceneH) * 100).toFixed(2) : 0
			document.getElementById('inp-obj-w-pct').value = widthPct
			document.getElementById('inp-obj-h-pct').value = heightPct
			
			// Opacity
			document.getElementById('rng-obj-opacity').value = obj.opacity
			document.getElementById('inp-obj-opacity').value = obj.opacity
			
			// Aspect Lock Button State
			const lockBtn = document.getElementById('btn-aspect-lock')
			if (window.Editor.aspectLocked) lockBtn.classList.add('active')
			else lockBtn.classList.remove('active')
		}
		
		// Delete Button Logic
		const delBtn = document.getElementById('btn-obj-delete')
		delBtn.innerText = `Delete ${isFolder ? 'Folder' : 'Asset'}`
		delBtn.disabled = false
		delBtn.title = isFolder ? 'Deletes folder and moves contents to root' : 'Deletes selected object'
	},
	
	updateObjProp: function (key, val, isContinuous = false) {
		if (window.Editor.selectedIds.length !== 1) return
		const id = window.Editor.selectedIds[0]
		const obj = window.Editor.data.objects.find(o => o.id === id)
		if (!obj) return
		
		if (!isContinuous) window.History.saveState()
		
		const oldW = obj.width
		const oldH = obj.height
		obj[key] = val
		
		// Aspect Ratio Logic
		if (window.Editor.aspectLocked && obj.type !== 'folder') {
			const ratio = oldW / oldH
			if (key === 'width' && ratio !== 0) obj.height = val / ratio
			if (key === 'height') obj.width = val * ratio
		}
		
		if (key === 'name' || key === 'zIndex') window.Treeview.render()
		
		// If changing animation, reset frame index and update view to show new settings
		if (key === 'currentAnim') {
			window.Editor.animState[obj.id] = { frameIndex: 0, timer: 0 }
			// Ensure settings entry exists for the new animation
			if (!obj.animSettings[val]) {
				obj.animSettings[val] = { fps: 10, stepX: 0, stepY: 0, resetLimit: 0 }
			}
			this.update() // Force update to refresh FPS/Step inputs for the new animation
			return
		}
		
		if (isContinuous) {
			if (key === 'opacity') {
				document.getElementById('inp-obj-opacity').value = val
			}
			window.Editor.render()
		} else {
			if (key !== 'currentAnim') {
				this.update()
			}
			window.Editor.render()
		}
	},
	
	// NEW: Update specific settings for the current animation
	updateSpriteSetting: function (key, val) {
		if (window.Editor.selectedIds.length !== 1) return
		const id = window.Editor.selectedIds[0]
		const obj = window.Editor.data.objects.find(o => o.id === id)
		if (!obj || obj.type !== 'sprite-anim') return
		
		window.History.saveState()
		
		// Ensure settings object exists
		if (!obj.animSettings) obj.animSettings = {}
		if (!obj.animSettings[obj.currentAnim]) {
			obj.animSettings[obj.currentAnim] = { fps: 10, stepX: 0, stepY: 0, resetLimit: 0 }
		}
		
		obj.animSettings[obj.currentAnim][key] = val
		
		// No need to full update(), just render to see FPS/Offset changes
		window.Editor.render()
	},
	
	updateObjPropPct: function (key, pctVal) {
		if (window.Editor.selectedIds.length !== 1) return
		const sceneW = window.Editor.data.meta.width
		const sceneH = window.Editor.data.meta.height
		let pxVal = 0
		
		if (key === 'width') pxVal = (pctVal / 100) * sceneW
		if (key === 'height') pxVal = (pctVal / 100) * sceneH
		
		this.updateObjProp(key, pxVal)
	},
	
	fitObject: function () {
		if (window.Editor.selectedIds.length === 1) {
			window.Editor.fitObjectToScene(window.Editor.selectedIds[0])
		}
	},
	
	toggleAspect: function () {
		window.Editor.aspectLocked = !window.Editor.aspectLocked
		this.update()
	},
	
	// --- Multi Selection Logic ---
	
	updateMultiView: function (ids) {
		document.getElementById('lbl-multi-count').innerText = ids.length
		
		// Calculate Average Percentages
		const sceneW = window.Editor.data.meta.width
		const sceneH = window.Editor.data.meta.height
		let totalPctW = 0
		let totalPctH = 0
		let count = 0
		
		ids.forEach(id => {
			const obj = window.Editor.data.objects.find(o => o.id === id)
			if (obj && obj.type !== 'folder') {
				totalPctW += (obj.width / sceneW) * 100
				totalPctH += (obj.height / sceneH) * 100
				count++
			}
		})
		
		const avgW = count > 0 ? (totalPctW / count).toFixed(2) : 0
		const avgH = count > 0 ? (totalPctH / count).toFixed(2) : 0
		
		document.getElementById('inp-multi-w-pct').value = avgW
		document.getElementById('inp-multi-h-pct').value = avgH
	},
	
	updateMultiPropPct: function (key, pctVal) {
		if (window.Editor.selectedIds.length === 0) return
		window.History.saveState()
		
		const sceneW = window.Editor.data.meta.width
		const sceneH = window.Editor.data.meta.height
		
		window.Editor.selectedIds.forEach(id => {
			const obj = window.Editor.data.objects.find(o => o.id === id)
			if (obj && obj.type !== 'folder') {
				if (key === 'width') {
					obj.width = (pctVal / 100) * sceneW
				} else if (key === 'height') {
					obj.height = (pctVal / 100) * sceneH
				}
			}
		})
		
		window.Editor.render()
	}
}

document.addEventListener('DOMContentLoaded', () => {
	window.PropertiesPanel.init()
})
