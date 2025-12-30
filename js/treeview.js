/**
 * js/treeview.js
 * Handles the hierarchical display of scene objects and folders.
 */

window.Treeview = {
    container: null,
    collapsedNodes: new Set(),
    draggedId: null,
    
    init: function () {
        this.container = document.getElementById('treeview-content');
        document.getElementById('btn-tree-new-node').onclick = () => this.createNewFolder();
    },
    
    render: function () {
        if (!window.Editor || !window.Editor.data) return;
        this.container.innerHTML = '';
        
        const rootWrapper = document.createElement('div');
        rootWrapper.className = 'tree-node-wrapper' + (this.collapsedNodes.has('scene') ? ' collapsed' : '');
        
        // Scene is a special case, usually single select only
        const isSceneSelected = window.Editor.selectedIds.length === 0; // Or specific scene ID if implemented
        const rootItem = this.createItemElement({ id: 'scene', name: window.Editor.data.meta.sceneName, type: 'scene' }, isSceneSelected);
        rootWrapper.appendChild(rootItem);
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        
        this.renderChildren(null, childrenContainer);
        
        rootWrapper.appendChild(childrenContainer);
        this.container.appendChild(rootWrapper);
    },
    
    renderChildren: function (parentId, container) {
        const objects = window.Editor.data.objects.filter(obj => obj.parentId === parentId);
        objects.sort((a, b) => b.zIndex - a.zIndex);
        
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
                window.Editor.selectedIds = [];
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
                this.render();
            };
        }
        
        el.ondragover = (e) => {
            e.preventDefault();
            if (this.draggedId === obj.id) return;
            if (obj.type === 'folder' || obj.id === 'scene') {
                el.classList.add('drag-over-child');
            } else {
                el.classList.add('drag-over');
            }
        };
        
        el.ondragleave = () => {
            el.classList.remove('drag-over', 'drag-over-child');
        };
        
        el.ondrop = (e) => {
            e.preventDefault();
            const droppedId = e.dataTransfer.getData('text/plain');
            this.handleDrop(droppedId, obj.id);
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
        const objects = window.Editor.data.objects;
        const draggedObj = objects.find(o => o.id === draggedId);
        const targetObj = objects.find(o => o.id === targetId);
        
        if (!draggedObj) return;
        
        if (targetId === 'scene' || (targetObj && targetObj.type === 'folder')) {
            if (this.isDescendant(draggedId, targetId)) return;
            draggedObj.parentId = (targetId === 'scene') ? null : targetId;
        } else if (targetObj) {
            draggedObj.parentId = targetObj.parentId;
        }
        
        window.PropertiesPanel.update();
        this.render();
    },
    
    isDescendant: function (parentCandidateId, childId) {
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
        if (window.Editor.selectedIds.length === 1) {
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
