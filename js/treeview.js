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

        const rootItem = this.createItemElement({ id: 'scene', name: window.Editor.data.meta.sceneName, type: 'scene' });
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

            const item = this.createItemElement(obj);
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

    createItemElement: function (obj) {
        const el = document.createElement('div');
        el.className = `tree-item ${window.Editor.selectedId === obj.id ? 'selected' : ''}`;
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

        el.onclick = () => {
            window.Editor.selectedId = obj.id;
            // MODIFIED: Correctly call the PropertiesPanel update method
            window.PropertiesPanel.update();
            this.render();
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

        // MODIFIED: Update properties panel after moving items
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
        const selected = window.Editor.data.objects.find(o => o.id === window.Editor.selectedId);

        if (selected) {
            parentId = (selected.type === 'folder') ? selected.id : selected.parentId;
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
        window.Editor.selectedId = newFolder.id;
        this.render();
        // MODIFIED: Update properties panel when a new folder is selected
        window.PropertiesPanel.update();
    }
};

document.addEventListener('DOMContentLoaded', () => Treeview.init());