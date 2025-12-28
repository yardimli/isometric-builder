/**
 * scene_manager.js
 * Handles File I/O, Scene Loading/Saving, and the File Browser UI.
 */

const SceneManager = {
	currentScenePath: null,
	browserMode: 'open', // 'open' or 'save'
	browserPath: '',
	
	init: function () {
		// Setup File Modal Listeners
		document.getElementById('btn-open-modal').onclick = () => this.openFileBrowser('open');
		document.getElementById('btn-save').onclick = () => this.saveScene(null);
		document.getElementById('btn-save-as').onclick = () => this.openFileBrowser('save');
		
		// Browser Actions
		document.getElementById('btn-create-folder').onclick = () => this.createFolder();
		document.getElementById('btn-browser-confirm').onclick = () => {
			const name = document.getElementById('inp-browser-filename').value;
			if (name) {
				const fullPath = this.browserPath ? (this.browserPath + '/' + name) : name;
				this.saveScene(fullPath, false); // false = check overwrite
			}
		};
		
		// Browser Navigation
		document.getElementById('btn-browser-up').onclick = () => {
			// Logic handled in renderBrowserList via data attributes,
			// but we can also track state here if needed.
			// The render function assigns the onclick, so this is just a placeholder or fallback.
		};
		
		// Initial Load
		this.loadScene('forest_level_1.json');
	},
	
	// --- AJAX Operations ---
	
	loadScene: function (filename) {
		const formData = new FormData();
		formData.append('action', 'load_scene');
		formData.append('filename', filename);
		
		fetch('php/file_manager.php', { method: 'POST', body: formData })
			.then(r => r.json())
			.then(res => {
				if (res.success) {
					this.currentScenePath = filename;
					document.getElementById('scene-name').innerText = res.data.meta.sceneName;
					
					// Pass data to the Editor
					if (window.Editor) {
						window.Editor.loadSceneData(res.data);
					}
				} else {
					alert('Error loading scene: ' + res.message);
					// If failed and no data exists, create empty
					if (window.Editor && !window.Editor.data) {
						this.createEmptyScene();
					}
				}
			});
	},
	
	saveScene: function (filename, overwrite = false) {
		const data = window.Editor ? window.Editor.data : null;
		if (!data) return;
		
		// If no filename provided, use current. If no current, trigger Save As
		if (!filename) {
			if (this.currentScenePath) {
				filename = this.currentScenePath;
			} else {
				this.openFileBrowser('save');
				return;
			}
		}
		
		// Update internal name in the data object
		const baseName = filename.split('/').pop().replace('.json', '');
		data.meta.sceneName = baseName;
		
		const performSave = () => {
			const formData = new FormData();
			formData.append('action', 'save_scene');
			formData.append('filename', filename);
			formData.append('data', JSON.stringify(data, null, 2));
			
			fetch('php/file_manager.php', { method: 'POST', body: formData })
				.then(r => r.json())
				.then(res => {
					alert(res.message);
					if (res.success) {
						this.currentScenePath = filename;
						document.getElementById('scene-name').innerText = data.meta.sceneName;
						document.getElementById('modal-file-browser').style.display = 'none';
					}
				});
		};
		
		if (overwrite) {
			performSave();
		} else {
			// Check existence first
			const checkData = new FormData();
			checkData.append('action', 'check_file_exists');
			checkData.append('filename', filename);
			fetch('php/file_manager.php', { method: 'POST', body: checkData })
				.then(r => r.json())
				.then(res => {
					if (res.success && res.data === true) {
						if (confirm(`File "${filename}" already exists. Overwrite?`)) {
							performSave();
						}
					} else {
						performSave();
					}
				});
		}
	},
	
	createEmptyScene: function () {
		const emptyData = {
			meta: {
				version: '1.0',
				sceneName: 'New Scene',
				width: 800,
				height: 600,
				backgroundColor: '#333',
				grid: { enabled: true, size: 32, snap: true }
			},
			library: { sprites: {} },
			objects: []
		};
		this.currentScenePath = null;
		document.getElementById('scene-name').innerText = 'Unsaved';
		
		if (window.Editor) {
			window.Editor.loadSceneData(emptyData);
		}
	},
	
	// --- File Browser Logic ---
	
	openFileBrowser: function (mode) {
		this.browserMode = mode;
		const modal = document.getElementById('modal-file-browser');
		const title = document.getElementById('browser-title');
		const saveArea = document.getElementById('save-input-area');
		
		modal.style.display = 'block';
		this.browserPath = ''; // Start at root
		
		if (mode === 'save') {
			title.innerText = 'Save Scene As...';
			saveArea.style.display = 'block';
			// Pre-fill filename if exists
			const currentName = this.currentScenePath ? this.currentScenePath.split('/').pop().replace('.json', '') : '';
			document.getElementById('inp-browser-filename').value = currentName;
		} else {
			title.innerText = 'Open Scene';
			saveArea.style.display = 'none';
		}
		
		this.refreshBrowserList();
	},
	
	refreshBrowserList: function () {
		const formData = new FormData();
		formData.append('action', 'list_scenes');
		formData.append('path', this.browserPath);
		
		fetch('php/file_manager.php', { method: 'POST', body: formData })
			.then(r => r.json())
			.then(res => {
				if (res.success) {
					this.renderBrowserList(res.data);
				}
			});
	},
	
	renderBrowserList: function (data) {
		const list = document.getElementById('browser-list');
		const pathLabel = document.getElementById('browser-current-path');
		const btnUp = document.getElementById('btn-browser-up');
		
		list.innerHTML = '';
		this.browserPath = data.currentPath;
		pathLabel.innerText = (this.browserPath || 'Root') + '/';
		
		// Up Button
		if (typeof data.parent === 'string') {
			btnUp.disabled = false;
			btnUp.onclick = () => {
				this.browserPath = data.parent;
				this.refreshBrowserList();
			};
		} else {
			btnUp.disabled = true;
		}
		
		// Folders
		data.folders.forEach(folder => {
			const li = document.createElement('li');
			li.innerHTML = `<span class="icon">📁</span> ${folder}`;
			li.onclick = () => {
				this.browserPath = this.browserPath ? (this.browserPath + '/' + folder) : folder;
				this.refreshBrowserList();
			};
			list.appendChild(li);
		});
		
		// Files
		data.files.forEach(file => {
			const li = document.createElement('li');
			li.innerHTML = `<span class="icon">📄</span> ${file}`;
			li.onclick = () => {
				if (this.browserMode === 'open') {
					const fullPath = this.browserPath ? (this.browserPath + '/' + file) : file;
					this.loadScene(fullPath);
					document.getElementById('modal-file-browser').style.display = 'none';
				} else {
					// In save mode, clicking a file populates the input
					document.getElementById('inp-browser-filename').value = file.replace('.json', '');
				}
			};
			list.appendChild(li);
		});
	},
	
	createFolder: function () {
		const name = prompt('Enter folder name:');
		if (name) {
			const formData = new FormData();
			formData.append('action', 'create_folder');
			formData.append('path', this.browserPath);
			formData.append('name', name);
			fetch('php/file_manager.php', { method: 'POST', body: formData })
				.then(r => r.json())
				.then(res => {
					if (res.success) this.refreshBrowserList();
					else alert(res.message);
				});
		}
	}
};

document.addEventListener('DOMContentLoaded', () => {
	SceneManager.init();
});
