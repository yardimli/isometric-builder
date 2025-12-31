/**
 * js/treeview.js
 * Handles the hierarchical display of scene objects and folders.
 */

window.Treeview = {
	container: null,
	collapsedNodes: new Set(),
	draggedId: null,
	dropTargetId: null,
	dropPosition: null, // 'before', 'inside', 'after'
	
	init: function () {
		this.container = document.getElementById('treeview-content');
		document.getElementById('btn-tree-new-node').onclick = () => this.createNewFolder();
	},
	
	render: function () {
		if (!window.Editor || !window.Editor.data) return;
		this.container.innerHTML = '';
		
		const rootWrapper = document.createElement('div');
		rootWrapper.className = 'tree-node-wrapper' + (this.collapsedNodes.has('scene') ? ' collapsed' : '');
		
		// Check if scene is explicitly selected
		const isSceneSelected = window.Editor.selectedIds.length === 1 && window.Editor.selectedIds[0] === 'scene';
		const rootItem = this.createItemElement({
			id: 'scene',
			name: window.Editor.data.meta.sceneName,
			type: 'scene'
		}, isSceneSelected);
		rootWrapper.appendChild(rootItem);
		
		const childrenContainer = document.createElement('div');
		childrenContainer.className = 'tree-children';
		
		this.renderChildren(null, childrenContainer);
		
		rootWrapper.appendChild(childrenContainer);
		this.container.appendChild(rootWrapper);
	},
	
	renderChildren: function (parentId, container) {
		// Filter by parent
		const objects = window.Editor.data.objects.filter(obj => obj.parentId === parentId);
		
		// IMPORTANT: Do NOT sort by Z-Index here.
		// We want the Treeview to reflect the array order (drawing order).
		objects.forEach(obj => {
			const wrapper = document.createElement('div');
			wrapper.className = 'tree-node-wrapper' + (this.collapsedNodes.has(obj.id) ? ' collapsed' : '');
			
			const isSelected = window.Editor.selectedIds.includes(obj.id);
			const item = this.createItemElement(obj, isSelected);
			wrapper.appendChild(item);
			
			if (obj.type === 'folder') {
				const childGroup = document.createElement('div');
				childGroup.className = 'tree-children';
				this.renderChildren(obj.id, childGroup);
				wrapper.appendChild(childGroup);
			}
			
			container.appendChild(wrapper);
		});
	},
	
	createItemElement: function (obj, isSelected) {
		const el = document.createElement('div');
		el.className = `tree-item ${isSelected ? 'selected' : ''}`;
		el.draggable = obj.id !== 'scene';
		el.dataset.id = obj.id;
		
		// Collapse Toggle
		const toggle = document.createElement('div');
		toggle.className = 'collapse-toggle';
		if (obj.type === 'folder' || obj.id === 'scene') {
			toggle.innerText = this.collapsedNodes.has(obj.id) ? '▶' : '▼';
			// Use mousedown to prevent conflict with drag/click
			toggle.onmousedown = (e) => {
				e.stopPropagation();
			};
			toggle.onclick = (e) => {
				e.stopPropagation();
				this.toggleCollapse(obj.id);
			};
		}
		el.appendChild(toggle);
		
		// Icon
		const iconSpan = document.createElement('span');
		iconSpan.innerText = obj.type === 'folder' ? '📁' : (obj.type === 'sprite' ? '👾' : (obj.type === 'scene' ? '🎬' : '🖼️'));
		el.appendChild(iconSpan);
		
		// Name
		const nameSpan = document.createElement('span');
		nameSpan.className = 'name';
		nameSpan.innerText = obj.name;
		el.appendChild(nameSpan);
		
		el.onclick = (e) => {
			if (obj.id === 'scene') {
				window.Editor.selectedIds = ['scene'];
			} else {
				const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
				
				if (obj.type === 'folder' && !isMulti) {
					// Logic: First click selects folder. Second click (if already selected) selects children.
					const isAlreadySelected = window.Editor.selectedIds.length === 1 && window.Editor.selectedIds[0] === obj.id;
					
					if (isAlreadySelected) {
						// Second click: Select all assets inside
						const childIds = this.getAllDescendants(obj.id);
						if (childIds.length > 0) {
							window.Editor.selectedIds = childIds;
						} else {
							// Empty folder, keep folder selected
							window.Editor.selectedIds = [obj.id];
						}
					} else {
						// First click: Select the folder itself
						window.Editor.selectedIds = [obj.id];
					}
				} else {
					// Standard selection for non-folders or multi-select modifier
					if (isMulti) {
						if (window.Editor.selectedIds.includes(obj.id)) {
							window.Editor.selectedIds = window.Editor.selectedIds.filter(id => id !== obj.id);
						} else {
							window.Editor.selectedIds.push(obj.id);
						}
					} else {
						window.Editor.selectedIds = [obj.id];
					}
				}
			}
			window.PropertiesPanel.update();
			this.render();
			window.Editor.render();
		};
		
		if (obj.id !== 'scene') {
			el.ondragstart = (e) => {
				this.draggedId = obj.id;
				e.dataTransfer.setData('text/plain', obj.id);
				el.style.opacity = '0.5';
			};
			el.ondragend = () => {
				this.draggedId = null;
				this.dropTargetId = null;
				this.dropPosition = null;
				this.render();
			};
		}
		
		el.ondragover = (e) => {
			e.preventDefault();
			if (this.draggedId === obj.id) return;
			
			const rect = el.getBoundingClientRect();
			const relY = e.clientY - rect.top;
			const height = rect.height;
			
			el.classList.remove('drag-over', 'drag-top', 'drag-bottom', 'drag-over-child');
			
			if (relY < height * 0.25) {
				this.dropPosition = 'before';
				el.classList.add('drag-top');
			} else if (relY > height * 0.75) {
				this.dropPosition = 'after';
				el.classList.add('drag-bottom');
			} else {
				if (obj.type === 'folder' || obj.id === 'scene') {
					this.dropPosition = 'inside';
					el.classList.add('drag-over');
				} else {
					this.dropPosition = 'after';
					el.classList.add('drag-bottom');
				}
			}
			this.dropTargetId = obj.id;
		};
		
		el.ondragleave = () => {
			el.classList.remove('drag-over', 'drag-top', 'drag-bottom', 'drag-over-child');
		};
		
		el.ondrop = (e) => {
			e.preventDefault();
			const draggedId = e.dataTransfer.getData('text/plain');
			this.handleDrop(draggedId, obj.id);
		};
		
		return el;
	},
	
	getAllDescendants: function (parentId) {
		let ids = [];
		const children = window.Editor.data.objects.filter(o => o.parentId === parentId);
		children.forEach(child => {
			if (child.type === 'folder') {
				ids = ids.concat(this.getAllDescendants(child.id));
			} else {
				ids.push(child.id);
			}
		});
		return ids;
	},
	
	toggleCollapse: function (id) {
		if (this.collapsedNodes.has(id)) this.collapsedNodes.delete(id);
		else this.collapsedNodes.add(id);
		this.render();
	},
	
	handleDrop: function (draggedId, targetId) {
		if (!draggedId || !targetId || draggedId === targetId) return;
		
		const objects = window.Editor.data.objects;
		const draggedObj = objects.find(o => o.id === draggedId);
		const targetObj = objects.find(o => o.id === targetId);
		
		if (!draggedObj) return;
		if (this.isDescendant(draggedId, targetId)) return;
		
		window.History.saveState();
		
		const oldIndex = objects.indexOf(draggedObj);
		if (oldIndex > -1) {
			objects.splice(oldIndex, 1);
		}
		
		if (this.dropPosition === 'inside') {
			draggedObj.parentId = (targetId === 'scene') ? null : targetId;
			objects.push(draggedObj);
		} else {
			draggedObj.parentId = targetObj ? targetObj.parentId : null;
			const targetIndex = objects.indexOf(targetObj);
			let newIndex = targetIndex;
			
			if (this.dropPosition === 'after') {
				newIndex = targetIndex + 1;
			}
			objects.splice(newIndex, 0, draggedObj);
		}
		
		window.PropertiesPanel.update();
		this.render();
		window.Editor.render();
	},
	
	isDescendant: function (parentCandidateId, childId) {
		if (childId === 'scene') return false;
		const objects = window.Editor.data.objects;
		let current = objects.find(o => o.id === childId);
		while (current && current.parentId) {
			if (current.parentId === parentCandidateId) return true;
			current = objects.find(o => o.id === current.parentId);
		}
		return false;
	},
	
	createNewFolder: async function () {
		if (!window.Editor.data) return;
		
		const name = await window.Editor.prompt('Enter folder name:', 'New Folder');
		if (!name) return;
		
		let parentId = null;
		if (window.Editor.selectedIds.length === 1 && window.Editor.selectedIds[0] !== 'scene') {
			const selected = window.Editor.data.objects.find(o => o.id === window.Editor.selectedIds[0]);
			if (selected) {
				parentId = (selected.type === 'folder') ? selected.id : selected.parentId;
			}
		}
		
		const newFolder = {
			id: 'folder_' + Date.now(),
			name: name,
			type: 'folder',
			parentId: parentId,
			zIndex: 0,
			visible: true,
			locked: false
		};
		
		window.Editor.data.objects.push(newFolder);
		window.Editor.selectedIds = [newFolder.id];
		this.render();
		window.PropertiesPanel.update();
	}
};

document.addEventListener('DOMContentLoaded', () => Treeview.init());
