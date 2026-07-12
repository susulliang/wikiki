import { useState, type FormEvent } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';

interface BundleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialTags?: string[];
  initialAuthors?: string[];
  initialCollection?: string;
  onSave: (name: string, tags: string[], authors: string[], collection: string) => void;
  title: string;
}

export default function BundleDialog({
  open,
  onOpenChange,
  initialName = '',
  initialTags = [],
  initialAuthors = [],
  initialCollection = '',
  onSave,
  title,
}: BundleDialogProps) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialName);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [authors, setAuthors] = useState<string[]>(initialAuthors);
  const [authorInput, setAuthorInput] = useState('');
  const [collection, setCollection] = useState(initialCollection);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(initialName);
      setTags(initialTags);
      setTagInput('');
      setAuthors(initialAuthors);
      setAuthorInput('');
      setCollection(initialCollection);
    }
    onOpenChange(next);
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setTags((prev) => prev.filter((tg) => tg !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const addAuthor = () => {
    const trimmed = authorInput.trim();
    if (trimmed && !authors.includes(trimmed)) {
      setAuthors((prev) => [...prev, trimmed]);
    }
    setAuthorInput('');
  };

  const removeAuthor = (author: string) => {
    setAuthors((prev) => prev.filter((a) => a !== author));
  };

  const handleAuthorKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addAuthor();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onSave(trimmedName, tags, authors, collection.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Fill in bundle information to continue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bundle-name">{t('dialog.bundleName')}</Label>
              <Input
                id="bundle-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('dialog.bundleName')}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{t('dialog.bundleTags')}</Label>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder={t('dialog.bundleTags')}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addTag}>
                  <Plus className="size-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('dialog.bundleAuthors')}</Label>
              <div className="flex gap-2">
                <Input
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  onKeyDown={handleAuthorKeyDown}
                  placeholder={t('dialog.bundleAuthors')}
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon" onClick={addAuthor}>
                  <Plus className="size-4" />
                </Button>
              </div>
              {authors.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {authors.map((author) => (
                    <Badge key={author} variant="secondary" className="gap-1 pr-1">
                      {author}
                      <button
                        type="button"
                        onClick={() => removeAuthor(author)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground pt-0.5">Default: susul</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bundle-collection">{t('dialog.bundleCollection')}</Label>
              <Input
                id="bundle-collection"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                placeholder="Default"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('action.cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {t('action.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
