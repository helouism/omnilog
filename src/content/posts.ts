export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  description: string;
  readingTime: string;
  tags: string[];
}

export const POSTS: PostMeta[] = [
  {
    slug: 'http-status-codes-explained',
    title: 'HTTP Status Codes Explained (With Real Log Examples)',
    date: '2026-06-13',
    description:
      'Every class of HTTP status code — 2xx to 5xx — explained with the access-log lines you actually see, how to spot scanners in 4xx floods, and how to read the status distribution at a glance.',
    readingTime: '8 min read',
    tags: ['http', 'status-codes', 'nginx', 'devops'],
  },
  {
    slug: 'grep-awk-log-analysis',
    title: 'Analysing Logs With grep and awk: A Practical Cookbook',
    date: '2026-06-13',
    description:
      'The grep and awk patterns that actually come up in log analysis: filter, count, rank top offenders, sum and average fields, work with timestamps, and run a real investigation end to end.',
    readingTime: '9 min read',
    tags: ['grep', 'awk', 'command-line', 'devops'],
  },
  {
    slug: 'docker-container-logs',
    title: 'How to View and Manage Docker Container Logs',
    date: '2026-06-13',
    description:
      'Master docker logs: follow live output, filter by time, find where logs live on disk, avoid the disk-filling trap with rotation, and export container logs for analysis.',
    readingTime: '8 min read',
    tags: ['docker', 'containers', 'devops', 'logging'],
  },
  {
    slug: 'mysql-slow-query-log',
    title: 'The MySQL Slow Query Log: Finding the Queries That Hurt',
    date: '2026-06-13',
    description:
      'Enable and read the MySQL slow query log, decode Rows_examined vs Rows_sent to spot missing indexes, summarise with mysqldumpslow, and diagnose culprits with EXPLAIN.',
    readingTime: '8 min read',
    tags: ['mysql', 'database', 'performance', 'sql'],
  },
  {
    slug: 'dmesg-kernel-log-guide',
    title: 'Reading the Kernel Log: A Practical Guide to dmesg',
    date: '2026-06-13',
    description:
      'Read the kernel ring buffer with dmesg: human-readable timestamps, severity filtering, and recognising OOM kills, disk I/O errors, read-only remounts, link flaps, and kernel panics.',
    readingTime: '8 min read',
    tags: ['dmesg', 'kernel', 'linux', 'troubleshooting'],
  },
  {
    slug: 'detect-ssh-brute-force-auth-log',
    title: 'How to Detect SSH Brute-Force Attacks in auth.log',
    date: '2026-06-13',
    description:
      'Read auth.log like an analyst: spot failed passwords, invalid users, and the one Accepted line that signals a breach. Command-line hunting plus how to shut brute-force attacks down.',
    readingTime: '8 min read',
    tags: ['ssh', 'security', 'auth-log', 'linux'],
  },
  {
    slug: 'journalctl-cheat-sheet',
    title: 'journalctl Cheat Sheet: Querying the systemd Journal',
    date: '2026-06-13',
    description:
      'The journalctl reference you will actually keep open: filter by service, time, boot, and priority, export logs, manage journal size, and combine filters for targeted queries.',
    readingTime: '8 min read',
    tags: ['journalctl', 'systemd', 'linux', 'logging'],
  },
  {
    slug: 'logrotate-configuration-guide',
    title: 'How logrotate Works: Configuring Log Rotation on Linux',
    date: '2026-06-13',
    description:
      'A complete guide to logrotate: every directive in a real config explained, the open-file-handle bug that breaks rotation, copytruncate vs postrotate, and how to test safely.',
    readingTime: '8 min read',
    tags: ['logrotate', 'devops', 'linux', 'sysadmin'],
  },
  {
    slug: 'fail2ban-log-analysis',
    title: 'How fail2ban Reads Your Logs to Block Attackers',
    date: '2026-06-13',
    description:
      'Understand fail2ban as a log parser with consequences: jails, filters and failregex, the maxretry/findtime/bantime window, testing filters, and tuning without locking yourself out.',
    readingTime: '8 min read',
    tags: ['fail2ban', 'security', 'firewall', 'devops'],
  },
  {
    slug: 'linux-log-files-guide',
    title: 'Linux Log Files Explained: syslog, kern.log, auth.log and Everything in Between',
    date: '2026-06-01',
    description:
      'A practical guide to every major log file under /var/log — what each one contains, how syslog routing and journald work, and the commands you need to diagnose real problems.',
    readingTime: '9 min read',
    tags: ['linux', 'syslog', 'devops', 'security'],
  },
  {
    slug: 'nginx-access-log-format',
    title: 'How to Read NGINX Access Log Format',
    date: '2026-06-07',
    description:
      'A field-by-field guide to the NGINX combined log format: remote address, status codes, referer, user agent, and how to analyse access logs with grep and awk.',
    readingTime: '7 min read',
    tags: ['nginx', 'access-log', 'devops'],
  },
  {
    slug: 'ufw-iptables-log-guide',
    title: 'Understanding UFW and iptables Log Entries',
    date: '2026-06-07',
    description:
      'Learn to read every field in a UFW firewall log line: SRC, DST, DPT, SPT, PROTO, TCP flags. Identify port scans, brute force attempts, and misconfigured services.',
    readingTime: '8 min read',
    tags: ['ufw', 'iptables', 'firewall', 'security'],
  },
  {
    slug: 'apache-error-log-codes',
    title: 'Common Apache Error Log Codes Explained',
    date: '2026-06-07',
    description:
      'Understand Apache error log format, severity levels, and the most common errors: 403 Forbidden, 500 Internal Server Error, SSL issues, and rewrite loops.',
    readingTime: '8 min read',
    tags: ['apache', 'error-log', 'devops'],
  },
  {
    slug: 'syslog-severity-levels',
    title: 'Linux Syslog Severity Levels: A Complete Guide',
    date: '2026-06-07',
    description:
      'All eight RFC 5424 syslog severity levels explained: from emergency (0) to debug (7), how rsyslog routes them, and how to filter with journalctl.',
    readingTime: '7 min read',
    tags: ['syslog', 'linux', 'logging'],
  },
  {
    slug: 'parsing-100gb-logs-in-the-browser',
    title: 'How OmniLog Parses 100 GB Log Files Entirely in Your Browser',
    date: '2025-06-01',
    description:
      'A technical deep dive into the Web Worker streaming architecture that lets OmniLog handle gigabyte-scale log files without any uploads.',
    readingTime: '7 min read',
    tags: ['architecture', 'web-workers', 'privacy'],
  },
];

const MD_MODULES = import.meta.glob<string>('./blog/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export function getPostContent(slug: string): string | null {
  const key = `./blog/${slug}.md`;
  return MD_MODULES[key] ?? null;
}
