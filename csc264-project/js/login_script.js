/* =====================================================
   LOGIN PAGE - SCRIPT
   ===================================================== */

/* ─── Plexus background canvas ─── */
(function plexus() {
    const canvas = document.getElementById('plexus-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const N = 80, MAX_DIST = 150, R = 2;

    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5);
            this.vy = (Math.random() - 0.5);
        }
        update() {
            this.x += this.vx; this.y += this.vy;
            if (this.x < 0 || this.x > canvas.width)  this.vx *= -1;
            if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            this.x = Math.max(0, Math.min(canvas.width,  this.x));
            this.y = Math.max(0, Math.min(canvas.height, this.y));
        }
        draw() {
            ctx.fillStyle = 'rgba(95, 37, 159, 0.6)';
            ctx.beginPath(); ctx.arc(this.x, this.y, R, 0, Math.PI * 2); ctx.fill();
        }
    }
    function init() { particles = Array.from({ length: N }, () => new Particle()); }
    function connections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d  = Math.sqrt(dx * dx + dy * dy);
                if (d < MAX_DIST) {
                    const op = (1 - d / MAX_DIST) * 0.3;
                    ctx.strokeStyle = `rgba(95, 37, 159, ${op})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }
    function loop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => { p.update(); p.draw(); });
        connections();
        requestAnimationFrame(loop);
    }
    window.addEventListener('resize', resize);
    resize(); init(); loop();
})();

/* ─── Tab switching ─── */
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function () {
        const target = this.dataset.tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(target + '-content').classList.add('active');
        document.getElementById('loginError').classList.remove('show');
    });
});

/* ─── Auto-redirect if already logged in ─── */
(async () => {
    try {
        const res = await fetch('../php/auth.php?action=session', { credentials: 'same-origin' });
        const j = await res.json();
        if (j.success && j.data) {
            const target = j.data.role === 'Student' ? 'user_dashboard.html'
                         : 'admin_dashboard.html';
            // replace() so the dashboard's Back button returns to the landing page, not login
            window.location.replace(target);
        }
    } catch (e) { /* not logged in or DB down — stay on login */ }
})();

/* ─── Display SSO error if redirected back with error ─── */
(function showSsoError() {
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get('sso_error');
    if (ssoError) {
        const error = document.getElementById('loginError');
        if (error) {
            const messages = {
                'no_token': 'SSO login gagal: token tiada',
                'Invalid token': 'SSO token tidak sah',
                'Token expired': 'SSO token sudah luput',
                'provision_failed': 'Gagal cipta akaun melalui SSO',
            };
            error.textContent = '⚠️ ' + (messages[ssoError] || 'SSO error: ' + ssoError);
            error.classList.add('show');
        }
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
    }
})();

/* ─── Login form submission ─── */
const loginForm = document.getElementById('loginForm');
loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = document.getElementById('btnLogin');
    const icon  = btn.querySelector('i');
    const error = document.getElementById('loginError');
    error.classList.remove('show');

    const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    if (!email || !password) {
        error.textContent = 'Please enter your email and password.';
        error.classList.add('show');
        return;
    }

    // Email format validation:
    //  - Student email must be [id]@student.uitm.edu.my
    //  - Staff/Admin email must be @uitm.edu.my or @bsu.uitm.edu.my (NOT @student.uitm.edu.my)
    const isStudentEmail = /^[a-z0-9._-]+@student\.uitm\.edu\.my$/.test(email);
    const isStaffEmail   = /^[a-z0-9._-]+@(bsu\.)?uitm\.edu\.my$/.test(email) && !email.endsWith('@student.uitm.edu.my');

    if (!isStudentEmail && !isStaffEmail) {
        error.textContent = '⚠️ Email format invalid. Student: <id>@student.uitm.edu.my  |  Staff/Admin: <name>@uitm.edu.my';
        error.classList.add('show');
        return;
    }

    const originalIcon = icon.className;
    icon.className = 'fas fa-spinner loading';
    btn.disabled = true;

    try {
        const res = await fetch('../php/auth.php?action=login', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        const j = await res.json();
        if (j.success) {
            // Success — redirect (replace so Back from the dashboard goes to the landing page)
            window.location.replace(j.data.redirect || 'user_dashboard.html');
            return;
        }
        error.textContent = j.message || 'Login failed';
        error.classList.add('show');
    } catch (err) {
        error.textContent = 'Network error. Check XAMPP is running.';
        error.classList.add('show');
    } finally {
        icon.className = originalIcon;
        btn.disabled = false;
    }
});

/* ─── Sign-up form submission ─── */
const signupForm = document.getElementById('signupForm');
signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn   = document.getElementById('btnSignup');
    const icon  = btn.querySelector('i');
    const error = document.getElementById('signupError');
    error.textContent = '';

    const fullName = document.getElementById('signupFullName').value.trim();
    const studentNo = document.getElementById('signupStudentNo').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const faculty = document.getElementById('signupFaculty').value.trim();
    const program = document.getElementById('signupProgram').value.trim();
    const campus = document.getElementById('signupCampus').value.trim() || 'UITM Kampus Tapah';
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirmPassword').value;

    if (!fullName || !studentNo || !email || !password || !confirmPassword) {
        error.textContent = '⚠️ Please fill in all required fields.';
        return;
    }

    // Student signup must use @student.uitm.edu.my email
    const emailLower = email.toLowerCase();
    if (!/^[a-z0-9._-]+@student\.uitm\.edu\.my$/.test(emailLower)) {
        error.textContent = '⚠️ Student email must be in format: <student_id>@student.uitm.edu.my';
        return;
    }

    // Student no must be numeric (UiTM uses 10-digit student numbers)
    if (!/^\d{6,12}$/.test(studentNo)) {
        error.textContent = '⚠️ Student number must be 6-12 digits.';
        return;
    }

    if (password.length < 6) {
        error.textContent = '⚠️ Password must be at least 6 characters.';
        return;
    }

    if (password !== confirmPassword) {
        error.textContent = '⚠️ Passwords do not match.';
        return;
    }

    const originalIcon = icon.className;
    icon.className = 'fas fa-spinner fa-spin';
    btn.disabled = true;

    try {
        const res = await fetch('../php/auth.php?action=signup', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ full_name: fullName, student_no: studentNo, email, phone, faculty, program, campus, password }),
        });
        const j = await res.json();
        if (j.success) {
            alert('✓ Account created successfully! Redirecting to login...');
            document.querySelector('button[data-tab="uitm"]').click();
            document.getElementById('loginEmail').value = email;
            document.getElementById('loginPassword').focus();
            signupForm.reset();
            return;
        }
        error.textContent = '⚠️ ' + (j.message || 'Sign-up failed');
    } catch (err) {
        error.textContent = '⚠️ Network error. Check XAMPP is running.';
    } finally {
        icon.className = originalIcon;
        btn.disabled = false;
    }
});
