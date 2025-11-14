// ==========================================
// BREATHSAFE ADMIN LOGIN - PERFORMANCE OPTIMIZED WITH SEPARATE LOCKOUT
// Independent admin lockout system
// ==========================================

(function() {
    'use strict';
    
    console.log('BreathSafe Admin Login Loading...');

    // ========== CONFIGURATION ==========
const CONFIG = {
    firebase: {
        apiKey: "AIzaSyA2M-8B77PYDw6fA-fZXLCOoK_M76reSpU",
        authDomain: "gas-leak-detection-8602a.firebaseapp.com",
        projectId: "gas-leak-detection-8602a",
        storageBucket: "gas-leak-detection-8602a.firebasestorage.app",
        messagingSenderId: "965913006308",
        appId: "1:965913006308:web:d70797bc2fa51fb8b01cf1",
        measurementId: "G-465DRCB5JE"
    },
    debounce: {
        validation: 300
    },
    adminLockout: {
        initialAttempts: 3,  // Admins get fewer initial attempts
        subsequentAttempts: 2, // Even fewer on subsequent lockouts
        duration: 20 * 60 * 1000, // 20 minutes lockout for admins (changed from 30)
        storageKey: 'breathsafe_admin_lockout'
    }
};
    // ========== STATE ==========
    const state = {
        db: null,
        lockoutTimer: null
    };

    // ========== ADMIN LOCKOUT MANAGER ==========
    const adminLockoutManager = {
        getData() {
            try {
                const data = localStorage.getItem(CONFIG.adminLockout.storageKey);
                if (!data) return { 
                    attempts: 0, 
                    lockedUntil: null, 
                    lockoutCount: 0,
                    lastSuccessfulLogin: null
                };
                return JSON.parse(data);
            } catch (e) {
                console.error('Error reading admin lockout data:', e);
                return { 
                    attempts: 0, 
                    lockedUntil: null, 
                    lockoutCount: 0,
                    lastSuccessfulLogin: null
                };
            }
        },

        saveData(data) {
            try {
                localStorage.setItem(CONFIG.adminLockout.storageKey, JSON.stringify(data));
            } catch (e) {
                console.error('Error saving admin lockout data:', e);
            }
        },

        isLocked() {
            const data = this.getData();
            if (!data.lockedUntil) return false;
            
            const now = Date.now();
            if (now < data.lockedUntil) {
                return true;
            }
            
            // Lock expired, determine next attempt limit
            this.saveData({
                attempts: 0,
                lockedUntil: null,
                lockoutCount: data.lockoutCount,
                lastSuccessfulLogin: data.lastSuccessfulLogin
            });
            return false;
        },

        getMaxAttempts() {
            const data = this.getData();
            
            // Check if admin had a successful login after a lockout
            if (data.lastSuccessfulLogin) {
                const timeSinceSuccess = Date.now() - data.lastSuccessfulLogin;
                
                // If successful login was recent, reset to initial attempts
                if (data.lockoutCount > 0 && timeSinceSuccess < CONFIG.adminLockout.duration) {
                    return CONFIG.adminLockout.initialAttempts;
                }
            }
            
            // If admin has been locked out before, give fewer attempts
            return data.lockoutCount > 0 ? CONFIG.adminLockout.subsequentAttempts : CONFIG.adminLockout.initialAttempts;
        },

        getRemainingLockTime() {
            const data = this.getData();
            if (!data.lockedUntil) return 0;
            
            const remaining = data.lockedUntil - Date.now();
            return remaining > 0 ? remaining : 0;
        },

        recordFailedAttempt() {
            const data = this.getData();
            data.attempts += 1;
            
            const maxAttempts = this.getMaxAttempts();
            
            if (data.attempts >= maxAttempts) {
                // Lock the admin account
                data.lockedUntil = Date.now() + CONFIG.adminLockout.duration;
                data.lockoutCount = (data.lockoutCount || 0) + 1;
                data.attempts = 0;
                this.saveData(data);
                
                // Log security event
                console.warn(`Admin lockout triggered - Count: ${data.lockoutCount}`);
                
                return {
                    locked: true,
                    attemptsUsed: maxAttempts,
                    remainingAttempts: 0,
                    lockoutMinutes: CONFIG.adminLockout.duration / 60000
                };
            }
            
            this.saveData(data);
            return {
                locked: false,
                attemptsUsed: data.attempts,
                remainingAttempts: maxAttempts - data.attempts,
                lockoutMinutes: CONFIG.adminLockout.duration / 60000
            };
        },

        recordSuccessfulLogin() {
            const data = this.getData();
            
            // Reset attempts and record successful login time
            this.saveData({
                attempts: 0,
                lockedUntil: null,
                lockoutCount: 0, // Reset lockout count on successful login
                lastSuccessfulLogin: Date.now()
            });
            
            console.log('Admin login successful - lockout data reset');
        },

        clearAll() {
            localStorage.removeItem(CONFIG.adminLockout.storageKey);
        },

        startCountdown(callback) {
            if (state.lockoutTimer) {
                clearInterval(state.lockoutTimer);
            }

            const updateCountdown = () => {
                const remaining = this.getRemainingLockTime();
                
                if (remaining <= 0) {
                    clearInterval(state.lockoutTimer);
                    state.lockoutTimer = null;
                    if (callback) callback(0);
                    return;
                }
                
                if (callback) callback(remaining);
            };

            updateCountdown();
            state.lockoutTimer = setInterval(updateCountdown, 1000);
        }
    };

    // ========== UTILITIES ==========
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    let firebasePromise = null;
    function loadFirebase() {
        if (firebasePromise) return firebasePromise;
        
        firebasePromise = new Promise((resolve, reject) => {
            if (typeof firebase !== 'undefined') {
                resolve(firebase);
            } else {
                const checkFirebase = setInterval(() => {
                    if (typeof firebase !== 'undefined') {
                        clearInterval(checkFirebase);
                        resolve(firebase);
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkFirebase);
                    reject(new Error('Firebase failed to load'));
                }, 10000);
            }
        });
        
        return firebasePromise;
    }

    // ========== MESSAGE HELPER ==========
    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-exclamation-circle"></i>',
        info: '<i class="fas fa-info-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        loading: '<i class="fas fa-spinner fa-spin"></i>',
        lock: '<i class="fas fa-lock"></i>',
        shield: '<i class="fas fa-shield-alt"></i>'
    };

    function createMessageWithIcon(type, text) {
        return `${icons[type] || ''} ${text}`;
    }

    // ========== THEME MANAGER ==========
    const themeManager = {
        toggle() {
            document.body.classList.toggle('dark');
            document.body.classList.toggle('light');
            
            const isDark = document.body.classList.contains('dark');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
            
            const icon = document.querySelector('.toggle-icon i');
            if (icon) icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
        },
        
        load() {
            const theme = localStorage.getItem('theme') || 'light';
            document.body.classList.add(theme);
            
            const icon = document.querySelector('.toggle-icon i');
            if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    };

    // ========== FIREBASE MANAGER ==========
    const firebaseManager = {
        async init() {
            try {
                const firebase = await loadFirebase();
                const app = firebase.initializeApp(CONFIG.firebase, "breathsafeAdminApp");
                state.db = firebase.firestore(app);
                console.log('Firebase Initialized');
                return true;
            } catch (error) {
                console.error('Firebase Error:', error);
                uiManager.showMessage(createMessageWithIcon('error', 'Failed to connect to database'), 'error');
                return false;
            }
        }
    };

    // ========== VALIDATION ==========
    const validator = {
        apiTokenFormat(token) {
            const pattern = /^[A-Z0-9]{3,4}-[A-Z0-9]{3,5}-[A-Z0-9]{3,6}$/i;
            return pattern.test(token);
        },

        validateInRealTime(token) {
            const tokenValidation = document.getElementById('tokenValidation');
            if (!tokenValidation) return;
            
            if (!token) {
                tokenValidation.style.display = 'none';
                return;
            }
            
            const isValid = this.apiTokenFormat(token);
            
            if (isValid) {
                tokenValidation.className = 'validation-status success';
                tokenValidation.innerHTML = '<i class="fas fa-check-circle"></i> Valid token format';
                tokenValidation.style.display = 'block';
            } else {
                tokenValidation.className = 'validation-status error';
                tokenValidation.innerHTML = '<i class="fas fa-exclamation-circle"></i> Invalid format (XXX-XXXX-XXXX)';
                tokenValidation.style.display = 'block';
            }
        }
    };

    // ========== LOGIN MANAGER ==========
    const loginManager = {
        async login(username, password, apiToken) {
            if (!state.db) {
                throw new Error('Database not initialized');
            }
            
            try {
                console.log('Verifying admin:', username);
                
                const adminsRef = state.db.collection('admins');
                const snapshot = await adminsRef
                    .where('username', '==', username)
                    .where('password', '==', password)
                    .where('apiToken', '==', apiToken)
                    .limit(1)
                    .get();
                
                if (snapshot.empty) {
                    console.log('Invalid admin credentials');
                    
                    // Parallel checks for better error message
                    const [usernameCheck, passwordCheck] = await Promise.all([
                        adminsRef.where('username', '==', username).get(),
                        adminsRef.where('username', '==', username).where('password', '==', password).get()
                    ]);
                    
                    if (usernameCheck.empty) {
                        return { 
                            success: false, 
                            message: createMessageWithIcon('error', 'Admin username not found')
                        };
                    }
                    
                    if (passwordCheck.empty) {
                        return { 
                            success: false, 
                            message: createMessageWithIcon('error', 'Incorrect admin password')
                        };
                    }
                    
                    return { 
                        success: false, 
                        message: createMessageWithIcon('error', 'Invalid admin API token')
                    };
                }
                
                const adminDoc = snapshot.docs[0];
                const adminData = adminDoc.data();
                
                console.log('Admin authenticated:', adminData.username);
                
                // Update last login (non-blocking)
                adminsRef.doc(adminDoc.id).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                }).catch(err => console.warn('Could not update last login:', err));
                
                return {
                    success: true,
                    admin: {
                        id: adminDoc.id,
                        username: adminData.username,
                        email: adminData.email,
                        apiToken: adminData.apiToken,
                        firstName: adminData.firstName || '',
                        lastName: adminData.lastName || '',
                        role: 'admin'
                    }
                };
                
            } catch (error) {
                console.error('Admin login error:', error);
                throw new Error('Authentication failed. Please try again.');
            }
        }
    };

    // ========== SESSION MANAGER ==========
  // ========== SESSION MANAGER ==========
const sessionManager = {
    create(admin) {
        const session = {
            id: admin.id,
            username: admin.username,
            email: admin.email,
            firstName: admin.firstName || '',
            lastName: admin.lastName || '',
            phoneNumber: admin.phoneNumber || '',
            apiToken: admin.apiToken,
            role: 'admin',
            loginTime: new Date().toISOString()
        };
        
        // Store in sessionStorage (cleared when browser closes)
        sessionStorage.setItem('breathsafeAdmin', JSON.stringify(session));
        sessionStorage.setItem('breathsafeAdminToken', admin.apiToken);
        
        // Store username in localStorage (persists across sessions)
        localStorage.setItem('breathsafeAdminUsername', admin.username);
        localStorage.setItem('lastAdminToken', admin.apiToken);
        
        console.log('Admin session created for:', admin.username);
    },

    redirectToDashboard() {
        console.log('Redirecting to admin dashboard...');
        window.location.href = 'admin-dashboard.html';
    }
};
    // ========== PREFILL MANAGER ==========
    const prefillManager = {
        check() {
            const prefillValue = sessionStorage.getItem('adminPrefillValue');
            const prefillType = sessionStorage.getItem('adminPrefillType');
            
            if (prefillValue && prefillType) {
                console.log(`Pre-filling ${prefillType} with:`, prefillValue);
                
                if (prefillType === 'username') {
                    this.fillUsername(prefillValue);
                } else if (prefillType === 'token') {
                    this.fillToken(prefillValue);
                }
                
                // Clear session storage
                sessionStorage.removeItem('adminPrefillValue');
                sessionStorage.removeItem('adminPrefillType');
            }
        },

        fillUsername(value) {
            const usernameInput = document.getElementById('adminUsername');
            if (!usernameInput) return;
            
            usernameInput.value = value;
            this.addVisualEffect(usernameInput);
            
            const passwordInput = document.getElementById('adminPassword');
            if (passwordInput) passwordInput.focus();
            
            uiManager.showMessage(createMessageWithIcon('info', 'Username pre-filled. Enter your password and API token.'), 'info');
        },

        fillToken(value) {
            const tokenInput = document.getElementById('adminAPI');
            if (!tokenInput) return;
            
            tokenInput.value = value;
            this.addVisualEffect(tokenInput);
            validator.validateInRealTime(value);
            
            const usernameInput = document.getElementById('adminUsername');
            if (usernameInput) usernameInput.focus();
            
            uiManager.showMessage(createMessageWithIcon('info', 'API token pre-filled. Enter your username and password.'), 'info');
        },

        addVisualEffect(input) {
            input.style.background = 'rgba(16, 185, 129, 0.1)';
            input.style.borderColor = '#10b981';
            
            setTimeout(() => {
                input.style.background = '';
                input.style.borderColor = '';
            }, 2000);
        }
    };

    // ========== UI MANAGER ==========
    const uiManager = {
        showMessage(msg, type) {
            const messageDiv = document.getElementById('message');
            if (!messageDiv) return;
            
            messageDiv.innerHTML = msg;
            messageDiv.className = 'modern-message ' + type;
            messageDiv.style.display = 'block';
            
            if (type === 'info') {
                setTimeout(() => {
                    if (messageDiv && messageDiv.className && messageDiv.className.includes('info')) {
                        messageDiv.style.display = 'none';
                    }
                }, 5000);
            }
        },

        togglePassword() {
            const passwordInput = document.getElementById('adminPassword');
            const toggleBtn = document.getElementById('togglePassword');
            
            if (!passwordInput || !toggleBtn) return;
            
            const type = passwordInput.type === 'password' ? 'text' : 'password';
            passwordInput.type = type;
            
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
            }
        },

        showLockoutTimer(remainingTime) {
            const lockoutDiv = document.getElementById('adminLockoutTimer');
            const countdownDiv = document.getElementById('adminLockoutCountdown');
            const loginBtn = document.getElementById('loginBtn');
            
            if (!lockoutDiv || !countdownDiv) return;
            
            if (remainingTime <= 0) {
                lockoutDiv.classList.remove('active');
                if (loginBtn) loginBtn.disabled = false;
                
                // Show available attempts after lockout expires
                const maxAttempts = adminLockoutManager.getMaxAttempts();
                this.showMessage(
                    createMessageWithIcon('shield', `Admin lockout expired. You have ${maxAttempts} attempt${maxAttempts !== 1 ? 's' : ''} available.`), 
                    'info'
                );
                return;
            }
            
            lockoutDiv.classList.add('active');
            if (loginBtn) loginBtn.disabled = true;
            
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            countdownDiv.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        },

        hideLockoutTimer() {
            const lockoutDiv = document.getElementById('adminLockoutTimer');
            if (lockoutDiv) {
                lockoutDiv.classList.remove('active');
            }
        }
    };

    // ========== FORM HANDLERS ==========
    const formHandlers = {
        handleTokenInput: debounce(function(value) {
            validator.validateInRealTime(value);
        }, CONFIG.debounce.validation),

        async handleSubmit(e, elements) {
            e.preventDefault();
            
            const { usernameInput, passwordInput, apiInput, loginBtn, btnContent, btnLoading } = elements;
            
            // Check if locked
            if (adminLockoutManager.isLocked()) {
                const remaining = adminLockoutManager.getRemainingLockTime();
                const minutes = Math.ceil(remaining / 60000);
                uiManager.showMessage(
                    createMessageWithIcon('lock', `Admin account locked for security. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''}.`), 
                    'error'
                );
                return;
            }
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            const apiToken = apiInput.value.trim();
            
            if (!username || !password || !apiToken) {
                uiManager.showMessage(createMessageWithIcon('warning', 'All fields are required'), 'error');
                return;
            }
            
            if (!validator.apiTokenFormat(apiToken)) {
                uiManager.showMessage(createMessageWithIcon('warning', 'Invalid API token format'), 'error');
                return;
            }
            
            loginBtn.disabled = true;
            if (btnContent) btnContent.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'flex';
            
            try {
                uiManager.showMessage(createMessageWithIcon('loading', 'Verifying admin credentials...'), 'info');
                
                const result = await loginManager.login(username, password, apiToken);
                
                if (result.success) {
                    // Successful login - reset lockout
                    adminLockoutManager.recordSuccessfulLogin();
                    uiManager.hideLockoutTimer();
                    
                    uiManager.showMessage(createMessageWithIcon('success', 'Admin authentication successful! Redirecting...'), 'success');
                    sessionManager.create(result.admin);
                    
                    setTimeout(() => {
                        sessionManager.redirectToDashboard();
                    }, 1500);
                } else {
                    // Failed login - record attempt
                    const lockoutResult = adminLockoutManager.recordFailedAttempt();
                    
                    if (lockoutResult.locked) {
                        uiManager.showMessage(
                            createMessageWithIcon('lock', `Too many failed admin login attempts. Account locked for ${lockoutResult.lockoutMinutes} minutes for security.`), 
                            'error'
                        );
                        
                        adminLockoutManager.startCountdown((remaining) => {
                            uiManager.showLockoutTimer(remaining);
                        });
                    } else {
                        const attemptText = lockoutResult.remainingAttempts === 1 ? 'attempt' : 'attempts';
                        uiManager.showMessage(
                            `${result.message}<br><small style="margin-top: 8px; display: block;"><i class="fas fa-shield-alt"></i> ${lockoutResult.remainingAttempts} ${attemptText} remaining before ${lockoutResult.lockoutMinutes}-minute security lockout</small>`, 
                            'error'
                        );
                    }
                    
                    loginBtn.disabled = false;
                    if (btnContent) btnContent.style.display = 'flex';
                    if (btnLoading) btnLoading.style.display = 'none';
                }
            } catch (error) {
                console.error('Error:', error);
                uiManager.showMessage(createMessageWithIcon('error', error.message), 'error');
                
                loginBtn.disabled = false;
                if (btnContent) btnContent.style.display = 'flex';
                if (btnLoading) btnLoading.style.display = 'none';
            }
        }
    };

    // ========== INITIALIZATION ==========
    async function initialize() {
        console.log('DOM Ready - Admin Login');
        
        themeManager.load();
        
        // Check if admin is already locked on page load
        if (adminLockoutManager.isLocked()) {
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) loginBtn.disabled = true;
            
            adminLockoutManager.startCountdown((remaining) => {
                uiManager.showLockoutTimer(remaining);
            });
            
            const minutes = Math.ceil(adminLockoutManager.getRemainingLockTime() / 60000);
            uiManager.showMessage(
                createMessageWithIcon('lock', `Admin account locked for security. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''}.`), 
                'error'
            );
        }
        
        const connected = await firebaseManager.init();
        if (!connected) return;
        
        // Check and pre-fill from main login
        prefillManager.check();
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', themeManager.toggle);
        }
        
        const togglePassword = document.getElementById('togglePassword');
        if (togglePassword) {
            togglePassword.addEventListener('click', uiManager.togglePassword);
        }
        
        const form = document.getElementById('adminLoginForm');
        const loginBtn = document.getElementById('loginBtn');
        const btnContent = loginBtn?.querySelector('.btn-content');
        const btnLoading = loginBtn?.querySelector('.btn-loading');
        
        if (!form || !loginBtn) {
            console.error('Form elements not found');
            return;
        }
        
        const apiInput = document.getElementById('adminAPI');
        if (apiInput) {
            apiInput.addEventListener('input', (e) => {
                formHandlers.handleTokenInput(e.target.value.trim());
            }, { passive: true });
        }
        
        form.addEventListener('submit', (e) => {
            formHandlers.handleSubmit(e, {
                usernameInput: document.getElementById('adminUsername'),
                passwordInput: document.getElementById('adminPassword'),
                apiInput,
                loginBtn,
                btnContent,
                btnLoading
            });
        });
        
        // Clear error messages on input
        const inputs = [
            document.getElementById('adminUsername'),
            document.getElementById('adminPassword'),
            apiInput
        ];
        
        inputs.forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    const messageDiv = document.getElementById('message');
                    if (messageDiv && messageDiv.className && messageDiv.className.includes('error')) {
                        messageDiv.style.display = 'none';
                    }
                }, { passive: true });
                
                // Add focus animation
                input.addEventListener('focus', (e) => {
                    if (e.target.parentElement) {
                        e.target.parentElement.style.transform = 'scale(1.01)';
                    }
                }, { passive: true });
                
                input.addEventListener('blur', (e) => {
                    if (e.target.parentElement) {
                        e.target.parentElement.style.transform = 'scale(1)';
                    }
                }, { passive: true });
            }
        });
        
        console.log('BreathSafe Admin Login Ready - Secure Lockout System');
    }

    // ========== START APPLICATION ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose for debugging (admin only)
    if (typeof window !== 'undefined') {
        window.BreathSafeAdminLogin = {
            lockout: {
                isLocked: () => adminLockoutManager.isLocked(),
                getData: () => adminLockoutManager.getData(),
                clear: () => adminLockoutManager.clearAll(),
                getMaxAttempts: () => adminLockoutManager.getMaxAttempts()
            }
        };
    }

})();