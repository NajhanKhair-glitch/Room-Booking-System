/* =====================================================
   FORGOT PASSWORD — OTP reset flow
   Step 1 email → Step 2 OTP → Step 3 new password → done
   ===================================================== */
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const API = '../php/password_reset.php';

    /* ── State ── */
    let email = '';
    let token = '';
    let expiryTimer = null;
    let resendTimer = null;

    async function api(action, body) {
        try {
            const res = await fetch(`${API}?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(body || {}),
            });
            return await res.json();
        } catch (e) {
            return { success: false, message: 'Network error. Is the server running?' };
        }
    }

    function showError(id, msg) {
        const el = $(id);
        if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
    }
    function busy(btn, on, label) {
        if (!btn) return;
        btn.disabled = on;
        const span = btn.querySelector('span');
        if (span) {
            if (on) { btn.dataset.label = span.textContent; span.textContent = label || 'Please wait…'; }
            else if (btn.dataset.label) { span.textContent = btn.dataset.label; }
        }
    }

    function goPane(name) {
        document.querySelectorAll('.reset-pane').forEach(p => p.classList.remove('is-active'));
        $(name)?.classList.add('is-active');
        const map = { paneEmail: 1, paneOtp: 2, panePass: 3, paneDone: 3 };
        const n = map[name] || 1;
        [1, 2, 3].forEach(i => {
            const s = $('rstep' + i);
            if (!s) return;
            s.classList.toggle('is-active', i === n);
            s.classList.toggle('is-done', i < n);
        });
    }

    /* ── Countdown helpers ── */
    function startExpiry(seconds) {
        clearInterval(expiryTimer);
        let left = seconds;
        const tick = () => {
            const m = String(Math.floor(left / 60)).padStart(2, '0');
            const s = String(left % 60).padStart(2, '0');
            const el = $('otpTimer'); if (el) el.textContent = `${m}:${s}`;
            if (left-- <= 0) { clearInterval(expiryTimer); if (el) el.textContent = 'expired'; }
        };
        tick(); expiryTimer = setInterval(tick, 1000);
    }
    function startResendCooldown(seconds) {
        clearInterval(resendTimer);
        const btn = $('btnResend'); const span = $('resendIn');
        let left = seconds;
        if (btn) btn.disabled = true;
        const tick = () => {
            if (span) span.textContent = left;
            if (left-- <= 0) {
                clearInterval(resendTimer);
                if (btn) { btn.disabled = false; btn.innerHTML = 'Resend code'; }
            }
        };
        tick(); resendTimer = setInterval(tick, 1000);
    }

    /* ── OTP boxes UX (auto-advance, paste, backspace) ── */
    function setupOtpBoxes() {
        const boxes = Array.from(document.querySelectorAll('.otp-box'));
        boxes.forEach((box, i) => {
            box.addEventListener('input', () => {
                box.value = box.value.replace(/\D/g, '').slice(0, 1);
                if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
            });
            box.addEventListener('keydown', e => {
                if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
            });
            box.addEventListener('paste', e => {
                e.preventDefault();
                const digits = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6).split('');
                digits.forEach((d, k) => { if (boxes[k]) boxes[k].value = d; });
                (boxes[Math.min(digits.length, boxes.length) - 1] || boxes[0]).focus();
            });
        });
    }
    function readOtp() { return Array.from(document.querySelectorAll('.otp-box')).map(b => b.value).join(''); }
    function clearOtp() { document.querySelectorAll('.otp-box').forEach(b => b.value = ''); }

    /* ── Step 1: request OTP ── */
    async function requestOtp(targetEmail) {
        showError('errEmail', '');
        const r = await api('request_otp', { email: targetEmail });
        if (!r.success) { showError('errEmail', r.message); return false; }
        email = targetEmail;
        $('otpMasked').textContent = (r.data && r.data.masked_email) || targetEmail;
        if (r.data && r.data.demo_otp) {
            $('demoOtp').textContent = r.data.demo_otp;
            $('demoBox').hidden = false;
        } else {
            $('demoBox').hidden = true;
        }
        startExpiry((r.data && r.data.expires_in) || 600);
        startResendCooldown(45);
        clearOtp();
        return true;
    }

    document.addEventListener('DOMContentLoaded', () => {
        plexusBg();
        setupOtpBoxes();

        /* Step 1 submit */
        $('formEmail')?.addEventListener('submit', async e => {
            e.preventDefault();
            const val = $('frEmail').value.trim().toLowerCase();
            if (!val) return showError('errEmail', 'Please enter your email.');
            busy($('btnSendOtp'), true, 'Sending…');
            const ok = await requestOtp(val);
            busy($('btnSendOtp'), false);
            if (ok) { goPane('paneOtp'); document.querySelector('.otp-box')?.focus(); }
        });

        /* Resend */
        $('btnResend')?.addEventListener('click', async () => {
            showError('errOtp', '');
            $('btnResend').disabled = true;
            const ok = await requestOtp(email);
            if (!ok) { showError('errOtp', 'Could not resend. Try again shortly.'); }
        });

        /* Back to email */
        $('backToEmail')?.addEventListener('click', e => {
            e.preventDefault(); clearInterval(expiryTimer); clearInterval(resendTimer); goPane('paneEmail');
        });

        /* Step 2 submit: verify OTP */
        $('formOtp')?.addEventListener('submit', async e => {
            e.preventDefault();
            showError('errOtp', '');
            const otp = readOtp();
            if (otp.length !== 6) return showError('errOtp', 'Enter all 6 digits.');
            busy($('btnVerify'), true, 'Verifying…');
            const r = await api('verify_otp', { email, otp });
            busy($('btnVerify'), false);
            if (!r.success) { showError('errOtp', r.message); clearOtp(); document.querySelector('.otp-box')?.focus(); return; }
            token = r.data.token;
            clearInterval(expiryTimer);
            goPane('panePass');
            $('frPass')?.focus();
        });

        /* Show/hide password */
        document.querySelectorAll('.pass-eye').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = $(btn.dataset.target);
                if (!input) return;
                const show = input.type === 'password';
                input.type = show ? 'text' : 'password';
                btn.querySelector('i').className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
            });
        });

        /* Password strength meter */
        $('frPass')?.addEventListener('input', () => {
            const v = $('frPass').value;
            let score = 0;
            if (v.length >= 6) score++;
            if (v.length >= 10) score++;
            if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
            if (/\d/.test(v)) score++;
            if (/[^A-Za-z0-9]/.test(v)) score++;
            const bar = $('passBar');
            const pct = [0, 25, 45, 65, 85, 100][score];
            const col = score <= 1 ? '#dc2626' : score <= 3 ? '#f59e0b' : '#16a34a';
            if (bar) { bar.style.width = pct + '%'; bar.style.background = col; }
        });

        /* Step 3 submit: reset password */
        $('formPass')?.addEventListener('submit', async e => {
            e.preventDefault();
            showError('errPass', '');
            const p1 = $('frPass').value, p2 = $('frPass2').value;
            if (p1.length < 6) return showError('errPass', 'Password must be at least 6 characters.');
            if (p1 !== p2) return showError('errPass', 'Passwords do not match.');
            busy($('btnReset'), true, 'Resetting…');
            const r = await api('reset_password', { email, token, new_password: p1 });
            busy($('btnReset'), false);
            if (!r.success) { showError('errPass', r.message); return; }
            goPane('paneDone');
        });
    });

    /* ── Lightweight plexus/particle background (matches the login page) ── */
    function plexusBg() {
        const canvas = document.getElementById('plexus-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let w, h, pts;
        const N = 60;
        function resize() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }
        function make() {
            pts = Array.from({ length: N }, () => ({
                x: Math.random() * w, y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
            }));
        }
        function frame() {
            ctx.clearRect(0, 0, w, h);
            for (const p of pts) {
                p.x += p.vx; p.y += p.vy;
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;
            }
            for (let i = 0; i < pts.length; i++) {
                for (let j = i + 1; j < pts.length; j++) {
                    const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
                    const d = Math.hypot(dx, dy);
                    if (d < 130) {
                        ctx.strokeStyle = `rgba(95,37,159,${0.12 * (1 - d / 130)})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
                    }
                }
            }
            for (const p of pts) {
                ctx.fillStyle = 'rgba(95,37,159,0.5)';
                ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
            }
            requestAnimationFrame(frame);
        }
        resize(); make(); frame();
        window.addEventListener('resize', () => { resize(); make(); });
    }
})();
