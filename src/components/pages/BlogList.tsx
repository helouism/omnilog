import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { POSTS } from '../../content/posts';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function BlogList() {
  useEffect(() => {
    document.title = 'Blog — OmniLog';
  }, []);

  const sorted = POSTS.toSorted((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="flex-grow-1 overflow-auto" style={{ background: '#0d1117' }}>
      <div className="container py-5" style={{ maxWidth: 760 }}>
        <div className="mb-5">
          <h1 className="fw-bold mb-2" style={{ fontSize: '2rem' }}>Blog</h1>
          <p className="text-muted">
            Deep dives into log analysis, browser performance, and privacy-first engineering.
          </p>
        </div>

        <div className="d-flex flex-column gap-4">
          {sorted.map(post => (
            <article
              key={post.slug}
              className="card border-secondary p-4"
              style={{ background: '#161b22' }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="text-muted small">{formatDate(post.date)}</span>
                <span className="text-muted small">·</span>
                <span className="text-muted small">{post.readingTime}</span>
              </div>

              <h2 className="fw-semibold mb-2" style={{ fontSize: '1.2rem' }}>
                <Link
                  to={`/blog/${post.slug}`}
                  className="text-white text-decoration-none"
                  style={{ lineHeight: 1.4 }}
                >
                  {post.title}
                </Link>
              </h2>

              <p className="text-secondary mb-3" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
                {post.description}
              </p>

              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex gap-2 flex-wrap">
                  {post.tags.map(tag => (
                    <span
                      key={tag}
                      className="badge"
                      style={{ background: '#21262d', color: '#8b949e', fontSize: '0.75rem' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link
                  to={`/blog/${post.slug}`}
                  className="text-decoration-none small"
                  style={{ color: '#58a6ff' }}
                >
                  Read article →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
