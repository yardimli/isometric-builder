<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Game Editor Engine v1.6</title>
	<link rel="stylesheet" href="css/style.css">
</head>
<body>

<div class="editor-container">
	<!-- Toolbar -->
	<div class="toolbar">
		<div class="left-group">
			<button id="btn-open-modal">📂 Open</button>
			<button id="btn-save">💾 Save</button>
			<button id="btn-save-as">💾 Save As...</button>
			<button id="btn-assets-modal">🖼️ Assets</button>
			<button id="btn-scene-props">⚙️ Scene Props</button>
		</div>
		<span>Scene: <strong id="scene-name">Unsaved</strong></span>
		<div class="controls">
			<button id="btn-play">▶ Play</button>
			<button id="btn-pause">⏸ Pause</button>
			<label title="Toggle Grid Visibility"><input type="checkbox" id="chk-grid-visible" checked> Grid</label>
			<label title="Toggle Snap to Grid"><input type="checkbox" id="chk-grid-snap" checked> Snap</label>
		</div>
	</div>

	<!-- Main Workspace -->
	<div class="workspace">
		<div class="canvas-wrapper" id="canvas-wrapper">
			<canvas id="gameCanvas"></canvas>
		</div>

		<!-- Zoom Controls -->
		<div class="zoom-controls">
			<button id="btn-zoom-out" title="Zoom Out">-</button>
			<input type="text" id="inp-zoom-percent" value="100%">
			<button id="btn-zoom-in" title="Zoom In">+</button>
		</div>

		<!-- Properties Panel -->
		<div class="properties-panel">
			<h3>Properties</h3>
			<div id="prop-content" class="prop-group">
				<p class="hint">Select an object or the scene.</p>
			</div>
		</div>
	</div>
</div>

<!-- MODALS -->

<!-- File Browser Modal (Shared for Open and Save As) -->
<div id="modal-file-browser" class="modal">
	<div class="modal-content large">
		<span class="close">&times;</span>
		<h2 id="browser-title">File Browser</h2>

		<div class="browser-controls">
			<button id="btn-browser-up" disabled>⬆ Up</button>
			<span id="browser-current-path">/</span>
			<button id="btn-create-folder" style="float:right;">+ New Folder</button>
		</div>

		<!-- File List Area -->
		<ul id="browser-list" class="file-list browser-list-area"></ul>

		<!-- Save As Input Area (Hidden by default) -->
		<div id="save-input-area" class="form-group" style="margin-top: 15px; display:none;">
			<label>Filename:</label>
			<div style="display:flex; gap:5px;">
				<input type="text" id="inp-browser-filename" placeholder="level_1">
				<button id="btn-browser-confirm" class="primary-btn">Save</button>
			</div>
		</div>
	</div>
</div>

<!-- Asset Browser Modal -->
<div id="modal-assets" class="modal">
	<div class="modal-content large">
		<span class="close">&times;</span>
		<h2>Asset Browser</h2>
		<div class="asset-toolbar">
			<button id="btn-asset-up" disabled>⬆ Up</button>
			<span id="asset-current-path">assets/</span>
		</div>
		<div id="asset-grid" class="asset-grid"></div>
		<p class="hint-text">Click an asset to add it to the scene.</p>
	</div>
</div>

<!-- Scripts -->
<script src="js/assets.js"></script>
<script src="js/scene_manager.js"></script>
<script src="js/editor.js"></script>
</body>
</html>
