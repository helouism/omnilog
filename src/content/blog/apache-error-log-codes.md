# Common Apache Error Log Codes Explained

Apache's error log records everything that goes wrong on your web server — from a missing file to a crashed PHP process to a TLS handshake failure. Unlike the access log (which records every request regardless of outcome), the error log is event-driven: it only writes when something noteworthy happens. Knowing how to read it is essential for diagnosing production problems.

## The Apache 2.4 Error Log Format

A typical Apache 2.4 error log line looks like this:

```
[Mon Jun 07 14:23:18.123456 2024] [php:error] [pid 12345] [client 203.0.113.42:49201] PHP Fatal error: Uncaught TypeError in /var/www/html/index.php on line 87
```

Apache 2.4 restructured the error log significantly from 2.2. The most important change was the addition of **module names** in the severity field (`[php:error]` instead of just `[error]`), making it much easier to filter by source.

## Field-by-Field Breakdown

### Timestamp — `[Mon Jun 07 14:23:18.123456 2024]`

Timestamp with microsecond precision. Apache logs in local server time unless configured otherwise. The microseconds are useful for correlating events that happen in rapid succession — two events with the same second but different microseconds are genuinely different events, not duplicates.

### Module and Level — `[php:error]`

Two parts separated by a colon:

- **Module**: which Apache module generated the message — `php`, `ssl`, `authz_core`, `rewrite`, `proxy`, `mpm_prefork`, `core`, etc.
- **Level**: severity of the message

The severity levels, from least to most severe:

| Level | Meaning |
|-------|---------|
| `debug` | Verbose diagnostic information |
| `info` | Normal informational messages |
| `notice` | Normal but significant condition |
| `warn` | Unexpected but not necessarily an error |
| `error` | An error has occurred |
| `crit` | A critical condition; some capability is unavailable |
| `alert` | Immediate action required |
| `emerg` | System is unusable |

The `LogLevel` directive controls which levels are written. The default is `warn`, meaning `debug`, `info`, and `notice` are usually silent in production unless you explicitly lower the threshold.

### Process ID — `[pid 12345]`

The Apache worker process that handled the request. Useful when correlating a sequence of log entries from the same request across a multi-process server.

### Client — `[client 203.0.113.42:49201]`

The client IP and port (port was added in Apache 2.4; absent in 2.2). If you're behind a reverse proxy, this will be the proxy's IP, not the end user's.

### Message

The rest of the line is the human-readable error message. Its content and format depend entirely on which module generated it.

## Common Error Patterns

### 403 Forbidden — `authz_core:error`

```
[authz_core:error] [pid 8001] [client 203.0.113.5:51234] AH01630: client denied by server configuration: /var/www/html/secret
```

The `authz_core` module rejected the request. Common causes:

- `Require all denied` or an `Order deny,allow` block without the client's IP in the allow list
- File or directory permissions that prevent the Apache process from reading the file (check with `namei -om /var/www/html/secret`)
- A `<Directory>` or `<Location>` block with no `Require` directive — Apache 2.4 defaults to denying access when authorization is not explicitly configured

### Rewrite Loop — `core:error`

```
[core:error] [pid 8023] [client 198.51.100.7:44120] AH00124: Request exceeded the limit of 10 internal redirects due to probable configuration error.
```

A rewrite rule is looping: the URL is being rewritten to a path that matches the same rule again. The most common cause is a rule without a `[L]` (last) flag or without a `[PT]` (pass-through) flag when using `ProxyPass` alongside `RewriteRule`.

Enable trace-level rewrite logging to debug:

```apache
LogLevel warn rewrite:trace3
```

### 500 Internal Server Error — PHP or Proxy

```
[php:error] [pid 9112] [client 203.0.113.42:49201] PHP Fatal error: Maximum execution time of 30 seconds exceeded in /var/www/html/heavy-query.php on line 114
```

```
[proxy:error] [pid 9001] [client 10.0.0.5:38291] AH00898: Error reading from remote server returned by /api/
```

500s from `php:error` point to uncaught exceptions, fatal errors, or resource exhaustion. 500s from `proxy:error` indicate the backend server — Node.js, Python, Go — returned an error or didn't respond at all.

### 502 Bad Gateway / 503 Service Unavailable

```
[proxy_http:error] [pid 9230] [client 10.0.0.1:43120] AH01102: error reading status line from remote server 127.0.0.1:3000
```

```
[mpm_event:error] [pid 1] AH00484: server reached MaxRequestWorkers setting, consider raising the MaxRequestWorkers setting
```

The first is a broken connection to the backend — the app server crashed or the port isn't listening. The second is Apache running out of worker processes, typically under heavy load or if workers are stuck waiting on slow backend responses. Check `MaxRequestWorkers` in your MPM configuration.

### SSL/TLS Errors — `ssl:*`

```
[ssl:warn] [pid 8888] AH01909: server certificate does NOT include an ID which matches the server name
```

```
[ssl:error] [pid 8001] SSL Library Error: error:14094418:SSL routines:ssl3_read_bytes:tlsv1 alert unknown ca
```

The first is a certificate misconfiguration — the CN or SAN field doesn't match the domain. The second is a client rejecting the certificate chain, usually because an intermediate CA certificate is missing from the server configuration. Fix by including the full chain (`SSLCertificateChainFile` or combining into a single PEM file).

### Rewrite Trace (not an error)

```
[rewrite:trace3] [pid 9001] mod_rewrite.c(478): [perdir /var/www/html/] applying pattern '(.*)' to uri '/index.php'
```

Rewrite traces (`trace1`–`trace8`) appear only when `LogLevel rewrite:trace3` or higher is set. They're invaluable for debugging complex rewrite rules but should be disabled in production due to verbosity.

## Apache Access Log vs Error Log

The distinction is important:

- **Access log**: every HTTP request and its outcome — 200, 301, 404, 500 — all appear here regardless of whether the request succeeded or failed
- **Error log**: only events that require attention — errors, warnings, configuration issues, module diagnostics

A 404 response appears in the access log (as status 404) but typically does **not** appear in the error log. A PHP fatal error appears in the error log and simultaneously generates a 500 in the access log — so you'll see it in both places if you know to look.

## Quick Triage Commands

Show only error-level and above (filter out debug/info/notice/warn):

```bash
grep -E '\[(error|crit|alert|emerg)' /var/log/apache2/error.log
```

Count errors by module:

```bash
grep -oP '\[\K[a-z_]+(?=:[a-z]+\])' /var/log/apache2/error.log | sort | uniq -c | sort -rn
```

Find errors from the last 15 minutes:

```bash
awk -v d="$(date +'%a %b %e %H:%M' -d '15 minutes ago')" '$0 ~ d' /var/log/apache2/error.log
```

Watch errors in real time:

```bash
tail -f /var/log/apache2/error.log | grep -E '\[(error|crit|alert)'
```

## Analysing Apache Logs in OmniLog

[OmniLog](/) auto-detects both Apache access log format and Apache error log format. For error logs, it classifies entries by severity level, extracts client IPs where present, and plots error frequency over time. Drop the file to get started — everything runs locally in your browser.
