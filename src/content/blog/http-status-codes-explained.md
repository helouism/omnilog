# HTTP Status Codes Explained (With Real Log Examples)

Every line in a web server access log carries a three-digit number that summarises what happened: the HTTP status code. Read fluently, these codes tell you whether your site is healthy, being attacked, or quietly broken. Read carelessly, they are just noise. This guide walks through every class of status code with the log lines you will actually see — and what each one should prompt you to do.

## The Five Classes

HTTP status codes are grouped by their first digit, and that first digit alone tells you the category of outcome:

| Class | Range | Meaning |
|---|---|---|
| **1xx** | 100–199 | Informational — request received, continuing |
| **2xx** | 200–299 | Success — the request worked |
| **3xx** | 300–399 | Redirection — further action needed |
| **4xx** | 400–499 | Client error — the caller did something wrong |
| **5xx** | 500–599 | Server error — your side broke |

When you scan a log, the leading digit is the first thing your eye should catch. A wall of `2`s is a healthy server. A surge of `5`s is an incident.

## 2xx — Success

```
203.0.113.10 - - [14/Mar/2024:10:01:22 +0000] "GET /index.html HTTP/1.1" 200 5312
```

- **200 OK** — the standard success. The response body was delivered.
- **201 Created** — a `POST`/`PUT` created a resource. Common in APIs.
- **204 No Content** — success with no body. Typical for `DELETE` or some `PUT` calls.
- **206 Partial Content** — a range request succeeded, used for video streaming and resumable downloads.

These are what you want to see. The only time a 2xx is interesting is when the byte count is suspicious — a `200` with `0` bytes sent suggests a connection dropped mid-transfer.

## 3xx — Redirection

```
203.0.113.10 - - [14/Mar/2024:10:02:05 +0000] "GET /old-page HTTP/1.1" 301 0 "-" "Mozilla/5.0"
```

- **301 Moved Permanently** — the resource has a new permanent home. SEO-friendly; browsers and crawlers cache it.
- **302 Found** — a temporary redirect. The original URL should still be used in future.
- **304 Not Modified** — the client's cached copy is still valid, so no body is sent. A high ratio of 304s is healthy caching at work, not a problem.
- **307 / 308** — like 302/301 but guarantee the HTTP method is preserved.

A sudden flood of 301s can indicate a redirect loop. Cross-reference the `Referer` and request path to confirm.

## 4xx — Client Errors (Where the Drama Is)

This class is the most security-relevant. It means the request was wrong — sometimes innocently, often maliciously.

```
198.51.100.7 - - [14/Mar/2024:10:05:41 +0000] "GET /wp-login.php HTTP/1.1" 404 209
198.51.100.7 - - [14/Mar/2024:10:05:42 +0000] "GET /.env HTTP/1.1" 403 153
```

- **400 Bad Request** — malformed syntax. Often fuzzers and broken clients.
- **401 Unauthorized** — authentication required or failed. Watch for repeats from one IP — credential guessing.
- **403 Forbidden** — the server understood but refuses. Probing for protected files (`.env`, `.git/config`, `/admin`) shows up here.
- **404 Not Found** — the classic. A few are normal (dead links). Hundreds of 404s on paths like `/wp-login.php`, `/phpmyadmin`, `/.git/` from one IP is a **vulnerability scanner** walking your site.
- **405 Method Not Allowed** — wrong HTTP verb for the endpoint.
- **429 Too Many Requests** — your rate limiter is firing. A spike means either an attack or a misbehaving client.

The 404 and 403 lines above are a textbook scanner: one IP, rapid-fire requests for files that should never exist on your server. That is reconnaissance.

## 5xx — Server Errors (Your Problem)

```
203.0.113.10 - - [14/Mar/2024:10:09:13 +0000] "POST /api/checkout HTTP/1.1" 500 617
203.0.113.10 - - [14/Mar/2024:10:09:14 +0000] "GET /api/cart HTTP/1.1" 502 0
```

- **500 Internal Server Error** — your application threw an unhandled error. The single most important code to alert on. A spike means your app is crashing.
- **502 Bad Gateway** — the upstream (your app server, PHP-FPM, Node process) returned an invalid response or is down. The reverse proxy could not get a valid answer.
- **503 Service Unavailable** — the server is overloaded or in maintenance. Often appears under traffic spikes when worker pools are exhausted.
- **504 Gateway Timeout** — the upstream did not respond in time. Points to a slow database query or a hung backend process.

The difference between 502, 503, and 504 is a fast diagnostic: 502 = upstream gave a bad answer, 503 = upstream refused/overloaded, 504 = upstream was too slow. That distinction tells you where to look first.

## Reading the Distribution at a Glance

Counting codes is the fastest health check you can run on a log:

```bash
awk '{print $9}' access.log | sort | uniq -c | sort -rn
```

Sample output:

```
  48213 200
   3104 304
    882 404
    211 301
     47 500
     12 502
```

In one glance: mostly healthy (200/304), a moderate 404 rate worth a look, and a handful of 500/502 errors that deserve investigation. Track the **ratio** of 5xx to total over time — that single number is one of the best leading indicators of an outage.

Find every distinct path that returned a 404 (to separate dead links from scanner probes):

```bash
awk '$9 == 404 {print $7}' access.log | sort | uniq -c | sort -rn | head -20
```

## See the Distribution Visually

Counting codes with awk is great for a quick check, but to watch how the status mix *changes over time* — the moment 500s start climbing, the window a scanner was active — a chart beats a number. [OmniLog](/) parses your access log in the browser and renders the status-code distribution and request volume over time automatically, with filtering by status code and date range. Drop the log in, and a 5xx spike that is invisible in a raw file becomes an obvious red bar on the timeline — all processed client-side, nothing uploaded.
