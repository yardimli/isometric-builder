/**
 * js/interaction.js
 * Handles mouse interaction, selection (pixel-perfect), dragging, and duplication.
 */

window.Interaction = {
	isDragging: false,
	isResizing: false,
	didMove: false, // Tracks if the mouse moved significantly during click
	dragStart: { x: 0, y: 0 },
	dragOffsets: {},
	resizeHandle: null,
	resizeStart: { x: 0, y: 0, w: 0, h: 0, mx: 0, my: 0 },
	hitTestCanvas: null,
	hitTestCtx: null,
	DRAG_THRESHOLD: 3, // Pixels to move before dragging starts
	
	init: function () {
		// Create a small canvas for pixel data extraction (hit testing)
		this.hitTestCanvas = document.createElement('canvas');
		this.hitTestCanvas.width = 1;
		this.hitTestCanvas.height = 1;
		this.hitTestCtx = this.hitTestCanvas.getContext('2d', { willReadFrequently: true });
		
		const canvas = document.getElementById('gameCanvas');
		
		// Attach listeners
		canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
		window.addEventListener('mousemove', (e) => this.handleMouseMove(e));
		window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
	},
	
	/**
	 * Helper to get mouse position relative to canvas
	 */
	getMousePos: function (e) {
		if (!window.Editor.canvas) return { x: 0, y: 0 };
		const r = window.Editor.canvas.getBoundingClientRect();
		const scaleX = window.Editor.canvas.width / r.width;
		const scaleY = window.Editor.canvas.height / r.height;
		return {
			x: (e.clientX - r.left) * scaleX,
			y: (e.clientY - r.top) * scaleY
		};
	},
	
	/**
	 * Checks if a specific pixel in an object's asset is transparent.
	 * Returns true if the pixel is visible (alpha > 10).
	 */
	checkPixelHit: function (obj, mouseX, mouseY) {
		// 1. Basic Bounding Box Check
		if (
			mouseX < obj.x ||
			mouseX > obj.x + obj.width ||
			mouseY < obj.y ||
			mouseY > obj.y + obj.height
		) {
			return false;
		}
		
		// 2. If no asset (e.g., placeholder rect), bounding box is enough
		if (!obj.asset || obj.type !== 'static') return true;
		
		const img = window.Editor.images[obj.asset];
		if (!img) return true; // Image not loaded yet, assume hit
		
		// 3. Calculate position within the image
		// Map mouse position (screen space) to image texture space
		const relativeX = mouseX - obj.x;
		const relativeY = mouseY - obj.y;
		
		const textureX = Math.floor((relativeX / obj.width) * img.naturalWidth);
		const textureY = Math.floor((relativeY / obj.height) * img.naturalHeight);
		
		// 4. Check Alpha
		this.hitTestCtx.clearRect(0, 0, 1, 1);
		// Draw only the 1x1 pixel we care about
		this.hitTestCtx.drawImage(
			img,
			textureX, textureY, 1, 1, // Source
			0, 0, 1, 1 // Destination
		);
		
		const pixelData = this.hitTestCtx.getImageData(0, 0, 1, 1).data;
		const alpha = pixelData[3];
		
		// Threshold can be adjusted (currently 10/255)
		return alpha > 10;
	},
	
	handleMouseDown: function (e) {
		if (!window.Editor.data) return;
		const pos = this.getMousePos(e);
		this.dragStart = pos;
		this.didMove = false;
		this.isDragging = false;
		this.isResizing = false;
		
		// 1. Check Resize Handles (Only if 1 item selected)
		if (window.Editor.selectedIds.length === 1) {
			const obj = window.Editor.data.objects.find(o => o.id === window.Editor.selectedIds[0]);
			if (obj && !obj.locked && obj.type !== 'folder') {
				const handles = window.Editor.getHandleCoords(obj);
				for (const key in handles) {
					const h = handles[key];
					if (pos.x >= h.x && pos.x <= h.x + h.w && pos.y >= h.y && pos.y <= h.y + h.h) {
						window.History.saveState();
						this.isResizing = true;
						this.resizeHandle = key;
						this.resizeStart = { x: obj.x, y: obj.y, w: obj.width, h: obj.height, mx: pos.x, my: pos.y };
						return; // Stop processing, we are resizing
					}
				}
			}
		}
		
		// 2. Check if we clicked on an ALREADY selected object (Potential Drag)
		// We use bounding box here for UX consistency (easier to grab selected items)
		const clickedSelected = window.Editor.selectedIds.some(id => {
			const obj = window.Editor.data.objects.find(o => o.id === id);
			if (!obj) return false;
			return (
				pos.x >= obj.x && pos.x <= obj.x + obj.width &&
				pos.y >= obj.y && pos.y <= obj.y + obj.height
			);
		});
		
		if (clickedSelected) {
			// We might be dragging. Don't change selection yet.
			// Calculate offsets immediately in case we do drag.
			this.dragOffsets = {};
			window.Editor.selectedIds.forEach(id => {
				const o = window.Editor.data.objects.find(obj => obj.id === id);
				if (o) {
					this.dragOffsets[id] = { x: pos.x - o.x, y: pos.y - o.y };
				}
			});
		} else {
			// Clicked outside current selection.
			// Do NOT select yet. Wait for MouseUp.
			// But we clear drag offsets to prevent accidental movement of previous selection.
			this.dragOffsets = {};
		}
	},
	
	handleMouseMove: function (e) {
		const pos = this.getMousePos(e);
		
		// Calculate distance moved to determine if it's a drag or a click
		const dist = Math.hypot(pos.x - this.dragStart.x, pos.y - this.dragStart.y);
		if (dist > this.DRAG_THRESHOLD) {
			this.didMove = true;
		}
		
		// --- Resizing Logic ---
		if (this.isResizing && window.Editor.selectedIds.length === 1) {
			const obj = window.Editor.data.objects.find(o => o.id === window.Editor.selectedIds[0]);
			if (!obj) return;
			
			const dx = pos.x - this.resizeStart.mx;
			const ratio = this.resizeStart.w / this.resizeStart.h;
			let newW = this.resizeStart.w;
			let newH = this.resizeStart.h;
			let newX = this.resizeStart.x;
			let newY = this.resizeStart.y;
			
			if (this.resizeHandle === 'br') {
				newW = this.resizeStart.w + dx;
				newH = window.Editor.aspectLocked ? newW / ratio : this.resizeStart.h + (pos.y - this.resizeStart.my);
			} else if (this.resizeHandle === 'bl') {
				newW = this.resizeStart.w - dx;
				newX = this.resizeStart.x + dx;
				newH = window.Editor.aspectLocked ? newW / ratio : this.resizeStart.h + (pos.y - this.resizeStart.my);
			} else if (this.resizeHandle === 'tr') {
				newW = this.resizeStart.w + dx;
				newH = window.Editor.aspectLocked ? newW / ratio : this.resizeStart.h - (pos.y - this.resizeStart.my);
				newY = window.Editor.aspectLocked ? this.resizeStart.y - (newH - this.resizeStart.h) : pos.y;
			} else if (this.resizeHandle === 'tl') {
				newW = this.resizeStart.w - dx;
				newX = this.resizeStart.x + dx;
				newH = window.Editor.aspectLocked ? newW / ratio : this.resizeStart.h - (pos.y - this.resizeStart.my);
				newY = window.Editor.aspectLocked ? this.resizeStart.y - (newH - this.resizeStart.h) : pos.y;
			}
			
			if (newW > 5 && newH > 5) {
				obj.width = newW;
				obj.height = newH;
				obj.x = newX;
				obj.y = newY;
				window.PropertiesPanel.update();
			}
			return;
		}
		
		// --- Dragging Logic ---
		// Only start dragging if we moved enough AND we have offsets calculated (meaning we clicked a selected item)
		if (this.didMove && Object.keys(this.dragOffsets).length > 0) {
			if (!this.isDragging) {
				this.isDragging = true;
				window.History.saveState(); // Save state once when drag begins
			}
			
			window.Editor.selectedIds.forEach(id => {
				const obj = window.Editor.data.objects.find(o => o.id === id);
				if (!obj || obj.locked) return;
				
				const offset = this.dragOffsets[id];
				let nx = pos.x - offset.x;
				let ny = pos.y - offset.y;
				
				if (window.Editor.data.meta.grid.snap) {
					const sz = window.Editor.data.meta.grid.size;
					nx = Math.round(nx / sz) * sz;
					ny = Math.round(ny / sz) * sz;
				}
				
				obj.x = nx;
				obj.y = ny;
			});
			window.PropertiesPanel.update();
		}
	},
	
	handleMouseUp: function (e) {
		const pos = this.getMousePos(e);
		
		// If we didn't drag and didn't resize, perform selection
		if (!this.isDragging && !this.isResizing && !this.didMove) {
			this.performSelection(pos, e);
		}
		
		this.isDragging = false;
		this.isResizing = false;
		this.resizeHandle = null;
		this.dragOffsets = {};
	},
	
	performSelection: function (pos, e) {
		// Sort objects by Z-Index (highest first) to select top-most visible pixel
		const sorted = [...window.Editor.data.objects]
			.filter(o => o.visible && !o.locked && o.type !== 'folder')
			.sort((a, b) => b.zIndex - a.zIndex);
		
		let hitObject = null;
		
		for (const obj of sorted) {
			if (this.checkPixelHit(obj, pos.x, pos.y)) {
				hitObject = obj;
				break; // Found the top-most non-transparent object
			}
		}
		
		const isMultiSelect = e.ctrlKey || e.shiftKey || e.metaKey;
		
		if (hitObject) {
			if (isMultiSelect) {
				// Toggle selection
				if (window.Editor.selectedIds.includes(hitObject.id)) {
					window.Editor.selectedIds = window.Editor.selectedIds.filter(id => id !== hitObject.id);
				} else {
					window.Editor.selectedIds.push(hitObject.id);
				}
			} else {
				// Single select
				window.Editor.selectedIds = [hitObject.id];
			}
		} else {
			// Clicked empty space
			if (!isMultiSelect) {
				window.Editor.selectedIds = [];
			}
		}
		
		window.PropertiesPanel.update();
		window.Treeview.render();
		window.Editor.render(); // Redraw selection outlines
	},
	
	duplicateSelected: function () {
		if (!window.Editor.data || window.Editor.selectedIds.length === 0) return;
		
		window.History.saveState();
		
		const newIds = [];
		const objectsToDuplicate = window.Editor.data.objects.filter(o => window.Editor.selectedIds.includes(o.id));
		
		objectsToDuplicate.forEach(obj => {
			// Deep clone
			const clone = JSON.parse(JSON.stringify(obj));
			clone.id = 'obj_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
			clone.name += '_copy';
			clone.x += 20; // Offset slightly
			clone.y += 20;
			window.Editor.data.objects.push(clone);
			newIds.push(clone.id);
		});
		
		// Select the new copies
		window.Editor.selectedIds = newIds;
		window.PropertiesPanel.update();
		window.Treeview.render();
	}
};

document.addEventListener('DOMContentLoaded', () => {
	// Initialize after Editor is ready
	if (window.Editor) {
		window.Interaction.init();
	}
});
