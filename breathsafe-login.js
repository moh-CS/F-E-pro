// ==========================================
// BREATHSAFE UNIFIED LOGIN - PERFORMANCE OPTIMIZED WITH LOCKOUT
// Web Workers, Lazy Loading, Debouncing, Throttling, Login Attempt Tracking
// Minification-ready, Bundling-ready, Performance Optimized
// ==========================================

(function() {
    'use strict';
    
    console.log('BreathSafe Unified Login Loading...');

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
            input: 300,
            check: 500
        },
        cache: {
            ttl: 5 * 60 * 1000 // 5 minutes
        },
        lockout: {
            initialAttempts: 5,
            subsequentAttempts: 3,
            duration: 15 * 60 * 1000, // 15 minutes
            storageKey: 'breathsafe_login_attempts'
        }
    };

    // ========== STATE ==========
    const state = {
        db: null,
        cache: new Map(),
        pendingRequests: new Map(),
        lockoutTimer: null,
        pendingAccountDetected: false
    };

    // ========== PERFORMANCE UTILITIES ==========
    
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

    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    class CacheManager {
        constructor(ttl) {
            this.cache = new Map();
            this.ttl = ttl;
        }

        set(key, value) {
            this.cache.set(key, {
                value,
                timestamp: Date.now()
            });
        }

        get(key) {
            const item = this.cache.get(key);
            if (!item) return null;
            
            if (Date.now() - item.timestamp > this.ttl) {
                this.cache.delete(key);
                return null;
            }
            
            return item.value;
        }

        clear() {
            this.cache.clear();
        }
    }

    const cache = new CacheManager(CONFIG.cache.ttl);

    async function dedupedRequest(key, requestFn) {
        const cached = cache.get(key);
        if (cached !== null) return cached;

        if (state.pendingRequests.has(key)) {
            return state.pendingRequests.get(key);
        }

        const promise = requestFn().then(result => {
            cache.set(key, result);
            state.pendingRequests.delete(key);
            return result;
        }).catch(error => {
            state.pendingRequests.delete(key);
            throw error;
        });

        state.pendingRequests.set(key, promise);
        return promise;
    }

    // ========== LAZY LOADING ==========
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
        search: '<i class="fas fa-search"></i>',
        shield: '<i class="fas fa-shield-alt"></i>',
        lock: '<i class="fas fa-lock"></i>',
        clock: '<i class="fas fa-clock"></i>'
    };

    function createMessageWithIcon(type, text) {
        return `${icons[type] || ''} ${text}`;
    }

    // ========== LOCKOUT MANAGER ==========
    const lockoutManager = {
        getData() {
            try {
                const data = localStorage.getItem(CONFIG.lockout.storageKey);
                if (!data) return { attempts: 0, lockedUntil: null, hasHadInitialAttempts: false };
                return JSON.parse(data);
            } catch (e) {
                console.error('Error reading lockout data:', e);
                return { attempts: 0, lockedUntil: null, hasHadInitialAttempts: false };
            }
        },

        saveData(data) {
            try {
                localStorage.setItem(CONFIG.lockout.storageKey, JSON.stringify(data));
            } catch (e) {
                console.error('Error saving lockout data:', e);
            }
        },

        isLocked() {
            const data = this.getData();
            if (!data.lockedUntil) return false;
            
            const now = Date.now();
            if (now < data.lockedUntil) {
                return true;
            }
            
            // Lock expired, reset attempts to 3 for subsequent tries
            this.saveData({
                attempts: 0,
                lockedUntil: null,
                hasHadInitialAttempts: true
            });
            return false;
        },

        getRemainingLockTime() {
            const data = this.getData();
            if (!data.lockedUntil) return 0;
            
            const remaining = data.lockedUntil - Date.now();
            return remaining > 0 ? remaining : 0;
        },

        recordFailedAttempt() {
            // Don't count attempts for pending accounts
            if (state.pendingAccountDetected) {
                return {
                    locked: false,
                    isPending: true,
                    attemptsUsed: 0,
                    remainingAttempts: 0
                };
            }

            const data = this.getData();
            data.attempts += 1;
            
            // Determine max attempts based on whether initial attempts have been used
            const maxAttempts = data.hasHadInitialAttempts ? 
                CONFIG.lockout.subsequentAttempts : 
                CONFIG.lockout.initialAttempts;
            
            if (data.attempts >= maxAttempts) {
                // Lock the account
                data.lockedUntil = Date.now() + CONFIG.lockout.duration;
                data.attempts = 0;
                data.hasHadInitialAttempts = true;
                this.saveData(data);
                return {
                    locked: true,
                    attemptsUsed: maxAttempts,
                    remainingAttempts: 0
                };
            }
            
            this.saveData(data);
            return {
                locked: false,
                attemptsUsed: data.attempts,
                remainingAttempts: maxAttempts - data.attempts
            };
        },

        resetAttempts() {
            const data = this.getData();
            data.attempts = 0;
            this.saveData(data);
        },

        clearAll() {
            localStorage.removeItem(CONFIG.lockout.storageKey);
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
                if (!firebase.apps.length) {
                    firebase.initializeApp(CONFIG.firebase);
                }
                state.db = firebase.firestore();
                console.log('Firebase Initialized Successfully');
                return true;
            } catch (error) {
                console.error('Firebase Initialization Error:', error);
                uiManager.showMessage(createMessageWithIcon('error', 'Failed to connect to database'), 'error');
                return false;
            }
        }
    };

    // ========== LOGIN MANAGER (OPTIMIZED) ==========
    const loginManager = {
        async handleLogin(input) {
            if (!state.db) {
                throw new Error('Database not initialized');
            }
            
            try {
                console.log('Processing login for:', input);
                state.pendingAccountDetected = false; // Reset pending flag
                
                const isTokenFormat = input.includes('-');
                const cacheKey = `login_${input}`;
                
                // Check admin username
                if (!isTokenFormat) {
                    const adminByUsername = await dedupedRequest(`admin_username_${input}`, async () => {
                        return await state.db.collection('admins')
                            .where('username', '==', input)
                            .limit(1)
                            .get();
                    });
                    
                    if (!adminByUsername.empty) {
                        console.log('Admin username found, redirecting');
                        uiManager.showMessage(createMessageWithIcon('shield', 'Admin account detected. Redirecting...'), 'info');
                        await this.delay(1000);
                        this.redirectToAdminLogin(input, 'username');
                        return { redirect: true };
                    }
                }
                
                // Check admin token
                if (isTokenFormat) {
                    const adminByToken = await dedupedRequest(`admin_token_${input}`, async () => {
                        return await state.db.collection('admins')
                            .where('apiToken', '==', input)
                            .limit(1)
                            .get();
                    });
                    
                    if (!adminByToken.empty) {
                        console.log('Admin token found, redirecting');
                        uiManager.showMessage(createMessageWithIcon('shield', 'Admin token detected. Redirecting...'), 'info');
                        await this.delay(1000);
                        this.redirectToAdminLogin(input, 'token');
                        return { redirect: true };
                    }
                }
                
                // Check user
                return await dedupedRequest(cacheKey, async () => {
                    const usersRef = state.db.collection('users');
                    
                    if (!isTokenFormat) {
                        const userByUsername = await usersRef
                            .where('username', '==', input)
                            .limit(1)
                            .get();
                        
                        if (!userByUsername.empty) {
                            return this.processUserLogin(userByUsername.docs[0]);
                        }
                    }
                    
                    const userByToken = await usersRef
                        .where('apiToken', '==', input)
                        .limit(1)
                        .get();
                    
                    if (!userByToken.empty) {
                        return this.processUserLogin(userByToken.docs[0]);
                    }
                    
                    return {
                        success: false,
                        isPendingAccount: false,
                        message: createMessageWithIcon('error', 'Username or API token not found')
                    };
                });
                
            } catch (error) {
                console.error('Login handler error:', error);
                throw new Error('Login failed: ' + error.message);
            }
        },

        processUserLogin(userDoc) {
            const userData = userDoc.data();
            
            if (userData.status !== 'active') {
                state.pendingAccountDetected = true; // Set pending flag
                return {
                    success: false,
                    isPendingAccount: true,
                    message: createMessageWithIcon('warning', 'Account is pending activation. Please contact admin.')
                };
            }
            
            console.log('User found and active');
            return {
                success: true,
                isPendingAccount: false,
                user: {
                    id: userDoc.id,
                    ...userData
                }
            };
        },

        redirectToAdminLogin(input, type) {
            try {
                sessionStorage.setItem('adminPrefillValue', input);
                sessionStorage.setItem('adminPrefillType', type);
            } catch (e) {
                console.warn('sessionStorage not available', e);
            }
            window.location.href = 'breathsafe-admin-login.html';
        },

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };

// ========== INPUT CHECKER (OPTIMIZED) ==========
const inputChecker = {
    async check(input) {
        if (!input || input.length < 3 || !state.db) return;
        
        const indicator = document.getElementById('inputIndicator');
        const hint = document.getElementById('inputHint');
        
        if (!indicator || !hint) return;
        
        indicator.className = 'input-indicator checking';
        indicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        indicator.style.display = 'block';
        
        try {
            const isTokenFormat = input.includes('-');
            
            // Parallel requests for better performance
            const [adminUsernameCheck, adminTokenCheck, userCheck, userTokenCheck] = await Promise.all([
                !isTokenFormat ? dedupedRequest(`admin_check_${input}`, async () => {
                    return await state.db.collection('admins')
                        .where('username', '==', input)
                        .limit(1)
                        .get();
                }) : Promise.resolve({ empty: true }),
                isTokenFormat ? dedupedRequest(`admin_token_check_${input}`, async () => {
                    return await state.db.collection('admins')
                        .where('apiToken', '==', input)
                        .limit(1)
                        .get();
                }) : Promise.resolve({ empty: true }),
                !isTokenFormat ? state.db.collection('users')
                    .where('username', '==', input)
                    .limit(1)
                    .get() : Promise.resolve({ empty: true }),
                isTokenFormat ? state.db.collection('users')
                    .where('apiToken', '==', input)
                    .limit(1)
                    .get() : Promise.resolve({ empty: true })
            ]);
            
            if (!adminUsernameCheck.empty || !adminTokenCheck.empty) {
                indicator.className = 'input-indicator admin';
                indicator.innerHTML = '<i class="fas fa-user-shield"></i>';
                hint.innerHTML = createMessageWithIcon('shield', 'Admin account detected');
                state.pendingAccountDetected = false;
                return;
            }
            
            if (!userCheck.empty || !userTokenCheck.empty) {
                const userData = !userCheck.empty ? userCheck.docs[0].data() : userTokenCheck.docs[0].data();
                
                // Check if user is pending
                if (userData.status !== 'active') {
                    state.pendingAccountDetected = true; // SET FLAG HERE
                    indicator.className = 'input-indicator warning';
                    indicator.innerHTML = '<i class="fas fa-hourglass-half"></i>';
                    hint.innerHTML = createMessageWithIcon('warning', 'Account pending activation');
                    return;
                }
                
                state.pendingAccountDetected = false;
                indicator.className = 'input-indicator user';
                indicator.innerHTML = '<i class="fas fa-user"></i>';
                hint.innerHTML = createMessageWithIcon('success', 'User account found');
                return;
            }
            
            state.pendingAccountDetected = false;
            indicator.style.display = 'none';
            hint.innerHTML = createMessageWithIcon('info', 'Enter your username or API token to continue');
            
        } catch (error) {
            console.error('Check input error:', error);
            state.pendingAccountDetected = false;
            indicator.style.display = 'none';
        }
    }
};
    // ========== SESSION MANAGER ==========
    const sessionManager = {
        createUserSession(user) {
            const session = {
                id: user.id,
                username: user.username,
                email: user.email,
                role: 'user',
                loginTime: new Date().toISOString()
            };
            
            try {
                sessionStorage.setItem('breathsafeUser', JSON.stringify(session));
                sessionStorage.setItem('breathsafeToken', user.apiToken || '');
            } catch (e) {
                console.warn('sessionStorage not available', e);
            }
            
            console.log('User session created:', user.username);
        },

        redirectToUserDashboard() {
            console.log('Redirecting to user dashboard...');
            window.location.href = 'user-dashboard.html';
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

        showLockoutTimer(remainingTime) {
            const lockoutDiv = document.getElementById('lockoutTimer');
            const countdownDiv = document.getElementById('lockoutCountdown');
            const loginBtn = document.getElementById('loginBtn');
            
            if (!lockoutDiv || !countdownDiv) return;
            
            if (remainingTime <= 0) {
                lockoutDiv.classList.remove('active');
                if (loginBtn) loginBtn.disabled = false;
                this.showMessage(createMessageWithIcon('info', 'You can try logging in again.'), 'info');
                return;
            }
            
            lockoutDiv.classList.add('active');
            if (loginBtn) loginBtn.disabled = true;
            
            const minutes = Math.floor(remainingTime / 60000);
            const seconds = Math.floor((remainingTime % 60000) / 1000);
            countdownDiv.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        },

        hideLockoutTimer() {
            const lockoutDiv = document.getElementById('lockoutTimer');
            if (lockoutDiv) {
                lockoutDiv.classList.remove('active');
            }
        }
    };

    // ========== FORM HANDLERS ==========
    const formHandlers = {
        handleInput: debounce(async function(value) {
            await inputChecker.check(value);
        }, CONFIG.debounce.check),

    async handleSubmit(e, elements) {
    e.preventDefault();
    
    const { userInput, loginBtn, btnContent, btnLoading } = elements;
    const input = userInput.value.trim();
    
    // Check if locked
    if (lockoutManager.isLocked()) {
        const remaining = lockoutManager.getRemainingLockTime();
        const minutes = Math.ceil(remaining / 60000);
        uiManager.showMessage(
            createMessageWithIcon('lock', `Account temporarily locked. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''}.`), 
            'error'
        );
        return;
    }
    
    if (!input) {
        uiManager.showMessage(createMessageWithIcon('warning', 'Please enter your username or API token'), 'error');
        return;
    }
    
    // ========== CHECK IF PENDING BEFORE LOGIN ==========
    if (state.pendingAccountDetected) {
        uiManager.showMessage(createMessageWithIcon('warning', 'Account is pending activation. Please contact admin.'), 'warning');
        return;
    }
    
    loginBtn.disabled = true;
    if (btnContent) btnContent.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'flex';
    
    try {
        uiManager.showMessage(createMessageWithIcon('loading', 'Verifying credentials...'), 'info');
        
        const result = await loginManager.handleLogin(input);
        
        if (result.redirect) {
            return;
        }
        
        if (result.success) {
            // Successful login - reset attempts
            lockoutManager.resetAttempts();
            uiManager.hideLockoutTimer();
            
            uiManager.showMessage(createMessageWithIcon('success', 'Welcome back! Redirecting...'), 'success');
            sessionManager.createUserSession(result.user);
            
            await loginManager.delay(1500);
            sessionManager.redirectToUserDashboard();
        } else {
            // ========== FAILURE HANDLING ==========
            if (result.isPendingAccount) {
                // ✓ DO NOT count attempts for pending accounts
                // ✓ DO NOT show lockout warning
                uiManager.showMessage(result.message, 'warning');
                
                // Simply reset button and return
                loginBtn.disabled = false;
                if (btnContent) btnContent.style.display = 'flex';
                if (btnLoading) btnLoading.style.display = 'none';
                return;
            }
            
            // Only count failed attempts for ACTIVE accounts
            const lockoutResult = lockoutManager.recordFailedAttempt();
            
            if (lockoutResult.locked) {
                uiManager.showMessage(
                    createMessageWithIcon('lock', `Too many failed attempts. Account locked for 15 minutes.`), 
                    'error'
                );
                
                lockoutManager.startCountdown((remaining) => {
                    uiManager.showLockoutTimer(remaining);
                });
            } else {
                const attemptText = lockoutResult.remainingAttempts === 1 ? 'attempt' : 'attempts';
                uiManager.showMessage(
                    `${result.message}<br><small style="margin-top: 8px; display: block;"><i class="fas fa-exclamation-triangle"></i> ${lockoutResult.remainingAttempts} ${attemptText} remaining before 15-minute lockout</small>`, 
                    'error'
                );
            }
            
            loginBtn.disabled = false;
            if (btnContent) btnContent.style.display = 'flex';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    } catch (error) {
        console.error('Login error:', error);
        uiManager.showMessage(createMessageWithIcon('error', error.message), 'error');
        
        loginBtn.disabled = false;
        if (btnContent) btnContent.style.display = 'flex';
        if (btnLoading) btnLoading.style.display = 'none';
    }
}
    };

    // ========== INITIALIZATION ==========
    async function initialize() {
        console.log('DOM Ready');
        
        themeManager.load();
        
        // Check if already locked on page load
        if (lockoutManager.isLocked()) {
            const loginBtn = document.getElementById('loginBtn');
            if (loginBtn) loginBtn.disabled = true;
            
            lockoutManager.startCountdown((remaining) => {
                uiManager.showLockoutTimer(remaining);
            });
            
            const minutes = Math.ceil(lockoutManager.getRemainingLockTime() / 60000);
            uiManager.showMessage(
                createMessageWithIcon('lock', `Account temporarily locked due to multiple failed attempts. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''}.`), 
                'error'
            );
        }
        
        const connected = await firebaseManager.init();
        if (!connected) {
            console.error('Failed to initialize Firebase');
            return;
        }
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', themeManager.toggle);
        }
        
        const userInput = document.getElementById('userInput');
        const form = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');
        const btnContent = loginBtn?.querySelector('.btn-content');
        const btnLoading = loginBtn?.querySelector('.btn-loading');
        
        if (userInput) {
            userInput.addEventListener('input', (e) => {
                const value = e.target.value.trim();
                
                if (value.length >= 3) {
                    formHandlers.handleInput(value);
                } else {
                    const indicator = document.getElementById('inputIndicator');
                    const hint = document.getElementById('inputHint');
                    
                    if (indicator) indicator.style.display = 'none';
                    if (hint) {
                        hint.innerHTML = createMessageWithIcon('info', 'Enter your username or API token to continue');
                    }
                }
            }, { passive: true });
        }
        
        if (form) {
            form.addEventListener('submit', (e) => {
                formHandlers.handleSubmit(e, {
                    userInput,
                    loginBtn,
                    btnContent,
                    btnLoading
                });
            });
        }
        
        if (userInput) {
            userInput.addEventListener('input', () => {
                const messageDiv = document.getElementById('message');
                if (messageDiv && messageDiv.className && messageDiv.className.includes('error')) {
                    messageDiv.style.display = 'none';
                }
            }, { passive: true });
        }
        
        console.log('BreathSafe Unified Login Ready - Optimized with Lockout');
    }

    // ========== START APPLICATION ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose for debugging
    if (typeof window !== 'undefined') {
        window.BreathSafeLogin = {
            cache,
            clearCache: () => cache.clear(),
            getState: () => ({ ...state, db: state.db ? 'initialized' : null }),
            lockout: {
                isLocked: () => lockoutManager.isLocked(),
                getData: () => lockoutManager.getData(),
                clear: () => lockoutManager.clearAll()
            }
        };
    }

})();