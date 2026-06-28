/* =====================================================
   RESERVATION FLOW — multi-step facility-portal style
   -----------------------------------------------------
   1. Detail view -> calls window.startReservation(space)
   2. Step 1: date/time/event/participants form +
              live payment summary + weekly timetable + terms
   3. Step 2: confirmation summary + BOOK NOW
   4. Step 3: order summary + CONFIRM BOOKING -> ToyyibPay
   5. Redirect to ToyyibPay (real FPX / card gateway)
   6. Return -> verify -> show receipt
   ===================================================== */

(function () {
    if (typeof window === 'undefined') return;
    const $ = id => document.getElementById(id);

    /* ─── State ─── */
    let SPACE = null;
    let BOOKING = {
        start_date: '', end_date: '',
        start_time: '', end_time: '',
        event: '', title: '', participants: 1,
        amount: 0, hours: 0, days: 0, tier_label: '', tier_rate: 0,
        method: 'FPX', bank: null,
        reservation_id: null, payment_ref: null,
    };
    let WEEK_START = mondayOf(new Date());
    let HAS_CLASH = false;          // true when the chosen slot overlaps an existing booking
    let clashTimer = null;          // debounce handle for the live clash check
    let clashSeq = 0;               // guards against out-of-order async responses

    /* ─── Helpers ─── */
    function fmt(n) { return 'RM ' + parseFloat(n || 0).toFixed(2); }
    function pad(n) { return String(n).padStart(2, '0'); }
    function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
    function fmtDate(s) {
        if (!s) return '—';
        const d = new Date(s + 'T00:00:00');
        return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    }
    function mondayOf(d) {
        const dt = new Date(d);
        const day = (dt.getDay() + 6) % 7;   // Mon = 0
        dt.setDate(dt.getDate() - day);
        dt.setHours(0, 0, 0, 0);
        return dt;
    }
    function timeToHours(t) {
        if (!t) return null;
        const [h, m] = t.split(':').map(Number);
        return h + (m || 0) / 60;
    }
    // Staff / lecturers (Moderator or Admin) book for free.
    function isStaffUser() {
        return !!(window.RBS_USER && window.RBS_USER.role && window.RBS_USER.role !== 'Student');
    }

    /* ─── Time slot dropdowns (08:00 – 18:00 in 30-min steps) ─── */
    function buildTimeOptions() {
        const opts = ['<option value="">-- Start Time --</option>'];
        const endOpts = ['<option value="">-- End Time --</option>'];
        for (let h = 8; h <= 18; h++) {
            for (let m of [0, 30]) {
                if (h === 18 && m > 0) continue;
                const t = `${pad(h)}:${pad(m)}`;
                const label = (h > 12 ? (h - 12) : h) + ':' + pad(m) + ' ' + (h >= 12 ? 'pm' : 'am');
                opts.push(`<option value="${t}:00">${label}</option>`);
                endOpts.push(`<option value="${t}:00">${label}</option>`);
            }
        }
        const s = $('rsStartTime'); if (s) s.innerHTML = opts.join('');
        const e = $('rsEndTime');   if (e) e.innerHTML = endOpts.join('');
    }

    /* ─── Pricing tier picker based on chosen hours ─── */
    function computeTier() {
        const sd = BOOKING.start_date, ed = BOOKING.end_date;
        const st = BOOKING.start_time, et = BOOKING.end_time;
        if (!sd || !ed || !st || !et) { BOOKING.amount = 0; return null; }

        const sH = timeToHours(st), eH = timeToHours(et);
        if (sH == null || eH == null || eH <= sH) { BOOKING.amount = 0; return null; }
        const hoursPerDay = eH - sH;
        const days = Math.max(1, Math.round((new Date(ed) - new Date(sd)) / 86400000) + 1);

        const rate    = parseFloat(SPACE.hourly_rate || 0);
        const rate4   = parseFloat(SPACE.rate_4hour || rate * 4 * 0.85);
        const rateDay = parseFloat(SPACE.rate_full_day || rate * 9 * 0.70);

        // Choose tier per day, then × days
        let perDay, label;
        if (hoursPerDay >= 8) {
            perDay = rateDay;
            label = 'Full Day';
        } else if (hoursPerDay >= 4) {
            // 4-hour bundle covers up to 4 hours; for 5-7.5 hours, charge 4-hour bundle + per-hour for extras
            const extraH = Math.max(0, hoursPerDay - 4);
            perDay = rate4 + extraH * rate;
            label = (hoursPerDay > 4) ? `4 Hour + ${extraH} hr` : '4 Hour Bundle';
        } else {
            perDay = hoursPerDay * rate;
            label = `${hoursPerDay} Hour(s)`;
        }
        let total = +(perDay * days).toFixed(2);
        // Staff / lecturer → free of charge
        if (isStaffUser()) { perDay = 0; total = 0; label = 'Staff · Free'; }
        BOOKING.amount = total;
        BOOKING.hours = hoursPerDay;
        BOOKING.days = days;
        BOOKING.tier_label = label;
        BOOKING.tier_rate  = perDay;
        return { perDay, days, total, label, hoursPerDay };
    }

    function updateSummary() {
        const t = computeTier();
        const body = $('rsSummary');
        if (!body) return;
        // The CONTINUE button stays clickable at all times — goStep2() validates and
        // shows a clear message for whatever is missing (better than a silently-dead button).
        if (!t) {
            // Distinguish an invalid time order (start ≥ end) from an incomplete selection,
            // so the user gets a clear, specific reason it can't continue.
            const st = BOOKING.start_time, et = BOOKING.end_time;
            if (st && et) {
                const sh = timeToHours(st), eh = timeToHours(et);
                if (sh != null && eh != null && eh <= sh) {
                    body.innerHTML = '<div class="rs-summary-empty" style="color:#dc2626;"><i class="fas fa-triangle-exclamation"></i> End time must be later than start time. Please fix the times to continue.</div>';
                    return;
                }
            }
            body.innerHTML = '<div class="rs-summary-empty">Please select start and end date and time.</div>';
            return;
        }
        if (isStaffUser()) {
            body.innerHTML = `
                <div class="rs-summary-date">${fmtDate(BOOKING.start_date)} To ${fmtDate(BOOKING.end_date)}</div>
                <div class="rs-summary-row"><span><i class="fas fa-id-badge"></i> Staff / Lecturer</span><strong style="color:#16a34a;">WAIVED</strong></div>
                <div class="rs-summary-total">TOTAL MYR</div>
                <div class="rs-summary-amount" style="color:#16a34a;">FREE</div>
            `;
            return;
        }
        body.innerHTML = `
            <div class="rs-summary-date">${fmtDate(BOOKING.start_date)} To ${fmtDate(BOOKING.end_date)}</div>
            <div class="rs-summary-row"><span>Facility ${t.label}</span><strong>${parseFloat(t.perDay).toFixed(2)}</strong></div>
            ${t.days > 1 ? `<div class="rs-summary-row"><span>× ${t.days} days</span><strong></strong></div>` : ''}
            <div class="rs-summary-total">TOTAL MYR</div>
            <div class="rs-summary-amount">${parseFloat(t.total).toFixed(2)}</div>
        `;
    }

    /* ─── Live booking-clash check (shows under Payment Summary; blocks Continue) ─── */
    function setClashAlert(html) {
        const el = $('rsClashAlert');
        if (!el) return;
        if (!html) { el.hidden = true; el.innerHTML = ''; }
        else       { el.hidden = false; el.innerHTML = html; }
    }

    function scheduleClashCheck() {
        if (clashTimer) clearTimeout(clashTimer);
        clashTimer = setTimeout(checkClash, 350);
    }

    async function checkClash() {
        HAS_CLASH = false;
        if (!SPACE) { setClashAlert(''); syncContinue(); return; }
        const { start_date, end_date, start_time, end_time } = BOOKING;
        // Only check once a complete, valid range is chosen (bad time order is
        // already messaged by updateSummary, so stay quiet here).
        if (!start_date || !end_date || !start_time || !end_time) { setClashAlert(''); syncContinue(); return; }
        const sh = timeToHours(start_time), eh = timeToHours(end_time);
        if (sh == null || eh == null || eh <= sh) { setClashAlert(''); syncContinue(); return; }

        const seq = ++clashSeq;
        try {
            const qs = new URLSearchParams({
                action: 'clash_preview', space_id: SPACE.id,
                start_date, end_date, start_time, end_time,
            });
            const res = await fetch(`../php/user_spaces.php?${qs}`, { credentials: 'same-origin' });
            const j = await res.json();
            if (seq !== clashSeq) return;                  // a newer check superseded this one
            if (j.success && j.data && j.data.has_clash) {
                HAS_CLASH = true;
                const list = (j.data.reservations || []).slice(0, 3).map(r => {
                    const t = (r.start_time && r.end_time)
                        ? `${formatTime(r.start_time)} – ${formatTime(r.end_time)}` : 'all day';
                    return `<li>${fmtDate(r.start_date)} · ${t} <span class="rs-clash-status">${r.status}</span></li>`;
                }).join('');
                setClashAlert(
                    `<div class="rs-clash-head"><i class="fas fa-triangle-exclamation"></i> Time slot not available</div>
                     <p>This room is already booked for the time you picked. Pick another time or date to continue.</p>
                     <ul class="rs-clash-list">${list}</ul>`
                );
            } else {
                setClashAlert('');
            }
        } catch (e) {
            // On a network/parse error don't block — the server re-checks on submit.
            if (seq === clashSeq) { HAS_CLASH = false; setClashAlert(''); }
        }
        syncContinue();
    }

    function syncContinue() {
        const btn = $('rsContinue');
        if (!btn) return;
        btn.classList.toggle('is-blocked', HAS_CLASH);
        btn.setAttribute('aria-disabled', HAS_CLASH ? 'true' : 'false');
    }

    /* ─── Weekly timetable ─── */
    async function loadWeek() {
        const ttEl = $('rsTimetable');
        ttEl.innerHTML = '<div class="rs-tt-loading">Loading schedule…</div>';
        try {
            const url = `../php/space_detail.php?action=week_schedule&space_id=${SPACE.id}&week_start=${ymd(WEEK_START)}`;
            const res = await fetch(url, { credentials: 'same-origin' });
            const j = await res.json();
            if (!j.success) {
                ttEl.innerHTML = '<div class="rs-tt-loading">Could not load schedule.</div>';
                return;
            }
            renderWeek(j.data);
        } catch (e) {
            ttEl.innerHTML = '<div class="rs-tt-loading">Schedule unavailable.</div>';
        }
    }

    function renderWeek(weekData) {
        // 30-min slots from 09:00 → 17:00 (matches screenshot)
        const slots = [];
        for (let h = 9; h <= 16; h++) {
            for (let m of [0, 30]) {
                slots.push({
                    start: `${pad(h)}:${pad(m)}`,
                    end:   m === 0 ? `${pad(h)}:30` : `${pad(h + 1)}:00`,
                });
            }
        }
        const days = weekData.days || [];
        const today = ymd(new Date());

        const head = '<tr><th></th>' + days.map(d => {
            const tag = d.date === today ? ' style="background:#67e8f9;color:#1c1c1a;"' : '';
            return `<th${tag}>${d.day_name}<br><small>${fmtDate(d.date)}</small></th>`;
        }).join('') + '</tr>';

        const rows = slots.map(slot => {
            const label = (parseInt(slot.start, 10) > 12 ? parseInt(slot.start, 10) - 12 : parseInt(slot.start, 10)) + ':' + slot.start.split(':')[1] + ' ' + (parseInt(slot.start) >= 12 ? 'pm' : 'am') + ' - ' +
                          (parseInt(slot.end, 10) > 12 ? parseInt(slot.end, 10) - 12 : parseInt(slot.end, 10)) + ':' + slot.end.split(':')[1] + ' ' + (parseInt(slot.end) >= 12 ? 'pm' : 'am');
            const cells = days.map(d => {
                const reserved = (d.reserved || []).find(r => {
                    const s = (r.start_time || '00:00').slice(0, 5);
                    const e = (r.end_time   || '23:59').slice(0, 5);
                    return slot.start < e && slot.end > s;
                });
                if (!reserved) return `<td></td>`;
                const cls = reserved.status === 'Pending' ? 'tt-pending' : (reserved.status === 'Approved' || reserved.status === 'In Progress') ? 'tt-booked' : 'tt-closed';
                const title = (reserved.title || reserved.applicant || '').slice(0, 14);
                return `<td class="${cls}" title="${reserved.title || ''}">${title}</td>`;
            }).join('');
            return `<tr><th>${label}</th>${cells}</tr>`;
        }).join('');

        $('rsTimetable').innerHTML = `<table class="rs-tt-table">
            <thead>${head}</thead>
            <tbody>${rows}</tbody>
        </table>`;
    }

    /* ─── Step 1 init ─── */
    window.startReservation = function (space) {
        SPACE = space;
        BOOKING = { ...BOOKING, reservation_id: null, payment_ref: null };
        if (typeof switchToView !== 'function') return;
        switchToView('reserveStep1');

        $('rsSpaceName').textContent     = (space.space_name || '—').toUpperCase();
        $('rsSpaceNameTerm').textContent = space.space_name || '';
        // Booking rules are fixed system-wide defaults (no longer per-space columns)
        $('rsWindowDays').textContent = 180;
        $('rsMaxDays').textContent    = 5;
        $('rsMinHours').textContent   = 1;

        buildTimeOptions();

        // Default to tomorrow
        const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
        $('rsStartDate').value = ymd(tmr);
        $('rsEndDate').value   = ymd(tmr);
        $('rsStartDate').min   = ymd(new Date());
        $('rsEndDate').min     = ymd(new Date());
        $('rsParticipants').placeholder = 'Max: ' + (space.seating_capacity || 10);
        $('rsParticipants').max         = space.seating_capacity || 999;
        $('rsEvent').value = '';
        $('rsTitle').value = '';
        $('rsAgreeTerms').checked = false;
        $('rsStartTime').value = '';
        $('rsEndTime').value = '';

        BOOKING.start_date = $('rsStartDate').value;
        BOOKING.end_date   = $('rsEndDate').value;
        HAS_CLASH = false;
        setClashAlert('');
        syncContinue();
        updateSummary();
        WEEK_START = mondayOf(new Date(BOOKING.start_date));
        loadWeek();
    };

    /* ─── Step 1 field listeners ─── */
    document.addEventListener('DOMContentLoaded', () => {
        const fields = ['rsStartDate','rsEndDate','rsStartTime','rsEndTime','rsEvent','rsParticipants','rsTitle','rsAgreeTerms'];
        fields.forEach(id => $(id)?.addEventListener('input', readForm));
        fields.forEach(id => $(id)?.addEventListener('change', readForm));

        $('rsBackToDetail')?.addEventListener('click', () => {
            if (SPACE) window.openSpaceDetail(SPACE.id);
        });
        $('rsCancel')?.addEventListener('click', () => switchToView('browseSpaces'));
        $('rsContinue')?.addEventListener('click', goStep2);

        $('rsWeekPrev')?.addEventListener('click', () => { WEEK_START.setDate(WEEK_START.getDate() - 7); loadWeek(); });
        $('rsWeekThis')?.addEventListener('click', () => { WEEK_START = mondayOf(new Date()); loadWeek(); });
        $('rsWeekNext')?.addEventListener('click', () => { WEEK_START.setDate(WEEK_START.getDate() + 7); loadWeek(); });

        /* Step 2 */
        $('rs2Back')?.addEventListener('click', () => switchToView('reserveStep1'));
        $('rs2BackBtn')?.addEventListener('click', () => switchToView('reserveStep1'));
        $('rs2BookNow')?.addEventListener('click', goStep3);

        /* Step 3 */
        $('rs3Cancel')?.addEventListener('click', () => {
            if (confirm('Cancel this booking? You will lose progress.')) switchToView('browseSpaces');
        });
        $('rs3Confirm')?.addEventListener('click', confirmAndPay);

        document.querySelectorAll('.rs3-pay-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                document.querySelectorAll('.rs3-pay-tile').forEach(t => t.classList.remove('is-selected'));
                tile.classList.add('is-selected');
                BOOKING.method = tile.dataset.pmethod;
            });
        });
    });

    function readForm() {
        BOOKING.start_date   = $('rsStartDate').value;
        BOOKING.end_date     = $('rsEndDate').value;
        BOOKING.start_time   = $('rsStartTime').value;
        BOOKING.end_time     = $('rsEndTime').value;
        BOOKING.event        = $('rsEvent').value.trim();
        BOOKING.title        = $('rsTitle').value.trim() || BOOKING.event;
        BOOKING.participants = parseInt($('rsParticipants').value, 10) || 0;
        updateSummary();
        scheduleClashCheck();
    }

    /* ─── Step 1 → Step 2 ─── */
    async function goStep2() {
        if (!SPACE) return toast('Please choose a space first', 'error');
        readForm();   // pull the latest field values + recompute the price
        // Validate
        if (!BOOKING.start_date || !BOOKING.end_date) return toast('Date required', 'error');
        if (new Date(BOOKING.start_date) < new Date(new Date().toDateString())) {
            return toast('Reservation start date must not be in the past time.', 'error');
        }
        if (new Date(BOOKING.end_date) < new Date(BOOKING.start_date)) {
            return toast('End date must be on or after start date.', 'error');
        }
        if (!BOOKING.start_time || !BOOKING.end_time) return toast('Time required', 'error');
        const _sh = timeToHours(BOOKING.start_time), _eh = timeToHours(BOOKING.end_time);
        if (_sh == null || _eh == null || _eh <= _sh) return toast('End time must be later than start time', 'error');
        if (!BOOKING.event) return toast('Event description required', 'error');
        if (!BOOKING.participants || BOOKING.participants < 1) return toast('Participants required', 'error');
        if (SPACE.seating_capacity && BOOKING.participants > SPACE.seating_capacity) {
            return toast(`Participants exceed capacity (${SPACE.seating_capacity})`, 'error');
        }
        if (!$('rsAgreeTerms').checked) return toast('Please agree to the terms', 'error');
        // Run a fresh clash check and block if the slot is taken (server re-checks on submit too).
        await checkClash();
        if (HAS_CLASH) return toast('This room is already booked for that time. Please pick another slot.', 'error');

        // Populate Step 2 confirmation (null-safe: a missing element must never
        // break the transition to the next step)
        const setText = (id, val) => { const e = $(id); if (e) e.textContent = val; };
        const dtStr = `${fmtDate(BOOKING.start_date)} ${formatTime(BOOKING.start_time)} - ${formatTime(BOOKING.end_time)}` +
                      (BOOKING.start_date !== BOOKING.end_date ? ` (to ${fmtDate(BOOKING.end_date)})` : '');
        setText('rs2SpaceName', (SPACE.space_name || '—').toUpperCase());
        setText('rs2Event', BOOKING.event);
        setText('rs2DateTime', dtStr);
        setText('rs2Facilities', SPACE.facilities_list || 'Standard amenities');
        setText('rs2Remark', SPACE.remark || 'No special remark.');
        setText('rs2Participants', BOOKING.participants + ' person(s)');
        setText('rs2Amount', parseFloat(BOOKING.amount || 0).toFixed(2));

        switchToView('reserveStep2');
    }

    function formatTime(t) {
        if (!t) return '';
        const [h, m] = t.split(':');
        const H = parseInt(h, 10);
        return ((H > 12 ? H - 12 : H || 12)) + ':' + m + ' ' + (H >= 12 ? 'pm' : 'am');
    }

    /* ─── Step 2 → Step 3 (order/payment) ─── */
    function goStep3() {
        const money = isStaffUser() ? 'FREE' : parseFloat(BOOKING.amount).toFixed(2);
        $('rs3Date').textContent       = fmtDate(ymd(new Date()));
        $('rs3OrderDate').textContent  = `${formatTime(BOOKING.start_time)} - ${formatTime(BOOKING.end_time)}, ${fmtDate(BOOKING.start_date)}`;
        $('rs3OrderItem').textContent  = `${SPACE.space_name} (${SPACE.category})` + (isStaffUser() ? ' — Staff/Lecturer (free)' : '');
        $('rs3OrderPrice').textContent = money;
        $('rs3OrderTotal').textContent = money;
        $('rs3SubTotal').textContent   = money;
        $('rs3GrandTotal').textContent = money;
        const cbtn = $('rs3Confirm');
        if (cbtn) cbtn.innerHTML = isStaffUser()
            ? '<i class="fas fa-check"></i> CONFIRM BOOKING (FREE)'
            : '<i class="fas fa-lock"></i> CONFIRM &amp; PAY <i class="fas fa-arrow-right"></i>';
        switchToView('reserveStep3');
    }

    /* ─── Confirm booking, then redirect to ToyyibPay to pay ─── */
    function resetConfirmBtn() {
        const btn = $('rs3Confirm');
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-lock"></i> CONFIRM &amp; PAY <i class="fas fa-arrow-right"></i>'; }
    }

    async function confirmAndPay() {
        const staff = isStaffUser();
        const msg = staff
            ? `Confirm booking for ${SPACE.space_name}?\n\nStaff / lecturer booking — FREE of charge.`
            : `Confirm booking for ${SPACE.space_name}?\nTotal: RM ${parseFloat(BOOKING.amount || 0).toFixed(2)}\n\nYou'll be redirected to ToyyibPay to complete payment.`;
        if (!confirm(msg)) return;

        const btn = $('rs3Confirm');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing…'; }

        // 1) Create the reservation (status Pending)
        const r = await api('user_bookings.php', 'submit_booking', { method: 'POST', body: {
            space_id: SPACE.id,
            reservation_title: BOOKING.title || BOOKING.event,
            event_name: BOOKING.event,
            start_date: BOOKING.start_date,
            end_date: BOOKING.end_date,
            start_time: BOOKING.start_time,
            end_time: BOOKING.end_time,
            total_participants: BOOKING.participants,
        }});
        if (!r.success) { resetConfirmBtn(); return toast(r.message || 'Failed to submit booking', 'error'); }
        BOOKING.reservation_id = r.data.booking_id;

        // 2) Create a ToyyibPay bill for this reservation
        let b;
        try {
            b = await fetch('../php/payment.php?action=create_bill', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reservation_id: BOOKING.reservation_id, amount: BOOKING.amount }),
            }).then(x => x.json());
        } catch (e) { b = { success: false, message: 'Network error' }; }
        if (!b || !b.success) { resetConfirmBtn(); return toast((b && b.message) || 'Could not start payment', 'error'); }

        // 3) Free booking → straight to success; otherwise redirect to ToyyibPay
        if (b.data && b.data.free) {
            window.location.href = 'user_dashboard.html?payment=success&rid=' + BOOKING.reservation_id;
        } else if (b.data && b.data.pay_url) {
            window.location.href = b.data.pay_url;
        } else {
            resetConfirmBtn();
            toast('Payment URL missing from gateway response', 'error');
        }
    }

    /* ─── Returned from ToyyibPay: show the result on the dashboard ─── */
    document.addEventListener('DOMContentLoaded', () => {
        const params = new URLSearchParams(window.location.search);
        const pay = params.get('payment');
        if (!pay) return;
        const rid = params.get('rid');
        history.replaceState({}, '', window.location.pathname);   // clean the URL
        if (pay === 'success') {
            toast('✓ Payment successful — booking submitted for approval', 'success');
            if (typeof loadMyBookings === 'function') loadMyBookings();
            if (typeof loadStats === 'function') loadStats();
            if (typeof loadCalendarEvents === 'function') loadCalendarEvents();
            if (rid && typeof showBookingReceipt === 'function') setTimeout(() => showBookingReceipt(rid), 350);
            else if (typeof switchToView === 'function') switchToView('spaceBookingList');
        } else {
            toast('Payment was not completed. The booking is still pending — pay again from My Bookings.', 'error');
            if (typeof switchToView === 'function') switchToView('spaceBookingList');
        }
    });

    /* ─── Misc helpers ─── */
    function toast(msg, type) {
        if (typeof showToast === 'function') showToast(msg, type || 'info');
        else alert(msg);
    }
})();
