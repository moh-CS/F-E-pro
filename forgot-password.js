// ==========================================
// BREATHSAFE FORGOT PASSWORD - PERFORMANCE OPTIMIZED - FIXED
// Send API Token via Email with performance enhancements
// ==========================================

(function() {
    'use strict';
    
    console.log('BreathSafe Forgot Password Loading...');

    // ========== CONFIGURATION ==========
    const CONFIG = {
        emailJS: {
            publicKey: "ttOsQpxink4j93uRk",
            serviceId: "service_gdw3oc5",
            templateId: "template_6l68q29"
        },
        firebase: {
            apiKey: "AIzaSyA2M-8B77PYDw6fA-fZXLCOoK_M76reSpU",
            authDomain: "gas-leak-detection-8602a.firebaseapp.com",
            projectId: "gas-leak-detection-8602a",
            storageBucket: "gas-leak-detection-8602a.firebasestorage.app",
            messagingSenderId: "965913006308",
            appId: "1:965913006308:web:d70797bc2fa51fb8b01cf1",
            measurementId: "G-465DRCB5JE"
        },
        rateLimit: {
            duration: 5 * 60 * 1000,
            key: 'breathsafe_email_rate_limit'
        },
        debounce: {
            input: 300
        }
    };

    // ========== STATE ==========
    const state = {
        db: null,
        countdownInterval: null
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

    let emailJSPromise = null;
    function loadEmailJS() {
        if (emailJSPromise) return emailJSPromise;
        
        emailJSPromise = new Promise((resolve, reject) => {
            if (typeof emailjs !== 'undefined') {
                emailjs.init(CONFIG.emailJS.publicKey);
                resolve(emailjs);
            } else {
                const checkEmailJS = setInterval(() => {
                    if (typeof emailjs !== 'undefined') {
                        clearInterval(checkEmailJS);
                        emailjs.init(CONFIG.emailJS.publicKey);
                        resolve(emailjs);
                    }
                }, 100);
                
                setTimeout(() => {
                    clearInterval(checkEmailJS);
                    reject(new Error('EmailJS failed to load'));
                }, 10000);
            }
        });
        
        return emailJSPromise;
    }

    // ========== MESSAGE HELPER ==========
    const icons = {
        success: '<i class="fas fa-check-circle"></i>',
        error: '<i class="fas fa-exclamation-circle"></i>',
        info: '<i class="fas fa-info-circle"></i>',
        warning: '<i class="fas fa-exclamation-triangle"></i>',
        loading: '<i class="fas fa-spinner fa-spin"></i>',
        search: '<i class="fas fa-search"></i>',
        email: '<i class="fas fa-envelope"></i>'
    };

    function createMessageWithIcon(type, text) {
        return `${icons[type] || ''} ${text}`;
    }

    // ========== RATE LIMIT MANAGER ==========
    const rateLimitManager = {
        get(email) {
            const stored = localStorage.getItem(CONFIG.rateLimit.key);
            if (!stored) return null;
            
            try {
                const limits = JSON.parse(stored);
                const limit = limits[email];
                
                if (limit && (Date.now() - limit) < CONFIG.rateLimit.duration) {
                    return limit;
                }
                
                delete limits[email];
                localStorage.setItem(CONFIG.rateLimit.key, JSON.stringify(limits));
                return null;
            } catch (e) {
                console.error('Rate limit parse error:', e);
                return null;
            }
        },

        set(email) {
            try {
                const stored = localStorage.getItem(CONFIG.rateLimit.key) || '{}';
                const limits = JSON.parse(stored);
                limits[email] = Date.now();
                localStorage.setItem(CONFIG.rateLimit.key, JSON.stringify(limits));
            } catch (e) {
                console.error('Rate limit save error:', e);
            }
        },

        startCountdown(lastSent, elements) {
            const { timerDiv, timerCount } = elements;
            
            if (timerDiv) {
                timerDiv.classList.add('active');
            }
            
            const updateTimer = () => {
                const elapsed = Date.now() - lastSent;
                const remaining = Math.ceil((CONFIG.rateLimit.duration - elapsed) / 1000);
                
                if (remaining <= 0) {
                    clearInterval(state.countdownInterval);
                    if (timerDiv) timerDiv.classList.remove('active');
                    return;
                }
                
                if (timerCount) {
                    const minutes = Math.floor(remaining / 60);
                    const seconds = remaining % 60;
                    timerCount.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                }
            };
            
            updateTimer();
            state.countdownInterval = setInterval(updateTimer, 1000);
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
                const app = firebase.initializeApp(CONFIG.firebase, "forgotPasswordApp");
                state.db = firebase.firestore(app);
                console.log('Firebase Initialized');
                return true;
            } catch (error) {
                console.error('Firebase Error:', error);
                uiManager.showMessage('Failed to connect to database', 'error');
                return false;
            }
        }
    };

    // ========== VALIDATION ==========
    const validator = {
        email(email) {
            const gmailPattern = /^[a-zA-Z0-9._%-]+@gmail\.com$/;
            return gmailPattern.test(email);
        }
    };

    // ========== EMAIL SENDER ==========
    const emailSender = {
        async send(email) {
            const lastSent = rateLimitManager.get(email);
            
            if (lastSent) {
                const waitTime = Math.ceil((CONFIG.rateLimit.duration - (Date.now() - lastSent)) / 60000);
                return {
                    success: false,
                    message: createMessageWithIcon('warning', `Please wait ${waitTime} minute${waitTime !== 1 ? 's' : ''} before requesting again.`)
                };
            }
            
            try {
                console.log('Looking up email:', email);
                
                const usersRef = state.db.collection('users');
                const userQuery = await usersRef.where('email', '==', email).limit(1).get();
                
                if (userQuery.empty) {
                    console.log('Email not found');
                    return {
                        success: false,
                        message: createMessageWithIcon('error', 'Email not found in our records')
                    };
                }
                
                const userDoc = userQuery.docs[0];
                const userData = userDoc.data();
                
                if (!userData.apiToken) {
                    console.log('No API token assigned');
                    return {
                        success: false,
                        message: createMessageWithIcon('error', 'API token not assigned yet. Please contact admin.')
                    };
                }
                
                console.log('User found:', userData.username);
                
                try {
                    const emailjs = await loadEmailJS();
                    
                    // Format request time
                    const requestTime = new Date().toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true
                    });
                    
                    // Prepare template parameters matching your email template
                    const templateParams = {
                        to_email: email,
                        user_name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username,
                        username: userData.username,
                        api_token: userData.apiToken,
                        login_url: window.location.origin + '/index.html',
                        request_time: requestTime,
                        support_email: 'support@breathsafe.com',
                        support_phone: '+962 79 000 0000'
                    };
                    
                    console.log('Sending email with params:', {
                        user_name: templateParams.user_name,
                        username: templateParams.username,
                        request_time: templateParams.request_time
                    });
                    
                    const response = await emailjs.send(
                        CONFIG.emailJS.serviceId,
                        CONFIG.emailJS.templateId,
                        templateParams
                    );
                    
                    console.log('Email sent successfully!', response);
                    
                    // Set rate limit
                    rateLimitManager.set(email);
                    
                    return {
                        success: true,
                        message: createMessageWithIcon('success', 'API token sent to your email! 📧 Please check your inbox (and spam folder).')
                    };
                    
                } catch (emailError) {
                    console.warn('EmailJS Error:', emailError);
                    
                    // Detailed error logging
                    if (emailError.status === 400) {
                        console.error('400 - Invalid email configuration or parameters');
                    } else if (emailError.status === 401) {
                        console.error('401 - Invalid EmailJS credentials');
                    } else if (emailError.status === 403) {
                        console.error('403 - Authentication failed');
                    } else if (emailError.status === 429) {
                        console.error('429 - Rate limit exceeded');
                    }
                    
                    // Fallback: Show token in dialog
                    showCredentialsModal({
                        username: userData.username,
                        apiToken: userData.apiToken,
                        userName: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || userData.username
                    });
                    
                    rateLimitManager.set(email);
                    
                    return {
                        success: true,
                        message: createMessageWithIcon('info', 'Credentials retrieved! (Email service temporarily unavailable)')
                    };
                }
                
            } catch (error) {
                console.error('Send email error:', error);
                
                let errorMsg = 'Failed to retrieve credentials. ';
                
                if (error.code === 'not-found') {
                    errorMsg = 'Email not found in our records.';
                } else if (error.code === 'permission-denied') {
                    errorMsg = 'Permission denied. Please contact support.';
                } else {
                    errorMsg += 'Please try again or contact support.';
                }
                
                throw new Error(errorMsg);
            }
        }
    };

    // ========== CREDENTIALS MODAL ==========
    function showCredentialsModal(data) {
        const modalHTML = `
            <div id="credentialsModal" style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
                animation: fadeIn 0.3s ease;
            ">
                <div style="
                    background: var(--panel);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 550px;
                    width: 90%;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
                    animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                ">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="
                            width: 80px;
                            height: 80px;
                            background: linear-gradient(135deg, #10b981, #059669);
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin: 0 auto 20px;
                            box-shadow: 0 10px 30px rgba(16,185,129,0.3);
                        ">
                            <i class="fas fa-key" style="font-size: 2rem; color: white;"></i>
                        </div>
                        <h2 style="
                            margin: 0 0 10px 0; 
                            color: var(--text);
                            font-size: 1.75rem;
                            font-weight: 700;
                        ">Your API Credentials</h2>
                        <p style="
                            color: var(--text-muted);
                            margin: 0;
                            font-size: 0.95rem;
                        ">Hello ${data.userName}! Here are your login credentials:</p>
                    </div>
                    
                    <div style="
                        margin: 25px 0; 
                        padding: 20px; 
                        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
                        border: 2px solid rgba(16, 185, 129, 0.3);
                        border-radius: 12px;
                    ">
                        <p style="
                            margin: 0 0 12px 0; 
                            font-size: 0.75rem; 
                            color: var(--primary);
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                        "><i class="fas fa-user"></i> USERNAME</p>
                        <div style="
                            background: var(--panel);
                            padding: 14px;
                            border: 2px solid var(--primary);
                            border-radius: 10px;
                            font-family: 'Monaco', 'Courier New', monospace;
                            font-size: 1.1rem;
                            color: var(--text);
                            word-break: break-all;
                            cursor: pointer;
                            user-select: all;
                            font-weight: 600;
                            transition: all 0.2s;
                        " onclick="this.select()" onmouseover="this.style.borderColor='#059669'" onmouseout="this.style.borderColor='var(--primary)'">${data.username}</div>
                    </div>
                    
                    <div style="
                        margin: 25px 0; 
                        padding: 20px; 
                        background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05));
                        border: 2px solid rgba(16, 185, 129, 0.3);
                        border-radius: 12px;
                    ">
                        <p style="
                            margin: 0 0 12px 0; 
                            font-size: 0.75rem; 
                            color: var(--primary);
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                        "><i class="fas fa-key"></i> API TOKEN</p>
                        <div style="
                            background: var(--panel);
                            padding: 14px;
                            border: 2px dashed var(--primary);
                            border-radius: 10px;
                            font-family: 'Monaco', 'Courier New', monospace;
                            font-size: 1.1rem;
                            color: var(--text);
                            word-break: break-all;
                            cursor: pointer;
                            user-select: all;
                            font-weight: 600;
                            transition: all 0.2s;
                        " onclick="this.select()" onmouseover="this.style.borderColor='#059669'; this.style.borderStyle='solid'" onmouseout="this.style.borderColor='var(--primary)'; this.style.borderStyle='dashed'">${data.apiToken}</div>
                    </div>
                    
                    <div style="
                        background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
                        border: 2px solid rgba(239, 68, 68, 0.3);
                        border-radius: 12px;
                        padding: 18px;
                        margin: 25px 0;
                        text-align: left;
                    ">
                        <p style="
                            font-size: 0.875rem;
                            color: var(--text);
                            margin: 0;
                            line-height: 1.6;
                            display: flex;
                            align-items: start;
                            gap: 10px;
                        ">
                            <i class="fas fa-shield-alt" style="color: var(--danger); margin-top: 3px; font-size: 1rem;"></i>
                            <span><strong>Security Notice:</strong> Keep these credentials secure and never share them with anyone. You'll need them to login to your account.</span>
                        </p>
                    </div>
                    
                    <button onclick="document.getElementById('credentialsModal').remove()" style="
                        width: 100%;
                        padding: 16px;
                        background: linear-gradient(135deg, #10b981, #059669);
                        color: white;
                        border: none;
                        border-radius: 12px;
                        font-weight: 700;
                        font-size: 1rem;
                        cursor: pointer;
                        font-family: inherit;
                        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(16, 185, 129, 0.35)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.25)'">
                        <i class="fas fa-check"></i> Got it, Close
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
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

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
                    if (messageDiv && messageDiv.className.includes('info')) {
                        messageDiv.style.display = 'none';
                    }
                }, 5000);
            }
        },

        resetForm(elements) {
            const { sendBtn, btnContent, btnLoading } = elements;
            
            if (sendBtn) sendBtn.disabled = false;
            if (btnContent) btnContent.style.display = 'flex';
            if (btnLoading) btnLoading.style.display = 'none';
        }
    };

    // ========== FORM HANDLERS ==========
    const formHandlers = {
        async handleSubmit(e, elements) {
            e.preventDefault();
            
            const { emailInput, sendBtn, btnContent, btnLoading, form, timerDiv, timerCount } = elements;
            const email = emailInput.value.trim().toLowerCase();
            
            if (!email) {
                uiManager.showMessage(createMessageWithIcon('warning', 'Please enter your email address'), 'error');
                return;
            }
            
            if (!validator.email(email)) {
                uiManager.showMessage(createMessageWithIcon('warning', 'Please enter a valid Gmail address (@gmail.com)'), 'error');
                return;
            }
            
            // Disable button and show loading
            sendBtn.disabled = true;
            if (btnContent) btnContent.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'flex';
            
            try {
                uiManager.showMessage(createMessageWithIcon('search', 'Searching for your account...'), 'info');
                
                const result = await emailSender.send(email);
                
                if (result.success) {
                    uiManager.showMessage(result.message, 'success');
                    form.reset();
                    
                    const lastSent = rateLimitManager.get(email);
                    if (lastSent) {
                        rateLimitManager.startCountdown(lastSent, { timerDiv, timerCount });
                    }
                    
                    // FIXED: Reset button state after success
                    uiManager.resetForm({ sendBtn, btnContent, btnLoading });
                } else {
                    uiManager.showMessage(result.message, 'error');
                    uiManager.resetForm({ sendBtn, btnContent, btnLoading });
                }
            } catch (error) {
                console.error('Form submission error:', error);
                uiManager.showMessage(createMessageWithIcon('error', error.message), 'error');
                uiManager.resetForm({ sendBtn, btnContent, btnLoading });
            }
        }
    };

    // ========== INITIALIZATION ==========
    async function initialize() {
        console.log('DOM Ready - BreathSafe Forgot Password');
        
        themeManager.load();
        
        const connected = await firebaseManager.init();
        if (!connected) {
            console.error('Failed to initialize Firebase');
            return;
        }
        
        // Try to load EmailJS (non-blocking)
        loadEmailJS().then(() => {
            console.log('EmailJS loaded successfully');
        }).catch((err) => {
            console.warn('EmailJS not available:', err.message);
            uiManager.showMessage(createMessageWithIcon('info', 'Email service unavailable. Credentials will be displayed directly.'), 'info');
        });
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', themeManager.toggle);
        }
        
        const form = document.getElementById('forgotForm');
        const sendBtn = document.getElementById('sendBtn');
        const btnContent = sendBtn?.querySelector('.btn-content');
        const btnLoading = sendBtn?.querySelector('.btn-loading');
        const emailInput = document.getElementById('email');
        const timerDiv = document.getElementById('rateLimitTimer');
        const timerCount = document.getElementById('timerCount');
        
        if (!form || !sendBtn || !emailInput) {
            console.error(' Required elements not found');
            return;
        }
        
        form.addEventListener('submit', (e) => {
            formHandlers.handleSubmit(e, {
                emailInput,
                sendBtn,
                btnContent,
                btnLoading,
                form,
                timerDiv,
                timerCount
            });
        });
        
        emailInput.addEventListener('input', () => {
            const messageDiv = document.getElementById('message');
            if (messageDiv && messageDiv.className.includes('error')) {
                messageDiv.style.display = 'none';
            }
        }, { passive: true });
        
        console.log('BreathSafe Forgot Password Ready - Performance Optimized');
    }

    // ========== START APPLICATION ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();