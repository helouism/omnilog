# The MySQL Slow Query Log: Finding the Queries That Hurt

When a database-backed application slows to a crawl, the cause is almost always a handful of expensive queries. The MySQL slow query log is the tool that finds them — it records every query that takes longer than a threshold you set, turning a vague "the site feels slow" complaint into a concrete list of statements to fix. This guide covers enabling it, reading its output, and acting on what you find.

## What the Slow Query Log Records

The slow query log captures any SQL statement whose execution time exceeds `long_query_time` (default 10 seconds, which is far too high for most workloads). For each slow statement it records the query text, how long it took, how many rows it examined versus returned, and when it ran. That last metric — rows examined vs. rows returned — is often the single most telling number in the whole file.

## Enabling It

You can turn it on at runtime without restarting MySQL:

```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;          -- log queries over 1 second
SET GLOBAL slow_query_log_file = '/var/log/mysql/slow.log';
```

To capture queries that are slow because they are **not using an index** — even fast ones — also enable:

```sql
SET GLOBAL log_queries_not_using_indexes = 'ON';
```

To make it permanent, add to `my.cnf` (`/etc/mysql/my.cnf` or a file in `conf.d/`):

```ini
[mysqld]
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 1
log_queries_not_using_indexes = 1
```

Then restart MySQL. Setting `long_query_time = 1` (or even `0.5`) is far more useful than the default — most "slow" queries that hurt a web app run in the 1–5 second range, well under the 10-second default that would never log them.

## Reading a Slow Query Log Entry

A single entry looks like this:

```
# Time: 2024-03-14T09:14:22.123456Z
# User@Host: appuser[appuser] @ localhost []  Id: 4471
# Query_time: 3.452119  Lock_time: 0.000087  Rows_sent: 12  Rows_examined: 2840151
SET timestamp=1710407662;
SELECT * FROM orders WHERE customer_email = 'user@example.com' ORDER BY created_at DESC;
```

Decode the header line by line:

- **`Query_time: 3.452119`** — the query took 3.45 seconds. This is what crossed your threshold.
- **`Lock_time: 0.000087`** — time spent waiting for table/row locks. A high lock time points to contention rather than the query itself being slow.
- **`Rows_sent: 12`** — the query returned 12 rows.
- **`Rows_examined: 2840151`** — but MySQL scanned **2.8 million** rows to find those 12.

That last ratio is the smoking gun. Sending 12 rows after examining 2.8 million means a **full table scan** — there is no index on `customer_email`, so MySQL read the entire table. Adding `CREATE INDEX idx_email ON orders(customer_email);` would turn this 3.45-second query into a sub-millisecond one.

## The mysqldumpslow Summary Tool

Reading a raw slow log line by line does not scale. MySQL ships `mysqldumpslow`, which groups *similar* queries (ignoring specific literal values) and ranks them:

```bash
# Top 10 queries by total time spent
mysqldumpslow -s t -t 10 /var/log/mysql/slow.log

# Sort by average query time
mysqldumpslow -s at /var/log/mysql/slow.log

# Sort by number of rows examined
mysqldumpslow -s r /var/log/mysql/slow.log
```

The `-s t` (sort by total time) view is the one to start with: it surfaces the queries consuming the most database time *in aggregate*, which is where optimisation pays off most. A query that takes 0.5 seconds but runs 10,000 times an hour hurts more than a 5-second query that runs twice.

`pt-query-digest` from Percona Toolkit does the same job with deeper analysis if you need it.

## Diagnosing a Slow Query With EXPLAIN

Once the log names a culprit, `EXPLAIN` tells you *why* it is slow:

```sql
EXPLAIN SELECT * FROM orders WHERE customer_email = 'user@example.com';
```

Key columns in the output:

- **`type`** — the access method. `ALL` means a full table scan (bad); `ref` or `range` means an index is being used; `const`/`eq_ref` are ideal.
- **`rows`** — MySQL's estimate of how many rows it must examine. A large number here matches a large `Rows_examined` in the log.
- **`key`** — which index is actually used. `NULL` means none — the query you need to fix.

`type: ALL` plus `key: NULL` is the signature of a missing index, the most common slow-query cause by far.

## The Fix Checklist

When the slow log hands you a query, work through this:

1. **Missing index?** High `Rows_examined`, `type: ALL`, `key: NULL` → add an index on the filtered/joined columns.
2. **`SELECT *` on a wide table?** Fetch only the columns you need.
3. **No `LIMIT` on a large result set?** Paginate.
4. **Function on an indexed column?** `WHERE DATE(created_at) = ...` defeats the index — rewrite as a range.
5. **High `Lock_time`?** The query is fine; you have contention. Look at long-running transactions holding locks.

## Analysing the Slow Log Over Time

`mysqldumpslow` aggregates *which* queries are slow, but it flattens away *when* — and slow-query problems are often time-bound, spiking during traffic peaks, nightly batch jobs, or a specific deploy. Drop your `slow.log` into [OmniLog](/) and it parses the entries in the browser, charting slow-query volume over time so you can see exactly when the database started struggling and correlate it with deploys or load. It runs entirely client-side, so query text — which can contain sensitive data — never leaves your machine, a real advantage over uploading logs to a hosted analysis service.
