# Linux Syslog Severity Levels: A Complete Guide

When a service logs `[ERR]` or your log file fills with `warning` lines, understanding what those labels actually mean — and what the system will do about them — is the difference between fast triage and guesswork. Linux syslog has a formal severity scale that every well-behaved service uses. Once you know it, you can filter, prioritise, and respond to log data systematically instead of reading everything line by line.

## The Eight Severity Levels

Linux syslog severity is defined in RFC 5424 and inherits from the original BSD syslog specification. There are exactly eight levels, numbered 0 through 7, where **lower numbers are more severe**.

| Level | Name | Keyword | When to use |
|-------|------|---------|-------------|
| 0 | Emergency | `emerg` | System is unusable |
| 1 | Alert | `alert` | Immediate action required |
| 2 | Critical | `crit` | Critical condition — hardware, resource exhaustion |
| 3 | Error | `err` | Error condition that should be investigated |
| 4 | Warning | `warning` | Pre-failure signal — not broken yet, but getting there |
| 5 | Notice | `notice` | Normal but significant state transition |
| 6 | Informational | `info` | Routine operational narrative |
| 7 | Debug | `debug` | Internal diagnostic detail |

### Emergency (0) — `emerg`

Reserved for conditions that make the system unable to function. In practice you rarely see this in log files — when the system is truly unusable, it may not be able to write logs at all. Sources: kernel panics, catastrophic memory corruption, hardware failures that prevent all I/O.

### Alert (1) — `alert`

Means automated action must be taken *right now*. Examples: primary database cluster has lost quorum, a watchdog is about to restart a critical service, a hardware RAID controller has detected uncorrectable errors on the active volume. If you have an on-call rotation, `alert` is what should page someone.

### Critical (2) — `crit`

A serious problem in a specific subsystem that doesn't bring down the whole machine. Examples: a storage device failing SMART tests, a daemon exhausting its memory limit and being OOM-killed, a network interface going down, a certificate about to expire. Investigate within the hour.

### Error (3) — `err`

The most commonly seen high-severity level. Something failed, but the system or service is still running — in degraded mode, with a fallback, or with the affected request dropped. Examples:

- Application failed to connect to its database and fell back to read-only mode
- A cron job exited with a non-zero status code
- A TLS certificate renewal failed
- A request handler threw an unhandled exception
- A DNS lookup timed out

`err` is the level you grep for first when debugging a broken feature.

### Warning (4) — `warning`

Pre-failure telemetry. Nothing has broken yet, but the system is signalling that you should pay attention before it does. Examples:

- Disk usage above 85%
- A connection pool is running at 90% capacity
- A deprecated API endpoint is being called
- An upstream service is slow (taking 4 seconds when it normally takes 0.3)
- A configuration value is outside the recommended range

Ignoring persistent `warning` entries is a reliable way to manufacture future `error` entries.

### Notice (5) — `notice`

Normal events worth recording because they represent significant state transitions. Examples:

- A service started or stopped cleanly
- A user logged in via sudo
- Configuration was reloaded (`SIGHUP`)
- A scheduled task completed
- A lease was renewed

These are not problems — they're bookmarks in the event timeline that help you reconstruct what happened and when.

### Informational (6) — `info`

The narrative layer: routine operations confirming things are working. Examples:

- "Processed 1,423 jobs from queue"
- "Opened connection to 10.0.0.5:5432"
- "Applying database migration 0042"
- "Cache hit ratio: 94.2%"

In most production systems, `info` logging is disabled or not written to persistent files because volume would be overwhelming. You typically enable it temporarily when investigating a specific behaviour.

### Debug (7) — `debug`

Intended purely for development and troubleshooting — never for production in normal circumstances. Includes internal state dumps, function arguments, loop counters, and any information useful for stepping through code logic. A single busy service can produce gigabytes of debug output per hour.

## How rsyslog Routes by Severity

The rsyslog daemon routes messages based on two fields: **facility** (which subsystem sent the message) and **severity**. The selector syntax is `facility.severity`, and severity selectors are **inclusive downward** — `kern.err` means "kernel facility, ERR severity and above (ERR, CRIT, ALERT, EMERG)".

Some examples from a typical `/etc/rsyslog.conf`:

```
# All messages at warning and above, from all facilities
*.warn    /var/log/messages

# All kernel messages at any severity
kern.*    /var/log/kern.log

# Auth messages at info and above
auth,authpriv.*   /var/log/auth.log

# Exclude debug from syslog
*.info;mail.none;authpriv.none;cron.none   /var/log/syslog
```

This is why events sometimes appear in multiple log files — a kernel error matching both `kern.*` and `*.err` will be written to every file where either selector applies.

## Filtering with journalctl

systemd's journal stores the original priority level for every message. You can filter precisely using the `-p` flag:

```bash
# Show only error and above (priority 0-3)
journalctl -p err

# Show warning through emergency
journalctl -p warning..emerg

# Show errors from a specific unit
journalctl -p err -u nginx.service

# Follow errors in real time
journalctl -p err -f

# Show all levels for the last hour
journalctl --since "1 hour ago" -p debug
```

The `-p` flag accepts both numeric levels (`0`–`7`) and the keyword names (`emerg`, `alert`, `crit`, `err`, `warning`, `notice`, `info`, `debug`).

## Filtering Syslog Files Directly

When reading flat log files, severity is usually embedded in the message text rather than in a dedicated field:

```bash
# Find errors in syslog
grep -iE '\b(error|err|crit|alert|emerg)\b' /var/log/syslog

# Find kernel critical messages
grep 'kernel.*\(CRIT\|crit\)' /var/log/kern.log

# Exclude debug and info from output
grep -vE '\b(debug|info|notice)\b' /var/log/syslog

# Show only the last 500 error lines
grep -iE '\berr' /var/log/syslog | tail -500
```

## RFC 5424 Priority Encoding

In RFC 5424 format, the priority is encoded as a single integer called the **PRI**, computed as `(facility × 8) + severity`. A PRI value of `<34>` means facility 4 (auth) × 8 + severity 2 (crit) = 34.

You'll see PRI values in raw syslog traffic and in log files that include the RFC 5424 header (`<34>1 2024-06-07T14:23:18Z hostname appname procid msgid ...`). Once you know the formula, decoding it is straightforward: divide by 8 to get the facility, take the remainder for the severity.

## Severity Levels in OmniLog

[OmniLog](/) recognises severity levels from NGINX, Apache, UFW, and syslog files and maps them to a unified scale (FATAL, ERROR, WARN, INFO, DEBUG, TRACE). The dashboard shows a severity distribution chart and the log table lets you filter to specific levels — useful for isolating ERROR and CRIT events in a large log file. Everything processes locally in your browser.
