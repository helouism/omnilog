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
