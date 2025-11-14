// ==========================================
// BREATHSAFE SIGNUP - PERFORMANCE OPTIMIZED - ENHANCED WITH PHONE CHECK
// Web Workers, Lazy Loading, Debouncing, Throttling
// Enhanced validation with phone number uniqueness check
// ==========================================

(function() {
    'use strict';
    
    console.log('BreathSafe Signup Loading...');

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
        username: {
            min: 3,
            max: 12
        },
        name: {
            max: 12
        },
        phone: {
            max: 9,
            operators: {
                '77': 'Orange',
                '78': 'Umniah',
                '79': 'Zain'
            },
            validPrefixes: ['77', '78', '79']
        },
        debounce: {
            input: 300,
            username: 400,
            phone: 800,
            email: 500,
            phoneCheck: 1000
        },
        cache: {
            ttl: 5 * 60 * 1000 // 5 minutes
        }
    };

    // ========== STATE MANAGEMENT ==========
    const state = {
        db: null,
        usernameWorker: null,
        cache: new Map(),
        pendingRequests: new Map()
    };

    // ========== PERFORMANCE UTILITIES ==========
    
    // Debounce function
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

    // Throttle function
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

    // Cache with TTL
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

    // Request deduplication
    async function dedupedRequest(key, requestFn) {
        const cached = cache.get(key);
        if (cached !== null) {
            return cached;
        }

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

    // ========== LAZY LOADING UTILITIES ==========
    
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
        check: '<i class="fas fa-check"></i>',
        times: '<i class="fas fa-times"></i>',
        lightbulb: '<i class="fas fa-lightbulb"></i>',
        user: '<i class="fas fa-user"></i>',
        envelope: '<i class="fas fa-envelope"></i>',
        phone: '<i class="fas fa-phone"></i>',
        userTie: '<i class="fas fa-user-tie"></i>'
    };

    function createMessageWithIcon(type, text) {
        return `${icons[type] || ''} ${text}`;
    }

    // ========== THEME MANAGEMENT ==========
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

    // ========== FIREBASE MANAGEMENT ==========
    const firebaseManager = {
        async init() {
            try {
                const firebase = await loadFirebase();
                const app = firebase.initializeApp(CONFIG.firebase, "signupApp");
                state.db = firebase.firestore(app);
                console.log('Firebase Initialized');
                return true;
            } catch (error) {
                console.error('Firebase Error:', error);
                uiManager.showMessage('Failed to connect to database', 'error');
                return false;
            }
        },

        generateToken() {
            const part = () => Math.random().toString(36).substring(2, 6).toUpperCase();
            return `${part()}-${part()}-${part()}`;
        }
    };

    // ========== VALIDATION (ENHANCED) ==========
    const validator = {
        username(username) {
            if (!username) return { valid: false, message: 'Username is required' };
            
            if (username.length < CONFIG.username.min) {
                return { valid: false, message: `Minimum ${CONFIG.username.min} characters required` };
            }
            
            if (username.length > CONFIG.username.max) {
                return { valid: false, message: `Maximum ${CONFIG.username.max} characters allowed` };
            }
            
            if (username.includes(' ')) {
                return { valid: false, message: 'Spaces are not allowed in username' };
            }
            
            if (!/^[a-zA-Z0-9_#$]+$/.test(username)) {
                return { valid: false, message: 'Only letters, numbers, _, #, and $ allowed' };
            }
            
            if (!/^[a-zA-Z0-9]/.test(username)) {
                return { valid: false, message: 'Must start with letter or number' };
            }
            
            if (/^\d+$/.test(username)) {
                return { valid: false, message: 'Username cannot be all numbers' };
            }
            
            const letterCount = (username.match(/[a-zA-Z]/g) || []).length;
            if (letterCount < 6) {
                return { valid: false, message: 'Must contain at least 6 letters' };
            }
            
            return { valid: true, message: 'Valid username format' };
        },

        name(name, fieldName) {
            if (!name) return { valid: false, message: `${fieldName} is required` };
            
            if (name.length > CONFIG.name.max) {
                return { valid: false, message: `Maximum ${CONFIG.name.max} characters allowed` };
            }
            
            if (!/^[a-zA-Z\s]+$/.test(name)) {
                return { valid: false, message: 'Only letters and spaces allowed' };
            }
            
            if (name.trim().length === 0) {
                return { valid: false, message: `${fieldName} cannot be empty` };
            }
            
            return { valid: true, message: `Valid ${fieldName.toLowerCase()}` };
        },

        email(email) {
            const gmailPattern = /^[a-zA-Z0-9._%-]+@gmail\.com$/;
            
            if (!email) {
                return { valid: false, message: 'Email is required' };
            }
            
            if (!email.includes('@')) {
                return { valid: false, message: 'Email must contain @' };
            }
            
            if (!email.endsWith('@gmail.com')) {
                return { valid: false, message: 'Only Gmail addresses allowed (@gmail.com)' };
            }
            
            if (!gmailPattern.test(email)) {
                return { valid: false, message: 'Invalid Gmail format' };
            }
            
            return { valid: true, message: 'Valid Gmail address' };
        },

        phone(phone) {
            if (!phone || phone.length === 0) {
                return { 
                    valid: false, 
                    message: 'Phone number is required',
                    operator: null
                };
            }
            
            if (phone.length !== CONFIG.phone.max) {
                return { 
                    valid: false, 
                    message: `Must be exactly ${CONFIG.phone.max} digits`,
                    operator: null
                };
            }
            
            if (!/^\d+$/.test(phone)) {
                return { 
                    valid: false, 
                    message: 'Only numbers allowed',
                    operator: null
                };
            }
            
            const prefix = phone.substring(0, 2);
            if (!CONFIG.phone.validPrefixes.includes(prefix)) {
                return { 
                    valid: false, 
                    message: 'Must start with 77 (Orange), 78 (Umniah), or 79 (Zain)',
                    operator: null
                };
            }
            
            if (/^(\d)\1{8}$/.test(phone)) {
                return { 
                    valid: false, 
                    message: 'Invalid phone number (all same digits)',
                    operator: null
                };
            }
            
            const operator = CONFIG.phone.operators[prefix];
            
            return { 
                valid: true, 
                message: `Valid phone (${operator})`,
                operator: operator
            };
        }
    };

    // ========== ENHANCED INPUT SHAKE ANIMATION ==========
    const shakeInput = (input) => {
        if (!input) return;
        input.classList.add('shake-error');
        setTimeout(() => {
            input.classList.remove('shake-error');
        }, 500);
    };

    // ========== DATA MANAGER WITH PHONE CHECK ==========
    const dataManager = {
        async checkUsername(username) {
            if (!state.db || !username || username.length < CONFIG.username.min) {
                return null;
            }
            
            const cacheKey = `username_${username}`;
            
            try {
                return await dedupedRequest(cacheKey, async () => {
                    const [usersSnapshot, adminsSnapshot] = await Promise.all([
                        state.db.collection('users').where('username', '==', username).limit(1).get(),
                        state.db.collection('admins').where('username', '==', username).limit(1).get()
                    ]);
                    
                    return usersSnapshot.empty && adminsSnapshot.empty;
                });
            } catch (error) {
                console.error('Check username error:', error);
                return null;
            }
        },

        async checkEmail(email) {
            if (!state.db || !email) return null;
            
            const cacheKey = `email_${email}`;
            
            try {
                return await dedupedRequest(cacheKey, async () => {
                    const [usersSnapshot, adminsSnapshot] = await Promise.all([
                        state.db.collection('users').where('email', '==', email).limit(1).get(),
                        state.db.collection('admins').where('email', '==', email).limit(1).get()
                    ]);
                    
                    return usersSnapshot.empty && adminsSnapshot.empty;
                });
            } catch (error) {
                console.error('Check email error:', error);
                return null;
            }
        },

        async checkPhoneNumber(phoneNumber) {
            if (!state.db || !phoneNumber) return null;
            
            const cacheKey = `phone_${phoneNumber}`;
            
            try {
                return await dedupedRequest(cacheKey, async () => {
                    const fullNumber = phoneNumber.startsWith('+962') ? phoneNumber : '+962' + phoneNumber;
                    
                    // Check both users and admins collections
                    const [usersSnapshot, adminsSnapshot] = await Promise.all([
                        state.db.collection('users').where('phoneNumber', '==', fullNumber).limit(1).get(),
                        state.db.collection('admins').where('phoneNumber', '==', fullNumber).limit(1).get()
                    ]);
                    
                    if (!usersSnapshot.empty) {
                        const userData = usersSnapshot.docs[0].data();
                        return {
                            available: false,
                            userType: 'user',
                            email: userData.email,
                            username: userData.username
                        };
                    }
                    
                    if (!adminsSnapshot.empty) {
                        const adminData = adminsSnapshot.docs[0].data();
                        return {
                            available: false,
                            userType: 'admin',
                            email: adminData.email,
                            username: adminData.username
                        };
                    }
                    
                    return { available: true };
                });
            } catch (error) {
                console.error('Check phone number error:', error);
                return null;
            }
        },

        async register(userData) {
            if (!state.db) throw new Error('Database not initialized');
            
            try {
                console.log('Registering user:', userData.username);
                
                // Check all unique fields in parallel
                const [usernameAvailable, emailAvailable, phoneCheck] = await Promise.all([
                    this.checkUsername(userData.username),
                    this.checkEmail(userData.email),
                    this.checkPhoneNumber(userData.phoneNumber.replace('+962', ''))
                ]);
                
                if (usernameAvailable === false) {
                    return { success: false, message: createMessageWithIcon('error', 'Username already exists') };
                }
                
                if (emailAvailable === false) {
                    return { success: false, message: createMessageWithIcon('error', 'Email already registered') };
                }
                
                // Check phone number uniqueness
                if (phoneCheck && !phoneCheck.available) {
                    let message = `Phone number already registered`;
                    
                    // Provide specific information about who owns the number
                    if (phoneCheck.email && phoneCheck.email !== userData.email) {
                        // Phone is registered to a different email
                        const maskedEmail = phoneCheck.email.substring(0, 3) + '***@gmail.com';
                        message = `Phone number already registered with email ${maskedEmail}`;
                        
                        if (phoneCheck.userType === 'admin') {
                            message = `Phone number is registered to an admin account`;
                        }
                    }
                    
                    return { success: false, message: createMessageWithIcon('error', message) };
                }
                
                let apiToken = firebaseManager.generateToken();
                let isUnique = false;
                let attempts = 0;
                
                while (!isUnique && attempts < 10) {
                    const [tokenQueryUsers, tokenQueryAdmins] = await Promise.all([
                        state.db.collection('users').where('apiToken', '==', apiToken).limit(1).get(),
                        state.db.collection('admins').where('apiToken', '==', apiToken).limit(1).get()
                    ]);
                    
                    if (tokenQueryUsers.empty && tokenQueryAdmins.empty) {
                        isUnique = true;
                    } else {
                        apiToken = firebaseManager.generateToken();
                        attempts++;
                    }
                }
                
                if (!isUnique) {
                    throw new Error('Failed to generate unique API token');
                }
                
                console.log('Generated API Token:', apiToken);
                
                const newUserRef = await state.db.collection('users').add({
                    username: userData.username,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    email: userData.email,
                    phoneNumber: userData.phoneNumber,
                    apiToken: apiToken,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    activatedAt: null
                });
                
                console.log('User registered:', newUserRef.id);
                cache.clear();
                
                return {
                    success: true,
                    message: createMessageWithIcon('success', 'Account created successfully!'),
                    userId: newUserRef.id,
                    apiToken: apiToken,
                    username: userData.username
                };
                
            } catch (error) {
                console.error('Registration error:', error);
                throw error;
            }
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
        },

        showSuccessModal(username, apiToken) {
            const modal = `
                <div style="
                    position: fixed;
                    inset: 0;
                    background: rgba(0,0,0,0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    padding: 20px;
                    backdrop-filter: blur(5px);
                    animation: fadeIn 0.3s ease;
                " id="successModal">
                    <div style="
                        background: var(--panel);
                        border-radius: 24px;
                        padding: 40px;
                        max-width: 500px;
                        width: 100%;
                        text-align: center;
                        border: 1px solid var(--border);
                        box-shadow: 0 24px 48px rgba(0,0,0,0.3);
                        animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    ">
                        <div style="
                            width: 80px;
                            height: 80px;
                            background: linear-gradient(135deg, #10b981, #059669);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0 auto 24px;
                            box-shadow: 0 8px 24px rgba(16,185,129,0.3);
                        ">
                            <i class="fas fa-check" style="font-size: 2.5rem; color: white;"></i>
                        </div>
                        <h2 style="font-size: 1.75rem; font-weight: 700; color: var(--text); margin-bottom: 12px;">
                            Registration Successful
                        </h2>
                        <p style="color: var(--text-muted); margin-bottom: 28px; font-size: 0.95rem;">
                            Your account has been created. Save your API token below.
                        </p>
                        
                        <div style="
                            background: var(--accent-bg);
                            border: 2px solid var(--primary);
                            border-radius: 12px;
                            padding: 20px;
                            margin-bottom: 24px;
                        ">
                            <label style="
                                display: block;
                                font-size: 0.8rem;
                                font-weight: 600;
                                color: var(--text-muted);
                                margin-bottom: 8px;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                            ">
                                <i class="fas fa-key"></i> Your API Token
                            </label>
                            <code style="
                                display: block;
                                font-family: 'Monaco', 'Courier New', monospace;
                                font-size: 1.1rem;
                                font-weight: 700;
                                color: var(--primary);
                                background: var(--panel);
                                padding: 14px;
                                border-radius: 8px;
                                margin-bottom: 12px;
                                word-break: break-all;
                            ">${apiToken}</code>
                            <button onclick="
                                navigator.clipboard.writeText('${apiToken}');
                                this.innerHTML='<i class=\\'fas fa-check\\'></i> Copied!';
                                this.style.background='#10b981';
                                setTimeout(()=>{
                                    this.innerHTML='<i class=\\'fas fa-copy\\'></i> Copy Token';
                                    this.style.background='';
                                }, 2000);
                            " style="
                                width: 100%;
                                padding: 12px;
                                background: var(--primary);
                                color: white;
                                border: none;
                                border-radius: 8px;
                                font-weight: 600;
                                cursor: pointer;
                                transition: all 0.3s;
                                font-family: inherit;
                                font-size: 0.9rem;
                            ">
                                <i class="fas fa-copy"></i> Copy Token
                            </button>
                        </div>
                        
                        <div style="
                            background: rgba(239,68,68,0.1);
                            border: 1px solid rgba(239,68,68,0.3);
                            border-radius: 12px;
                            padding: 16px;
                            margin-bottom: 24px;
                            text-align: left;
                        ">
                            <p style="
                                font-size: 0.875rem;
                                color: var(--text);
                                margin: 0;
                                line-height: 1.6;
                            ">
                                <i class="fas fa-exclamation-triangle" style="color: var(--danger);"></i>
                                <strong>Important:</strong> Save this token! You'll need it to login.
                                Your account is pending admin activation.
                            </p>
                        </div>
                        
                        <button onclick="window.location.href='index.html'" style="
                            width: 100%;
                            padding: 14px;
                            background: linear-gradient(135deg, #10b981, #059669);
                            color: white;
                            border: none;
                            border-radius: 12px;
                            font-weight: 600;
                            cursor: pointer;
                            font-family: inherit;
                            font-size: 1rem;
                            transition: all 0.3s;
                        ">
                            <i class="fas fa-sign-in-alt"></i> Go to Login
                        </button>
                    </div>
                </div>
                
                <style>
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                    @keyframes slideUp {
                        from {
                            opacity: 0;
                            transform: translateY(30px) scale(0.95);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0) scale(1);
                        }
                    }
                </style>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modal);
        }
    };

    // ========== SMART USERNAME ALTERNATIVES ==========
    const usernameAlternatives = {
        // ... (keep existing code)
        generateSync(baseUsername) {
            const suggestions = [];
            const maxLength = CONFIG.username.max;
            
            // Strategy 1: Abbreviations for long usernames
            if (baseUsername.length >= 8) {
                const firstChar = baseUsername[0];
                const noVowels = firstChar + baseUsername.slice(1).replace(/[aeiouAEIOU]/g, '');
                if (noVowels.length >= 3 && noVowels.length <= maxLength) {
                    suggestions.push(noVowels);
                }
                
                if (baseUsername.length >= 6) {
                    const abbrev = baseUsername.substring(0, 3) + '_' + baseUsername.substring(baseUsername.length - 3);
                    if (abbrev.length <= maxLength) {
                        suggestions.push(abbrev);
                    }
                }
            }
            
            // Strategy 2: Smart character substitution
            const substitutions = {
                'a': '4', 'e': '3', 'i': '1', 'o': '0', 's': '$'
            };
            
            for (const [letter, replacement] of Object.entries(substitutions)) {
                if (baseUsername.toLowerCase().includes(letter)) {
                    const substituted = baseUsername.replace(new RegExp(letter, 'i'), replacement);
                    if (substituted.length <= maxLength && substituted !== baseUsername) {
                        suggestions.push(substituted);
                        break;
                    }
                }
            }
            
            // Strategy 3: Prefix variations
            const shortPrefixes = ['my', 'im', 'mr', 'x'];
            for (const prefix of shortPrefixes) {
                if (suggestions.length >= 6) break;
                const prefixed = prefix + baseUsername;
                if (prefixed.length <= maxLength) {
                    suggestions.push(prefixed);
                }
            }
            
            // Strategy 4: Smart suffix
            const smartSuffixes = ['_x', '_v', '#1', '$1', '99'];
            for (const suffix of smartSuffixes) {
                if (suggestions.length >= 6) break;
                const truncated = baseUsername.substring(0, maxLength - suffix.length);
                if (truncated.length >= 3) {
                    suggestions.push(truncated + suffix);
                }
            }
            
            // Strategy 5: Middle character replacement
            if (baseUsername.length >= 5) {
                const start = baseUsername.substring(0, 2);
                const end = baseUsername.substring(baseUsername.length - 2);
                const midReplacements = ['xx', '##', '$$'];
                
                for (const mid of midReplacements) {
                    if (suggestions.length >= 6) break;
                    const modified = start + mid + end;
                    if (modified.length <= maxLength) {
                        suggestions.push(modified);
                    }
                }
            }
            
            // Strategy 6: Number patterns
            const years = [new Date().getFullYear().toString().slice(-2), '00', '21', '99'];
            for (const year of years) {
                if (suggestions.length >= 6) break;
                const truncated = baseUsername.substring(0, maxLength - 2);
                if (truncated.length >= 3) {
                    suggestions.push(truncated + year);
                }
            }
            
            // Remove duplicates and validate
            const uniqueSuggestions = [...new Set(suggestions)];
            const validSuggestions = uniqueSuggestions.filter(s => {
                const validation = validator.username(s);
                return validation.valid && s !== baseUsername && s.length <= maxLength;
            });
            
            return validSuggestions.slice(0, 6);
        },

        async verify(alternatives) {
            if (!alternatives || alternatives.length === 0) return [];
            
            try {
                const checkPromises = alternatives.map(alt => 
                    dataManager.checkUsername(alt).then(available => ({
                        username: alt,
                        available: available === true
                    }))
                );
                
                const results = await Promise.all(checkPromises);
                
                const availableAlternatives = results
                    .filter(r => r.available)
                    .map(r => r.username);
                
                return availableAlternatives.slice(0, 6);
            } catch (error) {
                console.error('Error verifying alternatives:', error);
                return alternatives.slice(0, 6);
            }
        },

        display(alternatives) {
            const container = document.getElementById('usernameAlternatives');
            if (container) container.remove();
            
            if (!alternatives || alternatives.length === 0) return;
            
            const usernameInput = document.getElementById('username');
            if (!usernameInput) return;
            
            const fragment = document.createDocumentFragment();
            const newContainer = document.createElement('div');
            newContainer.id = 'usernameAlternatives';
            newContainer.className = 'username-alternatives-container';
            
            const header = document.createElement('div');
            header.className = 'alternatives-header';
            header.innerHTML = `
                <i class="fas fa-lightbulb"></i>
                <span>Smart Suggestions (${alternatives.length} available)</span>
            `;
            newContainer.appendChild(header);
            
            const grid = document.createElement('div');
            grid.className = 'alternatives-grid';
            
            alternatives.forEach((alternative, index) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'alternative-btn';
                btn.style.animationDelay = `${index * 0.05}s`;
                
                let icon = 'fa-magic';
                if (alternative.includes('_')) icon = 'fa-link';
                else if (alternative.includes('#') || alternative.includes('$')) icon = 'fa-hashtag';
                else if (/\d/.test(alternative)) icon = 'fa-sort-numeric-down';
                
                btn.innerHTML = `
                    <i class="fas ${icon}"></i>
                    <span class="alt-text">${alternative}</span>
                    <i class="fas fa-arrow-right alt-arrow"></i>
                `;
                
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    
                    // Success animation
                    btn.classList.add('selected');
                    btn.innerHTML = '<i class="fas fa-check"></i>';
                    
                    setTimeout(() => {
                        usernameInput.value = alternative;
                        usernameInput.focus();
                        usernameInput.dispatchEvent(new Event('input'));
                        
                        // Smooth fade out
                        newContainer.style.opacity = '0';
                        newContainer.style.transform = 'translateY(-10px)';
                        setTimeout(() => newContainer.remove(), 300);
                    }, 400);
                });
                
                grid.appendChild(btn);
            });
            
            newContainer.appendChild(grid);
            fragment.appendChild(newContainer);
            
            const hint = document.getElementById('usernameHint');
            if (hint) {
                hint.parentElement.insertBefore(fragment, hint.nextSibling);
                
                requestAnimationFrame(() => {
                    newContainer.style.opacity = '0';
                    newContainer.style.transform = 'translateY(-10px)';
                    newContainer.style.transition = 'all 0.3s ease';
                    
                    requestAnimationFrame(() => {
                        newContainer.style.opacity = '1';
                        newContainer.style.transform = 'translateY(0)';
                    });
                });
            }
        }
    };

    // ========== PHONE SUGGESTIONS ==========
    const phoneSuggestions = {
        // ... (keep existing code)
        async generate(username) {
            if (!state.db || !username || username.length < CONFIG.username.min) {
                return [];
            }
            
            try {
                const cacheKey = `phone_suggestions_${username}`;
                return await dedupedRequest(cacheKey, async () => {
                    const usersRef = state.db.collection('users');
                    const userQuery = await usersRef
                        .where('username', '==', username)
                        .limit(1)
                        .get();
                    
                    if (!userQuery.empty) {
                        const userData = userQuery.docs[0].data();
                        const existingPhone = userData.phoneNumber;
                        
                        if (existingPhone) {
                            const phoneDigits = existingPhone.replace(/\D/g, '').slice(-9);
                            
                            if (phoneDigits.length === CONFIG.phone.max) {
                                const prefix = phoneDigits.substring(0, 2);
                                
                                if (CONFIG.phone.validPrefixes.includes(prefix)) {
                                    const suggestions = [];
                                    const base = parseInt(phoneDigits.substring(2));
                                    
                                    for (let i = 1; i <= 3; i++) {
                                        const suggestion = prefix + String(base + i).padStart(7, '0');
                                        if (suggestion.length === CONFIG.phone.max) {
                                            suggestions.push(suggestion);
                                        }
                                    }
                                    
                                    return suggestions.slice(0, 3);
                                }
                            }
                        }
                    }
                    
                    return [];
                });
            } catch (error) {
                console.error('Error generating phone suggestions:', error);
                return [];
            }
        },

        display(suggestions) {
            const container = document.getElementById('phoneSuggestions');
            if (container) container.remove();
            
            if (!suggestions || suggestions.length === 0) return;
            
            const phoneInput = document.getElementById('phoneNumber');
            if (!phoneInput) return;
            
            const fragment = document.createDocumentFragment();
            const newContainer = document.createElement('div');
            newContainer.id = 'phoneSuggestions';
            newContainer.className = 'phone-suggestions-container';
            
            const header = document.createElement('div');
            header.className = 'suggestions-header';
            header.innerHTML = `
                <i class="fas fa-mobile-alt"></i>
                <span>Suggested Phone Numbers</span>
            `;
            newContainer.appendChild(header);
            
            const grid = document.createElement('div');
            grid.className = 'suggestions-grid';
            
            suggestions.forEach((suggestion, index) => {
                const validation = validator.phone(suggestion);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'suggestion-btn';
                btn.style.animationDelay = `${index * 0.1}s`;
                
                btn.innerHTML = `
                    <div class="suggestion-operator">${validation.operator}</div>
                    <div class="suggestion-number">+962 ${suggestion.substring(0, 2)} ${suggestion.substring(2, 5)} ${suggestion.substring(5)}</div>
                    <i class="fas fa-arrow-right suggestion-arrow"></i>
                `;
                
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    btn.classList.add('selected');
                    
                    setTimeout(() => {
                        phoneInput.value = suggestion;
                        phoneInput.dispatchEvent(new Event('input'));
                        newContainer.remove();
                    }, 300);
                });
                
                grid.appendChild(btn);
            });
            
            newContainer.appendChild(grid);
            fragment.appendChild(newContainer);
            
            phoneInput.parentElement.parentElement.appendChild(fragment);
        }
    };

    // ========== INITIALIZATION ==========
    async function initialize() {
        console.log('DOM Ready');
        
        themeManager.load();
        
        const connected = await firebaseManager.init();
        if (!connected) return;
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', themeManager.toggle);
        }
        
        const form = document.getElementById('signupForm');
        const signupBtn = document.getElementById('signupBtn');
        const btnContent = signupBtn?.querySelector('.btn-content');
        const btnLoading = signupBtn?.querySelector('.btn-loading');
        
      // ========== USERNAME FIELD ==========
const usernameInput = document.getElementById('username');
const usernameIndicator = document.getElementById('usernameIndicator');
const usernameHint = document.getElementById('usernameHint');
const usernameCounter = document.getElementById('usernameCounter');

if (usernameInput) {
    usernameInput.setAttribute('maxlength', CONFIG.username.max);
    
    const updateCounter = throttle((value) => {
        if (usernameCounter) {
            usernameCounter.textContent = `${value.length} / ${CONFIG.username.max}`;
            if (value.length > CONFIG.username.max * 0.8) {
                usernameCounter.classList.add('warning');
            } else {
                usernameCounter.classList.remove('warning', 'danger');
            }
        }
    }, 100);
    
    // Create debounced validation function
    const checkUsernameDebounced = debounce(async (value) => {
        const validation = validator.username(value);
        
        if (!validation.valid) {
            usernameIndicator.style.display = 'none';
            usernameHint.innerHTML = createMessageWithIcon('times', validation.message);
            usernameHint.style.color = 'var(--danger)';
            shakeInput(usernameInput); // Jiggle only appears here (after user stops typing)
            
            const alternatives = document.getElementById('usernameAlternatives');
            if (alternatives) alternatives.remove();
            return;
        }
        
        if (value.length >= CONFIG.username.min) {
            usernameIndicator.className = 'input-indicator checking';
            usernameIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            usernameIndicator.style.display = 'block';
            
            const available = await dataManager.checkUsername(value);
            
            if (available === true) {
                usernameIndicator.className = 'input-indicator user';
                usernameIndicator.innerHTML = '<i class="fas fa-check"></i>';
                usernameHint.innerHTML = createMessageWithIcon('check', 'Username available!');
                usernameHint.style.color = 'var(--primary)';
                
                const alternatives = document.getElementById('usernameAlternatives');
                if (alternatives) alternatives.remove();
            } else if (available === false) {
                usernameIndicator.className = 'input-indicator';
                usernameIndicator.innerHTML = '<i class="fas fa-times"></i>';
                usernameIndicator.style.color = 'var(--danger)';
                usernameHint.innerHTML = createMessageWithIcon('times', 'Username taken - Choose from smart suggestions below');
                usernameHint.style.color = 'var(--danger)';
                shakeInput(usernameInput); // Jiggle appears here when username is taken
                
                const instantAlternatives = usernameAlternatives.generateSync(value);
                
                if (instantAlternatives.length > 0) {
                    usernameAlternatives.display(instantAlternatives);
                }
                
                usernameAlternatives.verify(instantAlternatives).then(verified => {
                    if (verified.length > 0 && verified.length !== instantAlternatives.length) {
                        usernameAlternatives.display(verified);
                    }
                });
            } else {
                usernameIndicator.style.display = 'none';
                usernameHint.innerHTML = createMessageWithIcon('info', 'Could not verify availability');
                usernameHint.style.color = '';
            }
        } else {
            usernameIndicator.style.display = 'none';
            usernameHint.innerHTML = createMessageWithIcon('info', `${CONFIG.username.min}-${CONFIG.username.max} characters`);
            usernameHint.style.color = '';
        }
    }, CONFIG.debounce.username); // Debounce by 400ms as configured
    
    // Event listener - only updates counter in real-time, validation is debounced
    usernameInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        updateCounter(value); // Counter updates in real-time
        checkUsernameDebounced(value); // Validation only runs after user stops typing
    }, { passive: true });
    
    usernameInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const cleaned = text.replace(/[^a-zA-Z0-9_#$]/g, '').substring(0, CONFIG.username.max);
        usernameInput.value = cleaned;
        usernameInput.dispatchEvent(new Event('input'));
    });
}
        // ========== FIRST NAME & LAST NAME FIELDS ==========
        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');
        
        [firstNameInput, lastNameInput].forEach(input => {
            if (input) {
                input.setAttribute('maxlength', CONFIG.name.max);
                
                const validateName = debounce((value, fieldName) => {
                    const validation = validator.name(value, fieldName);
                    const hint = input.parentElement.querySelector('.form-hint');
                    
                    if (hint) {
                        if (!validation.valid && value.length > 0) {
                            hint.innerHTML = createMessageWithIcon('times', validation.message);
                            hint.style.color = 'var(--danger)';
                            shakeInput(input);
                        } else if (validation.valid) {
                            hint.innerHTML = createMessageWithIcon('check', validation.message);
                            hint.style.color = 'var(--primary)';
                        } else {
                            hint.innerHTML = createMessageWithIcon('info', `Maximum ${CONFIG.name.max} characters`);
                            hint.style.color = '';
                        }
                    }
                }, CONFIG.debounce.input);
                
                input.addEventListener('input', (e) => {
                    const fieldName = input.id === 'firstName' ? 'First Name' : 'Last Name';
                    validateName(e.target.value.trim(), fieldName);
                }, { passive: true });
                
                // Only allow letters and spaces
                input.addEventListener('keypress', (e) => {
                    if (!/[a-zA-Z\s]/.test(e.key)) {
                        e.preventDefault();
                        shakeInput(input);
                    }
                });
            }
        });
        
        // ========== EMAIL FIELD ==========
        const emailInput = document.getElementById('email');
        const emailHint = document.getElementById('emailHint');
        const emailIndicator = document.getElementById('emailIndicator');
        
        if (emailInput) {
            const handleEmailInput = debounce(async (value) => {
                const validation = validator.email(value);
                
                if (!validation.valid && value.length > 0) {
                    if (emailHint) {
                        emailHint.innerHTML = createMessageWithIcon('times', validation.message);
                        emailHint.style.color = 'var(--danger)';
                    }
                    if (emailIndicator) emailIndicator.style.display = 'none';
                    shakeInput(emailInput);
                    return;
                }
                
                if (validation.valid) {
                    // Check if email already exists
                    if (emailIndicator) {
                        emailIndicator.className = 'input-indicator checking';
                        emailIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        emailIndicator.style.display = 'block';
                    }
                    
                    const available = await dataManager.checkEmail(value);
                    
                    if (available === true) {
                        if (emailIndicator) {
                            emailIndicator.className = 'input-indicator user';
                            emailIndicator.innerHTML = '<i class="fas fa-check"></i>';
                        }
                        if (emailHint) {
                            emailHint.innerHTML = createMessageWithIcon('check', 'Email available');
                            emailHint.style.color = 'var(--primary)';
                        }
                    } else if (available === false) {
                        if (emailIndicator) {
                            emailIndicator.className = 'input-indicator';
                            emailIndicator.innerHTML = '<i class="fas fa-times"></i>';
                            emailIndicator.style.color = 'var(--danger)';
                        }
                        if (emailHint) {
                            emailHint.innerHTML = createMessageWithIcon('times', 'Email already registered');
                            emailHint.style.color = 'var(--danger)';
                        }
                        shakeInput(emailInput);
                    }
                } else {
                    if (emailHint) {
                        emailHint.innerHTML = createMessageWithIcon('info', 'Gmail address only (e.g., yourname@gmail.com)');
                        emailHint.style.color = '';
                    }
                    if (emailIndicator) emailIndicator.style.display = 'none';
                }
            }, CONFIG.debounce.email);
            
            emailInput.addEventListener('input', (e) => {
                handleEmailInput(e.target.value.trim().toLowerCase());
            }, { passive: true });
        }
        
        // ========== PHONE FIELD WITH UNIQUENESS CHECK ==========
        const phoneInput = document.getElementById('phoneNumber');
        const phoneHint = document.getElementById('phoneHint');
        const phoneCounter = document.getElementById('phoneCounter');
        const phoneOperator = document.getElementById('phoneOperator');
        const phoneIndicator = document.getElementById('phoneIndicator');
        
        if (phoneInput) {
            phoneInput.setAttribute('maxlength', CONFIG.phone.max);
            
            const updatePhoneCounter = throttle((value) => {
                if (phoneCounter) {
                    phoneCounter.textContent = `${value.length} / ${CONFIG.phone.max}`;
                    if (value.length > CONFIG.phone.max * 0.8) {
                        phoneCounter.classList.add('warning');
                    } else {
                        phoneCounter.classList.remove('warning', 'danger');
                    }
                }
            }, 100);
            
            const handlePhoneInput = debounce(async (value, usernameValue) => {
                const validation = validator.phone(value);
                
                if (validation.valid) {
                    // Check if phone number is unique
                    if (phoneIndicator) {
                        phoneIndicator.className = 'input-indicator checking';
                        phoneIndicator.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        phoneIndicator.style.display = 'block';
                    }
                    
                    const phoneCheck = await dataManager.checkPhoneNumber(value);
                    
                    if (phoneCheck && phoneCheck.available) {
                        phoneInput.style.borderColor = 'var(--primary)';
                        if (phoneIndicator) {
                            phoneIndicator.className = 'input-indicator user';
                            phoneIndicator.innerHTML = '<i class="fas fa-check"></i>';
                        }
                        if (phoneHint) {
                            phoneHint.innerHTML = createMessageWithIcon('check', validation.message);
                            phoneHint.style.color = 'var(--primary)';
                        }
                        if (phoneOperator) {
                            phoneOperator.className = 'validation-feedback success';
                            phoneOperator.innerHTML = `<i class="fas fa-mobile-alt"></i> ${validation.operator}`;
                            phoneOperator.style.display = 'block';
                        }
                    } else if (phoneCheck && !phoneCheck.available) {
                        phoneInput.style.borderColor = 'var(--danger)';
                        if (phoneIndicator) {
                            phoneIndicator.className = 'input-indicator';
                            phoneIndicator.innerHTML = '<i class="fas fa-times"></i>';
                            phoneIndicator.style.color = 'var(--danger)';
                        }
                        
                        let message = 'Phone number already registered';
                        if (phoneCheck.userType === 'admin') {
                            message = 'Phone number is registered to an admin';
                        } else if (phoneCheck.email) {
                            const maskedEmail = phoneCheck.email.substring(0, 3) + '***@gmail.com';
                            message = `Phone already registered with ${maskedEmail}`;
                        }
                        
                        if (phoneHint) {
                            phoneHint.innerHTML = createMessageWithIcon('times', message);
                            phoneHint.style.color = 'var(--danger)';
                        }
                        if (phoneOperator) {
                            phoneOperator.style.display = 'none';
                        }
                        shakeInput(phoneInput);
                    }
                    
                    const phoneSuggestionsEl = document.getElementById('phoneSuggestions');
                    if (phoneSuggestionsEl) phoneSuggestionsEl.remove();
                } else {
                    phoneInput.style.borderColor = value.length > 0 ? 'var(--danger)' : '';
                    if (phoneIndicator) phoneIndicator.style.display = 'none';
                    if (phoneHint && value.length > 0) {
                        phoneHint.innerHTML = createMessageWithIcon('warning', validation.message);
                        phoneHint.style.color = 'var(--danger)';
                        shakeInput(phoneInput);
                    } else if (phoneHint) {
                        phoneHint.innerHTML = createMessageWithIcon('info', 'Enter 9 digits starting with 77, 78, or 79');
                        phoneHint.style.color = '';
                    }
                    if (phoneOperator) {
                        phoneOperator.style.display = 'none';
                    }
                    
                    if (value.length > 0 && usernameValue && usernameValue.length >= CONFIG.username.min) {
                        const suggestions = await phoneSuggestions.generate(usernameValue);
                        phoneSuggestions.display(suggestions);
                    }
                }
            }, CONFIG.debounce.phoneCheck);
            
            phoneInput.addEventListener('input', (e) => {
                let cleaned = e.target.value.replace(/\D/g, '');
                
                if (cleaned.length > 0 && cleaned[0] === '0') {
                    cleaned = cleaned.slice(1);
                }
                
                if (cleaned.length >= 2) {
                    const prefix = cleaned.substring(0, 2);
                    if (!CONFIG.phone.validPrefixes.includes(prefix)) {
                        let corrected = false;
                        for (const validPrefix of CONFIG.phone.validPrefixes) {
                            if (validPrefix.startsWith(cleaned[0])) {
                                cleaned = validPrefix + cleaned.substring(2);
                                corrected = true;
                                break;
                            }
                        }
                        if (!corrected) {
                            cleaned = '';
                        }
                    }
                }
                
                if (cleaned.length > CONFIG.phone.max) {
                    cleaned = cleaned.slice(0, CONFIG.phone.max);
                }
                
                e.target.value = cleaned;
                updatePhoneCounter(cleaned);
                
                const usernameValue = usernameInput?.value.trim();
                handlePhoneInput(cleaned, usernameValue);
            }, { passive: true });
            
            phoneInput.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text');
                const cleaned = text.replace(/\D/g, '').substring(0, CONFIG.phone.max);
                phoneInput.value = cleaned;
                phoneInput.dispatchEvent(new Event('input'));
            });
        }
        
        // ========== FORM SUBMISSION ==========
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const usernameValue = usernameInput.value.trim();
                const firstNameValue = firstNameInput.value.trim();
                const lastNameValue = lastNameInput.value.trim();
                const emailValue = emailInput.value.trim().toLowerCase();
                const phoneValue = phoneInput.value.trim();
                
                // Validate username
                const usernameValidation = validator.username(usernameValue);
                if (!usernameValidation.valid) {
                    uiManager.showMessage(createMessageWithIcon('warning', `Username: ${usernameValidation.message}`), 'error');
                    shakeInput(usernameInput);
                    usernameInput.focus();
                    return;
                }
                
                // Validate first name
                const firstNameValidation = validator.name(firstNameValue, 'First Name');
                if (!firstNameValidation.valid) {
                    uiManager.showMessage(createMessageWithIcon('warning', firstNameValidation.message), 'error');
                    shakeInput(firstNameInput);
                    firstNameInput.focus();
                    return;
                }
                
                // Validate last name
                const lastNameValidation = validator.name(lastNameValue, 'Last Name');
                if (!lastNameValidation.valid) {
                    uiManager.showMessage(createMessageWithIcon('warning', lastNameValidation.message), 'error');
                    shakeInput(lastNameInput);
                    lastNameInput.focus();
                    return;
                }
                
                // Validate email
                const emailValidation = validator.email(emailValue);
                if (!emailValidation.valid) {
                    uiManager.showMessage(createMessageWithIcon('warning', `Email: ${emailValidation.message}`), 'error');
                    shakeInput(emailInput);
                    emailInput.focus();
                    return;
                }
                
                // Validate phone
                const phoneValidation = validator.phone(phoneValue);
                if (!phoneValidation.valid) {
                    uiManager.showMessage(createMessageWithIcon('warning', `Phone: ${phoneValidation.message}`), 'error');
                    shakeInput(phoneInput);
                    phoneInput.focus();
                    return;
                }
                
                signupBtn.disabled = true;
                if (btnContent) btnContent.style.display = 'none';
                if (btnLoading) btnLoading.style.display = 'flex';
                
                try {
                    uiManager.showMessage(createMessageWithIcon('loading', 'Creating your account...'), 'info');
                    
                    const userData = {
                        username: usernameValue,
                        firstName: firstNameValue,
                        lastName: lastNameValue,
                        email: emailValue,
                        phoneNumber: '+962' + phoneValue
                    };
                    
                    const result = await dataManager.register(userData);
                    
                    if (result.success) {
                        uiManager.showSuccessModal(result.username, result.apiToken);
                    } else {
                        uiManager.showMessage(result.message, 'error');
                        
                        signupBtn.disabled = false;
                        if (btnContent) btnContent.style.display = 'flex';
                        if (btnLoading) btnLoading.style.display = 'none';
                    }
                } catch (error) {
                    console.error('Error:', error);
                    uiManager.showMessage(createMessageWithIcon('error', 'Registration failed: ' + error.message), 'error');
                    
                    signupBtn.disabled = false;
                    if (btnContent) btnContent.style.display = 'flex';
                    if (btnLoading) btnLoading.style.display = 'none';
                }
            });
        }
        
        console.log('BreathSafe Signup Ready - Enhanced with Phone Uniqueness Check');
    }

    // ========== START APPLICATION ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Expose for debugging
    if (typeof window !== 'undefined') {
        window.BreathSafeSignup = {
            cache,
            clearCache: () => cache.clear(),
            getState: () => ({ ...state, db: state.db ? 'initialized' : null })
        };
    }

})();