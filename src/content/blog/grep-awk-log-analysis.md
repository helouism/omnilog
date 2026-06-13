# Analysing Logs With grep and awk: A Practical Cookbook

Before there were dashboards, there were `grep` and `awk` — and they are still the fastest way to interrogate a log file on a server you just SSH'd into. No tool to install, no data to upload, just two utilities that have shipped with Unix for decades. This is a cookbook of the patterns that actually come up when you are staring at a log and need an answer now.

## The Two Tools, Briefly

**`grep`** finds lines that match a pattern. It is your filter — "show me only the lines I care about."

**`awk`** splits each line into fields and lets you compute on them. It is your analyser — "out of those lines, count, sum, and group."

Used together — `grep` to narrow, `awk` to crunch — they answer most operational questions in a single pipeline.

## grep Essentials

Find every line containing an error:

```bash
grep -i "error" app.log
```

`-i` makes the match case-insensitive (`Error`, `ERROR`, `error` all match).

Show matches with surrounding context — invaluable for stack traces:

```bash
grep -B2 -A5 "Exception" app.log
```

`-B2` shows 2 lines before, `-A5` shows 5 lines after each match.

Count matches instead of printing them:

```bash
grep -c "404" access.log
```

Search across rotated and compressed logs in one go:

```bash
zgrep "500" /var/log/nginx/access.log*.gz
```

Invert the match to *exclude* noise:

```bash
grep -v "healthcheck" access.log
```

Use extended regex for alternation:

```bash
grep -E "500|502|503|504" access.log    # any 5xx-ish line
```

## awk Essentials

awk splits each line on whitespace by default into `$1`, `$2`, `$3`… with `$0` being the whole line. For a standard access log line:

```
203.0.113.42 - - [10/Oct/2024:13:55:36 +0000] "GET /api HTTP/1.1" 200 2326
```

`$1` is the IP, `$9` is the status code, `$10` is the bytes sent.

Print just the IP and status of every request:

```bash
awk '{print $1, $9}' access.log
```

Filter on a field — only 500 errors:

```bash
awk '$9 == 500' access.log
```

Filter on a numeric comparison — responses larger than 1 MB:

```bash
awk '$10 > 1000000 {print $7, $10}' access.log
```

## The Money Pattern: Count and Rank

Nine times out of ten, log analysis comes down to *"group by something, count, and sort the top offenders."* The pipeline is always the same shape:

```bash
awk '{print $FIELD}' file | sort | uniq -c | sort -rn | head
```

`sort` groups identical values together, `uniq -c` counts each group, and `sort -rn` ranks them by count descending. Memorise this — it is the workhorse.

**Top 10 IPs by request count:**

```bash
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
```

**Status code distribution:**

```bash
awk '{print $9}' access.log | sort | uniq -c | sort -rn
```

**Most-requested URLs:**

```bash
awk '{print $7}' access.log | sort | uniq -c | sort -rn | head -20
```

**Which IPs are generating the most 404s** (scanner detection):

```bash
awk '$9 == 404 {print $1}' access.log | sort | uniq -c | sort -rn | head
```

## Summing and Averaging

awk can accumulate values across all lines, which `grep` cannot.

**Total bytes transferred:**

```bash
awk '{sum += $10} END {print sum/1024/1024 " MB"}' access.log
```

**Average response size:**

```bash
awk '{sum += $10; n++} END {print sum/n " bytes avg"}' access.log
```

**Requests per IP, but only show IPs with more than 100 requests** (associative arrays):

```bash
awk '{count[$1]++} END {for (ip in count) if (count[ip] > 100) print count[ip], ip}' \
  access.log | sort -rn
```

That last one is awk at its best: it builds a hash table keyed by IP in a single pass over the file, then reports the heavy hitters.

## Working With Time

**Requests per minute** (spot traffic spikes) — the timestamp is field 4, and cutting on `:` isolates date+hour+minute:

```bash
awk '{print $4}' access.log | cut -d: -f1,2,3 | uniq -c
```

**Everything in a specific hour:**

```bash
grep "14/Mar/2024:09:" access.log | wc -l
```

## A Real Investigation, End to End

Suppose your server felt slow at 9am. Here is the kind of chain you would run:

```bash
# 1. How much traffic in that window?
grep "14/Mar/2024:09:" access.log | wc -l

# 2. Was it one source?
grep "14/Mar/2024:09:" access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head

# 3. What were they hitting?
grep "14/Mar/2024:09:" access.log | awk '{print $7}' | sort | uniq -c | sort -rn | head

# 4. Did the server error out?
grep "14/Mar/2024:09:" access.log | awk '$9 >= 500' | wc -l
```

Four commands, and you know whether it was a traffic spike, a single abusive IP, or your app falling over.

## When the Pipeline Gets Unwieldy

`grep` and `awk` are unbeatable for quick, targeted questions on the box. But when you want to *see* trends — volume over time, the shape of an attack, the status mix shifting — building bar charts by hand gets old fast, and very large files make repeated passes slow. [OmniLog](/) takes the same files and does the grouping for you in the browser: drop in an access or syslog file and it charts requests over time, ranks top IPs and status codes, and offers regex filtering — the visual layer on top of everything you would otherwise compute by hand. It runs entirely client-side, so the convenience costs you nothing in privacy.
