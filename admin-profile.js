/* ==========================================
   BREATHSAFE ADMIN PROFILE
   Clean JavaScript - Well Organized
   ========================================== */

console.log('🚀 BreathSafe Profile Loading...');

// ========== FIREBASE CONFIGURATION ==========
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA2M-8B77PYDw6fA-fZXLCOoK_M76reSpU",
    authDomain: "gas-leak-detection-8602a.firebaseapp.com",
    projectId: "gas-leak-detection-8602a",
    storageBucket: "gas-leak-detection-8602a.firebasestorage.app",
    messagingSenderId: "965913006308",
    appId: "1:965913006308:web:d70797bc2fa51fb8b01cf1",
    measurementId: "G-465DRCB5JE"
};

// ========== GLOBAL STATE ==========
const STATE = {
    db: null,
    currentAdmin: null,
    originalData: {},
    isEditMode: false
};
// ========== SESSION CHECK ==========

function checkAdminSession() {
    const adminSession = sessionStorage.getItem('breathsafeAdmin');
    
    if (!adminSession) {
        console.warn('No admin session found. Redirecting to login...');
        window.location.href = 'breathsafe-admin-login.html';
        return null;
    }
    
    try {
        return JSON.parse(adminSession);
    } catch (error) {
        console.error('Invalid session data:', error);
        window.location.href = 'breathsafe-admin-login.html';
        return null;
    }
}

// ========== UTILITY FUNCTIONS ==========
const Utils = {
    // Get initials from user object
    getInitials(user) {
        if (user.firstName && user.lastName) {
            return (user.firstName[0] + user.lastName[0]).toUpperCase();
        }
        if (user.username) {
            return user.username.substring(0, 2).toUpperCase();
        }
        return 'AD';
    },

    // Format Firebase timestamp
    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return 'N/A';
        }
    },

    // Show toast notification
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 4000);
    },

    // Clear form field error
    clearError(fieldId) {
        const input = document.getElementById(fieldId);
        const error = document.getElementById(`${fieldId}Error`);
        
        if (input) input.classList.remove('error');
        if (error) {
            error.textContent = '';
            error.style.display = 'none';
        }
    },

    // Show form field error
    showError(fieldId, message) {
        const input = document.getElementById(fieldId);
        const error = document.getElementById(`${fieldId}Error`);
        
        if (input) input.classList.add('error');
        if (error) {
            error.textContent = message;
            error.style.display = 'block';
        }
    },

    // Validate email format
    isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    // Validate phone format
    isValidPhone(phone) {
        return /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/.test(phone);
    }
};

// ========== FIREBASE INITIALIZATION ==========
const Firebase = {
    async init() {
        try {
            const app = firebase.initializeApp(FIREBASE_CONFIG, "firestoreApp");
            STATE.db = firebase.firestore(app);
            console.log('✅ Firestore Connected');
            return true;
        } catch (error) {
            console.error('❌ Firebase Error:', error);
            Utils.showToast('Failed to connect to database', 'error');
            return false;
        }
    }
};

// ========== PROFILE MANAGEMENT ==========
const Profile = {
    // Load admin profile from Firestore
    async load() {
        // Check session first
        const sessionAdmin = checkAdminSession();
        if (!sessionAdmin) return;
        
        const ADMIN_USERNAME = sessionAdmin.username;
        console.log(`📥 Loading profile: ${ADMIN_USERNAME}`);
        
        if (!STATE.db) {
            Utils.showToast('Database not connected', 'error');
            return;
        }
        
        try {
            const snapshot = await STATE.db.collection('admins')
                .where('username', '==', ADMIN_USERNAME)
                .limit(1)
                .get();
            
            if (snapshot.empty) {
                Utils.showToast('Admin account not found', 'error');
                console.error('❌ Admin not found:', ADMIN_USERNAME);
                return;
            }
            
            const doc = snapshot.docs[0];
            STATE.currentAdmin = {
                id: doc.id,
                ...doc.data()
            };
            
            // Update session with fresh data
            const updatedSession = {
                id: STATE.currentAdmin.id,
                username: STATE.currentAdmin.username,
                email: STATE.currentAdmin.email,
                firstName: STATE.currentAdmin.firstName || '',
                lastName: STATE.currentAdmin.lastName || '',
                phoneNumber: STATE.currentAdmin.phoneNumber || '',
                apiToken: STATE.currentAdmin.apiToken,
                role: 'admin',
                loginTime: sessionAdmin.loginTime
            };
            sessionStorage.setItem('breathsafeAdmin', JSON.stringify(updatedSession));
            
            STATE.originalData = { ...STATE.currentAdmin };
            
            console.log('✅ Profile loaded:', STATE.currentAdmin);
            this.display();
            
        } catch (error) {
            console.error('❌ Load error:', error);
            Utils.showToast('Failed to load profile', 'error');
        }
    },

    // Display admin info in UI
    display() {
        if (!STATE.currentAdmin) return;
        
        const initials = Utils.getInitials(STATE.currentAdmin);
        const fullName = [STATE.currentAdmin.firstName, STATE.currentAdmin.lastName]
            .filter(Boolean).join(' ') || STATE.currentAdmin.username || 'Admin User';
        
        // Update all avatars
        const avatars = [
            { avatar: 'headerAvatar', text: 'headerAvatarText' },
            { avatar: 'dropdownAvatar', text: 'dropdownAvatarText' },
            { avatar: 'profileAvatar', text: 'profileInitials' }
        ];
        
        avatars.forEach(({ avatar, text }) => {
            const avatarEl = document.getElementById(avatar);
            const textEl = document.getElementById(text);
            if (avatarEl) avatarEl.className = 'avatar' + (avatar === 'profileAvatar' ? ' avatar--large' : '');
            if (textEl) textEl.textContent = initials;
        });
        
        // Update text elements
        const elements = {
            headerUsername: STATE.currentAdmin.username || 'Admin',
            dropdownUsername: fullName,
            dropdownEmail: STATE.currentAdmin.email || 'No email',
            profileName: fullName,
            profileEmail: STATE.currentAdmin.email || 'No email',
            memberSince: Utils.formatDate(STATE.currentAdmin.createdAt),
            apiTokenPreview: STATE.currentAdmin.apiToken ? 
                STATE.currentAdmin.apiToken.substring(0, 3) + '-***-***' : 
                '***-***-***'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        });
        
        // Fill form fields
        const fields = {
            firstName: STATE.currentAdmin.firstName || '',
            lastName: STATE.currentAdmin.lastName || '',
            username: STATE.currentAdmin.username || '',
            email: STATE.currentAdmin.email || '',
            phoneNumber: STATE.currentAdmin.phoneNumber || ''
        };
        
        Object.entries(fields).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.value = value;
        });
    },

    // Enter edit mode
    enterEditMode() {
        STATE.isEditMode = true;
        
        // Enable inputs
        const fields = ['firstName', 'lastName', 'username', 'email', 'phoneNumber'];
        fields.forEach(field => {
            const input = document.getElementById(field);
            if (input) input.disabled = false;
        });
        
        // Toggle buttons
        document.getElementById('editBtn').style.display = 'none';
        document.getElementById('saveBtn').style.display = 'inline-flex';
        document.getElementById('cancelBtn').style.display = 'inline-flex';
        document.getElementById('editIndicator').style.display = 'flex';
        
        Utils.showToast('Edit mode activated', 'info');
    },

    // Cancel edit mode
    cancelEditMode() {
        STATE.isEditMode = false;
        
        // Disable inputs and restore original values
        const fields = ['firstName', 'lastName', 'username', 'email', 'phoneNumber'];
        fields.forEach(field => {
            const input = document.getElementById(field);
            if (input) {
                input.disabled = true;
                input.value = STATE.originalData[field] || '';
            }
            Utils.clearError(field);
        });
        
        // Toggle buttons
        document.getElementById('editBtn').style.display = 'inline-flex';
        document.getElementById('saveBtn').style.display = 'none';
        document.getElementById('cancelBtn').style.display = 'none';
        document.getElementById('editIndicator').style.display = 'none';
        
        Utils.showToast('Changes cancelled', 'info');
    },

    // Validate form data
    validate(data) {
        const fields = ['firstName', 'lastName', 'username', 'email', 'phoneNumber'];
        fields.forEach(field => Utils.clearError(field));
        
        let hasError = false;
        
        if (!data.firstName) {
            Utils.showError('firstName', 'First name is required');
            hasError = true;
        }
        
        if (!data.lastName) {
            Utils.showError('lastName', 'Last name is required');
            hasError = true;
        }
        
        if (!data.username) {
            Utils.showError('username', 'Username is required');
            hasError = true;
        }
        
        if (!data.email) {
            Utils.showError('email', 'Email is required');
            hasError = true;
        } else if (!Utils.isValidEmail(data.email)) {
            Utils.showError('email', 'Invalid email format');
            hasError = true;
        }
        
        if (data.phoneNumber && !Utils.isValidPhone(data.phoneNumber)) {
            Utils.showError('phoneNumber', 'Invalid phone number format');
            hasError = true;
        }
        
        return !hasError;
    },

    // Check uniqueness in database
    async checkUniqueness(field, value, currentValue) {
        if (value === currentValue) return true; // No change
        
        console.log(`Checking ${field} uniqueness...`);
        
        // Check in admins collection
        const adminQuery = await STATE.db.collection('admins')
            .where(field, '==', value)
            .get();
        
        if (!adminQuery.empty) {
            Utils.showError(field, `${field} already exists`);
            Utils.showToast(`${field} already taken`, 'error');
            return false;
        }
        
        // Check in users collection
        const userQuery = await STATE.db.collection('users')
            .where(field, '==', value)
            .get();
        
        if (!userQuery.empty) {
            Utils.showError(field, `${field} already exists`);
            Utils.showToast(`${field} already taken`, 'error');
            return false;
        }
        
        return true;
    },

async save(formData) {
    if (!this.validate(formData)) {
        Utils.showToast('Please fix the errors', 'error');
        return;
    }
    
    // ... validation code ...
    
    try {
        // ... uniqueness checks ...
        
        // Update database
        await STATE.db.collection('admins').doc(STATE.currentAdmin.id).update({
            firstName: formData.firstName,
            lastName: formData.lastName,
            username: formData.username,
            email: formData.email,
            phoneNumber: formData.phoneNumber || ''
        });
        
        console.log('✅ Profile updated');
        
        // Update local state
        STATE.currentAdmin = {
            ...STATE.currentAdmin,
            ...formData
        };
        STATE.originalData = { ...STATE.currentAdmin };
        
        // ✅ UPDATE SESSION WITH NEW DATA
        const currentSession = JSON.parse(sessionStorage.getItem('breathsafeAdmin') || '{}');
        const updatedSession = {
            ...currentSession,
            username: formData.username,
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phoneNumber: formData.phoneNumber || ''
        };
        sessionStorage.setItem('breathsafeAdmin', JSON.stringify(updatedSession));
        
        // Exit edit mode
        this.cancelEditMode();
        this.display();
        
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
        
        Utils.showToast('✅ Profile updated successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Save error:', error);
        Utils.showToast('Failed to update profile: ' + error.message, 'error');
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
    }
}
};

// ========== MODALS ==========
const Modals = {
    // API Token Modal
    openToken() {
        const token = STATE.currentAdmin?.apiToken || 'No token available';
        document.getElementById('fullApiToken').textContent = token;
        document.getElementById('apiTokenModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    closeToken() {
        document.getElementById('apiTokenModal').classList.remove('active');
        document.body.style.overflow = '';
    },

    // Copy token to clipboard
    copyToken() {
        const token = document.getElementById('fullApiToken').textContent;
        
        if (!token || token === 'No token available') {
            Utils.showToast('No token to copy', 'error');
            return;
        }
        
        navigator.clipboard.writeText(token)
            .then(() => Utils.showToast('✅ Token copied to clipboard!', 'success'))
            .catch(() => Utils.showToast('Failed to copy', 'error'));
    }
};

// ========== UI INTERACTIONS ==========
const UI = {
    // Toggle user menu
    toggleUserMenu() {
        const userMenu = document.getElementById('userMenu');
        if (userMenu) {
            userMenu.classList.toggle('active');
        }
    },

    // Toggle theme
    toggleTheme() {
        document.body.classList.toggle('dark');
        document.body.classList.toggle('light');
        
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
    },

    // Load saved theme
    loadTheme() {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.classList.add(theme);
        
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
};

// ========== EVENT LISTENERS ==========
const Events = {
    init() {
        // User Menu
        const userMenu = document.getElementById('userMenu');
        if (userMenu) {
            userMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                UI.toggleUserMenu();
            });
        }
        
        document.addEventListener('click', () => {
            const menu = document.getElementById('userMenu');
            if (menu) menu.classList.remove('active');
        });
        
        // Theme Toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', UI.toggleTheme);
        }
        
    // Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Are you sure you want to logout?')) {
            // Clear all session data
            sessionStorage.removeItem('breathsafeAdmin');
            sessionStorage.removeItem('breathsafeAdminToken');
            sessionStorage.removeItem('adminPrefillValue');
            sessionStorage.removeItem('adminPrefillType');
            
            console.log('✅ Admin logged out');
            window.location.href = 'breathsafe-admin-login.html';
        }
    });
}
        
        // Profile Form
        const editBtn = document.getElementById('editBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const profileForm = document.getElementById('profileForm');
        
        if (editBtn) editBtn.addEventListener('click', () => Profile.enterEditMode());
        if (cancelBtn) cancelBtn.addEventListener('click', () => Profile.cancelEditMode());
        
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                
                const formData = {
                    firstName: document.getElementById('firstName').value.trim(),
                    lastName: document.getElementById('lastName').value.trim(),
                    username: document.getElementById('username').value.trim(),
                    email: document.getElementById('email').value.trim(),
                    phoneNumber: document.getElementById('phoneNumber').value.trim()
                };
                
                Profile.save(formData);
            });
        }
        
        // Clear errors on input
        const fields = ['firstName', 'lastName', 'username', 'email', 'phoneNumber'];
        fields.forEach(field => {
            const input = document.getElementById(field);
            if (input) {
                input.addEventListener('input', () => Utils.clearError(field));
            }
        });
        
        // API Token Modal
        const viewTokenBtn = document.getElementById('viewTokenBtn');
        const closeApiTokenModal = document.getElementById('closeApiTokenModal');
        const closeApiTokenBtn = document.getElementById('closeApiTokenBtn');
        const apiTokenBackdrop = document.getElementById('apiTokenBackdrop');
        const copyTokenBtn = document.getElementById('copyTokenBtn');
        
        if (viewTokenBtn) viewTokenBtn.addEventListener('click', () => Modals.openToken());
        if (closeApiTokenModal) closeApiTokenModal.addEventListener('click', () => Modals.closeToken());
        if (closeApiTokenBtn) closeApiTokenBtn.addEventListener('click', () => Modals.closeToken());
        if (apiTokenBackdrop) apiTokenBackdrop.addEventListener('click', () => Modals.closeToken());
        if (copyTokenBtn) copyTokenBtn.addEventListener('click', () => Modals.copyToken());
    }
};

// ========== INITIALIZATION ==========
async function init() {
    console.log('✅ DOM Ready');
    
    // Load theme
    UI.loadTheme();
    
    // Initialize Firebase
    const connected = await Firebase.init();
    if (!connected) return;
    
    // Setup event listeners
    Events.init();
    
    // Load profile
    await Profile.load();
    
    console.log('✅ BreathSafe Profile Ready');
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', init);
// ========== LOGOUT ==========
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear all session data
        sessionStorage.removeItem('breathsafeAdmin');
        sessionStorage.removeItem('breathsafeAdminToken');
        sessionStorage.removeItem('adminPrefillValue');
        sessionStorage.removeItem('adminPrefillType');
        
        console.log('✅ Admin logged out');
        window.location.href = 'breathsafe-admin-login.html';
    }
}
// ========== REFRESH SESSION PERIODICALLY ==========
function startSessionRefresh() {
    setInterval(async () => {
        const sessionAdmin = sessionStorage.getItem('breathsafeAdmin');
        if (!sessionAdmin) return;
        
        const admin = JSON.parse(sessionAdmin);
        
        if (STATE.db) {
            try {
                const snapshot = await STATE.db.collection('admins')
                    .where('username', '==', admin.username)
                    .limit(1)
                    .get();
                
                if (!snapshot.empty) {
                    const freshData = {
                        id: snapshot.docs[0].id,
                        ...snapshot.docs[0].data()
                    };
                    
                    const updatedSession = {
                        ...admin,
                        email: freshData.email,
                        firstName: freshData.firstName || '',
                        lastName: freshData.lastName || '',
                        phoneNumber: freshData.phoneNumber || '',
                        apiToken: freshData.apiToken
                    };
                    
                    sessionStorage.setItem('breathsafeAdmin', JSON.stringify(updatedSession));
                    console.log('🔄 Session refreshed');
                }
            } catch (error) {
                console.error('Session refresh error:', error);
            }
        }
    }, 5 * 60 * 1000); // Refresh every 5 minutes
}

// Call this in initCore() or initialize()
function initCore() {
    console.log("✅ Core Initializing...");
    loadTheme();
    initFirestore();
    setupCoreEventListeners();
    loadAdminInfo();
    loadUsers();
    startSessionRefresh(); // ✅ Add this
    console.log("✅ Core Ready");
}