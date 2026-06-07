import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { POSTS, getPostContent } from '../../content/posts';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = POSTS.find(p => p.slug === slug);
  const content = slug ? getPostContent(slug) : null;

  useEffect(() => {
    if (post) document.title = `${post.title} — OmniLog Blog`;
  }, [post]);

  if (!post || !content) {
    return (
      <div className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ background: '#0d1117' }}>
        <div className="text-center">
          <h2 className="fw-bold mb-2">Post not found</h2>
          <p className="text-muted mb-4">This article doesn't exist or has been removed.</p>
          <Link to="/blog" className="btn btn-outline-secondary btn-sm">
            <i className="bi bi-arrow-left me-2" />Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow-1 overflow-auto" style={{ background: '#0d1117' }}>
      <div className="container py-5" style={{ maxWidth: 760 }}>
        <Link
          to="/blog"
          className="text-decoration-none small mb-4 d-inline-flex align-items-center gap-1"
          style={{ color: '#8b949e' }}
        >
          <i className="bi bi-arrow-left" />
          All posts
        </Link>

        <header className="mt-4 mb-5">
          <div className="d-flex align-items-center gap-2 mb-3">
            <span className="text-muted small">{formatDate(post.date)}</span>
            <span className="text-muted small">·</span>
            <span className="text-muted small">{post.readingTime}</span>
          </div>
          <h1 className="fw-bold mb-3" style={{ fontSize: '1.9rem', lineHeight: 1.3 }}>
            {post.title}
          </h1>
          <p className="text-secondary" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
            {post.description}
          </p>
          <div className="d-flex gap-2 mt-3">
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
        </header>

        <hr style={{ borderColor: '#30363d' }} />

        <div className="blog-content mt-5">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>

        <hr className="mt-5" style={{ borderColor: '#30363d' }} />

        <div className="d-flex justify-content-between align-items-center mt-4">
          <Link
            to="/blog"
            className="text-decoration-none small d-inline-flex align-items-center gap-1"
            style={{ color: '#8b949e' }}
          >
            <i className="bi bi-arrow-left" />
            All posts
          </Link>
          <Link to="/" className="btn btn-sm btn-outline-secondary">
            Try OmniLog →
          </Link>
        </div>
      </div>
    </div>
  );
}
