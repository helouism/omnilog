# How logrotate Works: Configuring Log Rotation on Linux

Logs grow forever. A busy web server can write gigabytes of access logs a day, and without management those files will eventually fill the disk and take the whole machine down with them. **logrotate** is the standard Linux utility that prevents this — it rotates, compresses, and eventually deletes old logs on a schedule. Understanding it is essential operational hygiene.

## The Problem logrotate Solves

A single ever-growing log file has two failure modes: it fills the disk, and it becomes too large to open or search efficiently. logrotate breaks one giant file into a series of dated, compressed archives, keeps a fixed number of them, and discards the rest. The result is predictable disk usage and manageable file sizes.

## How It Runs

logrotate is **not** a daemon. It is a one-shot program triggered on a schedule, usually daily, by either cron or a systemd timer:

- **cron**: `/etc/cron.daily/logrotate`
- **systemd**: `logrotate.timer` (check with `systemctl status logrotate.timer`)

Each run, logrotate reads its config, checks every managed log against its rotation rules, and acts only on those that are due.

## Configuration Layout

There are two layers:

- **`/etc/logrotate.conf`** — global defaults
- **`/etc/logrotate.d/`** — one drop-in file per application

When you install nginx, Apache, or most server software, the package drops a file into `/etc/logrotate.d/` automatically. You rarely edit the main config; you add or tweak drop-ins.

## A Real Configuration, Annotated

Here is a typical nginx rotation rule:

```
/var/log/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}
```

Every directive earns its place:

- **`daily`** — rotate once per day. Alternatives: `weekly`, `monthly`, `yearly`, or `size 100M` to rotate when the file exceeds a size.
- **`missingok`** — do not error if the log file is absent.
- **`rotate 14`** — keep 14 rotated copies, then delete the oldest. With `daily`, that is two weeks of history.
- **`compress`** — gzip rotated files (`access.log.2.gz`). Saves enormous space on text logs.
- **`delaycompress`** — wait one cycle before compressing, so the most recent rotation stays readable for tools still writing to it.
- **`notifempty`** — skip rotation if the log is empty.
- **`create 0640 www-data adm`** — after rotating, recreate the live log file with these permissions and ownership.
- **`sharedscripts`** — run the `postrotate` block once for the whole glob, not once per matched file.
- **`postrotate … endscript`** — commands to run after rotation. Here it signals nginx to reopen its log files.

## The Critical Detail: Reopening Log Files

When logrotate renames `access.log` to `access.log.1`, the running service still holds an open file handle to the **old inode**. It keeps writing to the renamed file, and your new `access.log` stays empty. This is the single most common log-rotation bug.

There are two ways to fix it:

1. **Signal the service to reopen** its files (the `postrotate` approach above). nginx and Apache support this.
2. **`copytruncate`** — copy the log's contents to the archive, then truncate the original in place. The service keeps writing to the same inode, no signal needed:

```
/var/log/myapp/app.log {
    daily
    rotate 7
    compress
    copytruncate
}
```

`copytruncate` is simpler but has a small race window where log lines written during the copy can be lost. Prefer the signal approach when the application supports it; use `copytruncate` for apps that cannot reopen their logs.

## Testing Without Waiting a Day

You do not have to wait for the next cron run to see if your config works. Use debug mode:

```bash
# Dry run — show what WOULD happen, change nothing
logrotate -d /etc/logrotate.d/nginx

# Force a rotation now, even if not due
sudo logrotate -f /etc/logrotate.d/nginx

# Verbose, real run
sudo logrotate -v /etc/logrotate.conf
```

`-d` (debug) is your best friend — it prints every decision logrotate would make without touching a single file.

## Checking Rotation State

logrotate tracks when it last rotated each file in a state file:

```bash
cat /var/lib/logrotate/status
```

If a log is not rotating when expected, this file tells you when logrotate last thinks it acted on it — invaluable for debugging a stuck rotation.

## Common Pitfalls

- **Empty new log file** — the service was not signalled to reopen; add `postrotate` or `copytruncate`.
- **Wrong permissions after rotation** — the `create` directive does not match what the service expects; logs silently stop.
- **Disk still filling** — `rotate` count too high, or `compress` missing. Check actual usage with `du -sh /var/log/*`.
- **Rotation not running at all** — the cron job or systemd timer is disabled. Verify with `systemctl status logrotate.timer`.

## Analysing Rotated Logs Together

The flip side of rotation is that your history is now scattered across `access.log`, `access.log.1`, and a stack of `.gz` archives. To analyse a trend across the whole retention window you have to stitch them back together:

```bash
zcat /var/log/nginx/access.log.*.gz | cat - /var/log/nginx/access.log.1 /var/log/nginx/access.log > /tmp/all-access.log
```

Drop that combined file into [OmniLog](/) and it parses the whole span at once — charting traffic over the full two weeks, ranking top IPs and status codes across every rotation, without uploading anything. It is a quick way to see the big picture that per-file rotation otherwise hides.
