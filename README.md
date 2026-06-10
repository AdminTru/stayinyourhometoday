# Stay In Your Home Today — Website

**Tech:** Astro (static) · Cloudflare Pages · Plain CSS

---

## Local Development

```bash
npm install
npm run dev
# → http://localhost:4321
```

---

## Deploy to Cloudflare Pages

1. Push this repo to GitHub
2. In Cloudflare Pages dashboard → **Create a project** → connect your GitHub repo
3. Set build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Click **Save and Deploy**

Every push to `main` triggers a new build automatically.

---

## Adding a New Blog Post

1. Create a new file in `src/pages/blog/`, e.g. `src/pages/blog/avoiding-foreclosure.astro`
2. At the top of the file, export frontmatter so the blog index picks it up:

```astro
---
import BlogPostLayout from '../../layouts/BlogPostLayout.astro';

export const frontmatter = {
  title: "Your Post Title",
  description: "150-character meta description with keyword.",
  author: "Tiffany Lancaster",
  date: "2026-06-01",          // YYYY-MM-DD — used for sort order
  eyebrow: "Utah Foreclosure", // small label shown on blog index card
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your Post Title",
  "author": { "@type": "Person", "name": "Tiffany Lancaster" },
  "datePublished": "2026-06-01",
  "publisher": { "@type": "Organization", "name": "Stay In Your Home Today" }
};
---

<BlogPostLayout
  title="Your Post Title | Stay In Your Home Today"
  description="150-character meta description."
  schema={articleSchema}
>
  <!-- Hero slot (page-header section) -->
  <section class="page-header" slot="hero">
    <div class="container">
      <h1>Your Post Title</h1>
    </div>
  </section>

  <!-- Body content goes here -->
  <section id="tldr">
    <div class="tldr-block">
      <h3>TL;DR</h3>
      <p>Direct answer to the post's main question in 2–3 sentences.</p>
    </div>
  </section>

  <h2 id="section-1">First Section</h2>
  <p>Content...</p>

</BlogPostLayout>
```

3. The blog index at `/blog` will automatically include the new post on next build.

---

## Updating Existing Pages

| Page | File |
|------|------|
| Home/landing | `src/pages/home.astro` |
| Contact | `src/pages/contactus.astro` |
| Blog index | `src/pages/blog/index.astro` |
| Foreclosure Timeline | `src/pages/foreclosure-timeline.astro` |
| Nav links | `src/components/Nav.astro` |
| Footer | `src/components/Footer.astro` |
| Global CSS | `src/styles/global.css` |

---

## Personalized URLs (Direct Mail)

The `/home` page supports `?fn=FirstName` for personalized greetings:

```
https://stayinyourhometoday.com/home?fn=John
```

It also supports `?nod=MM/DD/YY` (Notice of Default date) to populate the countdown timers:

```
https://stayinyourhometoday.com/home?fn=John&nod=03/01/26
```

Both parameters degrade gracefully — the page is fully readable without them.

---

## Cloudflare Pages Environment Variables

No environment variables are required for this static build.

---

## SEO Checklist (per new page)

- [ ] Unique `<title>` under 60 characters
- [ ] Unique `<meta name="description">` 120–155 characters, includes "Utah"
- [ ] One `<h1>` per page
- [ ] JSON-LD schema in `<BaseLayout schema={...}>`
- [ ] `id` anchors on major sections for AEO citation
- [ ] `#tldr` section at top of blog posts
- [ ] Full name "Tiffany Lancaster" and "Stay In Your Home Today" mentioned in body copy
