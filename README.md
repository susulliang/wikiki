# Wikiki

**Wikiki** is a personal wiki knowledge base that helps you organize, document, and manage information across multiple topics or projects. Think of it as your own private Wikipedia for storing notes, documentation, research, and ideas.

## What is Wikiki?

Wikiki lets you create **products** (topics or projects), each containing multiple **pages** (documents or notes). Each page supports rich text formatting, images, code blocks, and more — making it perfect for:

- 📝 Personal knowledge bases
- 📚 Project documentation
- 🧑‍💼 Work notes and wikis
- 📖 Research and study notes
- 🗂️ Reference collections

---

## Features

### ✨ Rich Text Editing
- **Formatting tools**: Bold, italic, underline, strikethrough
- **Headings**: Body text, H1, H2, H3
- **Lists**: Bullet points and numbered lists
- **Code blocks** and inline code
- **Links and images**: Embed images or add links
- **Blockquotes** and horizontal rules

### 🗂️ Multi-Product Organization
- Create separate **products** for different topics (e.g., "Work", "Personal", "Learning")
- Each product can have **multiple pages**
- Organize pages with **drag-and-drop reordering**
- Tag products for easy filtering

### 🎨 5 Beautiful Themes
Choose from:
- **Warm Light** – Soft, paper-like feel
- **Clean Light** – Crisp, modern white
- **Soft Light** – Gentle, muted tones
- **Dark** – Comfortable dark mode
- **Midnight** – Deep, elegant blue-black

### 🔍 Full-Text Search
- Search across all products and pages
- Find content by product name, tags, or page content
- Instant results with highlighted snippets
- **Grouped results**: multiple matches within the same page are grouped into ranked bubbles inside a single card
- **Remote search**: when cloud sync is configured, search also queries remote collections via SQL — no full download required

### 💾 SQLite Storage
- All data is stored locally in a SQLite database (via sql.js + IndexedDB/OPFS)
- Handles large datasets reliably
- Export/import `.db` files
- JSON import/export still supported for migration

### ☁️ Cloud Sync
- Sync collections to the cloud with **Cloudflare D1** or **EdgeOne Blob**
- Upload/download collections as SQLite database blobs
- Chunked uploads for large datasets (splits blobs > 512 KB to avoid payload limits)
- Hidden sync panel — press **Shift+B** to open
- Remote search index: uploaded collections are indexed server-side so search works without downloading full DBs
- Per-collection organization with authors and collection metadata

### 📝 Markdown Paste
- Paste Markdown-formatted text into the rich text editor and it's automatically converted to formatted HTML
- Detects headings, code blocks, links, images, tables, bold, lists, blockquotes, and more

### 📤 Import & Export
- **Export**: Download your entire knowledge base as a SQLite database or JSON
- **Import**: Load data from `.db` or JSON files
- Data merges with existing content (no duplicates)

---

## How to Use

### Getting Started

1. **Create Your First Product**
   - Click the **+ Create New Product** button
   - Give it a name (e.g., "My Notes")
   - Optionally add tags (e.g., "work", "personal")

2. **Add Pages**
   - Inside a product, click the **+** button in the page tabs area
   - Give your page a name
   - Start writing!

3. **Edit and Format**
   - Use the **toolbar** at the top of the editor to format text
   - Click the **toolbar toggle button** (left of Edit/Delete) to show/hide the toolbar
   - Insert images by clicking the image icon or pasting from clipboard

### Navigation

- **Sidebar**: Browse all your products
  - Search products with the search bar
  - Filter by tags
  - Click a product to view its pages
  - Collapse/expand the sidebar with the toggle button
- **Page tabs**: Switch between pages within a product
  - Drag and drop to reorder pages
  - Click the **×** icon to delete a page
- **Theme selector**: Found in the sidebar (when expanded), choose your preferred theme

### Managing Data

#### Export Your Data
1. Expand the sidebar
2. Click the **Export** button (download icon)
3. Choose **JSON** or **SQLite Database**
4. Your data will download to your device

#### Import Data
1. Expand the sidebar
2. Click the **Import** button (upload icon)
3. Choose **JSON** or **SQLite Database**
4. Select your file
5. Data will be merged with existing content (no duplicates)

#### Cloud Sync
1. Press **Shift+B** to open the cloud sync panel
2. Choose a provider (Cloudflare D1 or EdgeOne Blob) and enter credentials
3. Upload local collections to the cloud or download remote collections
4. Remote search works automatically once collections are uploaded

---

## Tips & Tricks

- **Keyboard shortcuts**: Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline)
- **Paste images**: Copy an image and paste directly into the editor
- **Paste Markdown**: Copy Markdown source from any editor and paste — it auto-converts to formatted HTML
- **Sticky toolbar**: The toolbar stays visible while scrolling for easy access
- **Frosted panels**: Top panel and toolbar have a translucent effect — content scrolls beautifully underneath
- **Auto-save**: Changes are saved automatically after 500ms
- **Optimized performance**: Lazy loading ensures smooth performance even with many pages
- **Cloud sync**: Press **Shift+B** to open the hidden sync panel

---

## Use Cases

### 📚 Personal Knowledge Base
Keep all your notes, ideas, and references in one place. Create products for different areas of your life: learning, hobbies, travel, recipes, etc.

### 🧑‍💼 Work Documentation
Organize meeting notes, project specs, onboarding guides, and reference materials. Tag by team or project for easy filtering.

### 📖 Study Notes
Create products for each course or subject. Add pages for lectures, readings, and summaries. Use code blocks for programming notes.

### 🗂️ Reference Library
Store templates, checklists, how-tos, and quick references. Search instantly when you need them.

---

## Desktop App

Wikiki can also be run as a standalone desktop application for Windows and macOS, powered by [Tauri](https://tauri.app/).

### Build Requirements

To build the desktop app locally, you need to have the following installed:
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- System dependencies for Tauri (see [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))

### Local Development

1.  Generate icons (optional, if you want custom icons):
    ```bash
    npm run tauri:icon public/favicon.svg
    ```
2.  Run in development mode:
    ```bash
    npm run tauri dev
    ```

### Building Standalone App

To build the production-ready standalone app:
```bash
npm run tauri:build
```

The output will be in `src-tauri/target/release/bundle/`.

### Continuous Integration

This repository includes a GitHub Actions workflow (`.github/workflows/release.yml`) that automatically builds and releases the desktop app for Windows (x64) and macOS (Universal) whenever a new tag starting with `v` is pushed.

---

## Technical Details

- **Framework**: React + TypeScript + Vite
- **Storage**: SQLite (sql.js + IndexedDB/OPFS)
- **Cloud sync**: Cloudflare D1, EdgeOne Blob
- **Styling**: Tailwind CSS with custom theme system
- **Deployment**: Optimized for Vercel and other static hosts
- **Browser support**: Modern browsers (Chrome, Firefox, Safari, Edge)

---

## Changelog

### v0.3.2

- **Markdown paste**: pasting Markdown-formatted text into the rich text editor now auto-converts it to formatted HTML (headings, code blocks, links, images, tables, lists, and more)
- **Enhanced Super Search**: multiple matches within the same page are grouped into ranked "bubbles" inside a single result card, each navigable to its specific match location
- **Remote cloud search**: search now queries remote D1 collections via SQL directly — no full database download needed to find matches. Results show a download button to load the full collection locally
- **Progress indicators**: search page shows progress bars for index prep, remote querying, and active searching
- **Chunked cloud uploads**: large databases (> 512 KB) are split into chunks to avoid D1 payload limits

### v0.3.0

- **SQLite-only storage**: JSON storage mode has been removed; all data now lives in a local SQLite database (sql.js + IndexedDB/OPFS) for better performance and reliability with large datasets
- **Cloud sync**: sync collections to the cloud via Cloudflare D1 or EdgeOne Blob. Hidden sync panel accessible via **Shift+B**
- **Bundle schema**: added `authors` and `collection` fields to support multi-user collaboration and collection-level organization
- **Desktop app**: Tauri-based desktop builds for Windows and macOS

> **Remote Bundle** is currently in development.

---

## License

This project is open source and available under the MIT License.

---

**Enjoy building your knowledge base with Wikiki! 🎉**
