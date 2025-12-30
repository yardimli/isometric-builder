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
        const rootItem = this.createItemElement({ id: 'scene', name: window.Editor.data.meta.sceneName, type: 'scene' }, isSceneSelected);
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
        // The user can reorder items in the tree to change drawing order.
        
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
        
        const toggle = document.createElement('div');
        toggle.className = 'collapse-toggle';
        if (obj.type === 'folder' || obj.id === 'scene') {
            toggle.innerText = this.collapsedNodes.has(obj.id) ? '▶' : '▼';
            toggle.onclick = (e) => {
                e.stopPropagation();
                this.toggleCollapse(obj.id);
            };
        }
        el.appendChild(toggle);
        
        const icon = obj.type === 'folder' ? '📁' : (obj.type === 'sprite' ? '👾' : (obj.type === 'scene' ? '🎬' : '🖼️'));
        el.innerHTML += `<span>${icon}</span> <span class="name">${obj.name}</span>`;
        
        el.onclick = (e) => {
            if (obj.id === 'scene') {
                // Explicitly select scene
                window.Editor.selectedIds = ['scene'];
            } else {
                const isMulti = e.ctrlKey || e.metaKey || e.shiftKey;
                
                // Special logic: If clicking a folder, select all assets within it
                if (obj.type === 'folder' && !isMulti) {
                    const childIds = this.getAllDescendants(obj.id);
                    // If folder has no children, select the folder itself so it can be deleted/renamed
                    if (childIds.length > 0) {
                        window.Editor.selectedIds = childIds;
                    } else {
                        window.Editor.selectedIds = [obj.id];
                    }
                } else {
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
            // Redraw canvas to show selection outlines
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
            
            // Reset classes
            el.classList.remove('drag-over', 'drag-top', 'drag-bottom', 'drag-over-child');
            
            // Determine Drop Position
            // Top 25%: Insert Before
            // Bottom 25%: Insert After
            // Middle 50%: Nest (if folder/scene)
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
                    // If hovering middle of non-folder, default to after
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
        
        // Prevent dragging parent into child
        if (this.isDescendant(draggedId, targetId)) return;
        
        window.History.saveState();
        
        // 1. Remove dragged object from current array position
        const oldIndex = objects.indexOf(draggedObj);
        if (oldIndex > -1) {
            objects.splice(oldIndex, 1);
        }
        
        // 2. Determine new position and parent
        if (this.dropPosition === 'inside') {
            // Nesting
            draggedObj.parentId = (targetId === 'scene') ? null : targetId;
            // Add to end of list (top of stack visually)
            objects.push(draggedObj);
        } else {
            // Reordering (Before or After)
            // Target object determines the parent
            draggedObj.parentId = targetObj ? targetObj.parentId : null;
            
            // Find index of target object (it might have shifted if we removed draggedObj)
            const targetIndex = objects.indexOf(targetObj);
            let newIndex = targetIndex;
            
            if (this.dropPosition === 'after') {
                newIndex = targetIndex + 1;
            }
            
            // Insert at new index
            objects.splice(newIndex, 0, draggedObj);
        }
        
        window.PropertiesPanel.update();
        this.render();
        window.Editor.render(); // Update canvas to reflect new order
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
        // If single selection, try to nest
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
