# journalctl Cheat Sheet: Querying the systemd Journal

On any modern Linux distribution, logs no longer live solely in plain-text files under `/var/log`. systemd captures them in a structured, indexed binary store called the **journal**, and `journalctl` is the tool you use to query it. Once you know its filters, it is far more powerful than tailing a flat file — but the syntax trips up almost everyone at first. This is the reference you will actually keep open.

## What the Journal Is

`systemd-journald` collects log output from the kernel, services, and anything written to stdout/stderr by a unit, and stores it with rich metadata: the originating unit, the PID, the priority, the boot ID, and a precise timestamp. Because it is indexed, you can slice logs by time, service, or severity without grepping gigabytes of text.

By default the journal may be **volatile** (wiped on reboot, stored in `/run/log/journal`). To make it persistent across reboots:

```bash
sudo mkdir -p /var/log/journal
sudo systemctl restart systemd-journald
```

## The Essential Commands

### View Everything

```bash
journalctl
```

Opens the entire journal in a pager, oldest first. Add `-e` to jump to the end, or `-r` to reverse (newest first).

### Follow Live (like tail -f)

```bash
journalctl -f
```

Streams new entries as they arrive. The single most-used invocation.

### Logs for One Service

```bash
journalctl -u nginx.service
journalctl -u ssh -f          # follow SSH live
```

`-u` filters by unit. This is how you read a specific service's output without it being buried under everything else.

## Filtering by Time

This is where the journal shines over flat files.

```bash
journalctl --since "2024-03-14 09:00:00" --until "2024-03-14 10:00:00"
journalctl --since "1 hour ago"
journalctl --since yesterday
journalctl --since "09:00" --until "now"
```

`--since` and `--until` accept absolute timestamps **and** natural-language shortcuts like `today`, `yesterday`, `"2 days ago"`, and `"30 min ago"`.

## Filtering by Boot

Every reboot gets a boot ID. Investigate what happened in the current or a previous boot:

```bash
journalctl -b            # current boot only
journalctl -b -1         # the previous boot
journalctl --list-boots  # list all recorded boots with their IDs
```

`journalctl -b -1 -p err` is the classic "why did my server crash last time" query.

## Filtering by Priority

The journal understands syslog severity levels (0–7). Show only entries at or above a severity:

```bash
journalctl -p err        # err (3) and worse: err, crit, alert, emerg
journalctl -p warning    # warning (4) and worse
journalctl -p 0..3       # a numeric range
```

The level names, in order of decreasing severity: `emerg` (0), `alert` (1), `crit` (2), `err` (3), `warning` (4), `notice` (5), `info` (6), `debug` (7).

## Combining Filters

Filters are **ANDed** together, which makes targeted queries easy:

```bash
# Errors from nginx in the last hour
journalctl -u nginx -p err --since "1 hour ago"

# Kernel messages from the current boot
journalctl -k -b

# Everything from a specific PID
journalctl _PID=1432
```

`-k` is shorthand for kernel messages (`dmesg` equivalent). Fields prefixed with `_` (like `_PID`, `_UID`, `_SYSTEMD_UNIT`) are trusted metadata you can match on directly.

## Output Formats

The default is human-readable, but the journal can emit structured data:

```bash
journalctl -u nginx -o json          # one JSON object per line
journalctl -u nginx -o json-pretty   # indented JSON
journalctl -u nginx -o cat           # message only, no metadata
journalctl -o short-iso              # ISO-8601 timestamps
```

`-o json` is invaluable when you want to pipe journal data into another tool or parse it programmatically.

## Managing Journal Size

The journal can grow large. Inspect and prune it:

```bash
journalctl --disk-usage              # how much space is in use
sudo journalctl --vacuum-size=500M   # keep only the most recent 500 MB
sudo journalctl --vacuum-time=2weeks # delete entries older than two weeks
```

To cap it permanently, set `SystemMaxUse=` in `/etc/systemd/journal.conf`.

## Exporting for Offline Analysis

Sometimes you want the logs *out* of the journal — to hand to a colleague, archive, or analyse in another tool:

```bash
# Plain text, a single service, a specific window
journalctl -u nginx --since "2024-03-01" --until "2024-03-14" -o short-iso > nginx-march.log

# Everything from the last boot
journalctl -b -o short-iso > last-boot.log
```

## Quick Reference

| Goal | Command |
|---|---|
| Follow live | `journalctl -f` |
| One service | `journalctl -u <unit>` |
| Since a time | `journalctl --since "1 hour ago"` |
| Current boot | `journalctl -b` |
| Previous boot | `journalctl -b -1` |
| Errors only | `journalctl -p err` |
| Kernel log | `journalctl -k` |
| As JSON | `journalctl -o json` |
| Disk usage | `journalctl --disk-usage` |

## Analysing Exported Journal Logs Visually

Once you have exported a journal slice to a text file, `journalctl`'s filtering ends and manual reading begins. [OmniLog](/) picks up there: drop the exported `.log` file into your browser and it auto-detects the syslog format, charts message volume over time, surfaces the noisiest units and severities, and lets you filter by text or date range — no terminal gymnastics, and nothing uploaded anywhere. It is a fast way to eyeball an incident window after you have narrowed it down with `journalctl`.
