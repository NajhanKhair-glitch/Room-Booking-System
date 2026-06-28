/* =====================================================
   UITM SSO PORTAL - CLIENT SCRIPT
   =====================================================
   Mensimulasikan portal UiTM SSO. Flow:
     1. Student input Student ID + Password
     2. POST ke uitm_sso_api.php (simulated UiTM server)
     3. Jika valid, dapat SSO token
     4. Redirect ke sso_callback.php?token=XXX
        yang akan validate token + create local session
     5. Redirect ke dashboard
   ===================================================== */

// Build absolute URL from current page location to avoid path resolution issues
const BASE_URL = window.location.href.replace(/\/source\/[^/]*$/, '');
const UITM_SSO_API = BASE_URL + '/php/uitm_sso_api.php';
const SSO_CALLBACK = BASE_URL + '/php/sso_callback.php';

document.getElementById('footerYear').textContent = new Date().getFullYear();

/* ─── Toggle password visibility ─── */
document.getElementById('togglePassword')?.addEventListener('click', function () {
    const pwd = document.getElementById('ssoPassword');
    const icon = this.querySelector('i');
    if (pwd.type === 'password') {
        pwd.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        pwd.type = 'password';
        icon.className = 'fas fa-eye';
    }
});

/* ─── Show error message ─── */
function showError(message) {
    const err = document.getElementById('ssoError');
    err.textContent = message;
    err.classList.add('show');
}

/* ─── Hide error message ─── */
function clearError() {
    const err = document.getElementById('ssoError');
    err.textContent = '';
    err.classList.remove('show');
}

/* ─── Show loading overlay ─── */
function showLoading(text) {
    const overlay = document.getElementById('ssoLoadingOverlay');
    document.getElementById('ssoLoadingText').textContent = text || (window.i18n ? window.i18n.t('sso.loading') : 'Connecting to UiTM SSO server...');
    overlay.classList.add('show');
}

function hideLoading() {
    document.getElementById('ssoLoadingOverlay').classList.remove('show');
}

/* ─── Submit SSO form ─── */
document.getElementById('ssoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const studentId = document.getElementById('ssoStudentId').value.trim();
    const password = document.getElementById('ssoPassword').value;
    const btn = document.getElementById('ssoSubmitBtn');

    if (!studentId || !password) {
        showError('⚠️ Sila masukkan Student ID dan password.');
        return;
    }

    btn.disabled = true;
    showLoading('Menyambung ke UiTM SSO server...');

    // Check kalau page dibuka secara file:// instead of http://
    if (window.location.protocol === 'file:') {
        hideLoading();
        btn.disabled = false;
        showError('⚠️ Sila buka melalui http://localhost/csc264-project/source/sso_login_page.html — bukan klik file terus dari folder.');
        return;
    }

    // Show actual URL being called for debug
    console.log('SSO fetching:', `${UITM_SSO_API}?action=authenticate`);

    try {
        // Step 1: Send credentials to UiTM SSO API
        // Using URL-encoded form data (simplest, most compatible with all Apache configs)
        const formBody = new URLSearchParams();
        formBody.append('student_id', studentId);
        formBody.append('password', password);

        const res = await fetch(`${UITM_SSO_API}?action=authenticate`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formBody.toString(),
        });

        if (!res.ok) {
            const text = await res.text();
            hideLoading();
            btn.disabled = false;
            showError(`⚠️ Server HTTP ${res.status} from ${UITM_SSO_API}. Response: "${text.substring(0, 200)}". Open DevTools (F12) → Network tab and check the actual request.`);
            console.error('SSO HTTP error:', res.status, 'URL was:', `${UITM_SSO_API}?action=authenticate`, 'Body:', text);
            return;
        }

        // Try parse as JSON; show raw text if PHP leaked output
        const responseText = await res.text();
        let j;
        try {
            j = JSON.parse(responseText);
        } catch (parseErr) {
            hideLoading();
            btn.disabled = false;
            showError(`⚠️ Server returned invalid JSON. Raw response: ${responseText.substring(0, 300)}`);
            console.error('SSO JSON parse error. Raw response:', responseText);
            return;
        }

        if (!j.success) {
            hideLoading();
            btn.disabled = false;
            showError('⚠️ ' + (j.message || 'Authentication gagal'));
            return;
        }

        // Step 2: SSO authenticated — show success message
        document.getElementById('ssoLoadingText').textContent =
            `✓ Welcome ${j.user.full_name}. Redirecting...`;

        // Step 3: Wait a bit then redirect to callback with token
        await new Promise(r => setTimeout(r, 1200));

        // Redirect to local SSO callback handler with token
        window.location.href = `${SSO_CALLBACK}?token=${encodeURIComponent(j.sso_token)}`;

    } catch (err) {
        hideLoading();
        btn.disabled = false;
        showError(`⚠️ Network error: ${err.message}. Pastikan URL adalah http://localhost/csc264-project/source/sso_login_page.html`);
        console.error('SSO error:', err);
    }
});

/* ─── Auto-focus first empty field on load ─── */
window.addEventListener('load', () => {
    const studentId = document.getElementById('ssoStudentId');
    if (studentId && !studentId.value) studentId.focus();
});
