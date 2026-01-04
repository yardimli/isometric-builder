<?php
	/**
	 * Bone & Animation Scanner Tool
	 */

	// --- CONFIGURATION ---
	$DIRS = [
		'bones' => 'assets/bones',
		'animations' => 'assets/animations',
		'export' => 'assets/short-bones'
	];

	// --- BACKEND: API HANDLERS ---
	if (isset($_GET['action'])) {
		header('Content-Type: application/json');
		$action = $_GET['action'];

		// Determine which root folder to use (bones or animations)
		$sourceType = $_GET['source'] ?? 'bones';
		$baseDir = ($sourceType === 'animations') ? $DIRS['animations'] : $DIRS['bones'];

		try {
			// 1. List Character Folders (Level 1)
			if ($action === 'list_chars') {
				if (!is_dir($baseDir)) throw new Exception("Directory not found: $baseDir");

				$dirs = array_filter(glob($baseDir . '/*'), 'is_dir');
				$result = [];
				foreach ($dirs as $d) {
					$result[] = basename($d);
				}
				echo json_encode(['status' => 'success', 'data' => $result]);
				exit;
			}

			// 2. List Subfolders (Level 2: TR, TL, or Pose Names)
			if ($action === 'list_subfolders') {
				$char = $_GET['char'] ?? '';
				if (strpos($char, '..') !== false || !$char) throw new Exception("Invalid character path");

				$path = $baseDir . '/' . $char;
				if (!is_dir($path)) {
					echo json_encode(['status' => 'success', 'data' => []]); // Return empty if char doesn't exist in this source
					exit;
				}

				$dirs = array_filter(glob($path . '/*'), 'is_dir');
				$result = [];
				foreach ($dirs as $d) {
					$result[] = basename($d);
				}
				echo json_encode(['status' => 'success', 'data' => $result]);
				exit;
			}

			// 3. List Images in Folder
			if ($action === 'list_images') {
				$char = $_GET['char'] ?? '';
				$dir = $_GET['dir'] ?? '';

				if (strpos($char, '..') !== false || strpos($dir, '..') !== false) throw new Exception("Invalid path");

				$fullPath = $baseDir . '/' . $char . '/' . $dir;
				if (!is_dir($fullPath)) throw new Exception("Directory not found");

				$files = glob($fullPath . '/*.png');
				natsort($files); // Natural sort (1, 2, 10)

				$result = [];
				foreach ($files as $f) {
					$result[] = [
						'filename' => basename($f),
						'path' => $f
					];
				}
				echo json_encode(['status' => 'success', 'data' => $result]);
				exit;
			}

			// 4. Copy Files
			if ($action === 'copy_files') {
				$input = json_decode(file_get_contents('php://input'), true);

				$targetName = $input['targetName'] ?? '';
				$sourceChar = $input['sourceChar'] ?? '';
				$sourceDir = $input['sourceDir'] ?? '';
				$filesToCopy = $input['files'] ?? [];

				// Re-validate source type for copy operation
				$srcType = $input['sourceType'] ?? 'bones';
				$srcBase = ($srcType === 'animations') ? $DIRS['animations'] : $DIRS['bones'];

				if (!$targetName || strpos($targetName, '..') !== false) throw new Exception("Invalid target name");
				if (!$sourceChar || !$sourceDir) throw new Exception("Missing source info");
				if (empty($filesToCopy)) throw new Exception("No files selected");

				// Target: assets/short-bones/<targetName>/<subfolder>
				$destPath = $DIRS['export'] . '/' . $targetName . '/' . $sourceDir;

				if (!file_exists($destPath)) {
					if (!mkdir($destPath, 0777, true)) {
						throw new Exception("Failed to create directory: $destPath");
					}
				}

				$count = 0;
				foreach ($filesToCopy as $filename) {
					$src = $srcBase . '/' . $sourceChar . '/' . $sourceDir . '/' . $filename;
					$dest = $destPath . '/' . $filename;

					if (file_exists($src)) {
						if (copy($src, $dest)) {
							$count++;
						}
					}
				}

				echo json_encode(['status' => 'success', 'message' => "Copied $count files to $destPath"]);
				exit;
			}

		} catch (Exception $e) {
			http_response_code(400);
			echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
			exit;
		}
	}
?>

<!-- --- FRONTEND --- -->
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Bone & Animation Scanner</title>
	<style>
      :root {
          --bg-color: #1e1e1e;
          --text-color: #e0e0e0;
          --panel-bg: #252526;
          --border-color: #3e3e42;
          --accent: #007acc;
          --accent-green: #4caf50;
      }
      body {
          margin: 0;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: var(--bg-color);
          color: var(--text-color);
          height: 100vh;
          display: flex;
          flex-direction: column;
      }

      /* Top Bar */
      header {
          padding: 10px 20px;
          background-color: var(--panel-bg);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          gap: 15px;
          align-items: center;
          flex-wrap: wrap;
      }
      select, button, input {
          padding: 8px;
          background: #333;
          color: white;
          border: 1px solid #555;
          border-radius: 4px;
      }
      select { min-width: 150px; }
      button { cursor: pointer; background: var(--accent); border: none; }
      button:hover { opacity: 0.9; }
      button:disabled { background: #555; cursor: not-allowed; }

      .source-group {
          display: flex;
          align-items: center;
          gap: 10px;
          border-right: 1px solid #555;
          padding-right: 15px;
          margin-right: 5px;
      }

      /* Main Layout */
      .main-container {
          display: flex;
          flex: 1;
          overflow: hidden;
      }

      /* Vertical Strip (Left) */
      .strip-container {
          width: 256px;
          min-width: 256px;
          background-color: #111;
          overflow-y: auto;
          border-right: 1px solid var(--border-color);
          padding: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
      }

      .frame-card {
          position: relative;
          border: 2px solid transparent;
          cursor: pointer;
          background: #222;
      }
      .frame-card.active-frame {
          border-color: var(--accent);
      }
      .frame-card img {
          width: 100%;
          display: block;
          image-rendering: pixelated;
      }
      .frame-checkbox {
          position: absolute;
          top: 5px;
          left: 5px;
          transform: scale(1.5);
          cursor: pointer;
          z-index: 10;
      }
      .frame-number {
          position: absolute;
          bottom: 2px;
          right: 5px;
          background: rgba(0,0,0,0.7);
          padding: 2px 5px;
          font-size: 12px;
          pointer-events: none;
      }

      /* Preview Area (Right) */
      .preview-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: #2d2d30;
          padding: 20px;
      }

      .canvas-wrapper {
          border: 1px solid #555;
          background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABGdBTUEAALGPC/xhBQAAAAlwSFlzAAAOwgAADsIBFShKgAAAABh0RVh0U29mdHdhcmUAcGFpbnQubmV0IDQuMC41ZYmyBAAAABxlWElmTU0AKgAAAAgABQAiAAMBAAAAAQABAAAAMgACAAAAHgAAABgiBAABAAAAAQAAAByHBAABAAAAAQAAAC4AAAAA49+9AAAAVElEQVQ4T42TMQ4AMQiDW///096QQqU44e3eS2Ig1X0x6h4zIwD2Q46o+565+u4W/8w7O3d27ty9/w2Me98/O3d27ty9/w2Me98/O3d27ty9/w2M+wJ9Fw0jC92QZgAAAABJRU5ErkJggg==');
          margin-bottom: 20px;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
      }

      .controls {
          display: flex;
          gap: 20px;
          align-items: center;
          background: var(--panel-bg);
          padding: 15px;
          border-radius: 8px;
      }

      /* Modal */
      .modal {
          display: none;
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.7);
          z-index: 1000;
          justify-content: center;
          align-items: center;
      }
      .modal-content {
          background: var(--panel-bg);
          padding: 20px;
          border-radius: 8px;
          width: 400px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      }
      .modal-buttons {
          margin-top: 15px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
      }

	</style>
</head>
<body>

<header>
	<div class="source-group">
		<label>Source:</label>
		<select id="sourceSelect">
			<option value="bones">Raw Bones (Unchecked)</option>
			<option value="animations">Saved Animations (Checked)</option>
		</select>
	</div>

	<select id="charSelect" disabled>
		<option value="">Select Character...</option>
	</select>
	<select id="dirSelect" disabled>
		<option value="">Select Subfolder...</option>
	</select>

	<div style="flex:1"></div>
	<button id="btnOpenExport" disabled>Export Selected</button>
</header>

<div class="main-container">
	<!-- Left: Vertical Strip -->
	<div class="strip-container" id="stripContainer">
		<div style="text-align:center; color:#777; margin-top:50px;">Select a folder to load frames</div>
	</div>

	<!-- Right: Preview -->
	<div class="preview-container">
		<div class="canvas-wrapper">
			<canvas id="previewCanvas" width="256" height="256"></canvas>
		</div>

		<div class="controls">
			<div>
				<label>FPS: <span id="fpsDisplay">12</span></label>
				<input type="range" id="fpsRange" min="1" max="60" value="12">
			</div>
			<div>
				<button id="btnCheckAll">Check All</button>
				<button id="btnUncheckAll" style="background:#555;">Uncheck All</button>
			</div>
			<div id="statusText" style="color: #aaa; font-size: 0.9em;"></div>
		</div>
	</div>
</div>

<!-- Export Modal -->
<div class="modal" id="exportModal">
	<div class="modal-content">
		<h3>Export Selection</h3>
		<p>Copy selected frames to <code>assets/short-bones/</code></p>
		<label>Subfolder Name:</label>
		<input type="text" id="exportName" placeholder="e.g. skeleton_walk" style="width: 100%; box-sizing: border-box; margin-top:5px;">
		<div class="modal-buttons">
			<button onclick="document.getElementById('exportModal').style.display='none'" style="background:#555">Cancel</button>
			<button id="btnConfirmExport">Copy Files</button>
		</div>
	</div>
</div>

<script>
	// --- STATE ---
	const state = {
		frames: [],
		currentFrameIndex: 0,
		fps: 12,
		isPlaying: true,
		lastFrameTime: 0,
		selectedSource: 'bones', // 'bones' or 'animations'
		selectedChar: '',
		selectedDir: ''
	};

	// --- DOM ELEMENTS ---
	const sourceSelect = document.getElementById('sourceSelect');
	const charSelect = document.getElementById('charSelect');
	const dirSelect = document.getElementById('dirSelect');
	const stripContainer = document.getElementById('stripContainer');
	const canvas = document.getElementById('previewCanvas');
	const ctx = canvas.getContext('2d');
	const fpsRange = document.getElementById('fpsRange');
	const fpsDisplay = document.getElementById('fpsDisplay');
	const btnOpenExport = document.getElementById('btnOpenExport');
	const exportModal = document.getElementById('exportModal');
	const btnConfirmExport = document.getElementById('btnConfirmExport');
	const exportNameInput = document.getElementById('exportName');
	const statusText = document.getElementById('statusText');

	// --- INITIALIZATION ---
	async function init() {
		// Load characters for the default source (bones)
		await loadCharacters();
		requestAnimationFrame(animate);
	}

	// --- API HELPERS ---
	async function loadCharacters() {
		charSelect.innerHTML = '<option value="">Loading...</option>';
		charSelect.disabled = true;
		dirSelect.innerHTML = '<option value="">Select Subfolder...</option>';
		dirSelect.disabled = true;
		stripContainer.innerHTML = '';
		state.frames = [];
		btnOpenExport.disabled = true;

		try {
			const res = await fetch(`?action=list_chars&source=${state.selectedSource}`);
			const json = await res.json();

			charSelect.innerHTML = '<option value="">Select Character...</option>';
			if(json.status === 'success') {
				json.data.forEach(char => {
					const opt = document.createElement('option');
					opt.value = char;
					opt.textContent = char;
					charSelect.appendChild(opt);
				});
				charSelect.disabled = false;
			}
		} catch(e) { console.error(e); charSelect.innerHTML = '<option>Error</option>'; }
	}

	// --- EVENT LISTENERS ---

	// 1. Change Source (Bones vs Animations)
	sourceSelect.addEventListener('change', () => {
		state.selectedSource = sourceSelect.value;
		loadCharacters();
	});

	// 2. Select Character
	charSelect.addEventListener('change', async () => {
		state.selectedChar = charSelect.value;
		dirSelect.innerHTML = '<option value="">Select Subfolder...</option>';
		dirSelect.disabled = true;
		stripContainer.innerHTML = '';
		state.frames = [];
		btnOpenExport.disabled = true;

		if(!state.selectedChar) return;

		const res = await fetch(`?action=list_subfolders&source=${state.selectedSource}&char=${encodeURIComponent(state.selectedChar)}`);
		const json = await res.json();
		if(json.status === 'success') {
			json.data.forEach(d => {
				const opt = document.createElement('option');
				opt.value = d;
				opt.textContent = d;
				dirSelect.appendChild(opt);
			});
			dirSelect.disabled = false;
		}
	});

	// 3. Select Subfolder (Load Images)
	dirSelect.addEventListener('change', async () => {
		state.selectedDir = dirSelect.value;
		stripContainer.innerHTML = '';
		state.frames = [];
		btnOpenExport.disabled = true;

		if(!state.selectedDir) return;

		const res = await fetch(`?action=list_images&source=${state.selectedSource}&char=${encodeURIComponent(state.selectedChar)}&dir=${encodeURIComponent(state.selectedDir)}`);
		const json = await res.json();

		if(json.status === 'success') {
			// Determine default checked state based on source
			const defaultChecked = (state.selectedSource === 'animations');
			loadFrames(json.data, defaultChecked);
			btnOpenExport.disabled = false;
		}
	});

	// 4. FPS Slider
	fpsRange.addEventListener('input', (e) => {
		state.fps = parseInt(e.target.value);
		fpsDisplay.textContent = state.fps;
	});

	// 5. Export Buttons
	btnOpenExport.addEventListener('click', () => {
		const count = state.frames.filter(f => f.checked).length;
		if(count === 0) {
			alert("No frames checked!");
			return;
		}
		exportModal.style.display = 'flex';
	});

	btnConfirmExport.addEventListener('click', async () => {
		const targetName = exportNameInput.value.trim();
		if(!targetName) {
			alert("Please enter a subfolder name.");
			return;
		}

		const selectedFiles = state.frames.filter(f => f.checked).map(f => f.filename);

		btnConfirmExport.textContent = "Copying...";
		btnConfirmExport.disabled = true;

		try {
			const res = await fetch('?action=copy_files', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({
					targetName: targetName,
					sourceType: state.selectedSource,
					sourceChar: state.selectedChar,
					sourceDir: state.selectedDir,
					files: selectedFiles
				})
			});
			const json = await res.json();
			if(json.status === 'success') {
				alert(json.message);
				exportModal.style.display = 'none';
			} else {
				alert("Error: " + json.message);
			}
		} catch(e) {
			alert("Request failed");
		}

		btnConfirmExport.textContent = "Copy Files";
		btnConfirmExport.disabled = false;
	});

	// 6. Bulk Check/Uncheck
	document.getElementById('btnCheckAll').addEventListener('click', () => {
		state.frames.forEach((f, i) => {
			f.checked = true;
			document.getElementById(`chk-${i}`).checked = true;
		});
	});

	document.getElementById('btnUncheckAll').addEventListener('click', () => {
		state.frames.forEach((f, i) => {
			f.checked = false;
			document.getElementById(`chk-${i}`).checked = false;
		});
	});

	// --- LOGIC ---

	function loadFrames(fileList, defaultChecked) {
		state.frames = [];
		state.currentFrameIndex = 0;

		fileList.forEach((file, index) => {
			const div = document.createElement('div');
			div.className = 'frame-card';
			div.id = `card-${index}`;

			const img = new Image();
			img.src = file.path;
			img.onload = () => {
				if(index === 0) {
					canvas.width = img.naturalWidth;
					canvas.height = img.naturalHeight;
				}
			};

			const chk = document.createElement('input');
			chk.type = 'checkbox';
			chk.className = 'frame-checkbox';
			chk.id = `chk-${index}`;
			chk.checked = defaultChecked;

			chk.addEventListener('change', (e) => {
				state.frames[index].checked = e.target.checked;
				e.stopPropagation();
			});

			div.addEventListener('click', () => {
				document.querySelectorAll('.frame-card').forEach(c => c.classList.remove('active-frame'));
				div.classList.add('active-frame');
				state.currentFrameIndex = index;
			});

			const num = document.createElement('div');
			num.className = 'frame-number';
			num.textContent = index + 1;

			div.appendChild(img);
			div.appendChild(chk);
			div.appendChild(num);
			stripContainer.appendChild(div);

			state.frames.push({
				filename: file.filename,
				path: file.path,
				checked: defaultChecked,
				imgObj: img
			});
		});
	}

	function animate(timestamp) {
		requestAnimationFrame(animate);

		const interval = 1000 / state.fps;
		if (timestamp - state.lastFrameTime < interval) return;
		state.lastFrameTime = timestamp;

		if (state.frames.length === 0) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			return;
		}

		const activeIndices = state.frames
			.map((f, i) => f.checked ? i : -1)
			.filter(i => i !== -1);

		if (activeIndices.length === 0) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.fillStyle = "#ccc";
			ctx.font = "14px Arial";
			ctx.fillText("No frames checked", 10, 50);
			return;
		}

		let nextIndex = activeIndices.find(i => i >= state.currentFrameIndex);

		if (nextIndex === undefined) {
			nextIndex = activeIndices[0];
		}

		state.currentFrameIndex = nextIndex;

		const frame = state.frames[state.currentFrameIndex];
		if (frame && frame.imgObj.complete) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(frame.imgObj, 0, 0);

			document.querySelectorAll('.frame-card').forEach(c => c.classList.remove('active-frame'));
			const activeCard = document.getElementById(`card-${state.currentFrameIndex}`);
			if(activeCard) activeCard.classList.add('active-frame');

			statusText.textContent = `Playing Frame: ${frame.filename}`;
		}

		state.currentFrameIndex++;
	}

	// Start
	init();

</script>
</body>
</html>
