# Linux Log Files Explained: syslog, kern.log, auth.log and Everything in Between

Every Linux system is silently narrating its own story. Every hardware interrupt, failed login, crashed service, and kernel panic is recorded — somewhere under `/var/log`. If you know where to look and what to look for, that directory is one of the most powerful diagnostic tools available to you. If you don't, it's an intimidating wall of text.

This guide maps the terrain. By the end you'll know what each major log file contains, why it exists, how Linux routes log messages to the right place, and what the severity levels actually mean.

## The Two Logging Systems: syslog and journald

Before diving into individual files, it's worth understanding the plumbing behind them.

**Traditional syslog** (and its modern replacement **rsyslog** or **syslog-ng**) is a daemon that runs in the background and receives log messages from the kernel, services, and applications. It writes those messages to files under `/var/log` based on rules in `/etc/rsyslog.conf`. You can think of it as a switchboard: incoming messages are stamped with a facility (who sent it) and a severity (how bad is it), and the config file routes each combination to the right destination file.

**systemd-journald** is the newer approach, shipped with any systemd-based distribution (Debian 8+, Ubuntu 15.04+, RHEL 7+, Arch, Fedora, and most others in use today). The journal stores log messages in a structured binary format at `/run/log/journal/` (volatile) or `/var/log/journal/` (persistent). You query it with `journalctl` rather than reading flat files.

On most modern distributions **both run simultaneously**. journald captures everything from systemd units and the kernel; rsyslog subscribes to the journal and writes text files to `/var/log` for backwards compatibility. The files you're reading at the terminal are often a text rendering of what journald stored.

## The Syslog Priority System

Every log message carries two metadata fields that determine where it ends up.

**Facility** identifies the source category:

| Code | Facility | Typical Source |
|------|----------|----------------|
| 0 | kern | Linux kernel |
| 1 | user | User-space applications |
| 3 | daemon | Background services |
| 4 | auth | Authentication and security |
| 9 | cron | cron and at jobs |
| 16–23 | local0–local7 | Reserved for custom use |

**Severity** ranks how serious the message is (lower number = more serious):

| Level | Name | Meaning |
|-------|------|---------|
| 0 | EMERG | System is unusable |
| 1 | ALERT | Action must be taken immediately |
| 2 | CRIT | Critical conditions |
| 3 | ERR | Error conditions |
| 4 | WARNING | Warning conditions |
| 5 | NOTICE | Normal but significant condition |
| 6 | INFO | Informational messages |
| 7 | DEBUG | Debug-level messages |

When rsyslog routes a message to a file, it uses a selector like `kern.warning` (kernel facility, WARNING and above) or `*.info` (all facilities, INFO and above). This is why some events appear in multiple log files — a kernel error matching both `kern.*` and `*.err` will be written wherever both selectors apply.

## The Major Log Files

### `/var/log/syslog` (Debian/Ubuntu) or `/var/log/messages` (RHEL/CentOS/Fedora)

This is the general-purpose catch-all. Rsyslog's default configuration routes most facility/severity combinations here. If you don't know which specific log to check, start here.

```
Jun  1 09:12:34 webserver rsyslogd: imuxsock: Acquired UNIX socket '/dev/log'
Jun  1 09:13:01 webserver CRON[1482]: (root) CMD (   cd / && run-parts --report /etc/cron.hourly)
Jun  1 09:14:22 webserver kernel: [12345.678901] eth0: renamed from veth3a2b1c
Jun  1 09:15:00 webserver systemd[1]: Started Daily apt download activities.
```

The format is: `timestamp hostname process[PID]: message`. The timestamp is local system time (not UTC, unless you've configured NTC). Notably, syslog traditionally omits the year — tools like OmniLog and most parsers infer it from context. This is a subtle trap when analysing log archives that span a year boundary.

**What to look for:** Recurring errors from a specific process, unexpected reboots (look for rsyslogd start messages following a gap in timestamps), cron job failures.

### `/var/log/kern.log`

Kernel messages only — the same output you'd see from `dmesg` but with syslog timestamps appended and written to a persistent file. The kernel writes here via the `printk()` function inside kernel code.

```
Jun  1 10:03:17 webserver kernel: [    0.000000] Initializing cgroup subsys cpuset
Jun  1 10:03:17 webserver kernel: [    0.000000] Linux version 6.5.0-44-generic (buildd@...)
Jun  1 10:03:22 webserver kernel: [    5.123456] EXT4-fs (sda1): mounted filesystem with ordered data mode
Jun  1 10:47:55 webserver kernel: [2650.901234] usb 1-1.2: new high-speed USB device number 4 using xhci_hcd
```

The bracketed number after `kernel:` is the **kernel uptime in seconds** at the time of the message, not a real timestamp. That makes it useful for correlating events relative to boot, but awkward to correlate with wall-clock time in other logs.

**What to look for:** Hardware errors (`EXT4-fs error`, `SCSI error`, `hardware error`), OOM killer events (`Out of memory: Kill process`), driver problems, filesystem mount issues, and USB device activity.

### `/var/log/auth.log` (Debian/Ubuntu) or `/var/log/secure` (RHEL/CentOS)

All authentication-related events go here: SSH logins and logouts, sudo usage, PAM stack decisions, su attempts, and failed password entries.

```
Jun  1 11:22:03 webserver sshd[3241]: Accepted publickey for deploy from 203.0.113.42 port 54921 ssh2
Jun  1 11:22:03 webserver sshd[3241]: pam_unix(sshd:session): session opened for user deploy
Jun  1 14:01:17 webserver sshd[8812]: Invalid user admin from 198.51.100.7 port 39812
Jun  1 14:01:17 webserver sshd[8812]: Failed password for invalid user admin from 198.51.100.7
Jun  1 14:01:18 webserver sshd[8813]: Invalid user root from 198.51.100.7 port 39815
Jun  1 15:30:00 webserver sudo: deploy : TTY=pts/0 ; PWD=/home/deploy ; USER=root ; COMMAND=/bin/systemctl restart nginx
```

This file is security-critical. The pattern of `Invalid user X from IP` with rapid sequential port numbers is the signature of an SSH brute-force scan. A single source IP generating dozens of these per second is an active attack. The `sudo` lines create an audit trail: who ran what command as root, and when.

**What to look for:** Brute-force attempts (many `Failed password` or `Invalid user` from the same IP), successful logins from unexpected locations, sudo usage at unusual hours, PAM errors that may indicate misconfigured MFA.

### `/var/log/dmesg`

A snapshot of the kernel ring buffer at the time the system last booted, written to a file during startup. Unlike `kern.log`, this is a static file — it captures the boot sequence and does not receive ongoing messages.

```
[    0.000000] BIOS-provided physical RAM map:
[    0.000000] ACPI: RSDP 0x00000000000F05B0 000024 (v02 BOCHS )
[    0.152341] ACPI: IRQ0 used by override.
[    3.882104] tsc: Refined TSC clocksource calibration: 2592.006 MHz
[    4.102943] EXT4-fs (sda1): re-mounted. Opts: errors=remount-ro
```

Run `dmesg` at any time to read the live ring buffer; `dmesg -T` adds human-readable timestamps. The file at `/var/log/dmesg` is the last boot only.

**What to look for:** Boot failures, missing firmware (`firmware: failed to load`), hardware not detected, filesystem errors caught at mount time.

### `/var/log/apt/history.log` and `/var/log/dpkg.log`

Package management audit trails, specific to Debian/Ubuntu and derivatives.

`dpkg.log` records every individual package installation, removal, and configuration step with fine granularity:

```
2026-06-01 09:00:01 startup packages configure
2026-06-01 09:00:03 configure nginx:amd64 1.24.0-1 <none>
2026-06-01 09:00:04 status installed nginx:amd64 1.24.0-1
```

`apt/history.log` groups operations into human-readable sessions:

```
Start-Date: 2026-06-01  09:00:00
Commandline: apt-get install nginx
Install: nginx:amd64 (1.24.0-1, automatic)
End-Date: 2026-06-01  09:00:05
```

**What to look for:** When a package was installed or upgraded (for correlating a breakage to a recent change), unexpected automatic upgrades, packages installed without a corresponding `apt` session (which might indicate a script running outside normal package management).

### `/var/log/nginx/access.log` and `/var/log/nginx/error.log`

NGINX writes its own logs independently of syslog. `access.log` uses the Combined Log Format by default:

```
203.0.113.42 - alice [01/Jun/2026:12:00:01 +0000] "GET /api/v2/users HTTP/1.1" 200 1423 "https://app.example.com" "Mozilla/5.0 ..."
198.51.100.99 - - [01/Jun/2026:12:00:03 +0000] "GET /.env HTTP/1.1" 404 153 "-" "python-requests/2.28.0"
```

The second line is a common scanner probe — automated tools looking for exposed `.env`, `.git/config`, and other sensitive files. High volumes of 404s from a single IP indicate active scanning.

`error.log` records configuration errors, upstream failures, and permission problems:

```
2026/06/01 12:01:55 [error] 1234#1234: *567 connect() failed (111: Connection refused) while connecting to upstream
2026/06/01 12:01:55 [crit] 1234#1234: *568 SSL_do_handshake() failed (SSL: error:1408F10B) while SSL handshaking
```

Apache follows the same split (`/var/log/apache2/access.log` and `error.log`) with a nearly identical Combined Log Format for access logs.

### `/var/log/ufw.log`

When the Uncomplicated Firewall is active, every blocked or explicitly allowed packet is logged here via the kernel's netfilter subsystem:

```
Jun  1 13:45:02 webserver kernel: [UFW BLOCK] IN=eth0 OUT= MAC=... SRC=203.0.113.55 DST=10.0.0.5 LEN=44 TOS=0x00 PREC=0x00 TTL=238 ID=54321 PROTO=TCP SPT=59234 DPT=22 WINDOW=1024 RES=0x00 SYN URGP=0
```

Each line tells you: direction (`IN`/`OUT`), interface, source IP (`SRC`), destination IP (`DST`), protocol (`PROTO`), source port (`SPT`), and destination port (`DPT`). `DPT=22` with `SYN` and `[UFW BLOCK]` means someone tried to initiate a TCP connection to SSH and was blocked.

**What to look for:** Port scans (many `[UFW BLOCK]` events from one IP across many destination ports), brute-force attempts on specific services, unexpected outbound connections if you're logging `OUT` rules.

### `/var/log/cron` or `/var/log/syslog` (cron entries)

Cron writes to syslog with `facility=cron`. On some distributions this is separated into `/var/log/cron`; on others it flows into `syslog`.

```
Jun  1 00:00:01 webserver CRON[9801]: (root) CMD (/usr/bin/certbot renew --quiet)
Jun  1 00:00:02 webserver CRON[9802]: (www-data) CMD (/usr/local/bin/cleanup_sessions.sh)
```

**What to look for:** Jobs that should run but don't appear in the log (missed crons), jobs whose timing shifts unexpectedly, errors piped back via MAILTO.

## Log Rotation: Why Old Logs Have Numbers

You'll often see files like `syslog.1`, `syslog.2.gz`, `auth.log.3.gz` alongside the current files. This is **logrotate** — a scheduled job that renames the current log file, compresses older versions, and deletes files past a retention threshold.

A typical rotation cycle for `/var/log/syslog`:
```
syslog          ← current, active writes
syslog.1        ← yesterday's, not yet compressed
syslog.2.gz     ← two days ago, compressed
syslog.3.gz
syslog.4.gz
...
syslog.7.gz     ← oldest retained (7-day default)
```

When investigating a past incident, look for `.gz` files. `zcat syslog.3.gz | grep "error"` works without decompressing to disk.

## Practical Commands

```bash
# Tail a log in real time
tail -f /var/log/syslog

# Show kernel messages with human timestamps
dmesg -T | tail -50

# journalctl: follow all logs
journalctl -f

# journalctl: logs from a specific service
journalctl -u nginx.service --since "1 hour ago"

# journalctl: only errors and above
journalctl -p err

# journalctl: logs from last boot
journalctl -b

# journalctl: previous boot (useful after a crash)
journalctl -b -1

# Count failed SSH attempts by IP
grep "Failed password" /var/log/auth.log | awk '{print $11}' | sort | uniq -c | sort -rn | head -20

# Find OOM kill events
grep -i "killed process" /var/log/kern.log

# Search across compressed archives
zgrep "error" /var/log/syslog.*.gz
```

## Making Sense of Large Log Files

The commands above work well for interactive debugging on a live server. When you need to analyse historical data — understanding traffic patterns over a week, spotting the spike in 5xx errors that coincided with a deploy, or building a picture of IP behaviour over time — reading flat files line by line stops scaling.

Structured analysis requires aggregation: grouping by time bucket, ranking by frequency, correlating status codes with request paths. That kind of processing is where a dedicated log analytics tool earns its place.

If you've pulled logs off a server and want to analyse them locally without uploading them anywhere, drop them into [OmniLog](/). It parses NGINX, Apache, UFW, and Syslog formats automatically, streams files of any size through a browser-side Web Worker, and produces time-series charts, IP rankings, and status distributions — all without your logs ever leaving your machine.

## Quick Reference

| File | What it contains | Key use cases |
|------|-----------------|---------------|
| `/var/log/syslog` | General catch-all | First stop for unknown issues |
| `/var/log/kern.log` | Kernel messages | Hardware errors, OOM, driver issues |
| `/var/log/auth.log` | Authentication | Brute-force detection, sudo audit |
| `/var/log/dmesg` | Boot-time kernel output | Hardware detection, boot failures |
| `/var/log/ufw.log` | Firewall blocks/allows | Port scans, blocked connections |
| `/var/log/apt/history.log` | Package operations | Correlating breaks with upgrades |
| `/var/log/nginx/access.log` | HTTP requests | Traffic analysis, scanner detection |
| `/var/log/nginx/error.log` | NGINX errors | Upstream failures, config errors |
| `/var/log/cron` | Cron job execution | Missed jobs, scheduling issues |

Linux logs are verbose by design. The system trusts that you'll filter the signal from the noise — and the tools are there to help you do it.
