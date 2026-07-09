import { useRef, useCallback, useEffect, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit-lite';
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
  Quote,
  Minus,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  showToolbar?: boolean;
  stickyTop?: number;
}

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

export default function RichTextEditor({ content, onChange, showToolbar = true, stickyTop = 0 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isComposing = useRef(false);
  const [activeHeading, setActiveHeading] = useState<'p' | 'h1' | 'h2' | 'h3'>('p');
  const saveTimerRef = useRef<number | null>(null);

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
          break;
        }
      }
    },
    [exec],
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

  return (
    <div className="flex flex-col flex-1 relative">
      {/* Toolbar */}
      {showToolbar && (
        <div
          className="sticky z-20 flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-background/55 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40 px-2.5 py-0.5"
          style={{ top: stickyTop }}
        >
          <div className="flex items-center gap-1 mr-1">
            <Button
              variant={activeHeading === 'p' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => handleHeadingChange('p')}
              title="Paragraph"
            >
              Paragraph
            </Button>
            <Button
              variant={activeHeading === 'h1' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => handleHeadingChange('h1')}
              title="Heading 1"
            >
              H1
            </Button>
            <Button
              variant={activeHeading === 'h2' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => handleHeadingChange('h2')}
              title="Heading 2"
            >
              H2
            </Button>
            <Button
              variant={activeHeading === 'h3' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => handleHeadingChange('h3')}
              title="Heading 3"
            >
              H3
            </Button>
          </div>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('bold')}
            title="Bold (Ctrl+B)"
          >
            <Bold className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('italic')}
            title="Italic (Ctrl+I)"
          >
            <Italic className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('underline')}
            title="Underline (Ctrl+U)"
          >
            <Underline className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('strikeThrough')}
            title="Strikethrough"
          >
            <Strikethrough className="size-4" />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('insertUnorderedList')}
            title="Bullet List"
          >
            <List className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('insertOrderedList')}
            title="Numbered List"
          >
            <ListOrdered className="size-4" />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('formatBlock', 'pre')}
            title="Code Block"
          >
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

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleLink}
            title="Insert Link"
          >
            <Link className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleImageUrl}
            title="Insert Image URL"
          >
            <ImageIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleImageUpload}
            title="Upload Image"
          >
            <ImageIcon className="size-3.5" />
            Upload
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('formatBlock', 'blockquote')}
            title="Blockquote"
          >
            <Quote className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('insertHorizontalRule')}
            title="Horizontal Rule"
          >
            <Minus className="size-4" />
          </Button>
        </div>
      )}

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        className="prose prose-sm max-w-none dark:prose-invert min-h-max h-full flex-1 px-8 py-6 outline-none focus:outline-none"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
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
