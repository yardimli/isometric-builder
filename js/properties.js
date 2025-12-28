/**
 * js/properties.js
 * Handles the rendering and logic for the Properties Panel.
 */

window.PropertiesPanel = {
    container: null,

    init: function () {
        this.container = document.getElementById('prop-content');
    },

    /**
     * Main render function for the panel.
     */
    update: function () {
        if (!window.Editor || !window.Editor.data) return;

        const selectedId = window.Editor.selectedId;

        if (selectedId === 'scene') {
            this.renderSceneProperties();
        } else {
            this.renderObjectProperties(selectedId);
        }
    },

    renderSceneProperties: function () {
        const meta = window.Editor.data.meta;
        let presetOpts = '';
        for (const name in window.Editor.resolutions) {
            presetOpts += `<option value="${name}">${name}</option>`;
        }

        this.container.innerHTML = `
      <h4>Scene Properties</h4>
      <div class="prop-row">
        <label>Name</label>
        <input value="${meta.sceneName}" onchange="PropertiesPanel.updateSceneProp('sceneName', this.value)">
      </div>
      <div class="prop-row">
        <label>Preset Size</label>
        <select onchange="PropertiesPanel.applyResolutionPreset(this.value)">${presetOpts}</select>
      </div>
      <div class="prop-row-dual">
        <div><label>Width</label><input type="number" value="${meta.width}" onchange="PropertiesPanel.updateSceneProp('width', Number(this.value))"></div>
        <div><label>Height</label><input type="number" value="${meta.height}" onchange="PropertiesPanel.updateSceneProp('height', Number(this.value))"></div>
      </div>
      <div class="prop-row"><label>Bg Color</label><input type="color" value="${meta.backgroundColor}" onchange="PropertiesPanel.updateSceneProp('backgroundColor', this.value)"></div>
      <div class="prop-row"><label>Grid Size</label><input type="number" value="${meta.grid.size}" onchange="PropertiesPanel.updateSceneProp('gridSize', Number(this.value))"></div>
    `;
    },

    renderObjectProperties: function (id) {
        const obj = window.Editor.data.objects.find(o => o.id === id);
        if (!obj) return;

        const isFolder = obj.type === 'folder';
        const hasChildren = window.Editor.data.objects.some(o => o.parentId === obj.id);
        const canDelete = !isFolder || !hasChildren;

        this.container.innerHTML = `
      <h4>${isFolder ? 'Folder' : 'Object'} Properties</h4>
      <div class="prop-row">
        <label>Name</label>
        <input value="${obj.name}" onchange="PropertiesPanel.updateProp('${obj.id}', 'name', this.value)">
      </div>
      
      <div class="prop-row-check">
        <label><input type="checkbox" ${obj.visible ? 'checked' : ''} onchange="PropertiesPanel.updateProp('${obj.id}', 'visible', this.checked)"> Visible</label>
        <label><input type="checkbox" ${obj.locked ? 'checked' : ''} onchange="PropertiesPanel.updateProp('${obj.id}', 'locked', this.checked)"> Locked</label>
      </div>

      ${!isFolder ? `
        <div class="prop-row-dual" style="margin-top:10px;">
          <div><label>X</label><input type="number" value="${Math.round(obj.x)}" onchange="PropertiesPanel.updateProp('${obj.id}', 'x', Number(this.value))"></div>
          <div><label>Y</label><input type="number" value="${Math.round(obj.y)}" onchange="PropertiesPanel.updateProp('${obj.id}', 'y', Number(this.value))"></div>
        </div>
        <div class="prop-row-dual">
          <div><label>Width</label><input type="number" value="${Math.round(obj.width)}" onchange="PropertiesPanel.updateProp('${obj.id}', 'width', Number(this.value))"></div>
          <button class="btn-lock-aspect ${window.Editor.aspectLocked ? 'active' : ''}" onclick="PropertiesPanel.toggleAspect()" title="Lock Aspect Ratio">🔗</button>
          <div><label>Height</label><input type="number" value="${Math.round(obj.height)}" onchange="PropertiesPanel.updateProp('${obj.id}', 'height', Number(this.value))"></div>
        </div>
        <div class="prop-row">
          <label>Opacity</label>
          <div class="opacity-ctrl">
            <input type="range" min="0" max="1" step="0.01" value="${obj.opacity}" oninput="PropertiesPanel.updateProp('${obj.id}', 'opacity', Number(this.value), true)">
            <input type="number" min="0" max="1" step="0.1" value="${obj.opacity}" onchange="PropertiesPanel.updateProp('${obj.id}', 'opacity', Number(this.value))">
          </div>
        </div>
      ` : ''}

      <div class="prop-row"><label>Z-Index</label><input type="number" value="${obj.zIndex}" onchange="PropertiesPanel.updateProp('${obj.id}', 'zIndex', Number(this.value))"></div>
      
      <button class="primary-btn btn-delete" ${!canDelete ? 'disabled title="Only empty folders can be deleted"' : ''} onclick="Editor.deleteObject('${obj.id}')">
        Delete ${isFolder ? 'Folder' : 'Asset'}
      </button>
      
      ${!isFolder ? `<button class="primary-btn" style="width:100%; margin-top:10px;" onclick="Editor.fitObjectToScene('${obj.id}')">Fit to Scene</button>` : ''}
    `;
    },

    updateProp: function (id, key, val, isContinuous = false) {
        const obj = window.Editor.data.objects.find(o => o.id === id);
        if (!obj) return;

        // Save state for history before modification (if not continuous like a slider)
        if (!isContinuous) window.History.saveState();

        const oldW = obj.width;
        const oldH = obj.height;
        obj[key] = val;

        if (window.Editor.aspectLocked && !isFolder) {
            const ratio = oldW / oldH;
            if (key === 'width') obj.height = val / ratio;
            if (key === 'height') obj.width = val * ratio;
        }

        if (key === 'name' || key === 'zIndex') window.Treeview.render();
        if (key !== 'opacity') this.update();
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
            this.updateSceneProp('width', res.w);
            this.updateSceneProp('height', res.h);
            this.update();
            window.Editor.fitZoomToScreen();
        }
    },

    toggleAspect: function () {
        window.Editor.aspectLocked = !window.Editor.aspectLocked;
        this.update();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.PropertiesPanel.init();
});