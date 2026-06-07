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
