/**
 * js/assets.js
 */

class AssetBrowser {
	constructor () {
		this.currentPath = 'assets';
		this.grid = document.getElementById('asset-grid');
		this.pathLabel = document.getElementById('asset-current-path');
		this.btnUp = document.getElementById('btn-asset-up');

		this.btnUp.onclick = () => this.goUp();
		this.scan(this.currentPath);
	}

	scan (path) {
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
					// Use Editor custom alert
					window.Editor.alert(res.message);
				}
			})
			.catch(err => console.error(err));
	}

	render (data) {
		this.currentPath = data.currentPath;
		this.pathLabel.innerText = this.currentPath + '/';
		this.grid.innerHTML = '';

		if (data.parent) {
			this.btnUp.disabled = false;
			this.btnUp.dataset.parent = data.parent;
		} else {
			this.btnUp.disabled = true;
		}

		data.folders.forEach(folder => {
			const el = document.createElement('div');
			el.className = 'asset-item';
			el.innerHTML = `<div class="icon">📁</div><span>${folder}</span>`;
			el.onclick = () => this.scan(this.currentPath + '/' + folder);
			this.grid.appendChild(el);
		});

		data.files.forEach(file => {
			const el = document.createElement('div');
			el.className = 'asset-item';
			const fullSrc = this.currentPath + '/' + file;
			el.innerHTML = `<img src="${fullSrc}" alt="${file}"><span>${file}</span>`;

			el.onclick = () => {
				// Fixed: Call Editor function directly
				if (window.Editor && window.Editor.addAssetToScene) {
					window.Editor.addAssetToScene(fullSrc);
				}
			};
			this.grid.appendChild(el);
		});
	}

	goUp () {
		const parent = this.btnUp.dataset.parent;
		if (parent) this.scan(parent);
	}
}

const assetBrowser = new AssetBrowser();