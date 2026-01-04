/**
 * js/sprite_browser.js
 * Handles browsing and importing sprite animations.
 */

class SpriteBrowser {
	constructor () {
		this.grid = document.getElementById('sprite-grid')
		this.modal = document.getElementById('modal-sprites')
		this.btnOpen = document.getElementById('btn-sprites-modal')
		
		this.btnOpen.onclick = () => {
			this.modal.style.display = 'block'
			this.scan()
		}
	}
	
	scan () {
		const formData = new FormData()
		formData.append('action', 'scan_sprite_root')
		
		fetch('php/file_manager.php', {
			method: 'POST',
			body: formData
		})
			.then(res => res.json())
			.then(res => {
				if (res.success) {
					this.render(res.data)
				} else {
					window.Editor.alert(res.message)
				}
			})
			.catch(err => console.error(err))
	}
	
	render (folders) {
		this.grid.innerHTML = ''
		
		if (folders.length === 0) {
			this.grid.innerHTML = '<p style="color:#888; width:100%; text-align:center;">No sprite folders found in assets/sprite-animation/</p>'
			return
		}
		
		folders.forEach(folder => {
			const el = document.createElement('div')
			el.className = 'asset-item'
			// Generic icon for sprite character
			el.innerHTML = '<div class="icon" style="font-size:32px;">👾</div><span>' + folder + '</span>'
			
			el.onclick = () => {
				if (window.Editor && window.Editor.addSpriteToScene) {
					window.Editor.addSpriteToScene(folder)
					this.modal.style.display = 'none'
				}
			}
			this.grid.appendChild(el)
		})
	}
}

const spriteBrowser = new SpriteBrowser()
