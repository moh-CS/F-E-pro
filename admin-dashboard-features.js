/* ==========================================
   BREATHSAFE ADMIN DASHBOARD
   INTELLIGENT TABLE CONTROL SYSTEM - FIXED
   Proper initialization with immediate effect
   ========================================== */

console.log('⚡ Initializing Intelligent Dashboard System...');

// ========== CONFIGURATION ==========
const CONFIG = {
    DEFAULT_ZOOM: 100,
    MIN_ZOOM: 60,
    MAX_ZOOM: 140,
    ZOOM_STEP: 20,
    TOAST_DURATION: 3000,
    ANIMATION_DURATION: 300
};

// ========== STATE MANAGEMENT ==========
const TableState = {
    focusMode: false,
    zoomLevel: CONFIG.DEFAULT_ZOOM,
    initialized: false,
    
    init() {
        // Load saved state from localStorage
        const savedZoom = localStorage.getItem('table_zoom_level');
        const savedFocus = localStorage.getItem('table_focus_mode');
        
        if (savedZoom) {
            this.zoomLevel = parseInt(savedZoom);
        } else {
            this.zoomLevel = CONFIG.DEFAULT_ZOOM;
        }
        
        if (savedFocus === 'true') {
            this.focusMode = true;
        } else {
            this.focusMode = false;
        }
        
        this.initialized = true;
        console.log(`✅ TableState initialized: Zoom=${this.zoomLevel}%, Focus=${this.focusMode}`);
    },
    
    saveState() {
        localStorage.setItem('table_zoom_level', this.zoomLevel);
        localStorage.setItem('table_focus_mode', this.focusMode);
    },
    
    reset() {
        this.focusMode = false;
        this.zoomLevel = CONFIG.DEFAULT_ZOOM;
        this.saveState();
    }
};

// ========== APPLY ZOOM IMMEDIATELY ==========
function applyZoomImmediately() {
    const zoom = TableState.zoomLevel;
    
    // Remove all zoom classes
    document.body.classList.remove(
        'table-zoom-60', 
        'table-zoom-80', 
        'table-zoom-100', 
        'table-zoom-120', 
        'table-zoom-140'
    );
    
    // Add current zoom class
    document.body.classList.add(`table-zoom-${zoom}`);
    console.log(`✅ Applied zoom: ${zoom}%`);
}

// ========== APPLY FOCUS MODE IMMEDIATELY ==========
function applyFocusModeImmediately() {
    if (TableState.focusMode) {
        document.body.classList.add('table-focus');
        console.log(`✅ Applied focus mode`);
    } else {
        document.body.classList.remove('table-focus');
        console.log(`✅ Removed focus mode`);
    }
}

// ========== UPDATE UI BUTTONS ==========
function updateUIState() {
    const focusBtn = document.getElementById('toggleTableFocus');
    const zoomInBtn = document.getElementById('zoomInTable');
    const zoomOutBtn = document.getElementById('zoomOutTable');
    
    // Update focus button
    if (focusBtn) {
        const icon = focusBtn.querySelector('i');
        if (icon) {
            if (TableState.focusMode) {
                focusBtn.classList.add('active-toggle');
                icon.className = 'fas fa-compress';
                focusBtn.title = 'Exit Focus Mode (F)';
            } else {
                focusBtn.classList.remove('active-toggle');
                icon.className = 'fas fa-expand';
                focusBtn.title = 'Enable Focus Mode (F)';
            }
        }
    }
    
    // Update zoom buttons
    updateZoomButtons();
}

// ========== VISUAL NOTIFICATION SYSTEM ==========
class NotificationSystem {
    static show(message, type = 'info', icon = null) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        const icons = {
            success: 'fa-check-circle',
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle',
            error: 'fa-times-circle',
            focus: 'fa-crosshairs',
            zoom: 'fa-search',
            reset: 'fa-undo'
        };
        
        const iconClass = icon || icons[type] || icons.info;
        const html = `
            <div class="toast-content">
                <i class="fas ${iconClass}"></i>
                <span>${message}</span>
            </div>
        `;
        
        toast.innerHTML = html;
        toast.className = `toast ${type}`;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.classList.remove('show', 'fade-out');
                toast.innerHTML = '';
            }, 300);
        }, CONFIG.TOAST_DURATION);
    }
}

// ========== VISUAL STATUS INDICATOR ==========
class StatusIndicator {
    static update() {
        let indicator = document.getElementById('tableStatusIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'tableStatusIndicator';
            indicator.className = 'table-status-indicator';
            document.body.appendChild(indicator);
        }
        
        const focusText = TableState.focusMode ? 'Focus Active' : 'Normal View';
        const zoomText = `${TableState.zoomLevel}%`;
        
        indicator.innerHTML = `
            <div class="status-item ${TableState.focusMode ? 'active' : ''}">
                <i class="fas fa-${TableState.focusMode ? 'crosshairs' : 'th'}"></i>
                <span>${focusText}</span>
            </div>
            <div class="status-item ${TableState.zoomLevel !== 100 ? 'active' : ''}">
                <i class="fas fa-search"></i>
                <span>${zoomText}</span>
            </div>
        `;
        
        indicator.classList.add('show');
        clearTimeout(indicator.hideTimeout);
        indicator.hideTimeout = setTimeout(() => {
            indicator.classList.remove('show');
        }, 4000);
    }
}

// ========== TABLE FOCUS MODE ==========
function toggleTableFocus() {
    const btn = document.getElementById('toggleTableFocus');
    if (!btn) return;
    
    TableState.focusMode = !TableState.focusMode;
    TableState.saveState();
    
    applyFocusModeImmediately();
    updateUIState();
    StatusIndicator.update();
    animateButton(btn);
    
    if (TableState.focusMode) {
        NotificationSystem.show(
            'Table Focus Activated',
            'success',
            'fa-crosshairs'
        );
    } else {
        NotificationSystem.show(
            'Table Focus Deactivated',
            'info',
            'fa-th'
        );
    }
    
    console.log(`✅ Focus Mode: ${TableState.focusMode ? 'ON' : 'OFF'}`);
}

// ========== ZOOM CONTROLS ==========
function zoomInTable() {
    const btn = document.getElementById('zoomInTable');
    if (!btn) return;
    
    if (TableState.zoomLevel >= CONFIG.MAX_ZOOM) {
        NotificationSystem.show('Maximum zoom reached (140%)', 'warning');
        shakeButton(btn);
        return;
    }
    
    TableState.zoomLevel += CONFIG.ZOOM_STEP;
    TableState.saveState();
    applyZoomImmediately();
    updateUIState();
    StatusIndicator.update();
    animateButton(btn);
    
    NotificationSystem.show(
        `Zoom: ${TableState.zoomLevel}%`,
        'success',
        'fa-search-plus'
    );
    
    console.log(`✅ Zoom In: ${TableState.zoomLevel}%`);
}

function zoomOutTable() {
    const btn = document.getElementById('zoomOutTable');
    if (!btn) return;
    
    if (TableState.zoomLevel <= CONFIG.MIN_ZOOM) {
        NotificationSystem.show('Minimum zoom reached (60%)', 'warning');
        shakeButton(btn);
        return;
    }
    
    TableState.zoomLevel -= CONFIG.ZOOM_STEP;
    TableState.saveState();
    applyZoomImmediately();
    updateUIState();
    StatusIndicator.update();
    animateButton(btn);
    
    NotificationSystem.show(
        `Zoom: ${TableState.zoomLevel}%`,
        'success',
        'fa-search-minus'
    );
    
    console.log(`✅ Zoom Out: ${TableState.zoomLevel}%`);
}

function resetZoom() {
    TableState.zoomLevel = CONFIG.DEFAULT_ZOOM;
    TableState.saveState();
    applyZoomImmediately();
    updateUIState();
    StatusIndicator.update();
    
    NotificationSystem.show('Zoom reset to 100%', 'info', 'fa-undo');
    console.log('✅ Zoom Reset: 100%');
}

// ========== UPDATE BUTTON STATES ==========
function updateZoomButtons() {
    const zoomInBtn = document.getElementById('zoomInTable');
    const zoomOutBtn = document.getElementById('zoomOutTable');
    
    if (!zoomInBtn || !zoomOutBtn) return;
    
    // Reset states
    zoomInBtn.classList.remove('disabled-btn', 'active-toggle');
    zoomOutBtn.classList.remove('disabled-btn', 'active-toggle');
    
    // Update zoom in button
    if (TableState.zoomLevel >= CONFIG.MAX_ZOOM) {
        zoomInBtn.classList.add('disabled-btn');
        zoomInBtn.disabled = true;
        zoomInBtn.title = 'Maximum Zoom (140%)';
    } else {
        zoomInBtn.disabled = false;
        zoomInBtn.title = `Zoom In (+) - ${TableState.zoomLevel}%`;
    }
    
    // Update zoom out button
    if (TableState.zoomLevel <= CONFIG.MIN_ZOOM) {
        zoomOutBtn.classList.add('disabled-btn');
        zoomOutBtn.disabled = true;
        zoomOutBtn.title = 'Minimum Zoom (60%)';
    } else {
        zoomOutBtn.disabled = false;
        zoomOutBtn.title = `Zoom Out (-) - ${TableState.zoomLevel}%`;
    }
    
    // Highlight active zoom state
    if (TableState.zoomLevel > CONFIG.DEFAULT_ZOOM) {
        zoomInBtn.classList.add('active-toggle');
    } else if (TableState.zoomLevel < CONFIG.DEFAULT_ZOOM) {
        zoomOutBtn.classList.add('active-toggle');
    }
}

// ========== ANIMATIONS ==========
function animateButton(btn) {
    if (!btn) return;
    btn.classList.add('button-pressed');
    setTimeout(() => btn.classList.remove('button-pressed'), 200);
}

function shakeButton(btn) {
    if (!btn) return;
    btn.classList.add('button-shake');
    setTimeout(() => btn.classList.remove('button-shake'), 500);
}

// ========== KEYBOARD SHORTCUTS ==========
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
            return;
        }
        
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleTableFocus();
        } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoomInTable();
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            zoomOutTable();
        } else if (e.key === '0') {
            e.preventDefault();
            resetZoom();
        } else if (e.key === 'Escape' && TableState.focusMode) {
            e.preventDefault();
            toggleTableFocus();
        } else if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            showShortcutsHelp();
        }
    });
}

function showShortcutsHelp() {
    NotificationSystem.show(
        'Shortcuts: F=Focus | +=Zoom In | -=Zoom Out | 0=Reset | Esc=Exit | H=Help',
        'info',
        'fa-keyboard'
    );
}

// ========== SETUP EVENT LISTENERS ==========
function setupTableControlListeners() {
    const focusBtn = document.getElementById('toggleTableFocus');
    const zoomInBtn = document.getElementById('zoomInTable');
    const zoomOutBtn = document.getElementById('zoomOutTable');
    
    if (focusBtn) {
        focusBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTableFocus();
        });
        console.log('✅ Focus button listener attached');
    } else {
        console.warn('⚠️ Focus button not found');
    }
    
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zoomInTable();
        });
        console.log('✅ Zoom In button listener attached');
    } else {
        console.warn('⚠️ Zoom In button not found');
    }
    
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            zoomOutTable();
        });
        console.log('✅ Zoom Out button listener attached');
    } else {
        console.warn('⚠️ Zoom Out button not found');
    }
}

// ========== MAIN INITIALIZATION ==========
function initTableControls() {
    console.log('⚡ Initializing Table Controls...');
    
    // Initialize state FIRST
    TableState.init();
    
    // Setup event listeners BEFORE applying state
    setupTableControlListeners();
    
    // NOW apply saved state to DOM IMMEDIATELY
    applyZoomImmediately();
    applyFocusModeImmediately();
    updateUIState();  // ✅ CRITICAL: Update button states after applying classes
    
    // Initialize keyboard shortcuts
    initKeyboardShortcuts();
    
    // Show ready message
    setTimeout(() => {
        NotificationSystem.show(
            'Dashboard Ready - Press H for shortcuts',
            'success',
            'fa-rocket'
        );
        console.log('✅ Table Controls Ready');
        console.log(`📍 Current State - Zoom: ${TableState.zoomLevel}%, Focus: ${TableState.focusMode}`);
    }, 500);
}

// ========== WAIT FOR DOM & INITIALIZE ==========
function waitForDOMAndInit() {
    // Only initialize once
    if (TableState.initialized) {
        console.log('⚠️ Table controls already initialized');
        return;
    }
    
    // Wait for critical elements to be available
    const maxWait = 50; // 5 seconds
    let attempts = 0;
    
    const checkElements = setInterval(() => {
        const focusBtn = document.getElementById('toggleTableFocus');
        const zoomInBtn = document.getElementById('zoomInTable');
        const zoomOutBtn = document.getElementById('zoomOutTable');
        
        // ✅ IMPROVED: Check if ANY button exists (not all required)
        if (focusBtn || zoomInBtn || zoomOutBtn) {
            clearInterval(checkElements);
            console.log('✅ Table control buttons found, initializing...');
            initTableControls();
        } else if (attempts >= maxWait) {
            clearInterval(checkElements);
            console.warn('⚠️ Some table control buttons not found, initializing anyway...');
            initTableControls();
        }
        attempts++;
    }, 100);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForDOMAndInit);
} else {
    // DOM already loaded
    waitForDOMAndInit();
}

// ========== EXPORT FUNCTIONS ==========
window.toggleTableFocus = toggleTableFocus;
window.zoomInTable = zoomInTable;
window.zoomOutTable = zoomOutTable;
window.resetZoom = resetZoom;
window.TableState = TableState;

console.log('✅ Intelligent Dashboard System Loaded');