/**
 * Base URL of the backend API used at build time to render the blog.
 * Set PUBLIC_API_BASE_URL when building (see .env.example).
 */
export const API_BASE =
  import.meta.env.PUBLIC_API_BASE_URL ?? 'https://api.snbajaj.com/api/v1';

export interface BlogListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published_at: string | null;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_html: string;
  published_at: string | null;
  updated_at: string;
}

export async function fetchPublishedPosts(): Promise<BlogListItem[]> {
  try {
    const res = await fetch(`${API_BASE}/website/blog-posts?pageSize=100`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    // API unreachable at build time — build with an empty blog list.
    return [];
  }
}

export async function fetchPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(`${API_BASE}/website/blog-posts/${slug}`);
    if (!res.ok) return null;
    return (await res.json()) as BlogPost;
  } catch {
    return null;
  }
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
