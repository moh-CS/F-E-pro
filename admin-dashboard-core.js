// ================================
// BREATHSAFE ADMIN DASHBOARD - CORE
// User Management & Firestore Data
// ================================

console.log("🚀 BreathSafe Core Loading...");

// ========== FIREBASE CONFIG ==========
const firestoreConfig = {
    apiKey: "AIzaSyA2M-8B77PYDw6fA-fZXLCOoK_M76reSpU",
    authDomain: "gas-leak-detection-8602a.firebaseapp.com",
    projectId: "gas-leak-detection-8602a",
    storageBucket: "gas-leak-detection-8602a.firebasestorage.app",
    messagingSenderId: "965913006308",
    appId: "1:965913006308:web:d70797bc2fa51fb8b01cf1",
    measurementId: "G-465DRCB5JE"
};

// ========== GLOBAL STATE ==========
// ========== GLOBAL STATE ==========
const STATE = {
    db: null,
    allUsers: [],
    filteredUsers: [],
    selectedUsers: new Set(),
    userCache: new Map(),
    currentAdminId: null, 
    currentAdminUsername: null 
};

// ========== UTILITY FUNCTIONS ==========
function getAvatarVariant(str) {
    if (!str) return 'variant-1';
    const code = str.charCodeAt(0) + str.charCodeAt(str.length - 1);
    return 'variant-' + ((code % 5) + 1);
}

function getInitials(user) {
    if (user.firstName && user.lastName) {
        return (user.firstName[0] + user.lastName[0]).toUpperCase();
    } else if (user.username) {
        return user.username.substring(0, 2).toUpperCase();
    }
    return 'U';
}

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'N/A';
    }
}

function formatDateShort(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return 'N/A';
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// ========== INITIALIZE FIRESTORE ==========
function initFirestore() {
    try {
        const firestoreApp = firebase.initializeApp(firestoreConfig, "firestoreApp");
        STATE.db = firebase.firestore(firestoreApp);
        console.log("✅ Firestore Ready");
        return true;
    } catch (error) {
        console.error("❌ Firestore Error:", error);
        return false;
    }
}

// ========== ADMIN INFO ==========
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


// ========== LOAD CURRENT ADMIN FROM SESSION ==========
async function loadAdminInfo() {
    // Check session first
    const sessionAdmin = checkAdminSession();
    if (!sessionAdmin) return;
    
    console.log('📥 Loading admin from session:', sessionAdmin.username);
    
    // ✅ Store current admin info in STATE
    STATE.currentAdminId = sessionAdmin.id;
    STATE.currentAdminUsername = sessionAdmin.username;
    
    // Try to get fresh data from Firestore
    if (STATE.db) {
        try {
            const snapshot = await STATE.db.collection('admins')
                .where('username', '==', sessionAdmin.username)
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const adminData = {
                    id: snapshot.docs[0].id,
                    ...snapshot.docs[0].data()
                };
                
                // ✅ Update current admin ID with actual Firestore ID
                STATE.currentAdminId = snapshot.docs[0].id;
                
                updateAdminUI(adminData);
                console.log('✅ Admin data loaded from Firestore');
                return;
            }
        } catch (error) {
            console.error('❌ Error loading admin from Firestore:', error);
        }
    }
    
    // Fallback to session data
    updateAdminUI(sessionAdmin);
    console.log('✅ Admin data loaded from session');
}
// ========== UPDATE ADMIN UI ==========
function updateAdminUI(admin) {
    const initials = getInitials(admin);
    const fullName = [admin.firstName, admin.lastName].filter(Boolean).join(' ') || admin.username || 'Admin User';
    
    // Header Avatar
    const headerAvatar = document.getElementById('headerAvatar');
    const headerAvatarText = document.getElementById('headerAvatarText');
    const headerUsername = document.getElementById('headerUsername');
    
    if (headerAvatar) headerAvatar.className = 'avatar-circle';
    if (headerAvatarText) headerAvatarText.textContent = initials;
    if (headerUsername) headerUsername.textContent = admin.username || 'Admin';
    
    // Dropdown Avatar
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownAvatarText = document.getElementById('dropdownAvatarText');
    const dropdownUsername = document.getElementById('dropdownUsername');
    const dropdownEmail = document.getElementById('dropdownEmail');
    
    if (dropdownAvatar) dropdownAvatar.className = 'avatar-circle';
    if (dropdownAvatarText) dropdownAvatarText.textContent = initials;
    if (dropdownUsername) dropdownUsername.textContent = fullName;
    if (dropdownEmail) dropdownEmail.textContent = admin.email || 'No email';
    
    console.log('✅ Admin UI updated for:', fullName);
}

// ========== LOAD USERS ==========
async function loadUsers() {
    console.log("📥 Loading users...");
    
    if (!STATE.db) {
        console.warn("Firestore not ready, using demo data");
        loadDemoUsers();
        return;
    }
    
    try {
        STATE.allUsers = [];
        STATE.userCache.clear();
        
        const [usersSnapshot, adminsSnapshot] = await Promise.all([
            STATE.db.collection('users').orderBy('createdAt', 'desc').get(),
            STATE.db.collection('admins').orderBy('createdAt', 'desc').get()
        ]);
        
        usersSnapshot.forEach(doc => {
            const userData = { id: doc.id, ...doc.data(), isAdmin: false };
            STATE.allUsers.push(userData);
            STATE.userCache.set(doc.id, userData);
        });
        
        adminsSnapshot.forEach(doc => {
            const adminData = {
                id: doc.id,
                username: doc.data().username,
                email: doc.data().email,
                firstName: doc.data().firstName || '',
                lastName: doc.data().lastName || '',
                phoneNumber: doc.data().phoneNumber || '',
                status: 'active',
                createdAt: doc.data().createdAt,
                activatedAt: doc.data().createdAt,
                apiToken: doc.data().apiToken,
                password: doc.data().password,
                role: 'admin',
                isAdmin: true
            };
            STATE.allUsers.push(adminData);
            STATE.userCache.set(doc.id, adminData);
        });
        
        STATE.filteredUsers = [...STATE.allUsers];
        updateStats();
        renderUsers();
        
        console.log(`✅ Loaded ${STATE.allUsers.length} users (${adminsSnapshot.size} admins)`);
    } catch (error) {
        console.error("❌ Load error:", error);
        loadDemoUsers();
    }
}

function loadDemoUsers() {
    STATE.allUsers = [
        {
            id: '1',
            username: 'john_doe',
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe',
            phoneNumber: '+1234567890',
            status: 'active',
            createdAt: new Date(),
            activatedAt: new Date(),
            apiToken: 'user_demo123456789',
            isAdmin: false
        },
        {
            id: '2',
            username: 'admin',
            email: 'admin@breathsafe.com',
            firstName: 'Admin',
            lastName: 'User',
            phoneNumber: '+1987654321',
            status: 'active',
            createdAt: new Date(),
            activatedAt: new Date(),
            apiToken: 'admin_demo987654321',
            role: 'admin',
            isAdmin: true
        }
    ];
    
    STATE.allUsers.forEach(u => STATE.userCache.set(u.id, u));
    STATE.filteredUsers = [...STATE.allUsers];
    updateStats();
    renderUsers();
}

// ========== UPDATE STATS ==========
function updateStats() {
    const total = STATE.allUsers.length;
    const active = STATE.allUsers.filter(u => u.status === 'active').length;
    const pending = STATE.allUsers.filter(u => !u.status || u.status === 'pending').length;
    
    const totalEl = document.getElementById('totalUsers');
    const activeEl = document.getElementById('activeUsers');
    const pendingEl = document.getElementById('pendingUsers');
    
    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (pendingEl) pendingEl.textContent = pending;
}

// ========== RENDER USERS ==========
// ========== RENDER USERS ==========
function renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (STATE.filteredUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-cell">
                    <i class="fas fa-users" style="font-size: 3rem; color: var(--muted); margin-bottom: 1rem; display: block;"></i>
                    <span class="muted">No users found</span>
                </td>
            </tr>
        `;
        return;
    }
    
    const rowsHTML = STATE.filteredUsers.map(user => {
        const initials = getInitials(user);
        const variant = getAvatarVariant(user.username);
        const isAdmin = user.role === 'admin' || user.isAdmin;
        const isSelected = STATE.selectedUsers.has(user.id);
        
        // ✅ Check if this is the current logged-in admin
        const isCurrentAdmin = user.id === STATE.currentAdminId || 
                              user.username === STATE.currentAdminUsername;
        
        return `
            <tr data-user-id="${user.id}" ${isCurrentAdmin ? 'class="current-admin-row"' : ''}>
                <td onclick="event.stopPropagation()">
                    ${isCurrentAdmin ? 
                        `<input type="checkbox" class="user-checkbox" data-user-id="${user.id}" disabled title="You cannot delete your own account">` :
                        `<input type="checkbox" class="user-checkbox" data-user-id="${user.id}" ${isSelected ? 'checked' : ''}>`
                    }
                </td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-table">
                            <div class="user-initials-table ${variant}">${initials}</div>
                            ${isAdmin ? '<span class="admin-badge-table"><i class="fas fa-shield-alt"></i></span>' : ''}
                        </div>
                        <span class="user-name-table">
                            ${user.username || 'Unknown'}
                            ${isCurrentAdmin ? ' <span style="color: var(--primary); font-weight: 600;">(You)</span>' : ''}
                        </span>
                    </div>
                </td>
                <td>${user.email || 'N/A'}</td>
                <td>
                    <span class="role-badge ${isAdmin ? 'admin' : 'user'}">
                        ${isAdmin ? '<i class="fas fa-shield-alt"></i>' : '<i class="fas fa-user"></i>'}
                        ${isAdmin ? 'Admin' : 'User'}
                    </span>
                </td>
                <td>
                    <span class="status-badge ${(user.status || 'pending').toLowerCase()}" 
                          ${!isCurrentAdmin ? `onclick="toggleUserStatus(event, '${user.id}')"` : ''}
                          ${!isCurrentAdmin ? 'title="Click to toggle status"' : 'title="You cannot change your own status"'}
                          style="${isCurrentAdmin ? 'cursor: not-allowed; opacity: 0.7;' : ''}">
                        <i class="fas fa-circle"></i>
                        ${user.status || 'Pending'}
                    </span>
                </td>
                <td class="muted">${formatDateShort(user.createdAt)}</td>
                <td onclick="event.stopPropagation()">
                    ${user.status !== 'active' && !isAdmin && !isCurrentAdmin ? 
                        `<button class="table-action-btn" onclick="activateUser('${user.id}')">Activate</button>` : 
                        '<span style="color: var(--primary); font-size: 1.2rem;">✓</span>'}
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = rowsHTML;
    
    // Attach event listeners
    tbody.querySelectorAll('tr[data-user-id]').forEach(row => {
        row.addEventListener('click', (e) => {
            if (e.target.closest('input[type="checkbox"]') || 
                e.target.closest('.status-badge') || 
                e.target.closest('button') ||
                e.target.closest('.table-action-btn')) {
                return;
            }
            showUserDetails(row.dataset.userId);
        });
    });
    
    //  Only attach change listener to enabled checkboxes
    tbody.querySelectorAll('.user-checkbox:not([disabled])').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const userId = e.target.dataset.userId;
            if (e.target.checked) {
                STATE.selectedUsers.add(userId);
            } else {
                STATE.selectedUsers.delete(userId);
            }
        });
    });
}
// ========== FILTER USERS ==========
function filterUsers() {
    const searchInput = document.getElementById('searchUsers');
    const filterRole = document.getElementById('filterRole');
    const filterStatus = document.getElementById('filterStatus');
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const roleFilter = filterRole ? filterRole.value : 'all';
    const statusFilter = filterStatus ? filterStatus.value : 'all';
    
    STATE.filteredUsers = STATE.allUsers.filter(user => {
        const matchesSearch = 
            (user.username && user.username.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.firstName && user.firstName.toLowerCase().includes(searchTerm)) ||
            (user.lastName && user.lastName.toLowerCase().includes(searchTerm));
        
        const matchesStatus = 
            statusFilter === 'all' || 
            (user.status || 'pending').toLowerCase() === statusFilter;
        
        const isAdmin = user.role === 'admin' || user.isAdmin;
        const matchesRole = 
            roleFilter === 'all' ||
            (roleFilter === 'admin' && isAdmin) ||
            (roleFilter === 'user' && !isAdmin);
        
        return matchesSearch && matchesStatus && matchesRole;
    });
    
    renderUsers();
}

// ========== TOGGLE USER STATUS ==========
window.toggleUserStatus = function(event, userId) {
    event.stopPropagation();
    
    // ✅ Check if trying to toggle own status
    if (userId === STATE.currentAdminId) {
        showToast('You cannot change your own status', 'error');
        return;
    }
    
    const user = STATE.userCache.get(userId);
    if (!user || user.isAdmin) return;
    
    const newStatus = user.status === 'active' ? 'pending' : 'active';
    
    if (!STATE.db) {
        user.status = newStatus;
        renderUsers();
        showToast(`Status changed to ${newStatus}`, 'success');
        return;
    }
    
    STATE.db.collection('users').doc(userId).update({
        status: newStatus,
        activatedAt: newStatus === 'active' ? firebase.firestore.FieldValue.serverTimestamp() : null
    })
    .then(() => {
        user.status = newStatus;
        if (newStatus === 'active') user.activatedAt = new Date();
        renderUsers();
        updateStats();
        showToast(`Status changed to ${newStatus}`, 'success');
    })
    .catch(error => {
        console.error(error);
        showToast('Failed to update status', 'error');
    });
};
// ========== ACTIVATE USER ==========
window.activateUser = function(userId) {
    const user = STATE.userCache.get(userId);
    if (!user) return;
    
    if (!STATE.db) {
        user.status = 'active';
        renderUsers();
        updateStats();
        showToast('User activated', 'success');
        return;
    }
    
    STATE.db.collection('users').doc(userId).update({
        status: 'active',
        activatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        user.status = 'active';
        user.activatedAt = new Date();
        renderUsers();
        updateStats();
        showToast('User activated', 'success');
    })
    .catch(error => {
        console.error(error);
        showToast('Failed to activate user', 'error');
    });
};

// ========== USER DETAILS MODAL ==========
function showUserDetails(userId) {
    const user = STATE.userCache.get(userId);
    if (!user) return;
    
    const isAdmin = user.role === 'admin' || user.isAdmin;
    const initials = getInitials(user);
    const variant = getAvatarVariant(user.username);
    
    const userDetailsAvatar = document.getElementById('userDetailsAvatar');
    const userDetailsInitials = document.getElementById('userDetailsInitials');
    const userDetailsBadge = document.getElementById('userDetailsBadge');
    
    if (userDetailsAvatar) userDetailsAvatar.className = 'avatar-circle-large ' + variant;
    if (userDetailsInitials) userDetailsInitials.textContent = initials;
    if (userDetailsBadge) {
        if (isAdmin) {
            userDetailsBadge.innerHTML = '<i class="fas fa-shield-alt"></i>';
            userDetailsBadge.classList.remove('hidden');
        } else {
            userDetailsBadge.classList.add('hidden');
        }
    }
    
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || 'Unknown User';
    const userDetailsName = document.getElementById('userDetailsName');
    const userDetailsEmail = document.getElementById('userDetailsEmail');
    
    if (userDetailsName) userDetailsName.textContent = fullName;
    if (userDetailsEmail) userDetailsEmail.textContent = user.email || 'No email';
    
    const details = {
        detailUsername: user.username || 'N/A',
        detailFirstName: user.firstName || 'N/A',
        detailLastName: user.lastName || 'N/A',
        detailEmail: user.email || 'N/A',
        detailPhone: user.phoneNumber || 'N/A',
        detailCreatedAt: formatDate(user.createdAt),
        detailActivatedAt: formatDate(user.activatedAt),
        detailApiToken: user.apiToken || 'Not generated'
    };
    
    Object.keys(details).forEach(key => {
        const el = document.getElementById(key);
        if (el) el.textContent = details[key];
    });
    
    const detailRole = document.getElementById('detailRole');
    if (detailRole) {
        detailRole.innerHTML = isAdmin ? 
            '<span class="role-badge admin"><i class="fas fa-shield-alt"></i> Administrator</span>' :
            '<span class="role-badge user"><i class="fas fa-user"></i> User</span>';
    }
    
    const detailStatus = document.getElementById('detailStatus');
    if (detailStatus) {
        detailStatus.innerHTML = `
            <span class="status-badge ${(user.status || 'pending').toLowerCase()}">
                <i class="fas fa-circle"></i> ${user.status || 'Pending'}
            </span>
        `;
    }
    
    const copyTokenBtn = document.getElementById('copyTokenBtn');
    if (copyTokenBtn) copyTokenBtn.dataset.token = user.apiToken || '';
    
    document.getElementById('userDetailsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeUserDetailsFunc() {
    document.getElementById('userDetailsModal').classList.remove('active');
    document.body.style.overflow = '';
}

function copyApiToken() {
    const token = document.getElementById('copyTokenBtn').dataset.token;
    if (!token || token === 'Not generated') {
        showToast('No token to copy', 'error');
        return;
    }
    
    navigator.clipboard.writeText(token)
        .then(() => showToast('API Token copied!', 'success'))
        .catch(() => showToast('Failed to copy', 'error'));
}

// ========== DELETE USERS ==========
function deleteSelected() {
    if (STATE.selectedUsers.size === 0) {
        showToast('Please select users to delete', 'error');
        return;
    }
    
    // ✅ Remove current admin from selection if accidentally included
    if (STATE.currentAdminId && STATE.selectedUsers.has(STATE.currentAdminId)) {
        STATE.selectedUsers.delete(STATE.currentAdminId);
        showToast('You cannot delete your own account', 'warning');
        
        if (STATE.selectedUsers.size === 0) {
            showToast('No other users selected for deletion', 'error');
            return;
        }
    }
    
    console.log('Opening delete modal for', STATE.selectedUsers.size, 'users');
    openDeleteConfirmModal();
}

function openDeleteConfirmModal() {
    const count = STATE.selectedUsers.size;
    const deleteCountEl = document.getElementById('deleteCount');
    const modal = document.getElementById('deleteConfirmModal');
    
    if (deleteCountEl) deleteCountEl.textContent = count;
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        console.log('Delete modal opened');
    } else {
        console.error('Delete modal not found!');
    }
}

function closeDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
        console.log('Delete modal closed');
    }
}

function confirmDelete() {
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const originalText = confirmBtn.innerHTML;
    
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    // ✅ Final safety check - remove current admin if present
    if (STATE.currentAdminId) {
        STATE.selectedUsers.delete(STATE.currentAdminId);
    }
    
    if (STATE.selectedUsers.size === 0) {
        closeDeleteConfirmModal();
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
        showToast('No users to delete', 'error');
        return;
    }
    
    if (!STATE.db) {
        const count = STATE.selectedUsers.size;
        STATE.allUsers = STATE.allUsers.filter(u => !STATE.selectedUsers.has(u.id));
        STATE.selectedUsers.forEach(id => STATE.userCache.delete(id));
        STATE.selectedUsers.clear();
        filterUsers();
        updateStats();
        
        closeDeleteConfirmModal();
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
        showToast(`✅ ${count} user(s) deleted successfully`, 'success');
        return;
    }
    
    const promises = [];
    STATE.selectedUsers.forEach(id => {
        // ✅ Double-check not deleting current admin
        if (id === STATE.currentAdminId) {
            console.warn('Prevented self-deletion attempt for admin:', id);
            return;
        }
        
        const user = STATE.userCache.get(id);
        if (user && user.isAdmin) {
            promises.push(STATE.db.collection('admins').doc(id).delete());
        } else {
            promises.push(STATE.db.collection('users').doc(id).delete());
        }
    });
    
    Promise.all(promises)
        .then(() => {
            const count = promises.length;
            STATE.allUsers = STATE.allUsers.filter(u => !STATE.selectedUsers.has(u.id));
            STATE.selectedUsers.forEach(id => STATE.userCache.delete(id));
            STATE.selectedUsers.clear();
            filterUsers();
            updateStats();
            
            closeDeleteConfirmModal();
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
            showToast(`✅ ${count} user(s) deleted successfully`, 'success');
        })
        .catch(error => {
            console.error(error);
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalText;
            showToast('Failed to delete users', 'error');
        });
}

// ========== EXPORT CSV ==========
function exportCSV() {
    if (STATE.filteredUsers.length === 0) {
        showToast('No users to export', 'error');
        return;
    }
    
    const headers = [
        'Username', 'First Name', 'Last Name', 'Email', 'Phone Number',
        'Role', 'Status', 'API Token', 'Created At', 'Activated At'
    ];
    
    const rows = STATE.filteredUsers.map(u => {
        const isAdmin = u.role === 'admin' || u.isAdmin;
        return [
            u.username || '',
            u.firstName || '',
            u.lastName || '',
            u.email || '',
            u.phoneNumber || '',
            isAdmin ? 'Administrator' : 'User',
            u.status || 'pending',
            u.apiToken || '',
            formatDate(u.createdAt),
            formatDate(u.activatedAt)
        ];
    });
    
    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `breathsafe-users-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('CSV exported successfully', 'success');
}

// ========== ADD ADMIN MODAL ==========
function openAddAdminModal() {
    document.getElementById('addAdminModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAddAdminModal() {
    document.getElementById('addAdminModal').classList.remove('active');
    document.body.style.overflow = '';
    document.getElementById('addAdminForm').reset();
}

// ========== API TOKEN GENERATOR ==========
async function generateUniqueApiTokenChecked(db) {
    let token;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 50;
    
    while (!isUnique && attempts < maxAttempts) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let prefix = '';
        for (let i = 0; i < 3; i++) {
            prefix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        token = `${prefix}-ADMIN-MASTER`;
        
        const adminTokenQuery = await db.collection('admins')
            .where('apiToken', '==', token)
            .get();
        
        const userTokenQuery = await db.collection('users')
            .where('apiToken', '==', token)
            .get();
        
        if (adminTokenQuery.empty && userTokenQuery.empty) {
            isUnique = true;
        } else {
            attempts++;
        }
    }
    
    if (!isUnique) {
        throw new Error('Failed to generate unique API token after multiple attempts');
    }
    
    return token;
}

// ========== HANDLE ADD ADMIN ==========
async function handleAddAdmin(e) {
    e.preventDefault();
    
    const username = document.getElementById('adminUsername').value.trim();
    const firstName = document.getElementById('adminFirstName').value.trim();
    const lastName = document.getElementById('adminLastName').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const phone = document.getElementById('adminPhone').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    if (!username || !email || !password || !firstName || !lastName) {
        showToast('Please fill all required fields', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    if (phone) {
        const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
        if (!phoneRegex.test(phone)) {
            showToast('Please enter a valid phone number', 'error');
            return;
        }
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (!STATE.db) {
        showToast('Firebase not connected', 'error');
        return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validating...';
    
    try {
        console.log('Checking username uniqueness...');
        
        const adminUsernameQuery = await STATE.db.collection('admins')
            .where('username', '==', username)
            .get();
        
        if (!adminUsernameQuery.empty) {
            showToast('❌ Username already exists in admins!', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
        }
        
        const userUsernameQuery = await STATE.db.collection('users')
            .where('username', '==', username)
            .get();
        
        if (!userUsernameQuery.empty) {
            showToast('❌ Username already exists in users!', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
        }
        
        console.log('Checking email uniqueness...');
        
        const adminEmailQuery = await STATE.db.collection('admins')
            .where('email', '==', email)
            .get();
        
        if (!adminEmailQuery.empty) {
            showToast('❌ Email already exists in admins!', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
        }
        
        const userEmailQuery = await STATE.db.collection('users')
            .where('email', '==', email)
            .get();
        
        if (!userEmailQuery.empty) {
            showToast('❌ Email already exists in users!', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
        }
        
        if (phone) {
            console.log('Checking phone number uniqueness...');
            
            const adminPhoneQuery = await STATE.db.collection('admins')
                .where('phoneNumber', '==', phone)
                .get();
            
            if (!adminPhoneQuery.empty) {
                showToast('❌ Phone number already linked to another admin account!', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                return;
            }
            
            const userPhoneQuery = await STATE.db.collection('users')
                .where('phoneNumber', '==', phone)
                .get();
            
            if (!userPhoneQuery.empty) {
                showToast('❌ Phone number already linked to another user account!', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
                return;
            }
        }
        
        console.log('Generating unique API token...');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Token...';
        
        let apiToken;
        try {
            apiToken = await generateUniqueApiTokenChecked(STATE.db);
            console.log('✅ Generated API Token:', apiToken);
        } catch (tokenError) {
            console.error('API Token generation failed:', tokenError);
            showToast('Failed to generate API token', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
        }
        
        console.log('All validations passed. Creating admin...');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Admin...';
        
        await STATE.db.collection('admins').add({
            username,
            firstName,
            lastName,
            email,
            phoneNumber: phone || '',
            password,
            apiToken,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Admin created successfully');
        console.log('✅ API Token:', apiToken);
        
        await loadUsers();
        closeAddAdminModal();
        showToast(`✅ Administrator "${username}" created successfully!\n🔑 API Token: ${apiToken}`, 'success');
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
        
    } catch (error) {
        console.error('❌ Error creating admin:', error);
        showToast('Failed to create administrator: ' + error.message, 'error');
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
}

// ========== THEME ==========
function toggleTheme() {
    document.body.classList.toggle('dark');
    document.body.classList.toggle('light');
    
    const isDark = document.body.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = isDark ? 'fas fa-moon' : 'fas fa-sun';
}

function loadTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.body.classList.add(theme);
    
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

// ========== EVENT LISTENERS (USER MANAGEMENT) ==========
function setupCoreEventListeners() {
    // User Menu
    const userMenu = document.getElementById('userMenu');
    if (userMenu) {
        userMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            userMenu.classList.toggle('active');
        });
    }
    
    document.addEventListener('click', () => {
        if (userMenu) userMenu.classList.remove('active');
    });
    
    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    
    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to logout?')) {
                window.location.href = 'breathsafe-admin-login.html';
            }
        });
    }
    
    // Search & Filters
    const searchUsers = document.getElementById('searchUsers');
    const filterRole = document.getElementById('filterRole');
    const filterStatus = document.getElementById('filterStatus');
    
    if (searchUsers) searchUsers.addEventListener('input', filterUsers);
    if (filterRole) filterRole.addEventListener('change', filterUsers);
    if (filterStatus) filterStatus.addEventListener('change', filterUsers);
    
    // Actions
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const selectAll = document.getElementById('selectAll');
    
    if (exportCsvBtn) exportCsvBtn.addEventListener('click', exportCSV);
    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', deleteSelected);
    if (selectAll) {
    selectAll.addEventListener('change', (e) => {
        if (e.target.checked) {
            STATE.filteredUsers.forEach(u => {
                // ✅ Don't select current admin
                if (u.id !== STATE.currentAdminId) {
                    STATE.selectedUsers.add(u.id);
                }
            });
        } else {
            STATE.selectedUsers.clear();
        }
        renderUsers();
    });
}
    
    // Refresh
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => location.reload());
    
    // Add Admin Modal
    const addAdminBtn = document.getElementById('addAdminBtn');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const modalBackdrop = document.getElementById('modalBackdrop');
    const addAdminForm = document.getElementById('addAdminForm');
    
    if (addAdminBtn) addAdminBtn.addEventListener('click', openAddAdminModal);
    if (closeModal) closeModal.addEventListener('click', closeAddAdminModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddAdminModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeAddAdminModal);
    if (addAdminForm) addAdminForm.addEventListener('submit', handleAddAdmin);
    
    // User Details Modal
    const closeUserDetailsModal = document.getElementById('closeUserDetailsModal');
    const closeUserDetailsBtn = document.getElementById('closeUserDetailsBtn');
    const userDetailsBackdrop = document.getElementById('userDetailsBackdrop');
    const copyTokenBtn = document.getElementById('copyTokenBtn');
    
    if (closeUserDetailsModal) closeUserDetailsModal.addEventListener('click', closeUserDetailsFunc);
    if (closeUserDetailsBtn) closeUserDetailsBtn.addEventListener('click', closeUserDetailsFunc);
    if (userDetailsBackdrop) userDetailsBackdrop.addEventListener('click', closeUserDetailsFunc);
    if (copyTokenBtn) copyTokenBtn.addEventListener('click', copyApiToken);
    
    // Delete Confirmation Modal
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    const deleteBackdrop = document.getElementById('deleteBackdrop');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    if (closeDeleteModal) closeDeleteModal.addEventListener('click', closeDeleteConfirmModal);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
    if (deleteBackdrop) deleteBackdrop.addEventListener('click', closeDeleteConfirmModal);
    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDelete);
}

// ========== INITIALIZE CORE ==========
function initCore() {
    console.log("✅ Core Initializing...");
    loadTheme();
    initFirestore();
    setupCoreEventListeners();
    loadAdminInfo();
    loadUsers();
    console.log("✅ Core Ready");
}

console.log("✅ BreathSafe Core Loaded");
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
// ========== VISIBILITY CHECK FOR CRITICAL BUTTONS ==========
function checkCriticalElements() {
    const criticalElements = [
        { id: 'addAdminBtn', name: 'Add Admin Button' },
        { id: 'refreshBtn', name: 'Refresh Button' },
        { id: 'exportCsvBtn', name: 'Export CSV Button' },
        { id: 'deleteSelectedBtn', name: 'Delete Selected Button' }
    ];
    
    criticalElements.forEach(element => {
        const el = document.getElementById(element.id);
        if (el) {
            const isVisible = el.offsetParent !== null;
            const computed = window.getComputedStyle(el);
            
            if (!isVisible || computed.display === 'none' || computed.visibility === 'hidden') {
                console.warn(`⚠️ ${element.name} is not visible!`);
                
                // Force visibility
                el.style.display = 'inline-flex';
                el.style.visibility = 'visible';
                el.style.opacity = '1';
            } else {
                console.log(`✅ ${element.name} is visible`);
            }
        } else {
            console.error(`❌ ${element.name} not found in DOM!`);
        }
    });
}

// Call after DOM is loaded
setTimeout(checkCriticalElements, 100);
// ========== TABLE VIEW TOGGLES ==========
function addTableViewToggles() {
    // Create view toggle buttons
   
       
    
    // Toggle condensed view
    document.getElementById('toggleCondensedView')?.addEventListener('click', () => {
        document.body.classList.toggle('condensed-view');
        const icon = document.querySelector('#toggleCondensedView i');
        if (document.body.classList.contains('condensed-view')) {
            icon.className = 'fas fa-expand';
            showToast('Condensed view enabled', 'info');
        } else {
            icon.className = 'fas fa-compress';
            showToast('Normal view restored', 'info');
        }
    });
    
    // Toggle table focus mode
    document.getElementById('toggleTableFocus')?.addEventListener('click', () => {
        document.body.classList.toggle('table-focus');
        const icon = document.querySelector('#toggleTableFocus i');
        if (document.body.classList.contains('table-focus')) {
            icon.className = 'fas fa-compress-alt';
            showToast('Table focus mode enabled', 'info');
        } else {
            icon.className = 'fas fa-expand';
            showToast('Normal layout restored', 'info');
        }
    });
}

