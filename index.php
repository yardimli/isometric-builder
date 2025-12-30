<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Game Editor Engine v1.7</title>
	<link rel="stylesheet" href="css/style.css">
</head>
<body>

<div class="editor-container">
	<!-- Toolbar -->
	<div class="toolbar">
		<div class="left-group">
			<button id="btn-open-modal" type="button">📂 Open</button>
			<button id="btn-save" type="button">💾 Save</button>
			<button id="btn-save-as" type="button">💾 Save As...</button>
			<button id="btn-assets-modal" type="button">🖼️ Assets</button>
			<span class="separator">|</span>
			<button id="btn-duplicate" type="button" title="Duplicate Selected (Ctrl+D)">📄 Duplicate</button>
			<span class="separator">|</span>
			<button id="btn-undo" type="button" title="Undo (Ctrl+Z)" disabled>↩️</button>
			<button id="btn-redo" type="button" title="Redo (Ctrl+Y)" disabled>↪️</button>
		</div>
		<span>Scene: <strong id="scene-name">Unsaved</strong></span>
		<div class="controls">
			<button id="btn-play" type="button">▶ Play</button>
			<button id="btn-pause" type="button">⏸ Pause</button>
			<label title="Toggle Grid Visibility">
				<input type="checkbox" id="chk-grid-visible" checked> Grid
			</label>
			<label title="Toggle Snap to Grid">
				<input type="checkbox" id="chk-grid-snap" checked> Snap
			</label>
		</div>
	</div>
	
	<!-- Main Workspace -->
	<div class="workspace">
		<div class="treeview-panel">
			<div class="treeview-header" style="padding: 10px; font-weight: bold; border-bottom: 1px solid #3e3e42; color: #fff;">Hierarchy</div>
			<div class="tree-btn-bar">
				<button id="btn-tree-new-node" type="button" title="Create new folder under selection">+ New Folder</button>
			</div>
			<div id="treeview-content" class="treeview-content"></div>
		</div>
		
		<div class="canvas-wrapper" id="canvas-wrapper">
			<canvas id="gameCanvas"></canvas>
		</div>
		
		<div class="zoom-controls">
			<button id="btn-zoom-out" type="button" title="Zoom Out">-</button>
			<input type="text" id="inp-zoom-percent" value="100%">
			<button id="btn-zoom-in" type="button" title="Zoom In">+</button>
		</div>
		
		<div class="properties-panel">
			<!-- 1. Empty State Panel -->
			<div id="prop-empty" class="prop-group">
				<p class="hint" style="text-align: center; color: #888; margin-top: 50px;">
					No selection.<br>
					Click an object to edit properties.<br>
					Click "Scene" in hierarchy for scene settings.
				</p>
			</div>
			
			<!-- 2. Scene Properties Panel -->
			<div id="prop-scene" class="prop-group" style="display: none;">
				<h4>Scene Properties</h4>
				<div class="prop-row">
					<label for="inp-scene-name">Name</label>
					<input id="inp-scene-name" onchange="PropertiesPanel.updateSceneProp('sceneName', this.value)">
				</div>
				<div class="prop-row">
					<label for="sel-scene-preset">Preset Size</label>
					<select id="sel-scene-preset" onchange="PropertiesPanel.applyResolutionPreset(this.value)">
						<!-- Options populated by JS -->
					</select>
				</div>
				<div class="prop-row-dual">
					<div>
						<label for="inp-scene-w">Width</label>
						<input type="number" id="inp-scene-w" onchange="PropertiesPanel.updateSceneProp('width', Number(this.value))">
					</div>
					<div>
						<label for="inp-scene-h">Height</label>
						<input type="number" id="inp-scene-h" onchange="PropertiesPanel.updateSceneProp('height', Number(this.value))">
					</div>
				</div>
				<div class="prop-row">
					<label for="inp-scene-bg">Bg Color</label>
					<input type="color" id="inp-scene-bg" onchange="PropertiesPanel.updateSceneProp('backgroundColor', this.value)">
				</div>
				<div class="prop-row">
					<label for="inp-scene-grid">Grid Size</label>
					<input type="number" id="inp-scene-grid" onchange="PropertiesPanel.updateSceneProp('gridSize', Number(this.value))">
				</div>
			</div>
			
			<!-- 3. Object/Folder Properties Panel -->
			<div id="prop-object" class="prop-group" style="display: none;">
				<h4 id="lbl-obj-type">Object Properties</h4>
				
				<div class="prop-row">
					<label for="inp-obj-name">Name</label>
					<input id="inp-obj-name" onchange="PropertiesPanel.updateObjProp('name', this.value)">
				</div>
				
				<div class="prop-row-check">
					<label>
						<input type="checkbox" id="chk-obj-visible" onchange="PropertiesPanel.updateObjProp('visible', this.checked)"> Visible
					</label>
					<label>
						<input type="checkbox" id="chk-obj-locked" onchange="PropertiesPanel.updateObjProp('locked', this.checked)"> Locked
					</label>
				</div>
				
				<!-- Transform Group (Hidden for Folders) -->
				<div id="grp-obj-transform">
					<div class="prop-row-dual" style="margin-top:10px;">
						<div>
							<label for="inp-obj-x">X</label>
							<input type="number" id="inp-obj-x" onchange="PropertiesPanel.updateObjProp('x', Number(this.value))">
						</div>
						<div>
							<label for="inp-obj-y">Y</label>
							<input type="number" id="inp-obj-y" onchange="PropertiesPanel.updateObjProp('y', Number(this.value))">
						</div>
					</div>
					
					<div class="prop-row-dual">
						<div>
							<label>Width</label>
							<div class="unit-group">
								<input type="number" id="inp-obj-w" onchange="PropertiesPanel.updateObjProp('width', Number(this.value))">
								<input type="number" id="inp-obj-w-pct" onchange="PropertiesPanel.updateObjPropPct('width', Number(this.value))" title="% of Scene Width">
							</div>
						</div>
						<button id="btn-aspect-lock" class="btn-lock-aspect" onclick="PropertiesPanel.toggleAspect()" title="Lock Aspect Ratio">🔗</button>
						<div>
							<label>Height</label>
							<div class="unit-group">
								<input type="number" id="inp-obj-h" onchange="PropertiesPanel.updateObjProp('height', Number(this.value))">
								<input type="number" id="inp-obj-h-pct" onchange="PropertiesPanel.updateObjPropPct('height', Number(this.value))" title="% of Scene Height">
							</div>
						</div>
					</div>
					
					<div class="prop-row">
						<label>Opacity</label>
						<div class="opacity-ctrl">
							<input type="range" id="rng-obj-opacity" min="0" max="1" step="0.01" oninput="PropertiesPanel.updateObjProp('opacity', Number(this.value), true)">
							<input type="number" id="inp-obj-opacity" min="0" max="1" step="0.1" onchange="PropertiesPanel.updateObjProp('opacity', Number(this.value))">
						</div>
					</div>
				</div>
				
				<div class="prop-row">
					<label for="inp-obj-z">Z-Index</label>
					<input type="number" id="inp-obj-z" onchange="PropertiesPanel.updateObjProp('zIndex', Number(this.value))">
				</div>
				
				<button class="primary-btn" style="width:100%; margin-top:20px;" onclick="Editor.duplicateSelected()">Duplicate</button>
				
				<button id="btn-obj-delete" class="primary-btn btn-delete" style="width:100%; margin-top:10px;" onclick="Editor.deleteSelected()">
					Delete
				</button>
				
				<button id="btn-obj-fit" class="primary-btn" style="width:100%; margin-top:10px;" onclick="PropertiesPanel.fitObject()">Fit to Scene</button>
			</div>
			
			<!-- 4. Multi-Selection Panel -->
			<div id="prop-multi" class="prop-group" style="display: none;">
				<h4>Multi-Selection</h4>
				<div class="multi-select-info">
					<span id="lbl-multi-count" class="multi-select-count">0</span>
					items selected
				</div>
				
				<!-- New Percentage Inputs for Multi-Select -->
				<div class="prop-row-dual" style="margin-bottom: 15px;">
					<div>
						<label>Avg Width %</label>
						<div class="unit-group">
							<input type="number" id="inp-multi-w-pct" onchange="PropertiesPanel.updateMultiPropPct('width', Number(this.value))" title="% of Scene Width">
							<input type="text" value="%" disabled style="width: 20px; padding:0; border:none; background:transparent;">
						</div>
					</div>
					<div>
						<label>Avg Height %</label>
						<div class="unit-group">
							<input type="number" id="inp-multi-h-pct" onchange="PropertiesPanel.updateMultiPropPct('height', Number(this.value))" title="% of Scene Height">
							<input type="text" value="%" disabled style="width: 20px; padding:0; border:none; background:transparent;">
						</div>
					</div>
				</div>
				
				<div class="multi-actions">
					<button onclick="Editor.toggleMultiProperty('visible', false)">Hide All</button>
					<button onclick="Editor.toggleMultiProperty('visible', true)">Show All</button>
				</div>
				<div class="multi-actions">
					<button onclick="Editor.toggleMultiProperty('locked', true)">Lock All</button>
					<button onclick="Editor.toggleMultiProperty('locked', false)">Unlock All</button>
				</div>
				
				<button class="primary-btn" style="width:100%; margin-top:10px;" onclick="Editor.groupSelected()">Group Selected</button>
				<button class="primary-btn" style="width:100%; margin-top:10px;" onclick="Editor.duplicateSelected()">Duplicate All</button>
				<button class="primary-btn btn-delete" style="width:100%; margin-top:10px;" onclick="Editor.deleteSelected()">Delete All</button>
			</div>
		</div>
	</div>
</div>

<!-- MODALS -->

<!-- File Browser Modal -->
<div id="modal-file-browser" class="modal">
	<div class="modal-content large">
		<span class="close" role="button" tabindex="0">&times;</span>
		<h2 id="browser-title">File Browser</h2>
		<div class="browser-controls">
			<button id="btn-browser-up" type="button" disabled>⬆ Up</button>
			<span id="browser-current-path">/</span>
			<button id="btn-create-folder" type="button" style="float:right;">+ New Folder</button>
		</div>
		<ul id="browser-list" class="file-list browser-list-area"></ul>
		<div id="save-input-area" class="form-group" style="margin-top: 15px; display:none;">
			<label for="inp-browser-filename">Filename:</label>
			<div style="display:flex; gap:5px;">
				<input type="text" id="inp-browser-filename" placeholder="level_1">
				<button id="btn-browser-confirm" type="button" class="primary-btn">Save</button>
			</div>
		</div>
	</div>
</div>

<!-- Asset Browser Modal -->
<div id="modal-assets" class="modal">
	<div class="modal-content large">
		<span class="close" role="button" tabindex="0">&times;</span>
		<h2>Asset Browser</h2>
		<div class="asset-toolbar">
			<button id="btn-asset-up" type="button" disabled>⬆ Up</button>
			<span id="asset-current-path">assets/</span>
		</div>
		<div id="asset-grid" class="asset-grid"></div>
		<p class="hint-text">Click an asset to add it to the scene.</p>
	</div>
</div>

<!-- CUSTOM DIALOGS -->
<dialog id="dlg-alert" class="custom-dialog">
	<p id="dlg-alert-msg"></p>
	<button id="dlg-alert-close" type="button">OK</button>
</dialog>

<dialog id="dlg-confirm" class="custom-dialog">
	<p id="dlg-confirm-msg"></p>
	<div class="dlg-actions">
		<button id="dlg-confirm-yes" type="button" class="primary-btn">Yes</button>
		<button id="dlg-confirm-no" type="button">No</button>
	</div>
</dialog>

<dialog id="dlg-prompt" class="custom-dialog">
	<p id="dlg-prompt-msg"></p>
	<input type="text" id="dlg-prompt-input">
	<div class="dlg-actions">
		<button id="dlg-prompt-ok" type="button" class="primary-btn">OK</button>
		<button id="dlg-prompt-cancel" type="button">Cancel</button>
	</div>
</dialog>

<script src="js/assets.js"></script>
<script src="js/history.js"></script>
<script src="js/properties.js"></script>
<script src="js/treeview.js"></script>
<script src="js/scene_manager.js"></script>
<script src="js/editor.js"></script>
<script src="js/interaction.js"></script>
</body>
</html>
