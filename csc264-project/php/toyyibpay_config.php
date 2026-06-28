<?php
/**
 * =====================================================
 * TOYYIBPAY CONFIGURATION + API HELPERS
 * =====================================================
 * Real Malaysian payment gateway (FPX online banking + cards).
 *
 * ── SETUP (one time) ────────────────────────────────
 * 1. Create a free account:
 *      Sandbox/testing : https://dev.toyyibpay.com   (use this first)
 *      Production/live  : https://toyyibpay.com
 * 2. After login → "Profile / API Key" → copy your USER SECRET KEY.
 * 3. Create a Category ("Create New Category") → copy its CATEGORY CODE.
 * 4. Paste both below. While the keys are blank, the app tells the user
 *    the gateway isn't configured (no fake payment happens).
 *
 * ── Sandbox test bank ──────────────────────────────
 *    On dev.toyyibpay.com, choose any bank then pick "successful" / "fail"
 *    on the FPX simulator to test both outcomes.
 *
 * NOTE: keep this file out of public Git repos in production (it holds a secret).
 * =====================================================
 */

// PRODUCTION (real payments). Your keys are live-account keys, so this must be
// the production host. For free/no-charge testing, create a separate account at
// https://dev.toyyibpay.com and switch this back to that URL with the sandbox keys.
define('TOYYIBPAY_BASE', 'https://toyyibpay.com');

// ↓↓↓ YOUR KEYS ↓↓↓
define('TOYYIBPAY_SECRET_KEY',   'k9aq349c-h1ln-2bah-jihx-45azjee8aoq8');
define('TOYYIBPAY_CATEGORY_CODE', 'q61ary4f');
// ↑↑↑ YOUR KEYS ↑↑↑

/** True once the real keys have been filled in. */
function tpConfigured() {
    return TOYYIBPAY_SECRET_KEY !== 'YOUR_SECRET_KEY_HERE'
        && TOYYIBPAY_CATEGORY_CODE !== 'YOUR_CATEGORY_CODE_HERE'
        && TOYYIBPAY_SECRET_KEY !== '' && TOYYIBPAY_CATEGORY_CODE !== '';
}

/** Low-level POST to a ToyyibPay API endpoint. Returns decoded JSON (array). */
function tpPost($endpoint, array $fields) {
    $ch = curl_init(TOYYIBPAY_BASE . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($fields),
        CURLOPT_TIMEOUT        => 30,
        // XAMPP on Windows often ships without an up-to-date CA bundle, which
        // makes HTTPS calls fail. Disable peer verification for local dev.
        // In production with a proper CA bundle, set this back to true.
        CURLOPT_SSL_VERIFYPEER => false,
    ]);
    $res = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) return ['error' => $err ?: 'Connection to ToyyibPay failed'];
    $json = json_decode($res, true);
    return $json !== null ? $json : ['error' => 'Unexpected response', 'raw' => $res];
}

/** Create a bill. $params must include billAmount (cents), billReturnUrl, etc. */
function tpCreateBill(array $params) {
    return tpPost('/index.php/api/createBill', array_merge([
        'userSecretKey'        => TOYYIBPAY_SECRET_KEY,
        'categoryCode'         => TOYYIBPAY_CATEGORY_CODE,
        'billPriceSetting'     => 1,    // 1 = fixed amount
        'billPayorInfo'        => 1,    // collect payer name/email/phone
        'billPaymentChannel'   => '2',  // 0=FPX, 1=Card, 2=both
        'billChargeToCustomer' => 1,    // charge processing fee to payer
    ], $params));
}

/** Look up the real payment status of a bill (server-to-server verification). */
function tpGetTransactions($billCode) {
    return tpPost('/index.php/api/getBillTransactions', [
        'userSecretKey' => TOYYIBPAY_SECRET_KEY,
        'billCode'      => $billCode,
    ]);
}
