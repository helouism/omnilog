# How to Detect SSH Brute-Force Attacks in auth.log

If your server has a public IP and port 22 open, it is being attacked right now. Automated bots continuously sweep the internet trying common usernames and passwords against SSH. Every one of those attempts is recorded in your authentication log — and learning to read that log is the difference between noticing a breach in progress and finding out weeks later.

## Where SSH Logs Live

The location depends on your distribution:

- **Debian / Ubuntu**: `/var/log/auth.log`
- **RHEL / CentOS / Fedora**: `/var/log/secure`
- **systemd journal** (any modern distro): `journalctl -u ssh` or `journalctl -u sshd`

SSH (via the `sshd` daemon) writes authentication events here using the standard syslog format. Each line carries a timestamp, the hostname, the process name with PID, and a human-readable message.

## Anatomy of a Failed Login

A single failed password attempt looks like this:

```
Mar 14 09:21:44 web01 sshd[20413]: Failed password for invalid user admin from 203.0.113.55 port 54122 ssh2
```

Breaking it down:

- **`Mar 14 09:21:44`** — timestamp (note: traditional syslog omits the year)
- **`web01`** — the hostname receiving the connection
- **`sshd[20413]`** — the process and its PID
- **`Failed password`** — the event type
- **`invalid user admin`** — the account that was tried. `invalid user` means the account does not exist on the system at all — a strong signal of blind guessing.
- **`from 203.0.113.55`** — the attacker's source IP
- **`port 54122`** — the client's source port

## The Messages That Matter

A brute-force attack produces a recognisable mix of log lines. Learn to spot each one.

### Failed Password

```
Failed password for root from 198.51.100.23 port 41888 ssh2
```

A password was tried against a **real** account and rejected. A handful of these is normal (fat-fingered logins). Hundreds per minute from one IP is an attack.

### Invalid User

```
Failed password for invalid user oracle from 198.51.100.23 port 41890 ssh2
Invalid user postgres from 198.51.100.23 port 41892
```

The username does not exist. Bots cycle through dictionaries of common service accounts — `admin`, `oracle`, `postgres`, `ubuntu`, `git`, `test`. A burst of different invalid usernames from one IP is the clearest brute-force fingerprint there is.

### Connection Closed / Preauth

```
Connection closed by authenticating user root 198.51.100.23 port 41888 [preauth]
Received disconnect from 198.51.100.23 port 41888:11: Bye Bye [preauth]
```

The bot gave up before completing authentication and moved on. `[preauth]` means the disconnect happened before login succeeded.

### Accepted Password — The One to Watch

```
Accepted password for deploy from 203.0.113.10 port 50122 ssh2
```

A **successful** login. In the middle of thousands of failures, an `Accepted` line from an unexpected IP is the single most important entry in the entire file. If you see one following a flood of failures from the same address, treat it as a confirmed compromise.

## Hunting Attacks From the Command Line

Count failed attempts per source IP — the offenders rise to the top:

```bash
grep "Failed password" /var/log/auth.log \
  | grep -oE "from [0-9.]+" \
  | awk '{print $2}' | sort | uniq -c | sort -rn | head -20
```

List every username an attacker tried:

```bash
grep "invalid user" /var/log/auth.log \
  | grep -oE "invalid user [a-z]+" | sort | uniq -c | sort -rn
```

Find successful logins (audit these against your known team and IPs):

```bash
grep "Accepted" /var/log/auth.log
```

See the timeline of attempts per hour to spot when an attack began:

```bash
grep "Failed password" /var/log/auth.log \
  | awk '{print $1, $2, $3}' | cut -d: -f1 | uniq -c
```

## Telling an Attack From Noise

A few failures scattered across the day are background noise. A genuine brute-force attack has a distinct shape:

- **Volume**: dozens to thousands of attempts in minutes
- **Single source, or a tight cluster of sources** hammering repeatedly
- **Many different usernames**, especially `invalid user` entries
- **Sequential source ports** incrementing rapidly (41888, 41890, 41892…)
- **Round-the-clock timing** — bots do not sleep, humans do

If volume comes from *many* distinct IPs each trying once or twice, you are likely seeing a **distributed** brute-force or credential-stuffing campaign — harder to block by IP, which is why key-based auth matters.

## Shutting It Down

Detection is half the job. The fixes:

1. **Disable password authentication entirely.** In `/etc/ssh/sshd_config` set `PasswordAuthentication no` and use SSH keys. This makes brute-forcing mathematically pointless.
2. **Disable root login**: `PermitRootLogin no`.
3. **Install fail2ban** to auto-ban IPs after N failures — it reads this very log file.
4. **Move SSH off port 22.** Cuts automated noise dramatically (though it is obscurity, not security).
5. **Restrict by source** with a firewall or `AllowUsers` directive where practical.

## Analysing auth.log at Scale

When `auth.log` rolls into millions of lines — or you are correlating an attack across weeks of rotated logs — grep and awk get unwieldy. [OmniLog](/) parses syslog-format authentication logs directly in your browser: drop the file and it charts failed-login volume over time, ranks the top attacking IPs, and lets you filter by message or date range to isolate the exact window an attack ran. Because everything is processed client-side, sensitive authentication data never leaves your machine.
