# Reading the Kernel Log: A Practical Guide to dmesg

When hardware misbehaves, a disk starts failing, or the kernel kills a process for using too much memory, the evidence lands in one place: the kernel ring buffer, which you read with `dmesg`. It is the lowest-level log on a Linux system, sitting beneath your applications and even beneath most of your services. Learning to read it is how you diagnose problems that no application log will ever explain.

## What the Kernel Ring Buffer Is

The kernel logs its own messages to a fixed-size in-memory buffer called the **ring buffer**. "Ring" because when it fills, the oldest messages are overwritten by new ones. This is where the kernel records hardware detection at boot, driver messages, filesystem events, network interface changes, and critical events like out-of-memory kills and kernel panics.

Because it lives in memory, the ring buffer is fast and always available — even when disks are failing and normal logging cannot write. That is exactly why it is so valuable during hardware trouble.

## The dmesg Basics

Read the buffer:

```bash
dmesg
```

On modern systems, reading `dmesg` may require root:

```bash
sudo dmesg
```

The most useful everyday form — human-readable timestamps and colour:

```bash
dmesg -H        # human-readable, opens in a pager with relative timestamps
dmesg -T        # convert timestamps to wall-clock time
```

By default, kernel timestamps are **seconds since boot** (`[12345.678901]`), which is nearly useless for correlating with other logs. `dmesg -T` translates them to real dates and times — always use it when investigating an incident.

Follow new messages live:

```bash
dmesg -w        # wait for and print new messages (like tail -f)
```

## Filtering by Severity

Kernel messages carry the same syslog priority levels (0–7) as the rest of the system. Filter to show only what matters:

```bash
dmesg -l err,crit,alert,emerg    # serious problems only
dmesg -l warn                    # warnings and worse
```

This is the fastest way to cut through pages of routine boot chatter to the lines that actually indicate a fault.

## Filtering by Subsystem

`dmesg -x` shows the facility and level of each line, but for everyday triage you usually grep for the subsystem you suspect:

```bash
dmesg | grep -i error            # anything flagged as an error
dmesg | grep -i 'usb'            # USB device events
dmesg | grep -i 'eth\|enp\|link' # network interface changes
dmesg | grep -iE 'sda|nvme|ata'  # disk and storage events
```

## The Messages That Signal Real Trouble

These are the patterns worth recognising on sight.

### Out-of-Memory Killer

```
[12453.998] Out of memory: Killed process 8842 (java) total-vm:8200000kB, anon-rss:7100000kB
[12453.998] oom-kill:constraint=CONSTRAINT_NONE,...
```

The kernel ran out of memory and killed a process to survive. If a service mysteriously "just died" with no error in *its* log, the OOM killer in `dmesg` is the first place to check — the kernel killed it from underneath.

### Disk and I/O Errors

```
[ 89.231] ata1.00: failed command: READ FPDMA QUEUED
[ 89.245] blk_update_request: I/O error, dev sda, sector 2104578
[ 89.260] EXT4-fs error (device sda1): ext4_find_entry: reading directory block
```

These are the early warning signs of a failing disk. SMART may still report the drive as "healthy" while these errors accumulate — `dmesg` sees the failures in real time. Take a backup immediately when you see them.

### Filesystem Remounted Read-Only

```
[ 90.001] EXT4-fs (sda1): Remounting filesystem read-only
```

The kernel detected filesystem corruption and protected your data by making the filesystem read-only. Applications will start failing to write. This almost always follows I/O errors above it.

### Network Link Changes

```
[ 45.882] e1000e: eth0 NIC Link is Down
[ 48.114] e1000e: eth0 NIC Link is Up 1000 Mbps Full Duplex
```

Physical link flapping — a loose cable, a failing switch port, or a driver issue. If connectivity drops intermittently, this is where the proof is.

### Kernel Panics and Oops

```
[ 332.5] kernel BUG at mm/slub.c:305!
[ 332.5] Oops: 0002 [#1] SMP
```

A `BUG`, `Oops`, or panic is the kernel hitting an unrecoverable internal error — usually a driver or hardware fault. Capture the full trace; it is what you would hand to a kernel maintainer or hardware vendor.

## dmesg vs. journalctl vs. /var/log

These overlap, which causes confusion:

- **`dmesg`** reads the live, in-memory kernel ring buffer. It is wiped on reboot.
- **`journalctl -k`** (or `journalctl --dmesg`) shows kernel messages from the systemd journal — the **persistent** copy, including from previous boots (`journalctl -k -b -1`).
- **`/var/log/kern.log`** (Debian/Ubuntu) is the on-disk syslog copy of kernel messages.

Use `dmesg` for what is happening *now*; use `journalctl -k -b -1` to see what the kernel logged *before the last reboot* — essential for diagnosing a crash that rebooted the box.

## Capturing the Kernel Log for Analysis

To save a snapshot with real timestamps for an incident report or deeper analysis:

```bash
dmesg -T > kernel-$(date +%F).log

# Or the persistent journal copy, including the previous boot
journalctl -k -b -1 -o short-iso > last-boot-kernel.log
```

## Spotting Patterns in the Kernel Log

A handful of error lines is easy to eyeball, but recurring hardware faults — a disk throwing I/O errors every few minutes, a NIC flapping on a schedule, memory pressure building toward an OOM kill — reveal themselves as *patterns over time*, not single lines. Export the kernel log with `dmesg -T` and drop it into [OmniLog](/): it parses the syslog-style output in your browser, charts message volume and severity over time so a building problem stands out, and lets you filter to just the errors or a specific time window. It is processed entirely client-side, so even kernel logs from sensitive infrastructure never leave your machine.
