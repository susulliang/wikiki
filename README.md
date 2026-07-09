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

### 💾 Two Storage Modes
1. **JSON Mode** (localStorage)
   - Fast, lightweight
   - Stores data in your browser
   - Easy JSON export/import
2. **SQLite Mode** (IndexedDB)
   - Powerful database storage
   - Better for large data sets
   - Export/import `.db` files

### 📤 Import & Export
- **Export**: Download your entire knowledge base as JSON or SQLite database
- **Import**: Load data from JSON or `.db` files
- Switch seamlessly between storage modes

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

#### Switch Storage Modes
- In the sidebar, click the **storage mode indicator** (JSON/SQLite)
- Choose your preferred mode
- Data will be migrated automatically

---

## Tips & Tricks

- **Keyboard shortcuts**: Ctrl+B (bold), Ctrl+I (italic), Ctrl+U (underline)
- **Paste images**: Copy an image and paste directly into the editor
- **Sticky toolbar**: The toolbar stays visible while scrolling for easy access
- **Frosted panels**: Top panel and toolbar have a translucent effect — content scrolls beautifully underneath
- **Auto-save**: Changes are saved automatically after 500ms
- **Optimized performance**: Lazy loading ensures smooth performance even with many pages

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
- **Storage**: localStorage (JSON) or IndexedDB (SQLite via sql.js)
- **Styling**: Tailwind CSS with custom theme system
- **Deployment**: Optimized for Vercel and other static hosts
- **Browser support**: Modern browsers (Chrome, Firefox, Safari, Edge)

---

## License

This project is open source and available under the MIT License.

---

**Enjoy building your knowledge base with Wikiki! 🎉**
