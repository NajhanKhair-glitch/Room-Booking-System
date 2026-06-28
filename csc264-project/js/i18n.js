/* =====================================================
   I18N - LANGUAGE TRANSLATION SYSTEM (BM / EN)
   =====================================================
   Usage:
     - Add data-i18n="key" to any element with text to translate
     - Add data-i18n-placeholder="key" for input placeholders
     - Add data-i18n-title="key" for title/tooltip
     - Call i18n.setLang('bm' or 'en') to switch
     - Language preference persists in localStorage
   ===================================================== */

const TRANSLATIONS = {
    en: {
        // ─── Common ───
        'common.logout': 'Logout',
        'common.login': 'Login',
        'common.signin': 'Sign In',
        'common.signup': 'Sign Up',
        'common.submit': 'Submit',
        'common.cancel': 'Cancel',
        'common.save': 'Save',
        'common.delete': 'Delete',
        'common.edit': 'Edit',
        'common.view': 'View',
        'common.search': 'Search',
        'common.back': 'Back',
        'common.continue': 'Continue',
        'common.confirm': 'Confirm',
        'common.yes': 'Yes',
        'common.no': 'No',
        'common.loading': 'Loading…',
        'common.darkmode': 'Dark Mode',
        'common.settings': 'Settings',
        'common.profile': 'My Profile',
        'common.home': 'Home',
        'common.actions': 'Actions',
        'common.status': 'Status',
        'common.language': 'Language',
        'common.email': 'Email',
        'common.password': 'Password',
        'common.phone': 'Phone Number',
        'common.fullname': 'Full Name',
        'common.required': 'Required',

        // ─── Login Page ───
        'login.title': 'Room Booking System',
        'login.subtitle': 'University',
        'login.welcome': 'Welcome Back',
        'login.forgot': 'Forgot password?',
        'login.description': 'Sign in with your UiTM credentials to access the booking system.',
        'login.email_placeholder': 'you@uitm.edu.my',
        'login.password_placeholder': 'Your password',
        'login.guest_title': 'Guest Access',
        'login.guest_desc': 'Guest accounts are issued by campus administrators. Contact them to request one.',
        'login.request_access': 'Request Access',
        'login.signup_title': 'Create Account',
        'login.signup_desc': 'Join UiTM Tapah Booking System as a student.',
        'login.create_account': 'Create Account',
        'login.sso_button': 'Login with UiTM Portal (SSO)',
        'login.or': 'OR',
        'login.tab_signin': 'Sign In',
        'login.tab_signup': 'Sign Up',
        'login.tab_others': 'Others',
        'login.student_no': 'Student Number',
        'login.confirm_password': 'Confirm Password',

        // ─── Dashboards (sidebar) ───
        'nav.my_dashboard': 'My Dashboard',
        'nav.book_space': 'Book a Space',
        'nav.space': 'Space',
        'nav.space_management': 'Space Management',
        'nav.booking_requests': 'Booking Requests',
        'nav.all_bookings': 'All Bookings',
        'nav.space_list': 'Space List',
        'nav.space_booking_list': 'My Bookings',
        'nav.new_booking': 'Book a Space',
        'nav.calendar': 'Calendar',
        'nav.moderator_list': 'Moderator List',
        'nav.reports': 'Reports',
        'nav.activity_log': 'Activity Log',
        'nav.user_management': 'User Management',

        // ─── Roles ───
        'role.student': 'Student · Full Access',
        'role.moderator': 'Moderator',
        'role.admin': 'Administrator',

        // ─── Student Dashboard ───
        'student.total_spaces': 'Total Spaces',
        'student.active_bookings': 'My Active Bookings',
        'student.pending_approvals': 'Pending Approvals',
        'student.hours_scheduled': 'Hours Scheduled',
        'student.spaces_active': 'currently active',
        'student.calendar': 'My Calendar',
        'student.approved': 'Approved',
        'student.in_progress': 'In Progress',
        'student.pending': 'Pending',
        'student.applicant': 'Applicant Name',
        'student.event': 'Event',
        'student.category': 'Space Category',
        'student.space_name': 'Space Name',
        'student.start_date': 'Start Date',
        'student.end_date': 'End Date',
        'student.applied_date': 'Applied Date',
        'student.add': 'Add',
        'student.guidelines': 'Booking Guidelines',
        'student.today': 'Today',

        // ─── SSO Portal ───
        'sso.title': 'UiTM Single Sign-On Portal',
        'sso.secure': 'Secure Connection',
        'sso.banner': 'requires you to sign in with your UiTM credentials.',
        'sso.heading': 'UiTM SSO Login',
        'sso.subheading': 'Use your official UiTM Student ID or Email',
        'sso.field_id': 'Student ID / UiTM Email',
        'sso.field_password': 'UiTM Portal Password',
        'sso.placeholder_id': 'e.g., 2024220654 or 2024220654@student.uitm.edu.my',
        'sso.placeholder_password': 'Your UiTM portal password',
        'sso.btn_login': 'Sign In',
        'sso.back_link': 'Back to standard login',
        'sso.security_title': 'Security Guaranteed',
        'sso.security_desc': 'Your password is not shared with the booking system. Only an access token is sent.',
        'sso.token_title': 'Token Valid 15 Minutes',
        'sso.token_desc': 'SSO tokens automatically expire for additional security.',
        'sso.forgot_title': 'Forgot Password?',
        'sso.forgot_desc': 'Please contact <code>helpdesk@uitm.edu.my</code> to reset your UiTM portal password.',
        'sso.loading': 'Connecting to UiTM SSO server...',

        // ─── Extended Coverage ───
        'breadcrumb.dashboard': 'Dashboard',
        'breadcrumb.booking_list': 'Space Booking List',
        'breadcrumb.new_booking': 'New Space Booking',
        'breadcrumb.calendar': 'Calendar',
        'breadcrumb.moderator': 'Moderator List',
        'breadcrumb.reports': 'Reports',

        'cal.my_calendar': '📅 My Calendar',
        'cal.calendar': '📅 Calendar',
        'cal.today': 'Today',
        'cal.approved': 'Approved',
        'cal.in_progress': 'In Progress',
        'cal.pending': 'Pending',

        'tbl.show': 'Show',
        'tbl.entries': 'entries',
        'tbl.search_placeholder': 'Search my bookings...',
        'tbl.no': 'No',
        'tbl.action': 'Action',

        'form.event_name': 'EVENT NAME *',
        'form.space_category': 'SPACE CATEGORY *',
        'form.space_name': 'SPACE NAME *',
        'form.start_date': 'START DATE *',
        'form.end_date': 'END DATE *',
        'form.start_time': 'START TIME',
        'form.end_time': 'END TIME',
        'form.participants': 'TOTAL PARTICIPANTS *',
        'form.reservation_title': 'RESERVATION TITLE:',
        'form.continue': 'CONTINUE',
        'form.submit_booking': 'Submit Booking',
        'form.reset': 'Reset',

        'pd.student_no': 'STUDENT NO:',
        'pd.name': 'NAME:',
        'pd.campus': 'CAMPUS:',
        'pd.faculty': 'FACULTY:',
        'pd.program': 'PROGRAM:',
        'pd.email': 'EMAIL:',
        'pd.tel': 'TEL:',
        'pd.personal_details': 'Personal Details',
        'pd.reservation_details': 'RESERVATION DETAILS',

        'sch.department': 'Department',
        'sch.space_category': 'Space Category',
        'sch.space_name': 'Space Name',
        'sch.start_date': 'Start Date',
        'sch.end_date': 'End Date',
        'sch.search': 'SEARCH',
        'sch.print': 'PRINT',
        'sch.space_code': 'SPACE CODE',
        'sch.space_desc': 'SPACE DESCRIPTION',
        'sch.availability': 'AVAILABILITY',
        'sch.reservations': 'LIST OF RESERVATION',
        'sch.title': '📋 Booking Schedule',

        'view.dashboard_title': '📊 My Dashboard',
        'view.booking_list_title': '📋 My Bookings',
        'view.new_booking_title': '📝 New Space Booking',
        'view.guidelines': 'Booking Guidelines',
        'view.agree_text': 'I understand, I am clear and will be responsible for the use of space during preparation, while in use and after the program is completed.',
        'view.moderator_list_title': '👥 Moderator List',
    },
    bm: {
        // ─── Common ───
        'common.logout': 'Log Keluar',
        'common.login': 'Log Masuk',
        'common.signin': 'Log Masuk',
        'common.signup': 'Daftar Akaun',
        'common.submit': 'Hantar',
        'common.cancel': 'Batal',
        'common.save': 'Simpan',
        'common.delete': 'Padam',
        'common.edit': 'Ubah',
        'common.view': 'Lihat',
        'common.search': 'Cari',
        'common.back': 'Kembali',
        'common.continue': 'Teruskan',
        'common.confirm': 'Sah',
        'common.yes': 'Ya',
        'common.no': 'Tidak',
        'common.loading': 'Memuatkan…',
        'common.darkmode': 'Mod Gelap',
        'common.settings': 'Tetapan',
        'common.profile': 'Profil Saya',
        'common.home': 'Utama',
        'common.actions': 'Tindakan',
        'common.status': 'Status',
        'common.language': 'Bahasa',
        'common.email': 'Emel',
        'common.password': 'Kata Laluan',
        'common.phone': 'No. Telefon',
        'common.fullname': 'Nama Penuh',
        'common.required': 'Diperlukan',

        // ─── Login Page ───
        'login.title': 'Sistem Tempahan Bilik',
        'login.subtitle': 'Universiti',
        'login.welcome': 'Selamat Kembali',
        'login.forgot': 'Lupa kata laluan?',
        'login.description': 'Log masuk menggunakan kredensial UiTM untuk akses sistem tempahan.',
        'login.email_placeholder': 'anda@uitm.edu.my',
        'login.password_placeholder': 'Kata laluan anda',
        'login.guest_title': 'Akses Tetamu',
        'login.guest_desc': 'Akaun tetamu dikeluarkan oleh pentadbir kampus. Sila hubungi mereka.',
        'login.request_access': 'Mohon Akses',
        'login.signup_title': 'Cipta Akaun',
        'login.signup_desc': 'Sertai Sistem Tempahan UiTM Tapah sebagai pelajar.',
        'login.create_account': 'Cipta Akaun',
        'login.sso_button': 'Log Masuk dengan Portal UiTM (SSO)',
        'login.or': 'ATAU',
        'login.tab_signin': 'Log Masuk',
        'login.tab_signup': 'Daftar',
        'login.tab_others': 'Lain-lain',
        'login.student_no': 'No. Pelajar',
        'login.confirm_password': 'Sahkan Kata Laluan',

        // ─── Dashboards (sidebar) ───
        'nav.my_dashboard': 'Papan Pemuka Saya',
        'nav.book_space': 'Tempah Ruang',
        'nav.space': 'Ruang',
        'nav.space_management': 'Pengurusan Ruang',
        'nav.booking_requests': 'Permohonan Tempahan',
        'nav.all_bookings': 'Semua Tempahan',
        'nav.space_list': 'Senarai Ruang',
        'nav.space_booking_list': 'Tempahan Saya',
        'nav.new_booking': 'Tempah Ruang',
        'nav.calendar': 'Kalendar',
        'nav.moderator_list': 'Senarai Moderator',
        'nav.reports': 'Laporan',
        'nav.activity_log': 'Log Aktiviti',
        'nav.user_management': 'Pengurusan Pengguna',

        // ─── Roles ───
        'role.student': 'Pelajar · Akses Penuh',
        'role.moderator': 'Moderator',
        'role.admin': 'Pentadbir',

        // ─── Student Dashboard ───
        'student.total_spaces': 'Jumlah Ruang',
        'student.active_bookings': 'Tempahan Aktif Saya',
        'student.pending_approvals': 'Menunggu Kelulusan',
        'student.hours_scheduled': 'Jam Dijadualkan',
        'student.spaces_active': 'sedang aktif',
        'student.calendar': 'Kalendar Saya',
        'student.approved': 'Diluluskan',
        'student.in_progress': 'Sedang Berjalan',
        'student.pending': 'Menunggu',
        'student.applicant': 'Nama Pemohon',
        'student.event': 'Acara',
        'student.category': 'Kategori Ruang',
        'student.space_name': 'Nama Ruang',
        'student.start_date': 'Tarikh Mula',
        'student.end_date': 'Tarikh Tamat',
        'student.applied_date': 'Tarikh Mohon',
        'student.add': 'Tambah',
        'student.guidelines': 'Garis Panduan Tempahan',
        'student.today': 'Hari Ini',

        // ─── SSO Portal ───
        'sso.title': 'Portal UiTM Single Sign-On',
        'sso.secure': 'Sambungan Selamat',
        'sso.banner': 'meminta anda log masuk dengan kredensial UiTM anda.',
        'sso.heading': 'Log Masuk SSO UiTM',
        'sso.subheading': 'Gunakan Student ID atau Email rasmi UiTM anda',
        'sso.field_id': 'Student ID / Emel UiTM',
        'sso.field_password': 'Kata Laluan Portal UiTM',
        'sso.placeholder_id': 'cth: 2024220654 atau 2024220654@student.uitm.edu.my',
        'sso.placeholder_password': 'Kata laluan portal UiTM anda',
        'sso.btn_login': 'Log Masuk',
        'sso.back_link': 'Kembali ke log masuk biasa',
        'sso.security_title': 'Keselamatan Dijamin',
        'sso.security_desc': 'Kata laluan anda tidak dikongsi dengan sistem tempahan. Hanya token akses dihantar.',
        'sso.token_title': 'Token Sah 15 Minit',
        'sso.token_desc': 'Token SSO automatik tamat tempoh untuk keselamatan tambahan.',
        'sso.forgot_title': 'Lupa Kata Laluan?',
        'sso.forgot_desc': 'Sila hubungi <code>helpdesk@uitm.edu.my</code> untuk set semula kata laluan portal UiTM.',
        'sso.loading': 'Menyambung ke pelayan UiTM SSO...',

        // ─── Extended Coverage ───
        'breadcrumb.dashboard': 'Papan Pemuka',
        'breadcrumb.booking_list': 'Senarai Tempahan Ruang',
        'breadcrumb.new_booking': 'Tempahan Ruang Baru',
        'breadcrumb.calendar': 'Kalendar',
        'breadcrumb.moderator': 'Senarai Moderator',
        'breadcrumb.reports': 'Laporan',

        'cal.my_calendar': '📅 Kalendar Saya',
        'cal.calendar': '📅 Kalendar',
        'cal.today': 'Hari Ini',
        'cal.approved': 'Diluluskan',
        'cal.in_progress': 'Sedang Berjalan',
        'cal.pending': 'Menunggu',

        'tbl.show': 'Papar',
        'tbl.entries': 'rekod',
        'tbl.search_placeholder': 'Cari tempahan saya...',
        'tbl.no': 'No',
        'tbl.action': 'Tindakan',

        'form.event_name': 'NAMA ACARA *',
        'form.space_category': 'KATEGORI RUANG *',
        'form.space_name': 'NAMA RUANG *',
        'form.start_date': 'TARIKH MULA *',
        'form.end_date': 'TARIKH TAMAT *',
        'form.start_time': 'MASA MULA',
        'form.end_time': 'MASA TAMAT',
        'form.participants': 'JUMLAH PESERTA *',
        'form.reservation_title': 'TAJUK TEMPAHAN:',
        'form.continue': 'TERUSKAN',
        'form.submit_booking': 'Hantar Tempahan',
        'form.reset': 'Set Semula',

        'pd.student_no': 'NO. PELAJAR:',
        'pd.name': 'NAMA:',
        'pd.campus': 'KAMPUS:',
        'pd.faculty': 'FAKULTI:',
        'pd.program': 'PROGRAM:',
        'pd.email': 'EMEL:',
        'pd.tel': 'TEL:',
        'pd.personal_details': 'Maklumat Peribadi',
        'pd.reservation_details': 'MAKLUMAT TEMPAHAN',

        'sch.department': 'Jabatan',
        'sch.space_category': 'Kategori Ruang',
        'sch.space_name': 'Nama Ruang',
        'sch.start_date': 'Tarikh Mula',
        'sch.end_date': 'Tarikh Tamat',
        'sch.search': 'CARI',
        'sch.print': 'CETAK',
        'sch.space_code': 'KOD RUANG',
        'sch.space_desc': 'PENERANGAN RUANG',
        'sch.availability': 'KETERSEDIAAN',
        'sch.reservations': 'SENARAI TEMPAHAN',
        'sch.title': '📋 Jadual Tempahan',

        'view.dashboard_title': '📊 Papan Pemuka Saya',
        'view.booking_list_title': '📋 Tempahan Saya',
        'view.new_booking_title': '📝 Tempahan Ruang Baru',
        'view.guidelines': 'Garis Panduan Tempahan',
        'view.agree_text': 'Saya faham, jelas dan akan bertanggungjawab terhadap penggunaan ruang semasa persediaan, ketika penggunaan serta selepas selesai program.',
        'view.moderator_list_title': '👥 Senarai Moderator',
    },
};

// Ensure every page boots in light mode by default. Theme toggle still
// persists if user explicitly switches during their session.
if (!sessionStorage.getItem('bsu-theme-initialized')) {
    sessionStorage.setItem('bsu-theme-initialized', '1');
    localStorage.removeItem('bsu-theme');
    document.documentElement.setAttribute('data-theme', 'light');
}

const i18n = {
    _lang: localStorage.getItem('bsu-lang') || 'en',

    getLang() { return this._lang; },

    setLang(lang) {
        if (!['en', 'bm'].includes(lang)) return;
        this._lang = lang;
        localStorage.setItem('bsu-lang', lang);
        document.documentElement.setAttribute('lang', lang === 'bm' ? 'ms' : 'en');
        this.applyAll();

        // Trigger custom event for scripts that need to react
        window.dispatchEvent(new CustomEvent('i18n:changed', { detail: { lang } }));
    },

    toggle() {
        this.setLang(this._lang === 'en' ? 'bm' : 'en');
    },

    t(key) {
        return TRANSLATIONS[this._lang]?.[key] || TRANSLATIONS.en[key] || key;
    },

    applyAll() {
        // Translate text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const value = this.t(key);
            // If contains HTML, use innerHTML; otherwise textContent
            if (value.includes('<')) {
                el.innerHTML = value;
            } else {
                el.textContent = value;
            }
        });
        // Translate placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = this.t(el.getAttribute('data-i18n-placeholder'));
        });
        // Translate titles/tooltips
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = this.t(el.getAttribute('data-i18n-title'));
        });
        // Translate aria-labels
        document.querySelectorAll('[data-i18n-aria]').forEach(el => {
            el.setAttribute('aria-label', this.t(el.getAttribute('data-i18n-aria')));
        });

        // Update language toggle button display (if exists)
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            const span = langBtn.querySelector('.lang-label');
            if (span) span.textContent = this._lang === 'en' ? 'BM' : 'EN';
        }
    },

    init() {
        document.documentElement.setAttribute('lang', this._lang === 'bm' ? 'ms' : 'en');
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.applyAll());
        } else {
            this.applyAll();
        }
    },
};

// Auto-initialise on script load
i18n.init();

// Expose globally
window.i18n = i18n;
