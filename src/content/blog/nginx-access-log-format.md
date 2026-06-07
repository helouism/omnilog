# How to Read NGINX Access Log Format

NGINX's access log is one of the most information-dense files on any web server. Every HTTP request that touches your server — legitimate traffic, bots, crawlers, and attackers alike — leaves a line here. Learning to read it fluently turns raw noise into actionable intelligence.

## The Combined Log Format

By default, NGINX uses the **combined** log format, which is a superset of Apache's original Common Log Format. A typical line looks like this:

```
203.0.113.42 - frank [10/Oct/2024:13:55:36 +0000] "GET /api/users HTTP/1.1" 200 2326 "https://example.com/dashboard" "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
```

This single line tells a complete story. Let's break down every field.

## Field-by-Field Breakdown

### 1. Remote Address — `203.0.113.42`

The IP address of the client that made the request. This is whatever IP connected to your server, which may be a proxy, CDN edge node, or the actual end user depending on your infrastructure. If you're behind Cloudflare or a load balancer, this will be the proxy's IP — you'll need `$http_x_forwarded_for` or `$http_x_real_ip` to get the original client IP.

### 2. Remote User (Ident) — `-`

The RFC 1413 ident lookup result. This is almost always `-` in practice — the ident protocol is disabled everywhere for security and performance reasons. You can safely ignore this field.

### 3. Authenticated User — `frank`

The username of an authenticated user, typically set when using HTTP basic authentication (`auth_basic`) or `ngx_http_auth_request_module`. It's `-` for anonymous requests, which is the vast majority of traffic.

### 4. Timestamp — `[10/Oct/2024:13:55:36 +0000]`

Request time in `dd/Mon/YYYY:HH:MM:SS timezone` format. The timezone offset (`+0000` = UTC) matters — NGINX logs in whatever timezone the system is configured for. If your server runs in UTC and you're analysing logs in local time, timestamps will appear off. Always note the timezone when cross-referencing with other systems.

### 5. Request Line — `"GET /api/users HTTP/1.1"`

The complete HTTP request line, quoted. Three parts:

- **Method**: `GET`, `POST`, `PUT`, `DELETE`, `HEAD`, `OPTIONS`, etc.
- **Path**: The requested URL path, including query string (e.g., `/search?q=nginx`)
- **Protocol**: HTTP version — `HTTP/1.1` or `HTTP/2` depending on configuration.

Malformed requests from scanners and fuzzers often show up here as empty strings `""` or garbage values.

### 6. Status Code — `200`

The HTTP response code sent back to the client:

- **2xx**: Success (200 OK, 201 Created, 204 No Content)
- **3xx**: Redirect (301 Permanent, 302 Temporary, 304 Not Modified)
- **4xx**: Client error (400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found)
- **5xx**: Server error (500 Internal Server Error, 502 Bad Gateway, 503 Service Unavailable)

A sudden spike in 500s points to an application crash. A flood of 404s on obscure paths is usually a scanner probing for vulnerabilities.

### 7. Bytes Sent — `2326`

The number of bytes sent to the client in the response body, not including headers. A value of `0` for a 200 response suggests something unusual — possibly a connection reset before transfer completed.

### 8. Referer — `"https://example.com/dashboard"`

The HTTP `Referer` header sent by the client, indicating the page that linked to this request. `-` means no referer (direct navigation, bookmarks, or a client that strips the header). Useful for tracking traffic sources and finding broken links.

### 9. User Agent — `"Mozilla/5.0 ..."`

The `User-Agent` header from the client. This identifies the browser, OS, and sometimes the bot or crawler making the request. Common patterns:

- `Googlebot/2.1` — Google's web crawler
- `Mozilla/5.0 (compatible; bingbot/2.0;` — Bing crawler
- `curl/7.84.0` — curl requests (often automated tooling or scripts)
- Blank or `-` — suspicious; most legitimate browsers always send a user agent

## Customising the Log Format

The combined format is defined in NGINX's `http` block:

```nginx
log_format combined '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent"';
```

Common additions:

- `$request_time` — total request processing time in seconds (useful for finding slow endpoints)
- `$upstream_response_time` — time waiting for the upstream server (distinguishes NGINX slowness from app slowness)
- `$http_x_forwarded_for` — original client IP when behind a proxy
- `$gzip_ratio` — compression ratio if gzip is enabled

## Useful One-Liners

Count requests by status code:

```bash
awk '{print $9}' access.log | sort | uniq -c | sort -rn
```

Top 10 IP addresses by request count:

```bash
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
```

Find all 500 errors from today:

```bash
grep "$(date +'%d/%b/%Y')" access.log | awk '$9 == 500'
```

Count unique IPs:

```bash
awk '{print $1}' access.log | sort -u | wc -l
```

Requests per minute (useful for spotting spikes):

```bash
awk '{print $4}' access.log | cut -d: -f1,2 | sort | uniq -c
```

## Analysing Access Logs Without the Terminal

For large log files — or when you want charts and filtering without writing awk commands — [OmniLog](/) parses NGINX access logs directly in your browser. Drop the file and it auto-detects the combined log format, plots request volume over time, shows top IPs, and lets you filter by status code, severity, or date range. Nothing is uploaded; all processing happens client-side.
