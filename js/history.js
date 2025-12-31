/**
 * js/history.js
 * Manages undo/redo states using snapshots of the scene data.
 */

window.History = {
    undoStack: [],
    redoStack: [],
    maxStates: 50,
    
    /**
     * Saves the current state to the undo stack.
     * Called before any mutation.
     */
    saveState: function () {
        if (!window.Editor || !window.Editor.data) return;
        
        // Mark scene as modified (dirty)
        window.Editor.isDirty = true;
        window.Editor.updateTitle();
        
        // Deep clone the current data
        const state = JSON.stringify(window.Editor.data);
        
        // Only push if the state is different from the last one
        if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === state) {
            return;
        }
        
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxStates) {
            this.undoStack.shift();
        }
        
        // Clear redo stack whenever a new action is performed
        this.redoStack = [];
        this.updateButtons();
    },
    
    undo: function () {
        if (this.undoStack.length === 0) return;
        
        // Save current state to redo stack before moving back
        this.redoStack.push(JSON.stringify(window.Editor.data));
        
        const state = JSON.parse(this.undoStack.pop());
        this.applyState(state);
    },
    
    redo: function () {
        if (this.redoStack.length === 0) return;
        
        // Save current state to undo stack before moving forward
        this.undoStack.push(JSON.stringify(window.Editor.data));
        
        const state = JSON.parse(this.redoStack.pop());
        this.applyState(state);
    },
    
    applyState: function (state) {
        window.Editor.data = state;
        
        // Refresh UI components
        window.Editor.render();
        window.Treeview.render();
        window.PropertiesPanel.update();
        this.updateButtons();
    },
    
    updateButtons: function () {
        const btnUndo = document.getElementById('btn-undo');
        const btnRedo = document.getElementById('btn-redo');
        if (btnUndo) btnUndo.disabled = this.undoStack.length === 0;
        if (btnRedo) btnRedo.disabled = this.redoStack.length === 0;
    }
};

// Keyboard shortcuts for Undo/Redo
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
            e.preventDefault();
            window.History.undo();
        } else if (e.key === 'y' || (e.shiftKey && e.key === 'Z')) {
            e.preventDefault();
            window.History.redo();
        }
    }
});
