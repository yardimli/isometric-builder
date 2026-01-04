/**
 * js/sprite_animator.js
 * Handles sprite animation logic, including the new sequencer functionality.
 */

window.SpriteAnimator = {
	spriteData: {}, // Cache for sprite frame lists
	// Runtime state for animations: { objId: { timer, sequenceIndex, stepFrameIndex, accX, accY, pauseTimer, lastAnim, lastFrameIndex } }
	states: {},
	
	init: function () {
		this.states = {};
	},
	
	/**
	 * Loads sprite details from the server if not already cached.
	 * @param {string} spriteName
	 * @returns {Promise}
	 */
	loadSpriteData: function (spriteName) {
		return new Promise((resolve) => {
			if (this.spriteData[spriteName]) return resolve();
			
			const formData = new FormData();
			formData.append('action', 'get_sprite_details');
			formData.append('name', spriteName);
			
			fetch('php/file_manager.php', { method: 'POST', body: formData })
				.then(r => r.json())
				.then(res => {
					if (res.success) {
						this.spriteData[spriteName] = res.data;
						const imgPromises = [];
						// Preload images
						for (const anim in res.data) {
							const frames = res.data[anim];
							frames.forEach(frame => {
								const path = `assets/sprite-animation/${spriteName}/${anim}/${frame}`;
								if (window.Editor && window.Editor.loadImage) {
									imgPromises.push(window.Editor.loadImage(path, path));
								}
							});
						}
						Promise.all(imgPromises).then(resolve);
					} else {
						resolve();
					}
				})
				.catch(() => resolve());
		});
	},
	
	/**
	 * Updates animation state based on delta time.
	 * Handles sequencing logic (accumulating offsets, switching sequence steps, pauses).
	 * @param {number} dt - Delta time in seconds
	 * @param {Array} objects - List of scene objects
	 */
	update: function (dt, objects) {
		objects.forEach(obj => {
			if (obj.type !== 'sprite-anim') return;
			
			// Initialize state if missing
			if (!this.states[obj.id]) {
				this.states[obj.id] = {
					timer: 0,
					sequenceIndex: 0,
					stepFrameIndex: 0,
					accX: 0, // Accumulated X from previous steps
					accY: 0, // Accumulated Y from previous steps
					pauseTimer: 0,
					lastAnim: null, // Track last valid animation to draw during pause
					lastFrameIndex: 0
				};
			}
			
			const state = this.states[obj.id];
			const data = this.spriteData[obj.spriteName];
			if (!data) return;
			
			// If sequence is empty, do nothing
			if (!obj.sequence || obj.sequence.length === 0) return;
			
			// Ensure index is valid
			if (state.sequenceIndex >= obj.sequence.length) {
				state.sequenceIndex = 0;
				state.accX = 0;
				state.accY = 0;
				state.pauseTimer = 0;
			}
			
			const seqItem = obj.sequence[state.sequenceIndex];
			const type = seqItem.type || 'anim'; // Default to 'anim' for backward compatibility
			
			// --- PAUSE LOGIC ---
			if (type === 'pause') {
				state.pauseTimer += dt;
				const duration = seqItem.duration || 1.0;
				
				if (state.pauseTimer >= duration) {
					// Pause finished, move to next step
					state.pauseTimer = 0;
					state.sequenceIndex++;
					state.stepFrameIndex = 0;
					
					// Loop Sequence
					if (state.sequenceIndex >= obj.sequence.length) {
						state.sequenceIndex = 0;
						state.accX = 0;
						state.accY = 0;
					}
				}
				return; // Don't process animation logic while paused
			}
			
			// --- ANIMATION LOGIC ---
			const currentAnimName = seqItem.anim;
			const stepLimit = parseInt(seqItem.limit) || 0; // 0 = infinite loop for this step
			
			// Update last valid animation (for drawing during pauses later)
			state.lastAnim = currentAnimName;
			state.lastFrameIndex = state.stepFrameIndex;
			
			// Get settings for the active animation
			const settings = (obj.animSettings && obj.animSettings[currentAnimName])
				? obj.animSettings[currentAnimName]
				: { fps: 10, stepX: 0, stepY: 0 };
			
			const fps = settings.fps || 10;
			
			// Update Timer
			state.timer += dt;
			if (state.timer >= (1 / fps)) {
				state.timer = 0;
				state.stepFrameIndex++;
				
				// Logic for Sequencer Transition
				// Only transition if a limit is set. If 0, it loops infinitely on this step.
				if (stepLimit > 0) {
					if (state.stepFrameIndex >= stepLimit) {
						// Step Finished: Accumulate offsets
						state.accX += (settings.stepX || 0) * state.stepFrameIndex;
						state.accY += (settings.stepY || 0) * state.stepFrameIndex;
						
						// Move to next step
						state.sequenceIndex++;
						state.stepFrameIndex = 0;
						
						// Loop Sequence
						if (state.sequenceIndex >= obj.sequence.length) {
							state.sequenceIndex = 0;
							state.accX = 0;
							state.accY = 0;
						}
					}
				}
			}
		});
	},
	
	/**
	 * Renders the sprite to the canvas.
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {Object} obj
	 */
	draw: function (ctx, obj) {
		const data = this.spriteData[obj.spriteName];
		// Fallback if data isn't loaded yet
		if (!data) {
			this.loadSpriteData(obj.spriteName);
			return;
		}
		
		if (!obj.sequence || obj.sequence.length === 0) return;
		
		const state = this.states[obj.id] || { sequenceIndex: 0, stepFrameIndex: 0, accX: 0, accY: 0 };
		
		// Safety check for index
		if (state.sequenceIndex >= obj.sequence.length) state.sequenceIndex = 0;
		
		const seqItem = obj.sequence[state.sequenceIndex];
		const type = seqItem.type || 'anim';
		
		let animName = '';
		let frameIdx = 0;
		let currentStepOffsetX = 0;
		let currentStepOffsetY = 0;
		
		if (type === 'pause') {
			// If paused, draw the last valid animation frame
			if (state.lastAnim && data[state.lastAnim]) {
				animName = state.lastAnim;
				const frames = data[animName];
				frameIdx = (state.lastFrameIndex || 0) % frames.length;
				// Note: During pause, we don't add additional step offsets, just the accumulated ones
			} else {
				// If pause is the very first step, try to draw the first frame of the next anim or just return
				return;
			}
		} else {
			// Normal Animation
			animName = seqItem.anim;
			if (!data[animName]) return;
			
			const frames = data[animName];
			frameIdx = state.stepFrameIndex % frames.length;
			
			// Calculate Step Offsets
			const settings = (obj.animSettings && obj.animSettings[animName])
				? obj.animSettings[animName]
				: { stepX: 0, stepY: 0 };
			
			currentStepOffsetX = (settings.stepX || 0) * state.stepFrameIndex;
			currentStepOffsetY = (settings.stepY || 0) * state.stepFrameIndex;
		}
		
		const frameFile = data[animName][frameIdx];
		const path = `assets/sprite-animation/${obj.spriteName}/${animName}/${frameFile}`;
		const img = window.Editor.images[path];
		
		// Calculate Final Position
		const drawX = obj.x + state.accX + currentStepOffsetX;
		const drawY = obj.y + state.accY + currentStepOffsetY;
		
		if (img) {
			ctx.drawImage(img, drawX, drawY, obj.width, obj.height);
		} else {
			// Trigger load if missing
			window.Editor.loadImage(path, path);
		}
	},
	
	/**
	 * Resets the state of a specific object (e.g. when properties change).
	 */
	resetState: function (id) {
		if (this.states[id]) {
			this.states[id] = {
				timer: 0,
				sequenceIndex: 0,
				stepFrameIndex: 0,
				accX: 0,
				accY: 0,
				pauseTimer: 0,
				lastAnim: null,
				lastFrameIndex: 0
			};
		}
	}
};
