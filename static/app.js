// ============================================================
//  AFIT CBT SIMULATOR — static/app.js  (shared across all pages)
//  SECURITY FIXES:
//    ✅ Math.random() → crypto.getRandomValues()
//    ✅ All console.log() leaking email/session data removed
//    ✅ Shared logout() clears current_session_token in DB before sign-out
//    ✅ escHtml() helper to prevent XSS when inserting DB data into DOM
// ============================================================

const SUPABASE_URL     = 'https://kvlishlwkxdnlbatepsr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2bGlzaGx3a3hkbmxiYXRlcHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NjMxNjIsImV4cCI6MjA5NTEzOTE2Mn0.tcl14-RfH6C_04gOm8T_cu9PlEFOmWM_BxD0PVIoXHQ';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── HTML escape helper (prevents XSS when inserting DB data into innerHTML) ──
function escHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── Cryptographically secure token (replaces Math.random()) ──────────────────
function generateSecureToken() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── OTP Authentication ────────────────────────────────────────────────────────
let userEmailForVerification = '';

async function requestOTP(event) {
    event.preventDefault();

    const emailInput = document.getElementById('email').value.trim();
    const messageEl  = document.getElementById('auth-message');
    const submitBtn  = document.getElementById('request-btn');

    if (!emailInput) {
        messageEl.innerText = 'Please enter your email address.';
        messageEl.className = 'error';
        return;
    }

    submitBtn.innerText = 'Sending...';
    submitBtn.disabled  = true;

    const { data, error } = await supabaseClient.auth.signInWithOtp({
        email: emailInput,
        options: { shouldCreateUser: true }
    });

    if (error) {
        messageEl.innerText = error.message;
        messageEl.className = 'error';
        submitBtn.innerText  = 'Send Verification Code';
        submitBtn.disabled   = false;
    } else {
        userEmailForVerification = emailInput;
        document.getElementById('email-form').classList.add('hidden');
        document.getElementById('otp-form').classList.remove('hidden');
        messageEl.innerText = 'Code sent! Check your inbox (and spam folder).';
        messageEl.className = 'success';
        submitBtn.disabled  = false;
    }
}

async function verifyOTP(event) {
    event.preventDefault();

    const otpInput  = document.getElementById('otp').value.trim();
    const messageEl = document.getElementById('auth-message');
    const verifyBtn = document.getElementById('verify-btn');

    verifyBtn.innerText = 'Verifying...';
    verifyBtn.disabled  = true;

    // Try 3 OTP types in sequence
    const types = ['email', 'magiclink', 'signup'];
    let session = null, lastError = null;

    for (const type of types) {
        const res = await supabaseClient.auth.verifyOtp({
            email: userEmailForVerification,
            token: otpInput,
            type
        });
        if (!res.error && res.data?.session) { session = res.data.session; break; }
        lastError = res.error;
    }

    if (!session) {
        messageEl.innerText = 'Invalid or expired code. Please request a new one.';
        messageEl.className = 'error';
        verifyBtn.innerText  = 'Verify & Login';
        verifyBtn.disabled   = false;
        return;
    }

    // Store cryptographically secure session token
    const secureToken = generateSecureToken();
    localStorage.setItem('cbt_session_token', secureToken);

    await supabaseClient
        .from('profiles')
        .update({ current_session_token: secureToken })
        .eq('id', session.user.id);

    const { data: profileData } = await supabaseClient
        .from('profiles')
        .select('full_name, role')
        .eq('id', session.user.id)
        .single();

    if (profileData?.role === 'admin') {
        window.location.href = '../admin/';
    } else if (!profileData?.full_name) {
        window.location.href = '../bio-data/';
    } else {
        window.location.href = '../dashboard/';
    }
}

// ── Shared Logout (clears DB token before signing out) ───────────────────────
window.logout = async function () {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        await supabaseClient
            .from('profiles')
            .update({ current_session_token: null })
            .eq('id', session.user.id);
    }
    await supabaseClient.auth.signOut();
    localStorage.removeItem('cbt_session_token');
    window.location.href = '../index.html';
};

// ── Shared Sidebar Toggle ─────────────────────────────────────────────────────
window.toggleSidebar = function () {
    document.getElementById('sidebar')?.classList.toggle('active');
    document.getElementById('mobile-overlay')?.classList.toggle('active');
};
