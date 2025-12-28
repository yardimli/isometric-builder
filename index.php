<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Game Editor Engine v1.3</title>
	<link rel="stylesheet" href="css/style.css">
</head>
<body>

<div class="editor-container">
	<!-- Toolbar -->
	<div class="toolbar">
		<div class="left-group">
			<button id="btn-open-modal">📂 Open Scene</button>
			<button id="btn-save-modal">💾 Save Scene</button>
			<button id="btn-assets-modal">🖼️ Asset Browser</button>
		</div>
		<span>Scene: <strong id="scene-name">Unsaved</strong></span>
		<div class="controls">
			<button id="btn-play">▶ Play</button>
			<button id="btn-pause">⏸ Pause</button>
			<label><input type="checkbox" id="chk-grid" checked> Grid</label>
		</div>
	</div>

	<!-- Main Workspace -->
	<div class="workspace">
		<div class="canvas-wrapper">
			<canvas id="gameCanvas"></canvas>
		</div>

		<!-- Properties Panel -->
		<div class="properties-panel">
			<h3>Properties</h3>
			<div id="prop-content" class="prop-group">
				<p class="hint">Select an object.</p>
			</div>
		</div>
	</div>
</div>

<!-- MODALS -->

<!-- Open Scene Modal -->
<div id="modal-open" class="modal">
	<div class="modal-content">
		<span class="close">&times;</span>
		<h2>Open Scene</h2>
		<ul id="scene-list" class="file-list"></ul>
	</div>
</div>

<!-- Save Scene Modal -->
<div id="modal-save" class="modal">
	<div class="modal-content">
		<span class="close">&times;</span>
		<h2>Save Scene</h2>
		<div class="form-group">
			<label>Filename:</label>
			<input type="text" id="inp-save-name" placeholder="level_1.json">
		</div>
		<button id="btn-confirm-save" class="primary-btn">Save</button>
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
	</div>
</div>

<script src="js/assets.js"></script>
<script src="js/editor.js"></script>
</body>
</html>
