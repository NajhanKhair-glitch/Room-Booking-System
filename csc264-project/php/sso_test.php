<?php
/**
 * DIAGNOSTIC TEST PAGE FOR SSO ISSUE
 *
 * Open in browser: http://localhost/csc264-project/php/sso_test.php
 * Click the "Test POST" button to see exactly what happens.
 *
 * If this page returns 200 OK with valid JSON, then the SSO API
 * is reachable and the issue is somewhere else.
 */

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$raw_body = file_get_contents('php://input');

if (isset($_GET['html'])) {
    // Show HTML test page
    header('Content-Type: text/html');
?>
<!DOCTYPE html>
<html>
<head>
    <title>SSO Diagnostic Test</title>
    <style>
        body { font-family: monospace; padding: 30px; max-width: 800px; margin: 0 auto; }
        button { padding: 12px 24px; font-size: 16px; cursor: pointer; margin: 10px 0; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 8px; overflow: auto; }
        .ok { color: green; font-weight: bold; }
        .bad { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h1>🩺 SSO Diagnostic Test</h1>
    <p><strong>This page URL:</strong> <span id="thisUrl"></span></p>
    <p><strong>Will POST to:</strong> <span id="postUrl"></span></p>

    <button onclick="testGet()">1. Test GET request</button>
    <button onclick="testPost()">2. Test POST (form-encoded)</button>
    <button onclick="testPostJson()">3. Test POST (JSON)</button>

    <h3>Result:</h3>
    <pre id="result">Click a button above...</pre>

    <script>
        const thisUrl = window.location.href;
        const postUrl = thisUrl.split('?')[0]; // same file, no query
        document.getElementById('thisUrl').textContent = thisUrl;
        document.getElementById('postUrl').textContent = postUrl;

        function show(label, data) {
            document.getElementById('result').textContent = label + '\n\n' + JSON.stringify(data, null, 2);
        }

        async function testGet() {
            try {
                const res = await fetch(postUrl);
                const status = res.status;
                const text = await res.text();
                show(`GET response (HTTP ${status}):`, text.length > 500 ? text.substring(0, 500) + '...' : text);
            } catch(e) { show('GET error:', e.message); }
        }

        async function testPost() {
            try {
                const body = new URLSearchParams();
                body.append('test', 'hello');
                const res = await fetch(postUrl, { method: 'POST', body: body.toString(),
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                const status = res.status;
                const text = await res.text();
                show(`POST (form) response (HTTP ${status}):`, text);
            } catch(e) { show('POST error:', e.message); }
        }

        async function testPostJson() {
            try {
                const res = await fetch(postUrl, { method: 'POST',
                    body: JSON.stringify({ test: 'hello' }),
                    headers: { 'Content-Type': 'application/json' } });
                const status = res.status;
                const text = await res.text();
                show(`POST (JSON) response (HTTP ${status}):`, text);
            } catch(e) { show('POST JSON error:', e.message); }
        }
    </script>
</body>
</html>
<?php
    exit;
}

// Just respond with JSON containing all request info
echo json_encode([
    'success'      => true,
    'method'       => $method,
    'php_version'  => PHP_VERSION,
    'apache_ok'    => true,
    'received_get' => $_GET,
    'received_post'=> $_POST,
    'raw_body'     => $raw_body,
    'headers'      => function_exists('getallheaders') ? getallheaders() : [],
    'message'      => 'If you can see this JSON, the API is working correctly. Method was: ' . $method,
]);
