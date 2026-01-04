<?php

	header('Content-Type: application/json');

	$action = $_POST['action'] ?? '';
	$root = realpath(__DIR__ . '/..');

	/**
	 * Sends a JSON response and exits.
	 */
	function sendResponse($success, $data = null, $message = '')
	{
		echo json_encode(['success' => $success, 'data' => $data, 'message' => $message]);
		exit;
	}

	/**
	 * Security: Prevent directory traversal.
	 */
	function isSafePath($path, $baseDir)
	{
		$realPath = realpath($path);
		if (!$realPath) {
			$realPath = realpath(dirname($path));
		}
		$realBase = realpath($baseDir);
		return $realPath && strpos($realPath, $realBase) === 0;
	}

	switch ($action) {
		case 'scan_assets':
			// ... (Existing code remains unchanged) ...
			$relPath = $_POST['path'] ?? 'assets';
			$relPath = trim($relPath, '/');
			if (strpos($relPath, 'assets') !== 0) {
				$relPath = 'assets';
			}

			$fullPath = $root . '/' . $relPath;

			if (!is_dir($fullPath) || !isSafePath($fullPath, $root . '/assets')) {
				sendResponse(false, null, 'Invalid directory.');
			}

			$files = scandir($fullPath);
			$result = ['folders' => [], 'files' => [], 'currentPath' => $relPath];

			if ($relPath !== 'assets') {
				$result['parent'] = dirname($relPath);
			}

			foreach ($files as $f) {
				if ($f === '.' || $f === '..') {
					continue;
				}
				$filePath = $fullPath . '/' . $f;
				if (is_dir($filePath)) {
					$result['folders'][] = $f;
				} else {
					if (preg_match('/\.(png|jpg|jpeg|gif)$/i', $f)) {
						$result['files'][] = $f;
					}
				}
			}
			sendResponse(true, $result);
			break;

		// --- NEW: Scan Sprite Root Folder ---
		case 'scan_sprite_root':
			$spriteRoot = $root . '/assets/sprite-animation';
			if (!is_dir($spriteRoot)) {
				mkdir($spriteRoot, 0777, true);
			}

			$items = scandir($spriteRoot);
			$sprites = [];

			foreach ($items as $item) {
				if ($item === '.' || $item === '..') {
					continue;
				}
				if (is_dir($spriteRoot . '/' . $item)) {
					$sprites[] = $item;
				}
			}
			sendResponse(true, $sprites);
			break;

		// --- NEW: Get Details for a specific Sprite (Animations/Frames) ---
		case 'get_sprite_details':
			$spriteName = $_POST['name'] ?? '';
			if (!$spriteName) {
				sendResponse(false, null, 'No sprite name provided.');
			}

			$baseDir = $root . '/assets/sprite-animation/' . $spriteName;
			if (!is_dir($baseDir) || !isSafePath($baseDir, $root . '/assets/sprite-animation')) {
				sendResponse(false, null, 'Invalid sprite path.');
			}

			$animations = [];
			$animFolders = scandir($baseDir);

			foreach ($animFolders as $anim) {
				if ($anim === '.' || $anim === '..' || !is_dir($baseDir . '/' . $anim)) {
					continue;
				}

				$frames = [];
				$frameFiles = scandir($baseDir . '/' . $anim);
				foreach ($frameFiles as $file) {
					if (preg_match('/\.(png|jpg|jpeg|gif)$/i', $file)) {
						$frames[] = $file;
					}
				}
				sort($frames); // Ensure frames are in order (frame_001, frame_002)

				if (!empty($frames)) {
					$animations[$anim] = $frames;
				}
			}

			sendResponse(true, $animations);
			break;

		case 'list_scenes':
			// ... (Existing code remains unchanged) ...
			$relPath = $_POST['path'] ?? '';
			$relPath = trim($relPath, '/');
			$baseSceneDir = $root . '/scenes';
			$fullPath = $baseSceneDir . ($relPath ? '/' . $relPath : '');

			if (!is_dir($fullPath) || !isSafePath($fullPath, $baseSceneDir)) {
				$fullPath = $baseSceneDir;
				$relPath = '';
			}

			if (!is_dir($fullPath)) {
				mkdir($fullPath, 0777, true);
			}

			$items = scandir($fullPath);
			$result = ['folders' => [], 'files' => [], 'currentPath' => $relPath];

			if ($relPath !== '' && $relPath !== '.') {
				$result['parent'] = dirname($relPath) === '.' ? '' : dirname($relPath);
			}

			foreach ($items as $f) {
				if ($f === '.' || $f === '..') {
					continue;
				}
				$itemPath = $fullPath . '/' . $f;
				if (is_dir($itemPath)) {
					$result['folders'][] = $f;
				} elseif (strpos($f, '.json') !== false) {
					$result['files'][] = $f;
				}
			}
			sendResponse(true, $result);
			break;

		case 'create_folder':
			// ... (Existing code remains unchanged) ...
			$path = $_POST['path'] ?? '';
			$newFolder = $_POST['name'] ?? 'New Folder';
			$baseSceneDir = $root . '/scenes';
			$targetDir = $baseSceneDir . ($path ? '/' . $path : '') . '/' . $newFolder;

			if (isSafePath($targetDir, $baseSceneDir) && !file_exists($targetDir)) {
				if (mkdir($targetDir, 0777, true)) {
					sendResponse(true, null, 'Folder created.');
				} else {
					sendResponse(false, null, 'Failed to create folder.');
				}
			} else {
				sendResponse(false, null, 'Invalid path or folder exists.');
			}
			break;

		case 'load_scene':
			// ... (Existing code remains unchanged) ...
			$filename = $_POST['filename'] ?? '';
			$path = $root . '/scenes/' . $filename;

			if (file_exists($path) && isSafePath($path, $root . '/scenes')) {
				$content = file_get_contents($path);
				sendResponse(true, json_decode($content));
			} else {
				sendResponse(false, null, 'Scene file not found.');
			}
			break;

		case 'check_file_exists':
			// ... (Existing code remains unchanged) ...
			$filename = $_POST['filename'] ?? '';
			$path = $root . '/scenes/' . $filename;
			if (file_exists($path) && isSafePath($path, $root . '/scenes')) {
				sendResponse(true, true);
			} else {
				sendResponse(true, false);
			}
			break;

		case 'save_scene':
			// ... (Existing code remains unchanged) ...
			$filename = $_POST['filename'] ?? 'scene.json';
			if (strpos($filename, '.json') === false) {
				$filename .= '.json';
			}

			$json = $_POST['data'] ?? '{}';
			$path = $root . '/scenes/' . $filename;

			$dir = dirname($path);
			if (!is_dir($dir)) {
				mkdir($dir, 0777, true);
			}

			if (isSafePath($path, $root . '/scenes')) {
				if (file_put_contents($path, $json)) {
					sendResponse(true, null, 'Scene saved successfully.');
				} else {
					sendResponse(false, null, 'Failed to save scene.');
				}
			} else {
				sendResponse(false, null, 'Invalid path.');
			}
			break;

		default:
			sendResponse(false, null, 'Invalid action.');
	}
?>
