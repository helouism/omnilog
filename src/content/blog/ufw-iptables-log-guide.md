# Understanding UFW and iptables Log Entries

UFW (Uncomplicated Firewall) is the default firewall on Ubuntu and Debian-based systems. Every time it blocks or allows a connection based on your rules, it writes a log entry — typically to `/var/log/ufw.log` and also to `/var/log/kern.log`. Reading these logs fluently helps you spot port scans, misconfigured services, and active intrusion attempts before they become incidents.

## What a UFW Log Line Looks Like

A blocked TCP connection looks like this:

```
Jun  7 14:23:18 server kernel: [12345.678901] [UFW BLOCK] IN=eth0 OUT= MAC=00:11:22:33:44:55:66:77:88:99:aa:bb:cc:dd SRC=198.51.100.23 DST=10.0.0.1 LEN=60 TOS=0x00 PREC=0x00 TTL=51 ID=44231 DF PROTO=TCP SPT=52814 DPT=22 WINDOW=64240 RES=0x00 SYN URGP=0
```

That's dense. Here's what every field means.

## Field-by-Field Breakdown

### Syslog Header

`Jun  7 14:23:18 server kernel:`

This is the standard syslog timestamp and hostname added by rsyslog when UFW's message passes through the kernel log. The kernel timestamp in brackets (`[12345.678901]`) is seconds since boot — useful for correlating with system events but not for wall-clock time.

### Action — `[UFW BLOCK]` or `[UFW ALLOW]`

The verdict:

- `[UFW BLOCK]`: The packet was dropped
- `[UFW ALLOW]`: The packet was permitted (only logged if you've run `ufw logging on`)
- `[UFW LIMIT BLOCK]`: The connection was rate-limited and then blocked (from `ufw limit` rules)

### IN and OUT — `IN=eth0 OUT=`

- `IN`: The network interface the packet arrived on — `eth0`, `ens3`, `wlan0`, etc.
- `OUT`: The outgoing interface (empty for incoming packets that were blocked before routing)

If both are set, the packet was being forwarded between interfaces. If only `IN` is set, it's an inbound packet destined for the local machine.

### MAC — `MAC=00:11:22:33:44:55:...`

Raw Ethernet frame header: destination MAC, source MAC, and EtherType, concatenated. Useful for identifying physical-layer traffic on a local network, but usually less important for Internet-facing servers where you care about IP-layer data.

### SRC and DST — `SRC=198.51.100.23 DST=10.0.0.1`

Source and destination IP addresses. For inbound block events:

- `SRC` is the remote address (the scanner, attacker, or misconfigured client)
- `DST` is your server

For outbound blocks — if configured — the roles reverse.

### Protocol and Ports — `PROTO=TCP SPT=52814 DPT=22`

- `PROTO`: Protocol — `TCP`, `UDP`, or `ICMP`
- `SPT` (source port): The ephemeral port on the remote side, typically 1024–65535
- `DPT` (destination port): The port on your server being targeted

High-value `DPT` values to monitor:

| Port | Service | Why it gets probed |
|------|---------|-------------------|
| 22 | SSH | Brute force and credential spraying |
| 3306 | MySQL | Exposed database |
| 5432 | PostgreSQL | Exposed database |
| 6379 | Redis | Often left open accidentally, no auth by default |
| 27017 | MongoDB | Same as Redis |
| 8080 / 8443 | Alt web | Alternative HTTP/HTTPS ports |
| 445 | SMB | Windows file sharing, often probed from compromised hosts |

### TCP Flags

After the port fields, TCP packets show their flags:

- `SYN` — Initial connection attempt. A series of `SYN`-only packets from one IP hitting many ports is a port scan.
- `FIN` — Normal connection teardown
- `RST` — Abrupt connection reset
- `ACK` — Acknowledgment
- `SYN URGP=0` — Standard SYN with no urgent data (the most common pattern for connection attempts)

### ICMP Fields

For ICMP packets (`PROTO=ICMP`), you'll see:

- `TYPE=8` — Echo Request (ping)
- `TYPE=0` — Echo Reply
- `CODE=0` — ICMP sub-type code

## Common Patterns and What They Mean

### SSH Brute Force

```
[UFW BLOCK] ... SRC=185.220.101.x DPT=22 PROTO=TCP SYN
```

Repeated hits from one or a small range of IPs on port 22. If you see hundreds of these per minute, the source is running an automated credential-stuffing or brute-force tool. `fail2ban` can automatically add block rules after N failures detected in the auth log.

### Port Scan

```
[UFW BLOCK] ... SRC=203.0.113.1 DPT=80 PROTO=TCP SYN
[UFW BLOCK] ... SRC=203.0.113.1 DPT=443 PROTO=TCP SYN
[UFW BLOCK] ... SRC=203.0.113.1 DPT=8080 PROTO=TCP SYN
[UFW BLOCK] ... SRC=203.0.113.1 DPT=22 PROTO=TCP SYN
```

Same source IP hitting many different destination ports in quick succession. This is a horizontal port scan — the attacker is mapping which services are running on your server.

### Misconfigured Application

```
[UFW BLOCK] ... IN=lo SRC=127.0.0.1 DST=127.0.0.1 DPT=6379
```

A localhost connection being blocked. This usually means an application is trying to reach Redis (6379), PostgreSQL (5432), or a similar local service but a UFW rule is too restrictive. The `IN=lo` (loopback interface) is the giveaway that this is local traffic, not external.

### UDP Scan

```
[UFW BLOCK] ... PROTO=UDP SPT=64823 DPT=53
[UFW BLOCK] ... PROTO=UDP SPT=61234 DPT=161
```

UDP probes on DNS (53) or SNMP (161). These are common in automated network reconnaissance tools.

## Raw iptables Log Format

UFW is a frontend for iptables. If you use iptables directly and add logging rules with `-j LOG --log-prefix "[IPTABLES DROP] "`, the format is nearly identical but without the `[UFW BLOCK/ALLOW]` prefix:

```
Jun  7 14:23:18 server kernel: [IPTABLES DROP] IN=eth0 SRC=198.51.100.23 DST=10.0.0.1 PROTO=TCP SPT=52814 DPT=22 SYN
```

The field names — `SRC`, `DST`, `PROTO`, `SPT`, `DPT`, `IN`, `OUT` — are standardised by the kernel's netfilter logging module and are identical regardless of the log prefix.

## Useful Commands

Count blocked IPs by frequency (top 20):

```bash
grep "UFW BLOCK" /var/log/ufw.log | grep -oP 'SRC=\K[^ ]+' | sort | uniq -c | sort -rn | head -20
```

See which destination ports are being probed most:

```bash
grep "UFW BLOCK" /var/log/ufw.log | grep -oP 'DPT=\K[0-9]+' | sort | uniq -c | sort -rn | head -20
```

Count blocks by hour:

```bash
grep "UFW BLOCK" /var/log/ufw.log | awk '{print $1, $2, substr($3,1,2)":00"}' | sort | uniq -c
```

Find all blocks targeting a specific port:

```bash
grep "UFW BLOCK" /var/log/ufw.log | grep "DPT=22"
```

## Analysing UFW Logs in OmniLog

[OmniLog](/) has a built-in UFW parser that auto-detects the `[UFW BLOCK/ALLOW]` prefix and extracts source IPs, destination ports, protocols, and timestamps. Drop a UFW log file and you'll get an IP frequency chart, port distribution, timeline view, and a searchable log table — all processed locally in your browser with no uploads.
