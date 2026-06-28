/* =====================================================
   USER DASHBOARD - SCRIPT
   All data comes from PHP APIs in ../php/ (no hardcoded data).
   ===================================================== */

const API_BASE = '../php/';
const LOGIN_PAGE = 'login_page.html';

/* ──────────────────────────────────────────────────────
   API HELPER (sends session cookie, handles 401)
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
        return await res.json();
    } catch (err) {
        console.error('API error:', err);
        return { success: false, message: 'Network error: ' + err.message };
    }
}

/* ──────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
   ────────────────────────────────────────────────────── */
function ensureToastContainer() {
    let c = document.getElementById('toastContainer');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toastContainer';
        c.className = 'toast-container';
        document.body.appendChild(c);
    }
    return c;
}
function showToast(message, type = 'info') {
    const c = ensureToastContainer();
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    t.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    c.appendChild(t);
    setTimeout(() => {
        t.style.animation = 'slideOutRight 0.3s forwards';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

/* ──────────────────────────────────────────────────────
   STATE
   ────────────────────────────────────────────────────── */
let currentUser = null;
let myBookings  = [];          // populated from API
let categories  = [];
let spacesByCategory = {};     // { category: [{id, space_code, space_name}, ...] }
let selectedSpaceId = null;    // chosen by user in booking form
let calendarEvents = [];

let currentPage = 1, entriesPerPage = 10, currentSort = 'no', sortDir = 'asc', searchQuery = '';

/* ──────────────────────────────────────────────────────
   FORMATTERS
   ────────────────────────────────────────────────────── */
const fmtDate = iso => iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

const statusClass = s => {
    s = (s || '').toLowerCase();
    if (s === 'approved')    return 'status-approved';
    if (s === 'pending')     return 'status-pending';
    if (s === 'in progress') return 'status-inprogress';
    if (s === 'rejected')    return 'status-rejected';
    if (s === 'cancelled')   return 'status-rejected';
    return 'status-pending';
};

/* ──────────────────────────────────────────────────────
   NOTIFICATIONS
   ────────────────────────────────────────────────────── */
function timeAgo(iso) {
    const d = new Date(iso);
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return 'just now';
    if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
    if (sec < 86400) return Math.floor(sec / 3600) + 'h ago';
    if (sec < 604800) return Math.floor(sec / 86400) + 'd ago';
    return d.toLocaleDateString();
}

async function loadNotifications() {
    const [listRes, countRes] = await Promise.all([
        api('notifications.php', 'list'),
        api('notifications.php', 'unread_count'),
    ]);

    // Update badge
    const badge = document.getElementById('notifBadge');
    if (badge && countRes.success) {
        const c = countRes.data.count;
        if (c > 0) {
            badge.style.display = 'flex';
            badge.textContent = c > 9 ? '9+' : c;
        } else {
            badge.style.display = 'none';
        }
    }

    // Update list
    const list = document.getElementById('notifList');
    if (!list) return;
    if (!listRes.success || !listRes.data || listRes.data.length === 0) {
        list.innerHTML = '<div class="notif-empty">No notifications yet</div>';
        return;
    }
    const iconMap = { approval: 'fa-check', rejection: 'fa-times', info: 'fa-info', reminder: 'fa-clock', system: 'fa-cog' };
    list.innerHTML = listRes.data.map(n => `
        <div class="notif-item ${n.is_read == 0 ? 'unread' : ''}" data-id="${n.notification_id}">
            <div class="notif-icon ${n.type}"><i class="fas ${iconMap[n.type] || 'fa-bell'}"></i></div>
            <div class="notif-content">
                <div class="notif-title">${n.title}</div>
                <div class="notif-message">${n.message}</div>
                <div class="notif-time">${timeAgo(n.created_at)}</div>
            </div>
        </div>
    `).join('');

    // Click → mark read
    list.querySelectorAll('.notif-item').forEach(item => {
        item.addEventListener('click', async () => {
            const nid = item.dataset.id;
            await api('notifications.php', 'mark_read', { method: 'POST', body: { notification_id: parseInt(nid) } });
            loadNotifications();
        });
    });
}

async function markAllNotificationsRead() {
    await api('notifications.php', 'mark_all_read', { method: 'POST' });
    loadNotifications();
}

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
   SESSION + PROFILE
   ────────────────────────────────────────────────────── */
async function loadProfile() {
    const r = await api('user_profile.php', 'me');
    if (!r.success) {
        window.location.href = LOGIN_PAGE;
        return null;
    }
    // Staff (Moderator/Admin) use the admin dashboard. They only land on this
    // booking portal when they explicitly come to book (?book=1) — where their
    // bookings are FREE. Otherwise route them back to the staff dashboard.
    const bookingMode = new URLSearchParams(window.location.search).has('book');
    if (!bookingMode && (r.data.role === 'Moderator' || r.data.role === 'Admin')) {
        window.location.href = 'admin_dashboard.html';
        return null;
    }
    currentUser = r.data;
    window.RBS_USER = r.data;   // expose for the booking flow (staff-free pricing)
    const avatar = currentUser.initials || currentUser.full_name.charAt(0);
    document.querySelector('.user-profile .avatar').textContent = avatar;
    document.querySelector('.user-profile .user-name').textContent = currentUser.full_name;
    document.querySelector('.dropdown-user-name').textContent = currentUser.full_name;
    document.querySelector('.dropdown-user-email').textContent = currentUser.email;
    // Personal details panel
    const map = {
        'pdStudentNo': currentUser.student_no || '—',
        'pdName':      currentUser.full_name,
        'pdCampus':    currentUser.campus  || '—',
        'pdFaculty':   currentUser.faculty || '—',
        'pdProgram':   currentUser.program || '—',
        'pdEmail':     currentUser.email,
        'pdPhone':     currentUser.phone   || '—',
    };
    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }
    return currentUser;
}

async function doLogout() {
    if (!confirm('Logout?')) return;
    await api('auth.php', 'logout', { method: 'POST' });
    window.location.href = LOGIN_PAGE;
}

/* ──────────────────────────────────────────────────────
   DASHBOARD STATS  +  PERSONAL CALCULATIONS
   ────────────────────────────────────────────────────── */
async function loadStats() {
    // Rich stat-card data from analytics.php
    const r = await api('analytics.php', 'student_rich_stats');
    if (!r.success) return;
    const el = id => document.getElementById(id);
    const set = (id, v) => { if (el(id)) el(id).textContent = v; };

    set('spaceCount',      r.data.total_spaces);
    set('activeBookings',  r.data.active_bookings);
    set('pendingCount',    r.data.pending_count);
    set('hoursScheduled',  r.data.hours_scheduled + 'h');
    set('activeSub',       `${r.data.total_participants} participants total`);
    set('pendingSub',      `${r.data.upcoming_7d} upcoming this week`);
}

async function loadPersonalStats() {
    const r = await api('analytics.php', 'student_stats');
    if (!r.success) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('psTotalBookings', r.data.total_bookings);
    set('psApprovalRate',  r.data.approval_rate + '%');
    set('psTotalHours',    r.data.total_hours + 'h');
    set('psAvgLead',       r.data.avg_lead_days);
    set('psCapacity',      r.data.avg_capacity_usage + '%');
    set('psFavCat',        r.data.favorite_category);
}

/* ──────────────────────────────────────────────────────
   MY BOOKINGS TABLE
   ────────────────────────────────────────────────────── */
async function loadMyBookings() {
    const r = await api('user_bookings.php', 'get_my_bookings');
    if (!r.success) { showToast(r.message || 'Failed to load bookings', 'error'); return; }
    myBookings = (r.data || []).map((b, i) => ({ ...b, no: i + 1 }));
    renderTable();
}

function renderTable() {
    let data = [...myBookings];
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        data = data.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(q)));
    }
    data.sort((a, b) => {
        let va = a[currentSort] ?? '', vb = b[currentSort] ?? '';
        if (currentSort === 'no') { va = +a.no; vb = +b.no; }
        return (va < vb ? -1 : 1) * (sortDir === 'asc' ? 1 : -1);
    });
    const total = data.length, pages = Math.ceil(total / entriesPerPage) || 1;
    if (currentPage > pages) currentPage = pages;
    const start = (currentPage - 1) * entriesPerPage;
    const end   = Math.min(start + entriesPerPage, total);
    const pageData = data.slice(start, end);

    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = total ? pageData.map(r => `
        <tr>
            <td>${r.no}</td>
            <td><div class="action-btns">
                <button class="action-btn" title="View" onclick="viewBooking(${r.id})"><i class="fas fa-eye"></i></button>
                ${r.status === 'Pending'
                    ? `<button class="action-btn" title="Cancel" onclick="cancelBooking(${r.id})"><i class="fas fa-times"></i></button>`
                    : ''}
            </div></td>
            <td>${r.applicant_name}</td>
            <td>${r.event_name || r.reservation_title}</td>
            <td>${r.category}</td>
            <td>${r.space_name}</td>
            <td>${fmtDate(r.start_date)}</td>
            <td>${fmtDate(r.end_date)}</td>
            <td>${fmtDate(r.applied_date)}</td>
            <td><span class="status-badge ${statusClass(r.status)}">${r.status}</span></td>
        </tr>
    `).join('') : '<tr class="empty-row"><td colspan="10">No bookings yet</td></tr>';

    document.getElementById('showingInfo').textContent =
        `Showing ${total ? start + 1 : 0} to ${end} of ${total} entries`;

    let pag = `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} data-p="prev"><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= pages; i++) pag += `<button class="page-btn ${i === currentPage ? 'active-page' : ''}" data-p="${i}">${i}</button>`;
    pag += `<button class="page-btn" ${currentPage >= pages ? 'disabled' : ''} data-p="next"><i class="fas fa-chevron-right"></i></button>`;
    document.getElementById('paginationControls').innerHTML = pag;
    document.querySelectorAll('#paginationControls .page-btn').forEach(b => b.addEventListener('click', function () {
        const p = this.dataset.p;
        if (p === 'prev' && currentPage > 1) currentPage--;
        else if (p === 'next' && currentPage < pages) currentPage++;
        else if (!isNaN(p)) currentPage = +p;
        renderTable();
    }));
}

async function viewBooking(id) {
    // Show printable receipt with current live status from DB
    await showBookingReceipt(id);
    // Also refresh stats + calendar so any status change shows immediately
    loadStats();
    loadCalendarEvents();
}

async function cancelBooking(id) {
    if (!confirm('Cancel this booking?')) return;
    const r = await api('user_bookings.php', 'cancel_booking', { method: 'POST', body: { booking_id: id } });
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) { loadMyBookings(); loadStats(); loadCalendarEvents(); }
}

/* ──────────────────────────────────────────────────────
   CATEGORIES + SPACES (for dropdowns)
   ────────────────────────────────────────────────────── */
async function loadCategories() {
    const r = await api('user_spaces.php', 'get_categories');
    if (!r.success) return;
    categories = r.data || [];
    populateCategoryDropdowns();
}

function populateCategoryDropdowns() {
    // Schedule search filter
    const schedSel = document.getElementById('catSelect');
    if (schedSel) {
        const cur = schedSel.value;
        schedSel.innerHTML = '<option value="">-- Select Category --</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
        if (cur) schedSel.value = cur;
    }
    // Booking form category dropdown
    const bookSel = document.getElementById('bookCategorySelect');
    if (bookSel) {
        bookSel.innerHTML = '<option value="">-- Select Category --</option>' +
            categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

async function loadSpaceNames(category, targetSelectId) {
    const sel = document.getElementById(targetSelectId);
    if (!sel) return;
    if (!category) {
        sel.innerHTML = '<option value="">-- Select Category First --</option>';
        return;
    }
    if (spacesByCategory[category]) {
        renderSpaceOptions(sel, spacesByCategory[category]);
        return;
    }
    const r = await api('user_spaces.php', 'get_space_names', { params: { category } });
    if (!r.success) { showToast(r.message, 'error'); return; }
    spacesByCategory[category] = r.data || [];
    renderSpaceOptions(sel, spacesByCategory[category]);
}

function renderSpaceOptions(sel, list) {
    if (!list.length) {
        sel.innerHTML = '<option value="">-- No spaces in this category --</option>';
        return;
    }
    sel.innerHTML = '<option value="">-- Select Space --</option>' +
        list.map(s => {
            const rate = parseFloat(s.hourly_rate ?? 0);
            const rateLabel = rate <= 0 ? ' · FREE' : ` · RM ${rate.toFixed(2)}/hr`;
            return `<option value="${s.id}" data-name="${s.space_name}" data-rate="${rate}">${s.space_name}${rateLabel}</option>`;
        }).join('');
}

/* ──────────────────────────────────────────────────────
   CALENDAR (renders event dots from real data)
   ────────────────────────────────────────────────────── */
async function loadCalendarEvents() {
    const r = await api('user_bookings.php', 'get_calendar_events');
    if (!r.success) return;
    calendarEvents = r.data || [];
    renderDashCal();
    renderCal2();
}

function buildCalendar(containerId, date, monthYearLabelId) {
    const y = date.getFullYear(), m = date.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const days     = new Date(y, m + 1, 0).getDate();
    const prevD    = new Date(y, m, 0).getDate();
    let grid = [];
    for (let i = firstDay - 1; i >= 0; i--) {
        grid.push({ num: prevD - i, curr: false, dateStr: ymd(new Date(y, m - 1, prevD - i)) });
    }
    for (let d = 1; d <= days; d++) {
        grid.push({ num: d, curr: true, dateStr: ymd(new Date(y, m, d)) });
    }
    while (grid.length < 42) {
        const n = grid.length - days - firstDay + 1;
        grid.push({ num: n, curr: false, dateStr: ymd(new Date(y, m + 1, n)) });
    }
    const todayStr = ymd(new Date());
    let html = '<div class="weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="calendar-days">';

    grid.forEach(c => {
        const isToday = c.dateStr === todayStr && c.curr;
        const events = calendarEvents.filter(ev =>
            c.dateStr >= ev.start_date && c.dateStr <= ev.end_date
        );

        // Build event labels (event NAME visibly shown, capped at 2 lines, others get +N more)
        let eventLabels = '';
        events.slice(0, 2).forEach(ev => {
            const statusClass = ev.status === 'Approved' ? 'evt-approved'
                : ev.status === 'In Progress' ? 'evt-inprogress' : 'evt-pending';
            const name = (ev.event_name || ev.reservation_title || 'Event').substring(0, 22);
            eventLabels += `<div class="event-label ${statusClass}" title="${ev.reservation_title} (${ev.status})">${name}</div>`;
        });
        if (events.length > 2) {
            eventLabels += `<div class="event-label evt-more">+${events.length - 2} more</div>`;
        }

        const allEventsTitle = events.map(e =>
            `${e.event_name || e.reservation_title} • ${e.start_date}${e.start_time ? ' ' + e.start_time : ''} (${e.status})`
        ).join('\n');

        const clickAttr = events.length ? ` onclick="showDayDetails('${c.dateStr}')" style="cursor:pointer;"` : '';
        html += `<div class="day-cell ${c.curr ? '' : 'other-month'} ${isToday ? 'today' : ''} ${events.length ? 'has-events' : ''}" title="${allEventsTitle}"${clickAttr}>
            <div class="day-number">${c.num}</div>
            <div class="event-labels">${eventLabels}</div>
        </div>`;
    });
    document.getElementById(containerId).innerHTML = html + '</div>';
    const lbl = document.getElementById(monthYearLabelId);
    if (lbl) lbl.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function ymd(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* Click a calendar day → popup listing that day's bookings → open full receipt */
function showDayDetails(dateStr) {
    const events = calendarEvents.filter(ev => dateStr >= ev.start_date && dateStr <= ev.end_date);
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
                  <span><i class="fas fa-door-open"></i> ${ev.space_name || ev.space_code || ''}</span>
                  <span><i class="far fa-clock"></i> ${time}</span>
                </div>
                <div class="ddi-side">
                  <span class="status-badge ${cls}">${st}</span>
                  <button class="ddi-view" data-id="${ev.id}"><i class="fas fa-receipt"></i> Receipt</button>
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
        btn.addEventListener('click', () => { const id = btn.dataset.id; close(); showBookingReceipt(id); })
    );
}
window.showDayDetails = showDayDetails;

let calDate  = new Date();
let cal2Date = new Date();
function renderDashCal() { buildCalendar('calendarDynamic', calDate,  'monthYearDisplay'); }
function renderCal2()    { buildCalendar('calendarGrid2',   cal2Date, 'calMonthYear2');   }

/* ──────────────────────────────────────────────────────
   SCHEDULE SEARCH
   ────────────────────────────────────────────────────── */
async function searchSchedule() {
    // Friendly defaults: if dates are blank, assume today so the user can
    // just hit SEARCH without filling everything in.
    const sd = document.getElementById('startDate');
    const ed = document.getElementById('endDate');
    if (!sd.value) sd.value = ymd(new Date());
    if (!ed.value || ed.value < sd.value) ed.value = sd.value;

    const params = {
        category:   document.getElementById('catSelect').value,
        space_name: document.getElementById('spaceNameSelect').selectedOptions[0]?.dataset.name || '',
        start_date: sd.value,
        end_date:   ed.value,
    };

    const tbody = document.getElementById('scheduleResultBody');
    if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="4"><i class="fas fa-spinner fa-spin" style="color:#5F259F;"></i> Searching available spaces…</td></tr>';

    const r = await api('user_spaces.php', 'search_schedule', { params });
    if (!r.success) {
        if (tbody) tbody.innerHTML = `<tr class="empty-row"><td colspan="4">⚠️ ${r.message || 'Search failed'}</td></tr>`;
        return;
    }
    renderScheduleResults(r.data || []);
}

function renderScheduleResults(spaces) {
    const tbody = document.getElementById('scheduleResultBody');
    if (!spaces.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No spaces match your search criteria. Try widening the filter.</td></tr>';
        document.getElementById('scheduleShowingInfo').textContent = 'Showing 0 to 0 of 0 entries';
        return;
    }
    tbody.innerHTML = spaces.map(s => {
        const hasBookings = s.reservations && s.reservations.length > 0;

        // Availability badge: BOOKED if there are conflicting reservations, AVAILABLE otherwise
        const availabilityBadge = hasBookings
            ? `<span class="avail-badge avail-booked">🔴 BOOKED</span>`
            : `<span class="avail-badge avail-free">🟢 AVAILABLE</span>`;

        // Detailed reservation list
        const list = hasBookings
            ? s.reservations.map(r => {
                const statusColor = r.status === 'Approved' ? '#10B981'
                    : r.status === 'In Progress' ? '#F59E0B' : '#3B82F6';
                const timeStr = r.start_time && r.end_time
                    ? `${r.start_time.slice(0,5)} - ${r.end_time.slice(0,5)}`
                    : 'Full day';
                return `<div class="resv-row">
                    <i class="fas fa-calendar-day" style="color:${statusColor};"></i>
                    <div>
                        <div style="font-weight:600;">${r.title}</div>
                        <div style="font-size:0.78rem;color:var(--text-muted,#9CA3AF);">
                            ${r.start_date}${r.start_date !== r.end_date ? ' → ' + r.end_date : ''} · ${timeStr} · <span style="color:${statusColor};font-weight:600;">${r.status}</span>
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-muted,#9CA3AF);">
                            Applicant: ${r.applicant_name} · ${r.total_participants || 0} participants
                        </div>
                    </div>
                </div>`;
            }).join('')
            : '<div class="resv-empty"><i class="fas fa-check-circle" style="color:#10B981;"></i> No reservations for the selected period — this space is free to book!</div>';

        return `<tr class="${hasBookings ? 'row-booked' : 'row-free'}">
            <td class="clickable-space-code"><strong>${s.space_code}</strong></td>
            <td>
                <div style="font-weight:600;">${s.space_name}</div>
                <div style="font-size:0.78rem;color:var(--text-muted,#9CA3AF);">${s.category || ''}</div>
            </td>
            <td style="text-align:center;">${availabilityBadge}</td>
            <td>${list}</td>
        </tr>`;
    }).join('');
    document.getElementById('scheduleShowingInfo').textContent =
        `Showing 1 to ${spaces.length} of ${spaces.length} entries`;
}

/* ──────────────────────────────────────────────────────
   REAL-TIME CLASH PREVIEW
   ──────────────────────────────────────────────────────
   Whenever the student finishes choosing space + dates (+ optional times),
   query the server and tell them up-front whether their proposed slot
   collides with an existing reservation. Debounced so quick typing in
   the date field doesn't spam the API.
   ────────────────────────────────────────────────────── */
let clashTimer = null;

function scheduleClashCheck() {
    clearTimeout(clashTimer);
    clashTimer = setTimeout(runClashCheck, 350);
}

async function runClashCheck() {
    const box = document.getElementById('clashPreview');
    if (!box) return;

    const space_id   = document.getElementById('bookSpaceSelect')?.value;
    const start_date = document.getElementById('bookStartDate')?.value;
    const end_date   = document.getElementById('bookEndDate')?.value;
    const start_time = document.getElementById('bookStartTime')?.value;
    const end_time   = document.getElementById('bookEndTime')?.value;

    if (!space_id || !start_date || !end_date) {
        box.className = 'clash-preview';
        box.innerHTML = '<span class="cp-default">ⓘ Pick a space and dates to see existing reservations for that slot.</span>';
        return;
    }

    box.className = 'clash-preview cp-loading';
    box.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking availability…';

    const r = await api('user_spaces.php', 'clash_preview', {
        params: { space_id, start_date, end_date, start_time, end_time },
    });
    if (!r.success) {
        box.className = 'clash-preview cp-error';
        box.innerHTML = '⚠️ ' + (r.message || 'Could not check availability');
        return;
    }

    if (!r.data.has_clash) {
        box.className = 'clash-preview cp-ok';
        box.innerHTML = '<i class="fas fa-circle-check"></i> Slot is available — no conflicts detected.';
        return;
    }

    const rows = r.data.reservations.map(x =>
        `<li><strong>${x.reservation_title}</strong> · ${x.applicant_name} · ${x.start_date}${x.start_time ? ' ' + x.start_time : ''} → ${x.end_date}${x.end_time ? ' ' + x.end_time : ''} <em>(${x.status})</em></li>`
    ).join('');
    box.className = 'clash-preview cp-clash';
    box.innerHTML = `<strong>⚠️ This slot conflicts with ${r.data.reservations.length} existing reservation${r.data.reservations.length === 1 ? '' : 's'}:</strong><ul>${rows}</ul>`;
}

/* ──────────────────────────────────────────────────────
   BOOKING FORM SUBMISSION
   ────────────────────────────────────────────────────── */
async function submitBooking() {
    const space_id          = parseInt(document.getElementById('bookSpaceSelect').value, 10);
    const reservation_title = document.getElementById('bookReservationTitle').value.trim();
    const event_name        = document.getElementById('bookEventName').value.trim();
    const start_date        = document.getElementById('bookStartDate').value;
    const end_date          = document.getElementById('bookEndDate').value;
    const start_time        = document.getElementById('bookStartTime').value || null;
    const end_time          = document.getElementById('bookEndTime').value   || null;
    const total_participants = parseInt(document.getElementById('bookParticipants').value, 10);

    if (!space_id)           { showToast('Please select a space', 'error'); return; }
    if (!reservation_title)  { showToast('Reservation title required', 'error'); return; }
    if (!event_name)         { showToast('Event name required', 'error'); return; }
    if (!start_date || !end_date) { showToast('Start and end date required', 'error'); return; }
    if (!total_participants || total_participants < 1) { showToast('Participants must be at least 1', 'error'); return; }

    if (new Date(start_date) < new Date(new Date().toDateString())) {
        showToast('Start date cannot be in the past', 'error'); return;
    }
    if (new Date(end_date) < new Date(start_date)) {
        showToast('End date must be on or after start date', 'error'); return;
    }

    const body = { space_id, reservation_title, event_name, start_date, end_date,
                   start_time, end_time, total_participants };
    const r = await api('user_bookings.php', 'submit_booking', { method: 'POST', body });
    if (r.success) {
        const newBookingId = r.data?.booking_id;
        // Legacy "New Space Booking" form still routes through payment modal
        if (newBookingId && typeof window.openPaymentForBooking === 'function') {
            showToast('Booking created · Proceed to payment', 'success');
            await window.openPaymentForBooking(newBookingId);
            document.getElementById('bookingForm')?.reset();
        } else {
            showToast('Booking submitted! Status: Pending', 'success');
            document.getElementById('bookingForm')?.reset();
            loadMyBookings(); loadStats(); loadCalendarEvents();
            if (newBookingId) await showBookingReceipt(newBookingId);
            else switchToView('spaceBookingList');
        }
    } else {
        showToast(r.message || 'Failed', 'error');
    }
}

/* ──────────────────────────────────────────────────────
   BOOKING RECEIPT
   ────────────────────────────────────────────────────── */
async function showBookingReceipt(bookingId) {
    const r = await api('user_bookings.php', 'get_booking_detail', { params: { booking_id: bookingId } });
    if (!r.success) { showToast(r.message || 'Receipt unavailable', 'error'); return; }
    const b = r.data;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; };

    set('rcptRef', 'BK-' + String(b.id).padStart(6, '0'));
    set('rcptApplicant', b.applicant || currentUser?.full_name);
    set('rcptStudentNo', b.student_no || currentUser?.student_no);
    set('rcptEmail', b.email || currentUser?.email);
    set('rcptPhone', b.phone || currentUser?.phone);
    set('rcptTitle', b.reservation_title);
    set('rcptEvent', b.event_name);
    set('rcptParticipants', b.total_participants);
    set('rcptApplied', fmtDate(b.applied_date));
    set('rcptSpaceCode', b.space_code);
    set('rcptSpaceName', b.space_name);
    set('rcptCategory', b.category);
    set('rcptCapacity', (b.seating_capacity || '—') + ' seats');
    set('rcptStart', fmtDate(b.start_date) + (b.start_time ? ' · ' + b.start_time : ''));
    set('rcptEnd', fmtDate(b.end_date) + (b.end_time ? ' · ' + b.end_time : ''));
    set('rcptGenerated', new Date().toLocaleString());

    // Payment details — query the payment endpoint for full info
    try {
        const pRes = await fetch(`../php/payment.php?action=receipt&reservation_id=${b.id}`, { credentials: 'same-origin' });
        const pJson = await pRes.json();
        const paySection = document.getElementById('rcptPaymentSection');
        if (pJson.success && pJson.data && pJson.data.payment_id) {
            const p = pJson.data;
            const methodLabel = {
                FPX: 'Online Banking (FPX)' + (p.bank_name ? ' · ' + p.bank_name : ''),
                TNG: 'Touch \'n Go eWallet',
                Boost: 'Boost eWallet',
                Card: 'Credit/Debit Card' + (p.card_last4 ? ' · ****' + p.card_last4 : ''),
                Cash: 'Cash',
            }[p.method] || p.method;
            set('rcptPayRef', p.reference_no);
            set('rcptPayMethod', methodLabel);
            set('rcptPayAmount', 'RM ' + parseFloat(p.amount).toFixed(2));
            set('rcptPaidAt', p.paid_at ? new Date(p.paid_at).toLocaleString() : '—');
            if (paySection) paySection.style.display = '';
        } else if (paySection) {
            paySection.style.display = 'none';
        }
    } catch (e) { /* payment info optional */ }

    // Set status badge
    const statusEl = document.getElementById('rcptStatus');
    if (statusEl) {
        const status = (b.status || 'Pending').toLowerCase();
        statusEl.className = 'receipt-status-badge ' + (status.includes('approv') ? 'approved' : status.includes('reject') ? 'rejected' : 'pending');
        statusEl.textContent = (b.status || 'Pending').toUpperCase();
    }

    // Remember the key fields so "Email Receipt" can compose a message.
    lastReceipt = {
        ref:          'BK-' + String(b.id).padStart(6, '0'),
        applicant:    b.applicant || currentUser?.full_name || '',
        email:        b.email || currentUser?.email || '',
        title:        b.reservation_title || '',
        event:        b.event_name || '',
        space:        (b.space_code ? b.space_code + ' — ' : '') + (b.space_name || ''),
        start:        fmtDate(b.start_date) + (b.start_time ? ' ' + b.start_time : ''),
        end:          fmtDate(b.end_date) + (b.end_time ? ' ' + b.end_time : ''),
        participants: b.total_participants || '',
        status:       (b.status || 'Pending').toUpperCase(),
    };

    document.getElementById('receiptModal').style.display = 'flex';
}

/* Compose an email of the receipt (opens the user's mail client, pre-filled). */
let lastReceipt = null;
function emailReceipt() {
    if (!lastReceipt) { showToast('Open a booking receipt first', 'info'); return; }
    const r = lastReceipt;
    const subject = `Room Booking Receipt — ${r.ref}`;
    const body = [
        'UiTM Tapah — Room Booking System',
        'Booking Confirmation Receipt',
        '──────────────────────────────',
        `Reference     : ${r.ref}`,
        `Status        : ${r.status}`,
        `Applicant     : ${r.applicant}`,
        `Reservation   : ${r.title}`,
        `Event         : ${r.event}`,
        `Room          : ${r.space}`,
        `Start         : ${r.start}`,
        `End           : ${r.end}`,
        `Participants  : ${r.participants}`,
        '──────────────────────────────',
        'Thank you for booking with RBS | UiTM.',
    ].join('\n');
    const href = `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
}

function hideReceipt() {
    document.getElementById('receiptModal').style.display = 'none';
    // Refresh bookings list so any status change is visible immediately
    loadMyBookings();
}

/* ──────────────────────────────────────────────────────
   VIEW SWITCHING
   ────────────────────────────────────────────────────── */
const viewMap = {
    dashboard:        'dashboardView',
    browseSpaces:     'browseSpacesView',
    spaceDetailNew:   'spaceDetailNewView',
    reserveStep1:     'reserveStep1View',
    reserveStep2:     'reserveStep2View',
    reserveStep3:     'reserveStep3View',
    spaceBookingList: 'spaceBookingListView',
    calendarView:     'calendarViewPage',
    moderatorList:    'moderatorListView',
};
const allViews = Object.values(viewMap);

// Breadcrumb trails per view. Each crumb is [label, targetView] — a null target
// renders as plain text (the current location); otherwise it's a clickable link.
const crumbMap = {
    dashboard:        [['Home', 'dashboard']],
    browseSpaces:     [['Home', 'dashboard'], ['Book a Space', 'browseSpaces']],
    spaceDetailNew:   [['Home', 'dashboard'], ['Book a Space', 'browseSpaces'], ['Room details', null]],
    reserveStep1:     [['Home', 'dashboard'], ['Book a Space', 'browseSpaces'], ['Reserve', null]],
    reserveStep2:     [['Home', 'dashboard'], ['Book a Space', 'browseSpaces'], ['Confirm', null]],
    reserveStep3:     [['Home', 'dashboard'], ['Book a Space', 'browseSpaces'], ['Payment', null]],
    spaceBookingList: [['Home', 'dashboard'], ['Space', 'spaceBookingList'], ['My Bookings', null]],
    calendarView:     [['Home', 'dashboard'], ['Space', 'spaceBookingList'], ['Calendar', null]],
    moderatorList:    [['Home', 'dashboard'], ['Space', 'spaceBookingList'], ['Moderator List', null]],
};

function switchToView(v, opts = {}) {
    allViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const target = viewMap[v];
    if (!target) return;
    document.getElementById(target).style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-view="${v}"]`);
    if (activeNav) activeNav.classList.add('active');
    if (['spaceBookingList','calendarView','moderatorList'].includes(v)) {
        document.getElementById('navSpaceParent')?.classList.add('active', 'expanded');
        document.getElementById('spaceSubmenu')?.classList.add('show');
    }

    const crumbs = crumbMap[v] || [['Home', 'dashboard'], ['Space', null]];
    document.getElementById('topBreadcrumb').innerHTML = crumbs.map((c, i) => {
        const [label, view] = c;
        if (i === crumbs.length - 1) return `<span class="active-crumb">${label}</span>`;
        const node = view
            ? `<a href="#" class="crumb-link" data-view="${view}">${label}</a>`
            : `<span>${label}</span>`;
        return `${node} <i class="fas fa-chevron-right"></i> `;
    }).join('');

    if (v === 'spaceBookingList') renderTable();
    if (v === 'dashboard')        { renderDashCal(); loadStats(); loadPersonalStats(); }
    if (v === 'calendarView')     renderCal2();
    if (v === 'browseSpaces' && typeof window.bsEnsureLoaded === 'function') window.bsEnsureLoaded();

    // Record the view in browser history so the Back button steps through the
    // SPA views instead of leaving straight to the landing page. Skipped when the
    // change was itself triggered by Back/Forward (fromHistory).
    if (!opts.fromHistory) {
        const st = { view: v };
        if (opts.replace || (history.state && history.state.view === v)) history.replaceState(st, '');
        else history.pushState(st, '');
    }
}

/* ──────────────────────────────────────────────────────
   DOM WIRING (after DOM ready)
   ────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
    ensureToastContainer();

    // Auth + initial loads in parallel
    const user = await loadProfile();
    if (!user) return;

    // Apply saved theme
    applyTheme(getTheme());

    // Theme toggle button
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);
    document.getElementById('themeSwitch')?.addEventListener('click', toggleTheme);

    // Receipt modal buttons
    document.getElementById('closeReceiptBtn')?.addEventListener('click', hideReceipt);
    document.getElementById('btnCloseReceipt')?.addEventListener('click', hideReceipt);
    document.getElementById('btnPrintReceipt')?.addEventListener('click', () => window.print());
    document.getElementById('btnEmailReceipt')?.addEventListener('click', emailReceipt);

    // Notification bell
    document.getElementById('notificationBell')?.addEventListener('click', function (e) {
        e.stopPropagation();
        const dropdown = document.getElementById('notifDropdown');
        dropdown.classList.toggle('show');
        if (dropdown.classList.contains('show')) loadNotifications();
    });
    document.getElementById('markAllReadBtn')?.addEventListener('click', markAllNotificationsRead);
    // Close on outside click
    document.addEventListener('click', e => {
        const dd = document.getElementById('notifDropdown');
        const bell = document.getElementById('notificationBell');
        if (dd && !dd.contains(e.target) && bell && !bell.contains(e.target)) dd.classList.remove('show');
    });
    // Load initial badge count + poll every 60s
    loadNotifications();
    setInterval(loadNotifications, 60000);

    // Profile dropdown toggle
    document.getElementById('userProfileBtn')?.addEventListener('click', function () {
        const dropdown = document.getElementById('userDropdown');
        const isOpen = dropdown?.style.display === 'block';
        dropdown.style.display = isOpen ? 'none' : 'block';
        this.setAttribute('aria-expanded', !isOpen);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
        const dropdown = document.getElementById('userDropdown');
        const profileBtn = document.getElementById('userProfileBtn');
        if (dropdown && !dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
            dropdown.style.display = 'none';
            profileBtn.setAttribute('aria-expanded', 'false');
        }
    });

    await Promise.all([loadStats(), loadMyBookings(), loadCategories(), loadCalendarEvents()]);

    // ----- Table controls
    document.getElementById('entriesSelect')?.addEventListener('change', e => {
        entriesPerPage = +e.target.value; currentPage = 1; renderTable();
    });
    document.getElementById('tableSearch')?.addEventListener('input', e => {
        searchQuery = e.target.value; currentPage = 1; renderTable();
    });

    // ----- "Add" button on My Bookings list → start the Book a Space flow
    document.getElementById('btnAddBookingTop')?.addEventListener('click', () => switchToView('browseSpaces'));

    // ----- Calendar nav
    document.getElementById('prevBtn')?.addEventListener('click', () => { calDate.setMonth(calDate.getMonth() - 1); renderDashCal(); });
    document.getElementById('nextBtn')?.addEventListener('click', () => { calDate.setMonth(calDate.getMonth() + 1); renderDashCal(); });
    document.getElementById('todayBtn')?.addEventListener('click', () => { calDate = new Date(); renderDashCal(); });
    document.getElementById('calPrevBtn2')?.addEventListener('click', () => { cal2Date.setMonth(cal2Date.getMonth() - 1); renderCal2(); });
    document.getElementById('calNextBtn2')?.addEventListener('click', () => { cal2Date.setMonth(cal2Date.getMonth() + 1); renderCal2(); });
    document.getElementById('calTodayBtn2')?.addEventListener('click', () => { cal2Date = new Date(); renderCal2(); });

    // ----- Schedule filter
    document.getElementById('catSelect')?.addEventListener('change', e =>
        loadSpaceNames(e.target.value, 'spaceNameSelect')
    );
    document.getElementById('searchScheduleBtn')?.addEventListener('click', searchSchedule);
    // Friendlier: default both dates to today, and search on Enter from any filter
    (function initSchedule() {
        const sd = document.getElementById('startDate');
        const ed = document.getElementById('endDate');
        const today = ymd(new Date());
        if (sd && !sd.value) { sd.value = today; sd.min = today; }
        if (ed && !ed.value) ed.value = today;
        ['catSelect','spaceNameSelect','startDate','endDate'].forEach(id => {
            document.getElementById(id)?.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); searchSchedule(); }
            });
        });
    })();

    // ----- PDF modal
    document.getElementById('pdfScheduleBtn')?.addEventListener('click', () => {
        window.print();
    });
    document.getElementById('closeModalBtn')?.addEventListener('click', () =>
        document.getElementById('scheduleModal').style.display = 'none'
    );

    // ----- Logo → back to dashboard home (and scroll to top of the page)
    const goHome = () => { switchToView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    document.getElementById('sidebarLogo')?.addEventListener('click', goHome);
    document.getElementById('sidebarLogo')?.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); }
    });

    // ----- Clickable breadcrumb (directory flow)
    document.getElementById('topBreadcrumb')?.addEventListener('click', e => {
        const link = e.target.closest('.crumb-link');
        if (!link) return;
        e.preventDefault();
        switchToView(link.dataset.view);
    });

    // ----- Browser Back/Forward steps through the SPA views
    window.addEventListener('popstate', e => {
        const v = (e.state && e.state.view) || 'dashboard';
        if (viewMap[v]) switchToView(v, { fromHistory: true });
    });

    // ----- Sidebar nav
    document.querySelectorAll('.nav-item[data-view]').forEach(item =>
        item.addEventListener('click', function () { switchToView(this.dataset.view); })
    );
    document.getElementById('navSpaceParent')?.addEventListener('click', function (e) {
        if (e.target.closest('.submenu')) return;
        const sub = document.getElementById('spaceSubmenu');
        sub.classList.toggle('show'); this.classList.toggle('expanded');
        switchToView('spaceBookingList');
    });

    // ----- Logout
    document.getElementById('logoutBtn')?.addEventListener('click', doLogout);

    // ----- Default view + sidebar state (replace: this is the SPA's base history entry)
    switchToView('dashboard', { replace: true });
    document.getElementById('spaceSubmenu')?.classList.add('show');
    document.getElementById('navSpaceParent')?.classList.add('expanded');
});

// expose to inline onclick handlers
window.viewBooking   = viewBooking;
window.cancelBooking = cancelBooking;
window.switchToView  = switchToView;
