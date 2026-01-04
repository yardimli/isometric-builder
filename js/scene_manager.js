/**
 * js/scene_manager.js
 */

const SceneManager = {
	currentScenePath: null,
	browserMode: 'open',
	browserPath: '',
	
	init: function () {
		document.getElementById('btn-open-modal').onclick = () => this.openFileBrowser('open');
		// Primary Save button: bypass overwrite check, silent mode enabled
		document.getElementById('btn-save').onclick = () => this.saveScene(null, true, true);
		document.getElementById('btn-save-as').onclick = () => this.openFileBrowser('save');
		
		// New Scene Button
		document.getElementById('btn-new-scene').onclick = async () => {
			if (window.Editor && window.Editor.isDirty) {
				const confirm = await window.Editor.confirm("Unsaved changes will be lost. Create new scene?");
				if (!confirm) return;
			}
			this.createEmptyScene();
		};
		
		document.getElementById('btn-create-folder').onclick = () => this.createFolder();
		document.getElementById('btn-browser-confirm').onclick = () => {
			const name = document.getElementById('inp-browser-filename').value;
			if (name) {
				const fullPath = this.browserPath ? (this.browserPath + '/' + name) : name;
				this.saveScene(fullPath, false, false); // Save As: check overwrite, not silent
			}
		};
		
		this.loadScene('forest_level_1.json');
	},
	
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
					if (window.Editor) {
						window.Editor.loadSceneData(res.data);
					}
				} else {
					window.Editor.alert('Error loading scene: ' + res.message);
					if (window.Editor && !window.Editor.data) {
						this.createEmptyScene();
					}
				}
			});
	},
	
	saveScene: async function (filename, overwrite = false, silent = false) {
		const data = window.Editor ? window.Editor.data : null;
		if (!data) return;
		
		if (!filename) {
			if (this.currentScenePath) {
				filename = this.currentScenePath;
			} else {
				this.openFileBrowser('save');
				return;
			}
		}
		
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
					if (!silent) {
						window.Editor.alert(res.message);
					}
					if (res.success) {
						this.currentScenePath = filename;
						// Mark as clean (not dirty)
						if (window.Editor) {
							window.Editor.isDirty = false;
							window.Editor.updateTitle();
						}
						document.getElementById('modal-file-browser').style.display = 'none';
					}
				});
		};
		
		if (overwrite) {
			performSave();
		} else {
			const checkData = new FormData();
			checkData.append('action', 'check_file_exists');
			checkData.append('filename', filename);
			fetch('php/file_manager.php', { method: 'POST', body: checkData })
				.then(r => r.json())
				.then(async res => {
					if (res.success && res.data === true) {
						// Use custom confirm
						const confirmed = await window.Editor.confirm(`File "${filename}" already exists. Overwrite?`);
						if (confirmed) {
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
				sceneName: 'Unnamed',
				width: 800,
				height: 600,
				backgroundColor: '#333',
				grid: { enabled: true, size: 32, snap: true }
			},
			library: { sprites: {} },
			objects: []
		};
		this.currentScenePath = null;
		if (window.Editor) {
			window.Editor.loadSceneData(emptyData);
		}
	},
	
	openFileBrowser: function (mode) {
		this.browserMode = mode;
		const modal = document.getElementById('modal-file-browser');
		const title = document.getElementById('browser-title');
		const saveArea = document.getElementById('save-input-area');
		
		modal.style.display = 'block';
		this.browserPath = '';
		
		if (mode === 'save') {
			title.innerText = 'Save Scene As...';
			saveArea.style.display = 'block';
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
		
		if (typeof data.parent === 'string') {
			btnUp.disabled = false;
			btnUp.onclick = () => {
				this.browserPath = data.parent;
				this.refreshBrowserList();
			};
		} else {
			btnUp.disabled = true;
		}
		
		data.folders.forEach(folder => {
			const li = document.createElement('li');
			li.innerHTML = `<span class="icon">📁</span> ${folder}`;
			li.onclick = () => {
				this.browserPath = this.browserPath ? (this.browserPath + '/' + folder) : folder;
				this.refreshBrowserList();
			};
			list.appendChild(li);
		});
		
		data.files.forEach(file => {
			const li = document.createElement('li');
			li.innerHTML = `<span class="icon">📄</span> ${file}`;
			li.onclick = () => {
				if (this.browserMode === 'open') {
					const fullPath = this.browserPath ? (this.browserPath + '/' + file) : file;
					this.loadScene(fullPath);
					document.getElementById('modal-file-browser').style.display = 'none';
				} else {
					document.getElementById('inp-browser-filename').value = file.replace('.json', '');
				}
			};
			list.appendChild(li);
		});
	},
	
	createFolder: async function () {
		// Use custom prompt
		const name = await window.Editor.prompt('Enter folder name:');
		if (name) {
			const formData = new FormData();
			formData.append('action', 'create_folder');
			formData.append('path', this.browserPath);
			formData.append('name', name);
			fetch('php/file_manager.php', { method: 'POST', body: formData })
				.then(r => r.json())
				.then(res => {
					if (res.success) this.refreshBrowserList();
					else window.Editor.alert(res.message);
				});
		}
	}
};

document.addEventListener('DOMContentLoaded', () => {
	SceneManager.init();
});
