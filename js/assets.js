class AssetBrowser {
	constructor() {
		this.currentPath = 'assets';
		this.grid = document.getElementById('asset-grid');
		this.pathLabel = document.getElementById('asset-current-path');
		this.btnUp = document.getElementById('btn-asset-up');
		
		this.btnUp.onclick = () => this.goUp();
		
		// Initial Load
		this.scan(this.currentPath);
	}
	
	scan(path) {
		const formData = new FormData();
		formData.append('action', 'scan_assets');
		formData.append('path', path);
		
		fetch('php/file_manager.php', {
			method: 'POST',
			body: formData
		})
			.then(res => res.json())
			.then(res => {
				if (res.success) {
					this.render(res.data);
				} else {
					alert(res.message);
				}
			})
			.catch(err => console.error(err));
	}
	
	render(data) {
		this.currentPath = data.currentPath;
		this.pathLabel.innerText = this.currentPath + '/';
		this.grid.innerHTML = '';
		
		// Handle Parent Link
		if (data.parent) {
			this.btnUp.disabled = false;
			this.btnUp.dataset.parent = data.parent;
		} else {
			this.btnUp.disabled = true;
		}
		
		// Render Folders
		data.folders.forEach(folder => {
			const el = document.createElement('div');
			el.className = 'asset-item';
			el.innerHTML = `<div class="icon">📁</div><span>${folder}</span>`;
			el.onclick = () => this.scan(this.currentPath + '/' + folder);
			this.grid.appendChild(el);
		});
		
		// Render Files
		data.files.forEach(file => {
			const el = document.createElement('div');
			el.className = 'asset-item';
			// Show preview
			const fullSrc = this.currentPath + '/' + file;
			el.innerHTML = `<img src="${fullSrc}"><span>${file}</span>`;
			
			el.onclick = () => {
				// Copy path to clipboard or just alert for now
				// In a real app, this would return the value to the active input field
				alert(`Selected: ${fullSrc}`);
				console.log('Selected Asset:', fullSrc);
			};
			this.grid.appendChild(el);
		});
	}
	
	goUp() {
		const parent = this.btnUp.dataset.parent;
		if (parent) this.scan(parent);
	}
}

// Initialize when modal opens (handled in editor.js or here)
const assetBrowser = new AssetBrowser();
