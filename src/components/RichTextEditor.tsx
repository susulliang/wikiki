import { useRef, useCallback, useEffect, useState, type KeyboardEvent, type ClipboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Heading1,
  Heading2,
  Heading3,
} from 'lucide-react';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  showToolbar?: boolean;
}

function processImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error('图片大小不能超过 2MB'));
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
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

export default function RichTextEditor({ content, onChange, showToolbar = true }: RichTextEditorProps) {
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
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;
          try {
            const dataUrl = await processImage(blob);
            exec('insertImage', dataUrl);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : '图片处理失败');
          }
          break;
        }
      }
    },
    [exec],
  );

  const handleImageUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await processImage(file);
        exec('insertImage', dataUrl);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '图片处理失败');
      }
    };
    input.click();
  }, [exec]);

  const handleImageUrl = useCallback(() => {
    const url = prompt('请输入图片 URL:');
    if (url) {
      exec('insertImage', url);
    }
  }, [exec]);

  const handleLink = useCallback(() => {
    const url = prompt('请输入链接 URL:');
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
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-background/55 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40 px-2.5 py-0.5">
          <div className="flex items-center gap-1 mr-1">
            <Button
              variant={activeHeading === 'p' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => handleHeadingChange('p')}
              title="正文"
            >
              正文
            </Button>
            <Button
              variant={activeHeading === 'h1' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => handleHeadingChange('h1')}
              title="标题 1"
            >
              H1
            </Button>
            <Button
              variant={activeHeading === 'h2' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => handleHeadingChange('h2')}
              title="标题 2"
            >
              H2
            </Button>
            <Button
              variant={activeHeading === 'h3' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-6 px-2.5 text-[11px]"
              onClick={() => handleHeadingChange('h3')}
              title="标题 3"
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
            title="加粗 (Ctrl+B)"
          >
            <Bold className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('italic')}
            title="斜体 (Ctrl+I)"
          >
            <Italic className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('underline')}
            title="下划线 (Ctrl+U)"
          >
            <Underline className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('strikeThrough')}
            title="删除线"
          >
            <Strikethrough className="size-4" />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('insertUnorderedList')}
            title="无序列表"
          >
            <List className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('insertOrderedList')}
            title="有序列表"
          >
            <ListOrdered className="size-4" />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('formatBlock', 'pre')}
            title="代码块"
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
            title="行内代码"
          >
            <Code2 className="size-4" />
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleLink}
            title="插入链接"
          >
            <Link className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleImageUrl}
            title="插入图片 URL"
          >
            <ImageIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={handleImageUpload}
            title="上传图片"
          >
            <ImageIcon className="size-3.5" />
            上传
          </Button>

          <Separator orientation="vertical" className="mx-0.5 h-4" />

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('formatBlock', 'blockquote')}
            title="引用块"
          >
            <Quote className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => exec('insertHorizontalRule')}
            title="分隔线"
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
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        data-placeholder="开始输入内容..."
      />
    </div>
  );
}
