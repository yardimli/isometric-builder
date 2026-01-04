<?php
	// frame-animation.php

	$dir = 'assets/animation-sheet/';

	// --- Handle JSON Saving (AJAX Request) ---
	if ($_SERVER['REQUEST_METHOD'] === 'POST') {
		$input = json_decode(file_get_contents('php://input'), true);

		if (isset($input['action']) && $input['action'] === 'save') {
			$filename = $input['filename']; // e.g., "hero.png"
			$data = $input['data'];

			// Change extension to .json
			$jsonName = pathinfo($filename, PATHINFO_FILENAME) . '.json';
			$savePath = $dir . $jsonName;

			if (file_put_contents($savePath, json_encode($data, JSON_PRETTY_PRINT))) {
				echo json_encode(['status' => 'success', 'message' => 'Saved to ' . $jsonName]);
			} else {
				echo json_encode(['status' => 'error', 'message' => 'Failed to write file. Check permissions.']);
			}
			exit;
		}
	}

	// --- Scan Directory for Images ---
	$files = [];
	if (is_dir($dir)) {
		$scanned = scandir($dir);
		foreach ($scanned as $file) {
			$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
			if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif'])) {
				$files[] = $file;
			}
		}
	}
?>
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Sprite Sheet Animator & Editor</title>
	<style>
      :root {
          --bg-color: #1e1e1e;
          --panel-color: #252526;
          --text-color: #d4d4d4;
          --accent-color: #007acc;
          --border-color: #3e3e42;
          --input-bg: #3c3c3c;
      }

      body {
          margin: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: var(--bg-color);
          color: var(--text-color);
          height: 100vh;
          display: flex;
          overflow: hidden;
      }

      /* --- Sidebar --- */
      .sidebar {
          width: 340px;
          background-color: var(--panel-color);
          border-right: 1px solid var(--border-color);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 15px;
          overflow-y: auto;
          flex-shrink: 0;
      }

      h2, h3 { margin: 0 0 10px 0; font-weight: 500; color: #fff; }
      label { display: block; margin-bottom: 5px; font-size: 0.85em; color: #aaa; }

      select, input {
          width: 100%;
          padding: 8px;
          background-color: var(--input-bg);
          border: 1px solid var(--border-color);
          color: white;
          border-radius: 4px;
          box-sizing: border-box;
          margin-bottom: 10px;
      }

      input:focus { border-color: var(--accent-color); outline: none; }

      button {
          background-color: var(--accent-color);
          color: white;
          border: none;
          padding: 10px;
          cursor: pointer;
          border-radius: 4px;
          width: 100%;
          font-weight: bold;
          transition: background 0.2s;
      }

      button:hover { background-color: #005f9e; }
      button.secondary { background-color: #444; margin-top: 5px; }
      button.secondary:hover { background-color: #555; }
      button.danger { background-color: #c0392b; }
      button.danger:hover { background-color: #a93226; }

      .row { display: flex; gap: 10px; }
      .col { flex: 1; }
      .divider { border-bottom: 1px solid var(--border-color); margin: 10px 0; }

      /* --- Main Content --- */
      .main-content {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
      }

      /* Source Preview */
      #source-container {
          background: #2d2d2d;
          padding: 10px;
          border-radius: 4px;
          overflow: auto;
          max-height: 400px;
          border: 1px solid #444;
          position: relative;
      }

      #source-canvas {
          background-image: linear-gradient(45deg, #444 25%, transparent 25%),
          linear-gradient(-45deg, #444 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #444 75%),
          linear-gradient(-45deg, transparent 75%, #444 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
          cursor: crosshair;
      }

      /* Animation Cards */
      #animations-list {
          display: flex;
          flex-wrap: wrap;
          gap: 15px;
          align-items: flex-start;
      }

      .anim-card {
          background-color: var(--panel-color);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 10px;
          width: 300px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      }

      .anim-preview-box {
          height: 300px;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          border: 1px solid #333;
          background-image: linear-gradient(45deg, #222 25%, transparent 25%),
          linear-gradient(-45deg, #222 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #222 75%),
          linear-gradient(-45deg, transparent 75%, #222 75%);
          background-size: 10px 10px;
      }

      .anim-card input {
          margin-bottom: 0;
          font-size: 0.9em;
          padding: 4px;
      }

      .anim-card .card-row {
          display: flex;
          gap: 5px;
      }

      .anim-card label {
          font-size: 0.7em;
          margin-bottom: 2px;
      }

      #status-msg {
          font-size: 0.9em;
          margin-top: 5px;
          height: 20px;
          color: #4caf50;
      }

	</style>
</head>
<body>

<!-- SIDEBAR -->
<div class="sidebar">
	<h2>Sprite Editor</h2>

	<!-- File Selection -->
	<label>Select File</label>
	<select id="file-select">
		<option value="">-- Choose a Sprite Sheet --</option>
		<?php foreach ($files as $f): ?>
			<option value="<?php echo $f; ?>"><?php echo $f; ?></option>
		<?php endforeach; ?>
	</select>

	<div class="row">
		<button id="save-btn" class="secondary">Save Settings (JSON)</button>
	</div>
	<div id="status-msg"></div>

	<div class="divider"></div>

	<!-- Dimensions -->
	<div class="row">
		<div class="col">
			<label>Frame Width</label>
			<input type="number" id="frame-width" value="32" min="1">
		</div>
		<div class="col">
			<label>Frame Height</label>
			<input type="number" id="frame-height" value="32" min="1">
		</div>
	</div>
	<div id="frame-info" style="font-size: 0.8em; color: #888; margin-bottom: 10px;">Total Frames: 0</div>

	<!-- FPS Control -->
	<label>Playback Speed (FPS): <span id="fps-val">10</span></label>
	<input type="range" id="fps-slider" min="1" max="60" value="10">

	<div class="divider"></div>

	<!-- Create Sequence -->
	<h3>Add Sequence</h3>
	<label>Sequence Name</label>
	<input type="text" id="seq-name" placeholder="e.g., Idle">

	<div class="row">
		<div class="col">
			<label>Start Frame</label>
			<input type="number" id="seq-start" value="0" min="0">
		</div>
		<div class="col">
			<label>End Frame</label>
			<input type="number" id="seq-end" value="0" min="0">
		</div>
	</div>

	<button id="add-seq-btn">Add Sequence</button>
</div>

<!-- MAIN CONTENT -->
<div class="main-content">
	<!-- Source Visualization -->
	<h3>Source Preview</h3>
	<div id="source-container">
		<canvas id="source-canvas"></canvas>
	</div>

	<div class="divider"></div>

	<!-- Active Animations -->
	<h3>Active Animations</h3>
	<div id="animations-list">
		<div style="color: #666; font-style: italic; width: 100%;" id="empty-msg">
			Select a file and add sequences. If a JSON file exists, it will load automatically.
		</div>
	</div>
</div>

<!-- JAVASCRIPT -->
<script>
	const ASSET_PATH = 'assets/animation-sheet/';

	// State
	const state = {
		filename: '',
		image: new Image(),
		isLoaded: false,
		frameWidth: 32,
		frameHeight: 32,
		fps: 10,
		cols: 0,
		rows: 0,
		totalFrames: 0,
		sequences: []
	};

	// DOM Elements
	const els = {
		fileSelect: document.getElementById('file-select'),
		saveBtn: document.getElementById('save-btn'),
		statusMsg: document.getElementById('status-msg'),
		frameWidth: document.getElementById('frame-width'),
		frameHeight: document.getElementById('frame-height'),
		frameInfo: document.getElementById('frame-info'),
		fpsSlider: document.getElementById('fps-slider'),
		fpsVal: document.getElementById('fps-val'),
		seqName: document.getElementById('seq-name'),
		seqStart: document.getElementById('seq-start'),
		seqEnd: document.getElementById('seq-end'),
		addBtn: document.getElementById('add-seq-btn'),
		sourceCanvas: document.getElementById('source-canvas'),
		sourceCtx: document.getElementById('source-canvas').getContext('2d'),
		animList: document.getElementById('animations-list'),
		emptyMsg: document.getElementById('empty-msg')
	};

	// --- Event Listeners ---

	els.fileSelect.addEventListener('change', (e) => {
		const filename = e.target.value;
		if(!filename) return;

		state.filename = filename;
		state.image.src = ASSET_PATH + filename;

		// Try to load JSON settings automatically
		loadSettings(filename);
	});

	state.image.onload = () => {
		state.isLoaded = true;
		updateGridCalculations();
		drawSourceGrid();
		// If no sequences loaded from JSON, clear list
		if(state.sequences.length === 0) renderSequences();
	};

	[els.frameWidth, els.frameHeight].forEach(el => {
		el.addEventListener('input', () => {
			state.frameWidth = parseInt(els.frameWidth.value) || 32;
			state.frameHeight = parseInt(els.frameHeight.value) || 32;
			updateGridCalculations();
			drawSourceGrid();
			updateAllCanvases();
		});
	});

	els.fpsSlider.addEventListener('input', (e) => {
		state.fps = parseInt(e.target.value);
		els.fpsVal.textContent = state.fps;
	});

	els.addBtn.addEventListener('click', () => {
		if (!state.isLoaded) return alert("Please select a file first.");

		const name = els.seqName.value || "Untitled";
		const start = parseInt(els.seqStart.value);
		const end = parseInt(els.seqEnd.value);

		if (start > end) return alert("Start frame cannot be greater than end frame.");

		addSequence(name, start, end);
	});

	els.saveBtn.addEventListener('click', saveSettingsToServer);

	// --- Core Logic ---

	function updateGridCalculations() {
		if (!state.isLoaded) return;
		state.cols = Math.floor(state.image.width / state.frameWidth);
		state.rows = Math.floor(state.image.height / state.frameHeight);
		state.totalFrames = state.cols * state.rows;
		els.frameInfo.textContent = `Grid: ${state.cols}x${state.rows} | Total Frames: ${state.totalFrames} (Indices: 0 - ${state.totalFrames-1})`;
	}

	function drawSourceGrid() {
		if (!state.isLoaded) return;

		const w = state.image.width;
		const h = state.image.height;

		els.sourceCanvas.width = w;
		els.sourceCanvas.height = h;

		const ctx = els.sourceCtx;

		// Draw Image
		ctx.drawImage(state.image, 0, 0);

		// Draw Grid Overlay
		ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
		ctx.lineWidth = 1;
		ctx.beginPath();

		for (let x = 0; x <= w; x += state.frameWidth) {
			ctx.moveTo(x, 0);
			ctx.lineTo(x, h);
		}
		for (let y = 0; y <= h; y += state.frameHeight) {
			ctx.moveTo(0, y);
			ctx.lineTo(w, y);
		}
		ctx.stroke();

		// Draw Frame Numbers (Bigger & Outlined)
		ctx.font = 'bold 16px Arial';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'top';

		let i = 0;
		// Use <= to ensure we cover the last row if dimensions match exactly
		for (let y = 0; y < state.rows; y++) {
			for (let x = 0; x < state.cols; x++) {
				const posX = (x * state.frameWidth) + 4;
				const posY = (y * state.frameHeight) + 4;

				// Stroke (Black Outline)
				ctx.strokeStyle = 'black';
				ctx.lineWidth = 3;
				ctx.strokeText(i, posX, posY);

				// Fill (Yellow Text)
				ctx.fillStyle = '#ffeb3b';
				ctx.fillText(i, posX, posY);

				i++;
			}
		}
	}

	function addSequence(name, start, end) {
		const seqObj = {
			id: Date.now() + Math.random(),
			name: name,
			start: start,
			end: end,
			currentFrame: start,
			canvas: null,
			ctx: null
		};
		state.sequences.push(seqObj);
		renderSequences();
	}

	function removeSequence(id) {
		state.sequences = state.sequences.filter(s => s.id !== id);
		renderSequences();
	}

	function updateSequenceData(id, field, value) {
		const seq = state.sequences.find(s => s.id === id);
		if (seq) {
			if (field === 'name') seq.name = value;
			else seq[field] = parseInt(value);

			// Reset current frame if out of bounds
			if (seq.currentFrame < seq.start || seq.currentFrame > seq.end) {
				seq.currentFrame = seq.start;
			}
		}
	}

	function renderSequences() {
		els.animList.innerHTML = '';

		if (state.sequences.length === 0) {
			els.emptyMsg.style.display = 'block';
			return;
		}
		els.emptyMsg.style.display = 'none';

		state.sequences.forEach(seq => {
			const card = document.createElement('div');
			card.className = 'anim-card';

			// Preview Box
			const previewBox = document.createElement('div');
			previewBox.className = 'anim-preview-box';

			const canvas = document.createElement('canvas');
			canvas.width = state.frameWidth;
			canvas.height = state.frameHeight;
			previewBox.appendChild(canvas);

			// Inputs
			const nameInput = document.createElement('input');
			nameInput.type = 'text';
			nameInput.value = seq.name;
			nameInput.oninput = (e) => updateSequenceData(seq.id, 'name', e.target.value);

			const rowDiv = document.createElement('div');
			rowDiv.className = 'card-row';

			const startWrap = document.createElement('div');
			startWrap.className = 'col';
			startWrap.innerHTML = '<label>Start</label>';
			const startInput = document.createElement('input');
			startInput.type = 'number';
			startInput.value = seq.start;
			startInput.oninput = (e) => updateSequenceData(seq.id, 'start', e.target.value);
			startWrap.appendChild(startInput);

			const endWrap = document.createElement('div');
			endWrap.className = 'col';
			endWrap.innerHTML = '<label>End</label>';
			const endInput = document.createElement('input');
			endInput.type = 'number';
			endInput.value = seq.end;
			endInput.oninput = (e) => updateSequenceData(seq.id, 'end', e.target.value);
			endWrap.appendChild(endInput);

			rowDiv.appendChild(startWrap);
			rowDiv.appendChild(endWrap);

			// Remove Btn
			const btn = document.createElement('button');
			btn.className = 'danger';
			btn.textContent = 'Remove';
			btn.onclick = () => removeSequence(seq.id);

			card.appendChild(previewBox);
			card.appendChild(nameInput);
			card.appendChild(rowDiv);
			card.appendChild(btn);
			els.animList.appendChild(card);

			seq.canvas = canvas;
			seq.ctx = canvas.getContext('2d');
		});
	}

	function updateAllCanvases() {
		state.sequences.forEach(seq => {
			if(seq.canvas) {
				seq.canvas.width = state.frameWidth;
				seq.canvas.height = state.frameHeight;
			}
		});
	}

	// --- Save / Load Operations ---

	function saveSettingsToServer() {
		if (!state.filename) return alert("No file selected.");

		const dataToSave = {
			frameWidth: state.frameWidth,
			frameHeight: state.frameHeight,
			fps: state.fps,
			sequences: state.sequences.map(s => ({
				name: s.name,
				start: s.start,
				end: s.end
			}))
		};

		fetch('frame-animation.php', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'save',
				filename: state.filename,
				data: dataToSave
			})
		})
			.then(res => res.json())
			.then(res => {
				els.statusMsg.textContent = res.message;
				els.statusMsg.style.color = res.status === 'success' ? '#4caf50' : '#f44336';
				setTimeout(() => els.statusMsg.textContent = '', 3000);
			})
			.catch(err => alert("Error saving: " + err));
	}

	function loadSettings(filename) {
		// Construct JSON filename
		const jsonName = filename.replace(/\.[^/.]+$/, "") + ".json";

		fetch(ASSET_PATH + jsonName)
			.then(res => {
				if (!res.ok) throw new Error("No JSON found");
				return res.json();
			})
			.then(data => {
				// Apply Settings
				state.frameWidth = data.frameWidth || 32;
				state.frameHeight = data.frameHeight || 32;
				state.fps = data.fps || 10;

				// Update UI
				els.frameWidth.value = state.frameWidth;
				els.frameHeight.value = state.frameHeight;
				els.fpsSlider.value = state.fps;
				els.fpsVal.textContent = state.fps;

				// Clear and Rebuild Sequences
				state.sequences = [];
				if (data.sequences && Array.isArray(data.sequences)) {
					data.sequences.forEach(s => {
						addSequence(s.name, s.start, s.end);
					});
				}

				els.statusMsg.textContent = "Settings loaded from JSON.";
				els.statusMsg.style.color = "#4caf50";
			})
			.catch(err => {
				// No JSON found, reset to defaults
				console.log("No existing settings found for this image.");
				state.sequences = [];
				renderSequences();
				els.statusMsg.textContent = "";
			});
	}

	// --- Animation Loop ---

	let lastTime = 0;

	function animate(timestamp) {
		const interval = 1000 / state.fps;
		const elapsed = timestamp - lastTime;

		if (elapsed > interval) {
			lastTime = timestamp - (elapsed % interval);

			state.sequences.forEach(seq => {
				if (!seq.ctx || !state.isLoaded) return;

				seq.ctx.clearRect(0, 0, state.frameWidth, state.frameHeight);

				// Validate frame range
				if (seq.currentFrame > seq.end || seq.currentFrame < seq.start) {
					seq.currentFrame = seq.start;
				}

				// Calculate source coordinates
				const colIndex = seq.currentFrame % state.cols;
				const rowIndex = Math.floor(seq.currentFrame / state.cols);

				const sx = colIndex * state.frameWidth;
				const sy = rowIndex * state.frameHeight;

				// Draw
				seq.ctx.drawImage(
					state.image,
					sx, sy, state.frameWidth, state.frameHeight,
					0, 0, state.frameWidth, state.frameHeight
				);

				// Advance
				seq.currentFrame++;
			});
		}

		requestAnimationFrame(animate);
	}

	requestAnimationFrame(animate);

</script>
</body>
</html>
