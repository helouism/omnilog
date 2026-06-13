# How fail2ban Reads Your Logs to Block Attackers

fail2ban is the quiet workhorse running on millions of Linux servers. Its job is simple to describe and powerful in practice: it watches your log files, and when it sees too many failures from one IP address, it bans that IP at the firewall. It turns passive log lines into active defence. Understanding how it parses logs demystifies it — and helps you tune it so it catches real attacks without locking out your own team.

## The Core Idea

fail2ban is fundamentally a **log parser with consequences**. Its loop is:

1. **Tail** one or more log files in real time.
2. **Match** each new line against a set of regular expressions (a *filter*).
3. **Count** matches per source IP within a sliding time window.
4. **Ban** the IP — via iptables, nftables, or firewalld — when the count crosses a threshold.
5. **Unban** automatically after a configured duration.

Everything fail2ban does is built on reading the same logs you read by hand — `auth.log`, nginx and Apache logs, mail logs — just continuously and at machine speed.

## Jails: What to Watch and What to Do

A **jail** ties together a log source, a filter, and an action. Jails live in `/etc/fail2ban/jail.local` (never edit `jail.conf` directly — it gets overwritten on upgrade). A minimal SSH jail:

```ini
[sshd]
enabled  = true
port     = ssh
filter   = sshd
logpath  = /var/log/auth.log
maxretry = 5
findtime = 600
bantime  = 3600
```

The four numbers that govern behaviour:

- **`maxretry = 5`** — number of failures that triggers a ban.
- **`findtime = 600`** — the sliding window in seconds. Five failures *within 600 seconds* trips the jail.
- **`bantime = 3600`** — how long the ban lasts, in seconds. `-1` means permanent.
- **`logpath`** — the file fail2ban tails for this jail.

So this jail says: *if one IP fails SSH login 5 times in 10 minutes, ban it for an hour.*

## Filters: The Regex That Catches Attackers

A **filter** is a set of regular expressions that define what a "failure" looks like in a given log format. They live in `/etc/fail2ban/filter.d/`. The key directive is `failregex`, and it must contain the token `<HOST>`, which fail2ban replaces with a pattern that captures the offending IP.

A snippet from the `sshd` filter:

```
failregex = ^%(__prefix_line)sFailed \S+ for .* from <HOST>
            ^%(__prefix_line)sInvalid user .* from <HOST>
```

Match these against the real log lines they target:

```
Mar 14 09:21:44 web01 sshd[20413]: Failed password for invalid user admin from 203.0.113.55 port 54122 ssh2
Mar 14 09:21:46 web01 sshd[20414]: Invalid user oracle from 203.0.113.55 port 54124
```

Both lines match, both attribute the failure to `203.0.113.55`, and that IP's counter ticks up. Five such lines in the window, and it is banned.

## Testing a Filter Before You Trust It

The most useful fail2ban command by far lets you run a filter against a real log file and see exactly what it would catch:

```bash
fail2ban-regex /var/log/auth.log /etc/fail2ban/filter.d/sshd.conf
```

The output reports how many lines matched, which IPs were extracted, and — crucially — how many lines were **missed**. If you write a custom filter for an application, this is how you confirm it actually matches your log format before relying on it.

## Checking What fail2ban Is Doing

Is a jail working? Who is currently banned?

```bash
# Status of all jails
sudo fail2ban-client status

# Detail for one jail: currently banned IPs, total counts
sudo fail2ban-client status sshd

# Manually ban or unban
sudo fail2ban-client set sshd banip 203.0.113.55
sudo fail2ban-client set sshd unbanip 203.0.113.55
```

fail2ban also logs its own actions to `/var/log/fail2ban.log`, so you can audit every ban and unban:

```
2024-03-14 09:22:01,883 fail2ban.actions [1123]: NOTICE [sshd] Ban 203.0.113.55
2024-03-14 10:22:02,011 fail2ban.actions [1123]: NOTICE [sshd] Unban 203.0.113.55
```

## Protecting More Than SSH

The same mechanism guards web applications. A jail against repeated authentication failures or scanner probing in nginx logs:

```ini
[nginx-http-auth]
enabled = true
filter  = nginx-http-auth
port    = http,https
logpath = /var/log/nginx/error.log

[nginx-botsearch]
enabled  = true
filter   = nginx-botsearch
port     = http,https
logpath  = /var/log/nginx/access.log
maxretry = 2
```

Any log with a consistent "failure" line — mail servers, FTP, VPNs, custom apps — can be defended by writing a filter for its format.

## Tuning Without Locking Yourself Out

fail2ban's power cuts both ways: a too-aggressive jail can ban *you*.

- **Whitelist trusted sources** with `ignoreip` in `jail.local`:
  ```ini
  ignoreip = 127.0.0.1/8 ::1 203.0.113.0/24
  ```
- **Escalate repeat offenders** with the `recidive` jail, which bans IPs that keep coming back after their first ban expires.
- **Start lenient, then tighten.** Watch `fail2ban.log` for a few days to learn your real failure baseline before lowering `maxretry`.
- **Mind log rotation.** If logrotate does not signal services to reopen their logs, fail2ban can end up watching a stale file and silently stop catching attacks.

## Seeing the Attack fail2ban Defends Against

fail2ban tells you *that* it banned an IP, but to understand the *shape* of an attack — when it started, how many attempts, which usernames, whether anything succeeded — you still need to read the underlying log. [OmniLog](/) parses `auth.log`, nginx, and Apache logs directly in your browser, charting failure volume over time and ranking the top offending IPs so you can see exactly what fail2ban was reacting to. It is the perfect companion for a post-incident review: load the log, find the spike, and confirm no `Accepted` login slipped through before the ban landed — all client-side, with nothing uploaded.
