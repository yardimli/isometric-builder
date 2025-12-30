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
			<div class="treeview-header">Hierarchy</div>
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
			<h3>Properties</h3>
			<div id="prop-content" class="prop-group">
				<p class="hint">Select an object or the scene.</p>
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

<!-- CUSTOM DIALOGS (New) -->
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
</body>
</html>
