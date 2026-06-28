/* =====================================================
   ADMIN DASHBOARD - SCRIPT
   All data comes from PHP APIs (no hardcoded data).
   ===================================================== */

const API_BASE = '../php/';
const LOGIN_PAGE = 'login_page.html';

/* ──────────────────────────────────────────────────────
   API HELPER
   ────────────────────────────────────────────────────── */
async function api(file, action, { method = 'GET', body, params } = {}) {
    let url = `${API_BASE}${file}?action=${encodeURIComponent(action)}`;
    if (params) {
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined && v !== null && v !== '') {
                url += `&${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
            }
        }
    }
    try {
        const res = await fetch(url, {
            method,
            credentials: 'same-origin',
            headers: body ? { 'Content-Type': 'application/json' } : {},
            body: body ? JSON.stringify(body) : null,
        });
        if (res.status === 401) {
            window.location.href = LOGIN_PAGE;
            return { success: false, message: 'Not logged in' };
        }
        if (res.status === 403) {
            const j = await res.json().catch(() => ({}));
            return { success: false, message: j.message || 'Forbidden' };
        }
        return await res.json();
    } catch (err) {
        console.error('API error:', err);
        return { success: false, message: 'Network error: ' + err.message };
    }
}

/* ──────────────────────────────────────────────────────
   TOAST
   ────────────────────────────────────────────────────── */
function showToast(message, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    c.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'slideInRight 0.3s reverse';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

/* ──────────────────────────────────────────────────────
   STATE
   ────────────────────────────────────────────────────── */
let currentUser  = null;
let requestsData = [];
let allBookings  = [];
let spacesData   = [];
let usersData    = [];
let calendarEvents = [];

/* ──────────────────────────────────────────────────────
   THEME
   ────────────────────────────────────────────────────── */
function getTheme() { return localStorage.getItem('bsu-theme') || 'light'; }
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('bsu-theme', theme);
    const icon = document.getElementById('themeIcon');
    const sw   = document.getElementById('themeSwitch');
    if (theme === 'dark') {
        if (icon) icon.className = 'fas fa-sun';
        if (sw) sw.classList.add('active');
    } else {
        if (icon) icon.className = 'fas fa-moon';
        if (sw) sw.classList.remove('active');
    }
}
function toggleTheme() {
    const next = getTheme() === 'light' ? 'dark' : 'light';
    applyTheme(next);
    showToast(`Switched to ${next} mode`, 'info');
}

/* ──────────────────────────────────────────────────────
   SESSION + LOGOUT
   ────────────────────────────────────────────────────── */
async function loadSession() {
    const r = await api('user_profile.php', 'me');
    if (!r.success) {
        window.location.href = LOGIN_PAGE;
        return null;
    }
    // Staff dashboard: shared by Admin and Moderator. Students get their own view.
    if (r.data.role === 'Student') {
        window.location.href = 'user_dashboard.html';
        return null;
    }
    if (r.data.role !== 'Admin' && r.data.role !== 'Moderator') {
        window.location.href = LOGIN_PAGE;
        return null;
    }
    currentUser = r.data;
    document.querySelectorAll('.user-name').forEach(el => el.textContent = currentUser.full_name);
    document.querySelectorAll('.avatar').forEach(el => el.textContent = currentUser.initials || currentUser.full_name.charAt(0));

    // Populate dropdown name + email
    const ddName  = document.querySelector('.dropdown-user-name');
    const ddEmail = document.querySelector('.dropdown-user-email');
    if (ddName)  ddName.textContent  = currentUser.full_name;
    if (ddEmail) ddEmail.textContent = currentUser.email;

    // Update role pill
    const roleText = document.getElementById('roleText');
    const rolePill = document.getElementById('rolePill');
    if (roleText) roleText.textContent = currentUser.role;
    if (rolePill && currentUser.role === 'Moderator') {
        rolePill.style.background = 'rgba(59,182,247,0.2)';
        rolePill.style.borderColor = 'rgba(59,182,247,0.4)';
        const span = rolePill.querySelector('span');
        if (span) span.style.color = '#93C5FD';
    }

    // Moderators share this dashboard with Admins. User Management is Admin-only
    // (gated server-side), so hide its nav item for Moderators to avoid a dead link.
    if (currentUser.role !== 'Admin') {
        const navUsers = document.getElementById('navUserManagement');
        if (navUsers) navUsers.style.display = 'none';
    }

    return currentUser;
}
async function handleLogout() {
    if (!confirm('Logout?')) return;
    await api('auth.php', 'logout', { method: 'POST' });
    window.location.href = LOGIN_PAGE;
}

/* ──────────────────────────────────────────────────────
   DATA LOADERS
   ────────────────────────────────────────────────────── */
async function loadRequests() {
    const r = await api('admin_bookings.php', 'get_booking_requests');
    if (!r.success) { showToast(r.message, 'error'); return; }
    requestsData = (r.data || []).map((b, i) => ({ ...b, no: i + 1 }));
    renderReqTable();
}
async function loadAllBookings() {
    const r = await api('admin_bookings.php', 'get_all_bookings');
    if (!r.success) { showToast(r.message, 'error'); return; }
    allBookings = (r.data || []).map((b, i) => ({ ...b, no: i + 1 }));
    renderAllBookingsTable();
}
async function loadSpaces() {
    const r = await api('admin_spaces.php', 'get_spaces');
    if (!r.success) { showToast(r.message, 'error'); return; }
    spacesData = r.data || [];
    renderSpaceList();
}
async function loadUsers() {
    if (currentUser?.role !== 'Admin') {
        // Moderators can't access this endpoint — show informational state
        usersData = [];
        const tbody = document.getElementById('userTableBody');
        if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="6">Only Admin role can manage users.</td></tr>';
        return;
    }
    const r = await api('admin_users.php', 'get_users');
    if (!r.success) { showToast(r.message, 'error'); return; }
    usersData = r.data || [];
    renderUserList();
}
async function loadStats() {
    // Pulls the rich KPI numbers powered by analytics.php?action=admin_rich_stats
    const r = await api('analytics.php', 'admin_rich_stats');
    if (!r.success) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('pendingCount',     r.data.pending);
    set('approvedCount',    r.data.approved);
    set('totalSpacesCount', r.data.spaces);
    set('hoursScheduled7d', r.data.hours_scheduled_7d + 'h');
    set('pendingSub',       `${r.data.this_week_bookings} submitted in 7 days`);
    set('participantsSub',  `${r.data.active_participants} participants active`);
    const bd = document.getElementById('bellDot');
    if (bd) bd.style.display = r.data.pending > 0 ? 'block' : 'none';
}
async function loadCalendar() {
    const r = await api('admin_bookings.php', 'get_calendar_events');
    if (!r.success) return;
    calendarEvents = r.data || [];
    populateCalRoomFilter();
    renderDashCal();
    renderCal2();
}

/* ──────────────────────────────────────────────────────
   ACTIONS (approve / reject / CRUD)
   ────────────────────────────────────────────────────── */
async function approveRequest(id) {
    if (!confirm('Approve this booking?')) return;
    const r = await api('admin_bookings.php', 'approve_request',
        { method: 'POST', body: { booking_id: id } });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) { loadRequests(); loadAllBookings(); loadStats(); loadCalendar(); }
}
async function rejectRequest(id) {
    const reason = prompt('Rejection reason (optional):') ?? '';
    const r = await api('admin_bookings.php', 'reject_request',
        { method: 'POST', body: { booking_id: id, reason } });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) { loadRequests(); loadAllBookings(); loadStats(); loadCalendar(); }
}
async function adminCancelBooking(id) {
    if (!confirm('Cancel this booking?')) return;
    const r = await api('admin_bookings.php', 'cancel_booking',
        { method: 'POST', body: { booking_id: id } });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) { loadRequests(); loadAllBookings(); loadStats(); loadCalendar(); }
}
async function viewBookingDetail(id) {
    const r = await api('admin_bookings.php', 'get_booking_detail', { params: { booking_id: id } });
    if (!r.success) { showToast(r.message, 'error'); return; }
    const b = r.data;
    document.getElementById('modalBody').innerHTML = `
        <div class="detail-row-modal"><span class="detail-label">Applicant</span><span class="detail-value">${b.applicant}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Student/Staff No</span><span class="detail-value">${b.student_no || '—'}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Email</span><span class="detail-value">${b.email}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Phone</span><span class="detail-value">${b.phone || '—'}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Event</span><span class="detail-value">${b.event_name || b.reservation_title}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Space</span><span class="detail-value">${b.space_code} — ${b.space_name}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Category</span><span class="detail-value">${b.category}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Dates</span><span class="detail-value">${b.start_date} → ${b.end_date}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Time</span><span class="detail-value">${b.start_time || '—'} - ${b.end_time || '—'}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Participants</span><span class="detail-value">${b.total_participants}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Department</span><span class="detail-value">${b.department || '—'}</span></div>
        <div class="detail-row-modal"><span class="detail-label">Status</span><span class="detail-value"><span class="status-badge ${statusClass(b.status)}">${b.status}</span></span></div>
        <div class="detail-row-modal"><span class="detail-label">Review Notes</span><span class="detail-value">${b.review_notes || '—'}</span></div>
    `;
    document.getElementById('detailsModal').classList.add('show');
}

function statusClass(s) {
    s = (s || '').toLowerCase();
    if (s === 'approved')    return 'status-approved';
    if (s === 'pending')     return 'status-pending';
    if (s === 'in progress') return 'status-pending';
    if (s === 'rejected' || s === 'cancelled') return 'status-rejected';
    return 'status-pending';
}

/* ──────────────────────────────────────────────────────
   TABLE RENDERING
   ────────────────────────────────────────────────────── */
function filterRows(rows, term) {
    if (!term) return rows;
    const q = term.toLowerCase();
    return rows.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
}

function renderReqTable() {
    const tbody = document.getElementById('reqTableBody');
    if (!tbody) return;
    const search = (document.getElementById('reqSearchInput')?.value || '');
    const data = filterRows(requestsData, search);
    if (!data.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No pending requests.</td></tr>';
    } else {
        tbody.innerHTML = data.map(b => `
            <tr>
                <td>${b.no}</td>
                <td>${b.applicant}</td>
                <td>${b.event_name || b.reservation_title}</td>
                <td>${b.space_code} — ${b.space_name}</td>
                <td>${b.start_date}</td>
                <td><span class="status-badge ${statusClass(b.status)}">${b.status}</span></td>
                <td><div class="action-btns">
                    <button class="action-btn view-btn" title="View" onclick="viewBookingDetail(${b.id})"><i class="fas fa-eye"></i></button>
                    <button class="action-btn approve-btn" title="Approve" onclick="approveRequest(${b.id})"><i class="fas fa-check"></i></button>
                    <button class="action-btn reject-btn" title="Reject" onclick="rejectRequest(${b.id})"><i class="fas fa-times"></i></button>
                </div></td>
            </tr>`).join('');
    }
    document.getElementById('reqShowingInfo').textContent =
        `Showing 1 to ${data.length} of ${data.length} entries`;
}

function renderAllBookingsTable() {
    const tbody = document.getElementById('allBookingsBody');
    if (!tbody) return;
    const search = (document.getElementById('allSearchInput')?.value || '');
    const data = filterRows(allBookings, search);
    if (!data.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No bookings.</td></tr>';
    } else {
        tbody.innerHTML = data.map(b => `
            <tr>
                <td>${b.no}</td>
                <td>${b.applicant}</td>
                <td>${b.event_name || b.reservation_title}</td>
                <td>${b.space_code} — ${b.space_name}</td>
                <td>${b.start_date}</td>
                <td>${b.end_date}</td>
                <td><span class="status-badge ${statusClass(b.status)}">${b.status}</span></td>
                <td><div class="action-btns">
                    <button class="action-btn view-btn" title="View" onclick="viewBookingDetail(${b.id})"><i class="fas fa-eye"></i></button>
                    ${b.status === 'Pending'
                        ? `<button class="action-btn approve-btn" title="Approve" onclick="approveRequest(${b.id})"><i class="fas fa-check"></i></button>
                           <button class="action-btn reject-btn" title="Reject" onclick="rejectRequest(${b.id})"><i class="fas fa-times"></i></button>`
                        : ''}
                    ${['Approved', 'In Progress'].includes(b.status)
                        ? `<button class="action-btn reject-btn" title="Cancel" onclick="adminCancelBooking(${b.id})"><i class="fas fa-ban"></i></button>`
                        : ''}
                </div></td>
            </tr>`).join('');
    }
    document.getElementById('allShowingInfo').textContent =
        `Showing 1 to ${data.length} of ${data.length} entries`;
}

function renderSpaceList() {
    const tbody = document.getElementById('spaceListBody');
    if (!tbody) return;
    if (!spacesData.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No spaces.</td></tr>';
    } else {
        tbody.innerHTML = spacesData.map(s => {
            const rate = parseFloat(s.hourly_rate ?? 0);
            const rateLabel = rate <= 0
                ? '<span style="color:#15803d;font-weight:600;">FREE</span>'
                : `RM ${rate.toFixed(2)}/hr`;
            return `
            <tr style="${s.is_active == 0 ? 'opacity:.5;' : ''}">
                <td>${s.space_code}</td>
                <td>${s.space_name}</td>
                <td>${s.category}</td>
                <td>${s.seating_capacity}</td>
                <td>${rateLabel}</td>
                <td>${s.operation_time}</td>
                <td><div class="action-btns">
                    <button class="action-btn edit-btn" title="Edit" onclick="editSpace(${s.id})"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete-btn" title="Delete" onclick="deleteSpace(${s.id})"><i class="fas fa-trash"></i></button>
                </div></td>
            </tr>`;
        }).join('');
    }
    document.getElementById('spaceShowingInfo').textContent =
        `Showing 1 to ${spacesData.length} of ${spacesData.length} entries`;
}

function renderUserList() {
    const tbody = document.getElementById('userTableBody');
    if (!tbody) return;
    const search = (document.getElementById('userSearchInput')?.value || '');
    const data = filterRows(usersData, search);
    if (!data.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No users.</td></tr>';
    } else {
        tbody.innerHTML = data.map(u => `
            <tr style="${u.status === 'Inactive' ? 'opacity:.5;' : ''}">
                <td>${u.full_name}</td>
                <td>${u.student_no || '—'}</td>
                <td>${u.campus || '—'}</td>
                <td>${u.faculty || '—'}</td>
                <td><span class="status-badge status-${u.role === 'Admin' ? 'approved' : (u.role === 'Moderator' ? 'inprogress' : 'pending')}">${u.role}</span></td>
                <td><div class="action-btns">
                    <button class="action-btn edit-btn" title="Edit user" onclick="openEditUserModal(${u.id})"><i class="fas fa-edit"></i></button>
                    <button class="action-btn" title="${u.status === 'Active' ? 'Deactivate' : 'Activate'}" onclick="toggleUserStatus(${u.id}, '${u.status}')"><i class="fas ${u.status === 'Active' ? 'fa-user-slash' : 'fa-user-check'}"></i></button>
                    <button class="action-btn delete-btn" title="Delete" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i></button>
                </div></td>
            </tr>`).join('');
    }
    document.getElementById('userShowingInfo').textContent =
        `Showing 1 to ${data.length} of ${data.length} entries`;
}

/* ──────────────────────────────────────────────────────
   SPACE CRUD
   ────────────────────────────────────────────────────── */
function openAddSpaceModal() {
    document.getElementById('addSpaceModal').classList.add('show');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('show');
}
async function addNewSpace() {
    const body = {
        space_code:       document.getElementById('newSpaceCode').value.trim(),
        space_name:       document.getElementById('newSpaceDesc').value.trim(),
        category:         document.getElementById('newSpaceCat').value,
        seating_capacity: parseInt(document.getElementById('newSpaceCap').value, 10) || 0,
        hourly_rate:      parseFloat(document.getElementById('newSpaceRate')?.value) || 0,
        operation_time:   document.getElementById('newSpaceTime').value.trim() || '08:00 - 18:00',
    };
    if (!body.space_code || !body.space_name) {
        showToast('Code and name are required', 'error'); return;
    }
    const r = await api('admin_spaces.php', 'add_space', { method: 'POST', body });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) {
        closeModal('addSpaceModal');
        ['newSpaceCode', 'newSpaceDesc', 'newSpaceCap', 'newSpaceRate', 'newSpaceTime']
            .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        loadSpaces(); loadStats();
    }
}
let editingSpaceId = null;
function editSpace(id) {
    const s = spacesData.find(x => x.id === id);
    if (!s) return;
    editingSpaceId = id;
    document.getElementById('editSpaceCode').value     = s.space_code || '';
    document.getElementById('editSpaceName').value     = s.space_name || '';
    document.getElementById('editSpaceCat').value      = s.category || '';
    document.getElementById('editSpaceCap').value      = s.seating_capacity || 0;
    const editRate = document.getElementById('editSpaceRate');
    if (editRate) editRate.value = s.hourly_rate != null ? parseFloat(s.hourly_rate).toFixed(2) : '0.00';
    document.getElementById('editSpaceTime').value     = s.operation_time || '';
    document.getElementById('editSpaceCampus').value   = s.campus || '';
    document.getElementById('editSpaceFaculty').value  = s.department || '';
    document.getElementById('editSpaceMod').value      = s.moderator_names || '';
    document.getElementById('editSpacePIC').value      = s.person_incharge || '';
    document.getElementById('editSpaceActive').value   = String(s.is_active);
    document.getElementById('editSpaceModal').classList.add('show');
}

async function saveEditSpace() {
    if (!editingSpaceId) return;
    const body = {
        space_id:         editingSpaceId,
        space_code:       document.getElementById('editSpaceCode').value.trim(),
        space_name:       document.getElementById('editSpaceName').value.trim(),
        category:         document.getElementById('editSpaceCat').value.trim(),
        seating_capacity: parseInt(document.getElementById('editSpaceCap').value, 10) || 0,
        hourly_rate:      parseFloat(document.getElementById('editSpaceRate')?.value) || 0,
        operation_time:   document.getElementById('editSpaceTime').value.trim(),
        campus:           document.getElementById('editSpaceCampus').value.trim(),
        department:       document.getElementById('editSpaceFaculty').value.trim(),
        moderator_names:  document.getElementById('editSpaceMod').value.trim(),
        person_incharge:  document.getElementById('editSpacePIC').value.trim(),
        is_active:        parseInt(document.getElementById('editSpaceActive').value, 10),
    };
    if (!body.space_code || !body.space_name) {
        showToast('Code and name are required', 'error'); return;
    }
    const r = await api('admin_spaces.php', 'edit_space', { method: 'POST', body });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) {
        closeModal('editSpaceModal');
        editingSpaceId = null;
        loadSpaces();
    }
}
async function deleteSpace(id) {
    const s = spacesData.find(x => x.id === id);
    if (!s || !confirm(`Delete space "${s.space_code}"?`)) return;
    const r = await api('admin_spaces.php', 'delete_space',
        { method: 'POST', body: { space_id: id } });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) { loadSpaces(); loadStats(); }
}

/* ──────────────────────────────────────────────────────
   USER ADMIN
   ────────────────────────────────────────────────────── */
async function changeUserRole(id, currentRole) {
    const newRole = prompt(`Current role: ${currentRole}\nEnter new role (Student / Moderator / Admin):`);
    if (!newRole) return;
    if (!['Student', 'Moderator', 'Admin'].includes(newRole)) {
        showToast('Invalid role', 'error'); return;
    }
    const r = await api('admin_users.php', 'change_role',
        { method: 'POST', body: { user_id: id, role: newRole } });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) loadUsers();
}
async function deleteUser(id) {
    if (!confirm('Delete this user? This action cannot be undone.')) return;
    const r = await api('admin_users.php', 'delete_user',
        { method: 'POST', body: { user_id: id } });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) loadUsers();
}

async function toggleUserStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    const verb = newStatus === 'Inactive' ? 'Deactivate' : 'Activate';
    if (!confirm(`${verb} this user account?`)) return;
    const r = await api('admin_users.php', 'change_status',
        { method: 'POST', body: { user_id: id, status: newStatus } });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) loadUsers();
}
function openAddUserModal() {
    document.getElementById('addUserModal').classList.add('show');
}
async function saveNewUser() {
    const body = {
        full_name:  document.getElementById('newUserName').value.trim(),
        email:      document.getElementById('newUserEmail').value.trim(),
        password:   document.getElementById('newUserPassword').value,
        student_no: document.getElementById('newUserStudentNo').value.trim() || null,
        phone:      document.getElementById('newUserPhone').value.trim() || null,
        role:       document.getElementById('newUserRole').value,
    };
    if (!body.full_name || !body.email || !body.password) {
        showToast('Name, email and password required', 'error'); return;
    }
    if (body.password.length < 6) {
        showToast('Password must be at least 6 chars', 'error'); return;
    }
    const r = await api('admin_users.php', 'add_user', { method: 'POST', body });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) {
        closeModal('addUserModal');
        ['newUserName','newUserEmail','newUserPassword','newUserStudentNo','newUserPhone']
            .forEach(id => document.getElementById(id).value = '');
        loadUsers();
    }
}

/* ──────────────────────────────────────────────────────
   CALENDAR
   ────────────────────────────────────────────────────── */
function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Events visible for a given day, optionally restricted to one room (space_id).
function eventsForDay(dateStr, spaceFilter) {
    return calendarEvents.filter(ev =>
        dateStr >= ev.start_date && dateStr <= ev.end_date &&
        (!spaceFilter || String(ev.space_id) === String(spaceFilter))
    );
}
function buildCalendar(containerId, dateObj, spaceFilter = '') {
    const y = dateObj.getFullYear(), m = dateObj.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const days     = new Date(y, m + 1, 0).getDate();
    const prevD    = new Date(y, m, 0).getDate();
    let grid = [];
    for (let i = firstDay - 1; i >= 0; i--) grid.push({ num: prevD - i, curr: false, dateStr: ymd(new Date(y, m - 1, prevD - i)) });
    for (let d = 1; d <= days; d++)        grid.push({ num: d,         curr: true,  dateStr: ymd(new Date(y, m, d)) });
    while (grid.length < 42) {
        const n = grid.length - days - firstDay + 1;
        grid.push({ num: n, curr: false, dateStr: ymd(new Date(y, m + 1, n)) });
    }
    const todayStr = ymd(new Date());
    let html = '<div class="weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="calendar-days">';
    grid.forEach(c => {
        const isToday = c.dateStr === todayStr && c.curr;
        const events = eventsForDay(c.dateStr, spaceFilter);
        let dots = '';
        events.slice(0, 4).forEach(ev => {
            const color = ev.status === 'Approved' ? '#10B981'
                : ev.status === 'Pending' ? '#F59E0B' : '#3B82F6';
            dots += `<span class="event-dot-mini" style="background:${color};box-shadow:0 0 3px ${color};"></span>`;
        });
        const clickAttr = events.length ? ` onclick="showAdminDayDetails('${c.dateStr}','${spaceFilter}')" style="cursor:pointer;"` : '';
        html += `<div class="day-cell ${c.curr ? '' : 'other-month'} ${isToday ? 'today' : ''}" title="${events.map(e => e.reservation_title).join(', ')}"${clickAttr}>
            <div class="day-number">${c.num}</div>
            <div class="event-dots">${dots}</div>
        </div>`;
    });
    document.getElementById(containerId).innerHTML = html + '</div>';
}

// Build the room filter dropdown from the rooms present in the calendar data.
function populateCalRoomFilter() {
    const sel = document.getElementById('calRoomFilter2');
    if (!sel) return;
    const seen = new Map();
    calendarEvents.forEach(ev => {
        if (ev.space_id != null && !seen.has(String(ev.space_id))) {
            seen.set(String(ev.space_id), `${ev.space_code || ''}${ev.space_code ? ' — ' : ''}${ev.space_name || ''}`.trim());
        }
    });
    const prev = sel.value;
    const opts = ['<option value="">All rooms</option>']
        .concat([...seen.entries()]
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, label]) => `<option value="${id}">${label}</option>`));
    sel.innerHTML = opts.join('');
    // Keep the previous selection if that room still exists
    if (prev && seen.has(prev)) sel.value = prev; else cal2SpaceFilter = '';
}

/* Click an admin calendar day → list that day's bookings → open full detail */
function showAdminDayDetails(dateStr, spaceFilter = '') {
    const events = eventsForDay(dateStr, spaceFilter);
    if (!events.length) return;
    const d = new Date(dateStr + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    document.querySelectorAll('.day-detail-overlay').forEach(e => e.remove());
    const overlay = document.createElement('div');
    overlay.className = 'day-detail-overlay';
    overlay.innerHTML = `
      <div class="day-detail-modal">
        <div class="day-detail-head">
          <h3><i class="fas fa-calendar-day"></i> ${dateLabel}</h3>
          <button class="day-detail-close" aria-label="Close">&times;</button>
        </div>
        <div class="day-detail-body">
          ${events.map(ev => {
            const st = ev.status || 'Pending';
            const cls = st === 'Approved' ? 'approved' : (st === 'Rejected' || st === 'Cancelled') ? 'rejected' : 'pending';
            const time = ev.start_time ? `${ev.start_time.slice(0,5)} – ${(ev.end_time||'').slice(0,5)}` : 'All day';
            return `<div class="day-detail-item">
                <div class="ddi-main">
                  <strong>${ev.event_name || ev.reservation_title || 'Booking'}</strong>
                  <span><i class="fas fa-user"></i> ${ev.applicant || ''}</span>
                  <span><i class="fas fa-door-open"></i> ${ev.space_name || ev.space_code || ''} · <i class="far fa-clock"></i> ${time}</span>
                </div>
                <div class="ddi-side">
                  <span class="status-badge ${cls}">${st}</span>
                  <button class="ddi-view" data-id="${ev.id}"><i class="fas fa-eye"></i> Details</button>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.day-detail-close').addEventListener('click', close);
    overlay.querySelectorAll('.ddi-view').forEach(btn =>
        btn.addEventListener('click', () => { const id = btn.dataset.id; close(); viewBookingDetail(id); })
    );
}
window.showAdminDayDetails = showAdminDayDetails;
let dashCalDate = new Date();
let cal2Date    = new Date();
let cal2SpaceFilter = '';   // '' = all rooms; otherwise a space_id
function renderDashCal() {
    buildCalendar('dashCalendarGrid', dashCalDate);   // dashboard mini-cal: never filtered
    const lbl = document.getElementById('dashMonthYear');
    if (lbl) lbl.textContent = dashCalDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function renderCal2() {
    buildCalendar('calendarGrid2', cal2Date, cal2SpaceFilter);
    const lbl = document.getElementById('calMonthYear2');
    if (lbl) lbl.textContent = cal2Date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/* ──────────────────────────────────────────────────────
   REPORTS / ANALYTICS (uses Chart.js)
   ────────────────────────────────────────────────────── */
const chartInstances = {};

async function loadReports() {
    // Run all the analytics queries in parallel
    const [overviewR, utilR, peakR] = await Promise.all([
        api('analytics.php', 'admin_overview'),
        api('analytics.php', 'space_utilization', { params: { days: 30 } }),
        api('analytics.php', 'peak_hours'),
    ]);
    if (!overviewR.success) { showToast(overviewR.message, 'error'); return; }

    const o = overviewR.data;

    // ----- KPI numbers
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('rptApprovalRate',    o.approval_rate + '%');
    set('rptReviewed',        `${o.reviewed_total} reviewed total`);
    set('rptAvgParticipants', o.avg_participants);
    set('rptAvgHours',        o.avg_hours + 'h');
    set('rptAvgLead',         o.avg_lead_days);

    // tooltip helper: shows "value (xx.x%)" of the dataset total
    const pctTip = (getVal) => ({
        callbacks: {
            label: (ctx) => {
                const total = ctx.dataset.data.reduce((a, b) => a + (parseFloat(b) || 0), 0);
                const v = getVal(ctx);
                const pct = total ? Math.round((v / total) * 1000) / 10 : 0;
                const lbl = ctx.label ? ctx.label + ': ' : '';
                return `${lbl}${v} (${pct}%)`;
            },
        },
    });

    // ----- Approval breakdown (doughnut) — % shown in tooltip
    drawChart('chartApproval', 'doughnut', {
        labels: Object.keys(o.status_counts),
        datasets: [{
            data: Object.values(o.status_counts),
            backgroundColor: ['#F59E0B','#10B981','#3B82F6','#EF4444','#9CA3AF'],
            borderWidth: 2,
            borderColor: '#fff',
        }],
    }, { plugins: { legend: { position: 'bottom' }, tooltip: pctTip(c => parseFloat(c.parsed) || 0) } });

    // ----- Category demand (bar) — % of all bookings shown in tooltip
    drawChart('chartCategory', 'bar', {
        labels: o.by_category.map(r => r.category),
        datasets: [{
            label: 'Bookings',
            data: o.by_category.map(r => parseInt(r.c, 10)),
            backgroundColor: 'rgba(124,58,237,0.7)',
            borderColor: '#7C3AED',
            borderWidth: 1,
        }],
    }, {
        plugins: { legend: { display: false }, tooltip: pctTip(c => parseFloat(c.parsed.y) || 0) },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    });

    // ----- Booking trend (line) — daily over last 14 days
    drawChart('chartMonthly', 'line', {
        labels: o.monthly_trend.map(r => r.label || r.ym),
        datasets: [{
            label: 'Bookings',
            data: o.monthly_trend.map(r => parseInt(r.c, 10)),
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59,130,246,0.15)',
            fill: true,
            tension: 0.3,
            pointRadius: 3,
        }],
    }, {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    });

    // ----- Peak hours histogram
    if (peakR.success) {
        const hist = peakR.data;
        drawChart('chartPeak', 'bar', {
            labels: hist.map((_, h) => `${String(h).padStart(2,'0')}:00`),
            datasets: [{
                label: 'Bookings starting at this hour',
                data: hist,
                backgroundColor: 'rgba(245,158,11,0.6)',
                borderColor: '#F59E0B',
                borderWidth: 1,
            }],
        }, {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
        });
    }

    // ----- Ranked tables
    if (utilR.success) {
        const tb = document.querySelector('#tblTopSpaces tbody');
        tb.innerHTML = utilR.data.top_5.length
            ? utilR.data.top_5.map(s => `
                <tr>
                    <td>${s.space_code}</td>
                    <td>${s.space_name}</td>
                    <td>${s.used_hours}</td>
                    <td>${s.booking_count}</td>
                    <td><div style="display:flex;align-items:center;gap:8px;">
                        <div style="flex:1;background:#E5E7EB;border-radius:99px;height:6px;overflow:hidden;">
                            <div style="height:100%;background:#7C3AED;width:${Math.min(100, s.utilization_pct)}%;"></div>
                        </div>
                        <span style="font-weight:600;min-width:46px;text-align:right;">${s.utilization_pct}%</span>
                    </div></td>
                </tr>`).join('')
            : '<tr class="empty-row"><td colspan="5">No data yet</td></tr>';
    }

}

function drawChart(canvasId, type, data, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined') return;
    // Destroy previous instance to avoid duplicate canvas state
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();
    chartInstances[canvasId] = new Chart(canvas, {
        type, data,
        options: { responsive: true, maintainAspectRatio: false, ...options },
    });
}

/* ──────────────────────────────────────────────────────
   SDP REPORTS GENERATION (Booking Summary, User History, Room Utilization)
   ────────────────────────────────────────────────────── */
function fmtDateShort(iso) {
    return iso ? new Date(iso).toLocaleDateString('en-GB') : '—';
}

function showReportOutput(title, html) {
    document.getElementById('reportOutputTitle').textContent = title;
    document.getElementById('reportOutputBody').innerHTML = html;
    document.getElementById('reportOutput').style.display = 'block';
    document.getElementById('reportOutput').scrollIntoView({ behavior: 'smooth' });
}

async function generateBookingSummary() {
    const start = prompt('Start date (YYYY-MM-DD):', new Date(Date.now() - 90*86400000).toISOString().slice(0,10));
    if (!start) return;
    const end = prompt('End date (YYYY-MM-DD):', new Date(Date.now() + 90*86400000).toISOString().slice(0,10));
    if (!end) return;

    const r = await api('analytics.php', 'booking_summary_report', { params: { start, end } });
    if (!r.success) { showToast(r.message, 'error'); return; }
    const d = r.data;

    const totalsRow = Object.entries(d.totals)
        .map(([k, v]) => `<div class="report-stat"><strong>${v}</strong><span>${k}</span></div>`).join('');

    const rowsHtml = (d.bookings || []).map((b, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>BK-${String(b.id).padStart(6, '0')}</td>
            <td>${b.applicant}</td>
            <td>${b.event_name}</td>
            <td>${b.space_code} — ${b.space_name}</td>
            <td>${fmtDateShort(b.start_date)} → ${fmtDateShort(b.end_date)}</td>
            <td>${b.participants}</td>
            <td><span class="status-badge status-${b.status.toLowerCase().replace(' ','')}">${b.status}</span></td>
            <td>${fmtDateShort(b.applied_date)}</td>
        </tr>
    `).join('') || '<tr><td colspan="9" style="text-align:center;color:#9CA3AF;">No bookings in this period</td></tr>';

    const html = `
        <div class="report-meta-row">
            <div><strong>Period:</strong> ${d.period.start} to ${d.period.end}</div>
            <div><strong>Total Bookings:</strong> ${d.total_count}</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
        </div>
        <div class="report-totals-grid">${totalsRow}</div>
        <table class="data-table report-table">
            <thead><tr>
                <th>#</th><th>Ref</th><th>Applicant</th><th>Event</th><th>Space</th>
                <th>Dates</th><th>Participants</th><th>Status</th><th>Applied</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
    showReportOutput('📋 Booking Summary Report', html);
}

async function generateUserHistory() {
    const search = prompt('Enter user name, email or student/staff number:');
    if (!search) return;

    const r = await api('analytics.php', 'user_history_report', { params: { search } });
    if (!r.success) { showToast(r.message, 'error'); return; }
    const d = r.data;

    if (!d.user) {
        showToast('User not found', 'error');
        return;
    }

    const rowsHtml = (d.bookings || []).map((b, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>BK-${String(b.id).padStart(6, '0')}</td>
            <td>${b.event_name}</td>
            <td>${b.space_code} — ${b.space_name}</td>
            <td>${b.category}</td>
            <td>${fmtDateShort(b.start_date)}<br/><small>${b.start_time || ''} - ${b.end_time || ''}</small></td>
            <td>${b.participants}</td>
            <td><span class="status-badge status-${b.status.toLowerCase().replace(' ','')}">${b.status}</span></td>
            <td>${fmtDateShort(b.applied_date)}</td>
        </tr>
    `).join('') || '<tr><td colspan="9" style="text-align:center;color:#9CA3AF;">No bookings yet</td></tr>';

    const u = d.user;
    const html = `
        <div class="report-user-card">
            <div class="report-user-avatar">${(u.full_name || 'U').charAt(0)}</div>
            <div>
                <h3 style="margin:0;">${u.full_name}</h3>
                <div style="font-size:0.85rem;color:#6B7280;">${u.identifier} · ${u.user_category} · ${u.email}</div>
                <div style="font-size:0.78rem;color:#9CA3AF;margin-top:4px;">
                    ${u.department || ''} ${u.program ? '· ' + u.program : ''} ${u.campus ? '· ' + u.campus : ''}
                </div>
            </div>
        </div>
        <div class="report-meta-row">
            <div><strong>Total Bookings:</strong> ${d.total_bookings}</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
        </div>
        <table class="data-table report-table">
            <thead><tr>
                <th>#</th><th>Ref</th><th>Event</th><th>Space</th><th>Category</th>
                <th>Schedule</th><th>Participants</th><th>Status</th><th>Applied</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
    showReportOutput(`👤 User Booking History — ${u.full_name}`, html);
}

async function generateRoomUtilization() {
    const days = parseInt(prompt('Period in days (default 30):', '30'), 10) || 30;

    const r = await api('analytics.php', 'room_utilization_report', { params: { days } });
    if (!r.success) { showToast(r.message, 'error'); return; }
    const d = r.data;

    const rowsHtml = (d.rooms || []).map((s, i) => {
        const utilBar = `<div class="util-bar"><div class="util-fill" style="width:${Math.min(100, s.utilization_pct)}%"></div><span>${s.utilization_pct}%</span></div>`;
        return `
            <tr>
                <td>${i + 1}</td>
                <td>${s.space_code}</td>
                <td>${s.space_name}</td>
                <td>${s.category}</td>
                <td>${s.seating_capacity}</td>
                <td>${s.booking_count}</td>
                <td>${s.approved_count}</td>
                <td>${s.used_hours}h</td>
                <td>${utilBar}</td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:#9CA3AF;">No rooms</td></tr>';

    const html = `
        <div class="report-meta-row">
            <div><strong>Period:</strong> Last ${d.period_days} days</div>
            <div><strong>Available hours/room:</strong> ${d.available_hours_per_room}h</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
        </div>
        <table class="data-table report-table">
            <thead><tr>
                <th>#</th><th>Code</th><th>Name</th><th>Category</th><th>Capacity</th>
                <th>Total Bookings</th><th>Approved</th><th>Hours Used</th><th>Utilization</th>
            </tr></thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
    showReportOutput('🏢 Room Utilization Report', html);
}

function closeReportOutput() {
    document.getElementById('reportOutput').style.display = 'none';
}

/* ──────────────────────────────────────────────────────
   NOTIFICATIONS (admin bell dropdown)
   ────────────────────────────────────────────────────── */
function timeAgo(iso) {
    if (!iso) return '';
    const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    if (sec < 604800) return Math.floor(sec / 86400) + 'd ago';
    return new Date(iso).toLocaleDateString();
}

async function loadNotifications() {
    const [list, count] = await Promise.all([
        api('notifications.php', 'list'),
        api('notifications.php', 'unread_count'),
    ]);

    const dot = document.getElementById('bellDot');
    if (dot) {
        dot.style.display = (count.success && count.data.count > 0) ? 'block' : 'none';
    }

    const c = document.getElementById('notifList');
    if (!c) return;
    if (!list.success || !list.data || !list.data.length) {
        c.innerHTML = '<div class="notif-empty">No notifications yet</div>';
        return;
    }
    const icons = { approval: 'fa-check', rejection: 'fa-times', info: 'fa-info', reminder: 'fa-clock', system: 'fa-cog' };
    c.innerHTML = list.data.map(n => `
        <div class="notif-item ${n.is_read == 0 ? 'unread' : ''}" data-id="${n.notification_id}">
            <div class="notif-icon ${n.type}"><i class="fas ${icons[n.type] || 'fa-bell'}"></i></div>
            <div style="flex:1;">
                <div class="notif-title">${n.title}</div>
                <div class="notif-message">${n.message}</div>
                <div class="notif-time">${timeAgo(n.created_at)}</div>
            </div>
        </div>
    `).join('');
    c.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', async () => {
            await api('notifications.php', 'mark_read', { method: 'POST', body: { notification_id: parseInt(item.dataset.id) } });
            loadNotifications();
        });
    });
}

async function markAllNotificationsRead() {
    await api('notifications.php', 'mark_all_read', { method: 'POST' });
    loadNotifications();
}

/* ──────────────────────────────────────────────────────
   EDIT USER MODAL
   ────────────────────────────────────────────────────── */
let editingUserId = null;
async function openEditUserModal(userId) {
    editingUserId = userId;
    const r = await api('admin_users.php', 'get_user_by_id', { params: { user_id: userId } });
    if (!r.success) { showToast(r.message, 'error'); return; }
    const u = r.data;

    document.getElementById('editUserName').value      = u.full_name || '';
    document.getElementById('editUserEmail').value     = u.email || '';
    document.getElementById('editUserPhone').value     = u.phone || '';
    document.getElementById('editUserStudentNo').value = u.student_no || '';
    document.getElementById('editUserFaculty').value   = u.faculty || '';
    document.getElementById('editUserProgram').value   = u.program || '';
    document.getElementById('editUserCampus').value    = u.campus || '';
    document.getElementById('editUserRole').value      = u.role || 'Student';
    document.getElementById('editUserStatus').value    = u.status || 'Active';
    document.getElementById('editUserPassword').value  = '';
    document.getElementById('editUserModal').classList.add('show');
}

async function saveEditUser() {
    if (!editingUserId) return;
    const body = {
        user_id:    editingUserId,
        full_name:  document.getElementById('editUserName').value.trim(),
        email:      document.getElementById('editUserEmail').value.trim(),
        phone:      document.getElementById('editUserPhone').value.trim(),
        student_no: document.getElementById('editUserStudentNo').value.trim(),
        faculty:    document.getElementById('editUserFaculty').value.trim(),
        program:    document.getElementById('editUserProgram').value.trim(),
        campus:     document.getElementById('editUserCampus').value.trim(),
        role:       document.getElementById('editUserRole').value,
        status:     document.getElementById('editUserStatus').value,
    };
    const newPassword = document.getElementById('editUserPassword').value;
    if (newPassword) {
        if (newPassword.length < 6) { showToast('Password too short', 'error'); return; }
        body.password = newPassword;
    }
    if (!body.full_name || !body.email) {
        showToast('Name and email required', 'error'); return;
    }

    const r = await api('admin_users.php', 'edit_user', { method: 'POST', body });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) {
        closeModal('editUserModal');
        editingUserId = null;
        loadUsers();
    }
}

/* ──────────────────────────────────────────────────────
   ACTIVITY LOG
   ────────────────────────────────────────────────────── */
async function loadActivityLog() {
    const limit = parseInt(document.getElementById('logLimit')?.value || '50', 10);
    const r = await api('analytics.php', 'activity_log', { params: { limit } });
    if (!r.success) { showToast(r.message, 'error'); return; }
    const tb = document.getElementById('logTableBody');
    if (!r.data.length) {
        tb.innerHTML = '<tr class="empty-row"><td colspan="6">No admin actions logged yet.</td></tr>';
    } else {
        tb.innerHTML = r.data.map(row => `
            <tr>
                <td>${new Date(row.created_at).toLocaleString()}</td>
                <td>${row.admin_name}</td>
                <td><span class="status-badge ${row.admin_role === 'Admin' ? 'status-approved' : 'status-pending'}">${row.admin_role}</span></td>
                <td><strong>${row.action}</strong></td>
                <td>${row.target_table || '—'}${row.target_id ? ' #' + row.target_id : ''}</td>
                <td><code style="font-size:0.7rem;">${row.details ? row.details : '—'}</code></td>
            </tr>`).join('');
    }
    document.getElementById('logShowingInfo').textContent =
        `Showing ${r.data.length} of last ${limit} entries`;
}

/* ──────────────────────────────────────────────────────
   VIEW SWITCHING
   ────────────────────────────────────────────────────── */
const viewMap = {
    adminDashboard:  'adminDashboardView',
    bookingRequests: 'bookingRequestsView',
    allBookings:     'allBookingsView',
    spaceList:       'spaceListView',
    adminCalendar:   'adminCalendarView',
    reports:         'reportsView',
    activityLog:     'activityLogView',
    userManagement:  'userManagementView',
};
function switchToView(v) {
    Object.values(viewMap).forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const target = viewMap[v];
    if (target) document.getElementById(target).style.display = 'block';
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-view="${v}"]`);
    if (activeNav) activeNav.classList.add('active');
    if (['bookingRequests', 'allBookings', 'spaceList', 'adminCalendar'].includes(v)) {
        document.getElementById('navSpaceParent')?.classList.add('active', 'expanded');
        document.getElementById('spaceSubmenu')?.classList.add('show');
    }
    const crumbs = {
        adminDashboard:  ['Home', 'Admin Dashboard'],
        bookingRequests: ['Home', 'Space Management', 'Booking Requests'],
        allBookings:     ['Home', 'Space Management', 'All Bookings'],
        spaceList:       ['Home', 'Space Management', 'Space List'],
        adminCalendar:   ['Home', 'Space Management', 'Calendar'],
        reports:         ['Home', 'Reports'],
        activityLog:     ['Home', 'Activity Log'],
        userManagement:  ['Home', 'User Management'],
    }[v] || ['Home', 'Page'];
    document.getElementById('topBreadcrumb').innerHTML = crumbs.map((t, i) =>
        i === crumbs.length - 1
            ? `<span class="active-crumb">${t}</span>`
            : `<span>${t}</span> <i class="fas fa-chevron-right"></i> `
    ).join('');
    if (v === 'bookingRequests') loadRequests();
    if (v === 'allBookings')     loadAllBookings();
    if (v === 'spaceList')       loadSpaces();
    if (v === 'userManagement')  loadUsers();
    if (v === 'adminCalendar')   loadCalendar();
    if (v === 'adminDashboard')  { loadStats(); loadCalendar(); }
    if (v === 'reports')         loadReports();
    if (v === 'activityLog')     loadActivityLog();
}

/* ──────────────────────────────────────────────────────
   DOM WIRING
   ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    applyTheme(getTheme());

    const u = await loadSession();
    if (!u) return;

    // Initial loads
    await Promise.all([loadRequests(), loadAllBookings(), loadSpaces(), loadStats(), loadCalendar()]);
    loadUsers();

    // Search listeners
    document.getElementById('reqSearchInput')?.addEventListener('input', renderReqTable);
    document.getElementById('allSearchInput')?.addEventListener('input', renderAllBookingsTable);
    document.getElementById('userSearchInput')?.addEventListener('input', renderUserList);

    // Theme
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    document.getElementById('themeSwitch')?.addEventListener('click', toggleTheme);

    // User dropdown
    document.getElementById('userProfileBtn')?.addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('userDropdown').classList.toggle('show');
        document.getElementById('notifDropdown')?.classList.remove('show');
    });

    // Notification bell — show real dropdown
    document.getElementById('notificationBell')?.addEventListener('click', e => {
        e.stopPropagation();
        const dd = document.getElementById('notifDropdown');
        dd?.classList.toggle('show');
        document.getElementById('userDropdown')?.classList.remove('show');
        if (dd?.classList.contains('show')) loadNotifications();
    });
    document.getElementById('markAllReadBtn')?.addEventListener('click', markAllNotificationsRead);

    // Click outside closes both dropdowns
    document.addEventListener('click', e => {
        const ud = document.getElementById('userDropdown');
        const nd = document.getElementById('notifDropdown');
        const ub = document.getElementById('userProfileBtn');
        const nb = document.getElementById('notificationBell');
        if (ud && !ud.contains(e.target) && ub && !ub.contains(e.target)) ud.classList.remove('show');
        if (nd && !nd.contains(e.target) && nb && !nb.contains(e.target)) nd.classList.remove('show');
    });

    // Edit user modal save button
    document.getElementById('btnSaveEditUser')?.addEventListener('click', saveEditUser);
    document.getElementById('btnSaveEditSpace')?.addEventListener('click', saveEditSpace);

    // Initial notification load + poll every 60s
    loadNotifications();
    setInterval(loadNotifications, 60000);

    // Calendar nav
    document.getElementById('dashPrevBtn')?.addEventListener('click', () => { dashCalDate.setMonth(dashCalDate.getMonth() - 1); renderDashCal(); });
    document.getElementById('dashNextBtn')?.addEventListener('click', () => { dashCalDate.setMonth(dashCalDate.getMonth() + 1); renderDashCal(); });
    document.getElementById('dashTodayBtn')?.addEventListener('click', () => { dashCalDate = new Date(); renderDashCal(); });
    document.getElementById('calPrevBtn2')?.addEventListener('click', () => { cal2Date.setMonth(cal2Date.getMonth() - 1); renderCal2(); });
    document.getElementById('calNextBtn2')?.addEventListener('click', () => { cal2Date.setMonth(cal2Date.getMonth() + 1); renderCal2(); });
    document.getElementById('calTodayBtn2')?.addEventListener('click', () => { cal2Date = new Date(); renderCal2(); });
    document.getElementById('calRoomFilter2')?.addEventListener('change', function () { cal2SpaceFilter = this.value; renderCal2(); });

    // Logo → back to dashboard home (and scroll to top)
    document.getElementById('sidebarLogo')?.addEventListener('click', () => {
        switchToView('adminDashboard'); window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Nav clicks
    document.querySelectorAll('.nav-item[data-view]').forEach(item =>
        item.addEventListener('click', function () {
            const v = this.dataset.view;
            if (v && viewMap[v]) switchToView(v);
        })
    );
    document.getElementById('navSpaceParent')?.addEventListener('click', function (e) {
        if (e.target.closest('.submenu')) return;
        const sub = document.getElementById('spaceSubmenu');
        sub.classList.toggle('show'); this.classList.toggle('expanded');
    });

    // Add user buttons
    document.getElementById('btnAddUser')?.addEventListener('click', openAddUserModal);
    document.getElementById('btnSaveUser')?.addEventListener('click', saveNewUser);

    // Activity log controls
    document.getElementById('btnRefreshLog')?.addEventListener('click', loadActivityLog);
    document.getElementById('logLimit')?.addEventListener('change', loadActivityLog);

    // SDP Report buttons
    document.querySelectorAll('.btn-generate-report').forEach(btn => {
        btn.addEventListener('click', function () {
            const type = this.dataset.report;
            if (type === 'booking_summary') generateBookingSummary();
            else if (type === 'user_history') generateUserHistory();
            else if (type === 'room_utilization') generateRoomUtilization();
        });
    });
    document.getElementById('btnCloseReport')?.addEventListener('click', closeReportOutput);
    document.getElementById('btnPrintReport')?.addEventListener('click', () => window.print());

    // Initial view
    switchToView('bookingRequests');
    document.getElementById('spaceSubmenu')?.classList.add('show');
    document.getElementById('navSpaceParent')?.classList.add('expanded');
});

// Expose for inline onclick handlers
window.handleLogout       = handleLogout;
window.openAddSpaceModal  = openAddSpaceModal;
window.closeModal         = closeModal;
window.addNewSpace        = addNewSpace;
window.editSpace          = editSpace;
window.saveEditSpace      = saveEditSpace;
window.deleteSpace        = deleteSpace;
window.changeUserRole     = changeUserRole;
window.deleteUser         = deleteUser;
window.toggleUserStatus   = toggleUserStatus;
window.openEditUserModal  = openEditUserModal;
window.saveEditUser       = saveEditUser;
window.approveRequest     = approveRequest;
window.rejectRequest      = rejectRequest;
window.adminCancelBooking = adminCancelBooking;
window.viewBookingDetail  = viewBookingDetail;
window.showToast          = showToast;
