<?php
	header('Content-Type: application/json');

	$action = $_POST['action'] ?? '';
	$root = realpath(__DIR__ . '/..'); // Project Root

	function sendResponse($success, $data = null, $message = '') {
		echo json_encode(['success' => $success, 'data' => $data, 'message' => $message]);
		exit;
	}

// Security: Prevent directory traversal
	function isSafePath($path, $baseDir) {
		$realPath = realpath($path);
		$realBase = realpath($baseDir);
		return $realPath && strpos($realPath, $realBase) === 0;
	}

	switch ($action) {
		case 'scan_assets':
			$relPath = $_POST['path'] ?? 'assets';
			// Remove trailing slashes and ensure it starts with assets
			$relPath = trim($relPath, '/');
			if (strpos($relPath, 'assets') !== 0) $relPath = 'assets';

			$fullPath = $root . '/' . $relPath;

			if (!is_dir($fullPath) || !isSafePath($fullPath, $root . '/assets')) {
				sendResponse(false, null, 'Invalid directory.');
			}

			$files = scandir($fullPath);
			$result = ['folders' => [], 'files' => [], 'currentPath' => $relPath];

			// Parent folder logic
			if ($relPath !== 'assets') {
				$result['parent'] = dirname($relPath);
			}

			foreach ($files as $f) {
				if ($f === '.' || $f === '..') continue;
				$filePath = $fullPath . '/' . $f;
				if (is_dir($filePath)) {
					$result['folders'][] = $f;
				} else {
					// Simple image filter
					if (preg_match('/\.(png|jpg|jpeg|gif)$/i', $f)) {
						$result['files'][] = $f;
					}
				}
			}
			sendResponse(true, $result);
			break;

		case 'list_scenes':
			$sceneDir = $root . '/scenes';
			if (!is_dir($sceneDir)) mkdir($sceneDir);

			$files = scandir($sceneDir);
			$scenes = [];
			foreach ($files as $f) {
				if (strpos($f, '.json') !== false) {
					$scenes[] = $f;
				}
			}
			sendResponse(true, $scenes);
			break;

		case 'load_scene':
			$filename = $_POST['filename'] ?? '';
			$path = $root . '/scenes/' . basename($filename);

			if (file_exists($path) && isSafePath($path, $root . '/scenes')) {
				$content = file_get_contents($path);
				sendResponse(true, json_decode($content));
			} else {
				sendResponse(false, null, 'Scene file not found.');
			}
			break;

		case 'save_scene':
			$filename = $_POST['filename'] ?? 'scene.json';
			if (strpos($filename, '.json') === false) $filename .= '.json';

			$json = $_POST['data'] ?? '{}';
			$path = $root . '/scenes/' . basename($filename);

			if (file_put_contents($path, $json)) {
				sendResponse(true, null, 'Scene saved successfully.');
			} else {
				sendResponse(false, null, 'Failed to save scene.');
			}
			break;

		default:
			sendResponse(false, null, 'Invalid action.');
	}
?>
