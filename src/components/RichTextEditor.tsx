import { useRef, useCallback, useEffect, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Code2,
  Link,
  Image as ImageIcon,
  Upload,
  Quote,
  Minus,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  showToolbar?: boolean;
  highlightQuery?: string;
}

/**
 * Detect whether a plain-text string looks like Markdown.
 * Uses a scoring system: strong signals (headings, code fences, links,
 * images, tables) score 2 each; moderate signals (bold, italic, lists,
 * blockquotes, horizontal rules) score 1 each. A total ≥ 2 means Markdown.
 */
function looksLikeMarkdown(text: string): boolean {
  let score = 0;

  // Strong: ATX headings  (#..# space)
  if (/^#{1,6}\s+\S/m.test(text)) score += 2;
  // Strong: fenced code blocks (``` or ~~~)
  if (/^(```|~~~)/m.test(text)) score += 2;
  // Strong: Markdown links [text](url)
  if (/\[.+?\]\(https?:\/\/\S+?\)/.test(text)) score += 2;
  // Strong: Markdown images ![alt](url)
  if (/!\[.*?\]\(https?:\/\/\S+?\)/.test(text)) score += 2;
  // Strong: GFM table (header row + delimiter row)
  if (/^\|.+\|\s*$/m.test(text) && /^\|[\s:-]+\|/m.test(text)) score += 2;

  // Moderate: bold **text** or __text__
  if (/(\*\*|__)\S/.test(text)) score += 1;
  // Moderate: unordered list items (-, *, +)
  if (/^\s*[-*+]\s+\S/m.test(text)) score += 1;
  // Moderate: ordered list items (1. 2. etc.)
  if (/^\s*\d+\.\s+\S/m.test(text)) score += 1;
  // Moderate: blockquote
  if (/^>\s+\S/m.test(text)) score += 1;
  // Moderate: horizontal rule (---, ***, ___ on its own line)
  if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/m.test(text)) score += 1;

  return score >= 2;
}

/** Configure marked for GFM, no line-break-as-<br>. */
marked.setOptions({ gfm: true, breaks: false });

function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('Image size cannot exceed 2MB'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        if (img.width <= 1200) {
          resolve(reader.result as string);
          return;
        }
        const canvas = document.createElement('canvas');
        const ratio = 1200 / img.width;
        canvas.width = 1200;
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function RichTextEditor({
  content,
  onChange,
  showToolbar = true,
  highlightQuery = ''
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const [activeHeading, setActiveHeading] = useState<'p' | 'h1' | 'h2' | 'h3'>('p');
  const saveTimerRef = useRef<number | null>(null);
  const { t } = useLanguage();

  // Auto-highlight and scroll when highlightQuery changes
  useEffect(() => {
    if (!highlightQuery || !editorRef.current) return;

    // Small delay to ensure content is rendered
    const timer = setTimeout(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const query = highlightQuery.toLowerCase().trim();
      if (!query) return;

      const selection = window.getSelection();
      const range = document.createRange();
      selection?.removeAllRanges();

      // Find tokens to search for
      const tokens = query.split(/\s+/).filter(t => t.length > 1);
      const searchCandidates = [query, ...tokens];

      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null);
      let node;
      let found = false;

      while ((node = walker.nextNode()) && !found) {
        const textContent = node.textContent?.toLowerCase() || '';
        
        for (const candidate of searchCandidates) {
          const index = textContent.indexOf(candidate);
          if (index !== -1) {
            try {
              range.setStart(node, index);
              range.setEnd(node, index + candidate.length);
              selection?.addRange(range);
              
              const span = document.createElement('span');
              span.className = 'temp-search-highlight';
              range.surroundContents(span);
              span.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Apply styles directly for maximum reliability — use theme-aware CSS variables
              span.style.backgroundColor = 'color-mix(in oklab, var(--primary) 25%, transparent)';
              span.style.color = 'var(--foreground)';
              span.style.padding = '2px 4px';
              span.style.borderRadius = '4px';
              span.style.boxShadow = '0 0 0 4px color-mix(in oklab, var(--primary) 40%, transparent)';
              span.style.transition = 'all 0.5s ease-out';

              // Pulse effect — uses primary color for a theme-consistent glow
              const pulseColor = 'var(--primary)';
              span.animate([
                { boxShadow: `0 0 0 0px color-mix(in oklab, ${pulseColor} 70%, transparent)` },
                { boxShadow: `0 0 0 12px color-mix(in oklab, ${pulseColor} 0%, transparent)` }
              ], {
                duration: 1000,
                iterations: 3
              });

              setTimeout(() => {
                if (span.parentNode) {
                  const parent = span.parentNode;
                  while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                  }
                  parent.removeChild(span);
                  parent.normalize();
                }
              }, 4000);
              
              found = true;
              break;
            } catch (e) {
              console.error('Highlight failed:', e);
            }
          }
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [highlightQuery]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  const syncContent = useCallback(() => {
    if (!editorRef.current) return;
    
    // Clear existing timer
    if (saveTimerRef.current !== null) {
      clearTimeout(saveTimerRef.current);
    }
    
    // Debounce: wait 500ms before calling onChange
    saveTimerRef.current = window.setTimeout(() => {
      onChange(editorRef.current!.innerHTML);
      saveTimerRef.current = null;
    }, 500);
  }, [onChange]);

  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
      syncContent();
    },
    [syncContent],
  );

  const handleInput = useCallback(() => {
    if (isComposing.current) return;
    syncContent();
  }, [syncContent]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          exec('bold');
          break;
        case 'i':
          e.preventDefault();
          exec('italic');
          break;
        case 'u':
          e.preventDefault();
          exec('underline');
          break;
        default:
          break;
      }
    },
    [exec],
  );

  const handlePaste = useCallback(
    async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      
      // Check for images first
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/') || item.type === 'image/svg+xml') {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          try {
            if (item.type === 'image/svg+xml') {
              const text = await blob.text();
              const b64 = btoa(unescape(encodeURIComponent(text)));
              const dataUrl = `data:image/svg+xml;base64,${b64}`;
              exec('insertImage', dataUrl);
            } else {
              const dataUrl = await processImage(blob);
              exec('insertImage', dataUrl);
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Image processing failed');
          }
          return;
        }
      }

      // Check for Markdown in plain text — if detected, convert to HTML.
      // This takes priority over the text/html flavor so that copying
      // Markdown source from editors (VS Code, Obsidian, etc.) renders
      // as rich text instead of literal "# Heading".
      const plain = e.clipboardData.getData('text/plain');
      if (plain && looksLikeMarkdown(plain)) {
        e.preventDefault();
        const html = marked.parse(plain, { async: false }) as string;
        document.execCommand('insertHTML', false, html);
        syncContent();
        return;
      }

      // Handle HTML/Text paste - strip inline styles
      const html = e.clipboardData.getData('text/html');
      if (html) {
        e.preventDefault();
        const div = document.createElement('div');
        div.innerHTML = html;
        
        // Remove all inline styles and dangerous attributes
        const allElements = div.getElementsByTagName('*');
        for (let i = 0; i < allElements.length; i++) {
          const el = allElements[i] as HTMLElement;
          el.removeAttribute('style');
          el.removeAttribute('class');
          el.removeAttribute('id');
          el.removeAttribute('width');
          el.removeAttribute('height');
          el.removeAttribute('face');
          el.removeAttribute('size');
          el.removeAttribute('color');
        }

        const cleanedHtml = div.innerHTML;
        document.execCommand('insertHTML', false, cleanedHtml);
        syncContent();
      }
    },
    [exec, syncContent],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        if (file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
          try {
            if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
              const text = await file.text();
              const b64 = btoa(unescape(encodeURIComponent(text)));
              const dataUrl = `data:image/svg+xml;base64,${b64}`;
              exec('insertImage', dataUrl);
            } else {
              const dataUrl = await processImage(file);
              exec('insertImage', dataUrl);
            }
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Image processing failed');
          }
        }
      }
    },
    [exec],
  );

  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.svg';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) {
          const text = await file.text();
          const b64 = btoa(unescape(encodeURIComponent(text)));
          const dataUrl = `data:image/svg+xml;base64,${b64}`;
          exec('insertImage', dataUrl);
        } else {
          const dataUrl = await processImage(file);
          exec('insertImage', dataUrl);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Image processing failed');
      }
    };
    input.click();
  }, [exec]);

  const handleImageUrl = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url) {
      exec('insertImage', url);
    }
  }, [exec]);

  const handleLink = useCallback(() => {
    const url = prompt('Enter link URL:');
    if (url) {
      exec('createLink', url);
    }
  }, [exec]);

  const handleHeadingChange = useCallback(
    (value: 'p' | 'h1' | 'h2' | 'h3') => {
      setActiveHeading(value);
      if (value === 'p') {
        exec('formatBlock', 'p');
      } else {
        exec('formatBlock', value);
      }
    },
    [exec],
  );

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false;
    syncContent();
  }, [syncContent]);

  // Hijack right-click: if text is selected, wrap it in a bookmark span.
  // The bookmark is stored inline in the page HTML, so it persists in both
  // JSON and SQLite storage modes automatically.
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        toast.info(t('bookmark.selectFirst'));
        return;
      }

      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      span.className = 'wiki-bookmark';

      try {
        range.surroundContents(span);
      } catch {
        // surroundContents fails when selection spans element boundaries.
        // Fallback: extract contents and re-insert wrapped in the span.
        const contents = range.extractContents();
        span.appendChild(contents);
        range.insertNode(span);
      }

      selection.removeAllRanges();
      editorRef.current?.focus();
      syncContent();
      toast.success(t('bookmark.bookmarked'));
    },
    [syncContent, t],
  );

  return (
    <div className="flex flex-col flex-1 relative">
      {/* Floating Vertical Toolbar */}
      {showToolbar && (
        <div className="fixed left-4 top-1/2 z-30 flex max-h-[85vh] -translate-y-1/2 flex-col items-center gap-0.5 overflow-y-auto no-scrollbar rounded-full border border-foreground/10 bg-background/40 p-1.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-[2px]">
          {/* Headings */}
          <Button
            variant={activeHeading === 'p' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 text-[10px] font-mono"
            onClick={() => handleHeadingChange('p')}
            title="Paragraph"
          >
            P
          </Button>
          <Button
            variant={activeHeading === 'h1' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 text-[10px] font-mono"
            onClick={() => handleHeadingChange('h1')}
            title="Heading 1"
          >
            H1
          </Button>
          <Button
            variant={activeHeading === 'h2' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 text-[10px] font-mono"
            onClick={() => handleHeadingChange('h2')}
            title="Heading 2"
          >
            H2
          </Button>
          <Button
            variant={activeHeading === 'h3' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 w-7 p-0 text-[10px] font-mono"
            onClick={() => handleHeadingChange('h3')}
            title="Heading 3"
          >
            H3
          </Button>

          <Separator orientation="horizontal" className="my-0.5 w-5" />

          {/* Text format */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('bold')} title="Bold (Ctrl+B)">
            <Bold className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('italic')} title="Italic (Ctrl+I)">
            <Italic className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('underline')} title="Underline (Ctrl+U)">
            <Underline className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('strikeThrough')} title="Strikethrough">
            <Strikethrough className="size-4" />
          </Button>

          <Separator orientation="horizontal" className="my-0.5 w-5" />

          {/* Lists */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('insertUnorderedList')} title="Bullet List">
            <List className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('insertOrderedList')} title="Numbered List">
            <ListOrdered className="size-4" />
          </Button>

          <Separator orientation="horizontal" className="my-0.5 w-5" />

          {/* Code */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('formatBlock', 'pre')} title="Code Block">
            <Code className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              const selection = window.getSelection();
              if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                const code = document.createElement('code');
                code.className = 'bg-muted px-1 py-0.5 rounded text-sm font-mono';
                try {
                  range.surroundContents(code);
                  selection.removeAllRanges();
                  syncContent();
                } catch {
                }
              }
            }}
            title="Inline Code"
          >
            <Code2 className="size-4" />
          </Button>

          <Separator orientation="horizontal" className="my-0.5 w-5" />

          {/* Link & Image */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleLink} title="Insert Link">
            <Link className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleImageUrl} title="Insert Image URL">
            <ImageIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleImageUpload} title="Upload Image">
            <Upload className="size-4" />
          </Button>

          <Separator orientation="horizontal" className="my-0.5 w-5" />

          {/* Quote & HR */}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('formatBlock', 'blockquote')} title="Blockquote">
            <Quote className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exec('insertHorizontalRule')} title="Horizontal Rule">
            <Minus className="size-4" />
          </Button>
        </div>
      )}

      {/* Editor area — padded left to clear the floating toolbar */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className={`prose prose-sm max-w-none dark:prose-invert min-h-max h-full flex-1 py-6 pr-8 outline-none focus:outline-none ${showToolbar ? 'pl-20' : 'pl-8'}`}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onContextMenu={handleContextMenu}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleDrop}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        data-placeholder="Start typing..."
      />
    </div>
  );
}
