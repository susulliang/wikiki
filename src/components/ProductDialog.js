import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X, Plus } from 'lucide-react';
export default function ProductDialog({ open, onOpenChange, initialName = '', initialTags = [], onSave, title, }) {
    const [name, setName] = useState(initialName);
    const [tags, setTags] = useState(initialTags);
    const [tagInput, setTagInput] = useState('');
    const handleOpenChange = (next) => {
        if (next) {
            setName(initialName);
            setTags(initialTags);
            setTagInput('');
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
    const removeTag = (tag) => {
        setTags((prev) => prev.filter((t) => t !== tag));
    };
    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag();
        }
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (!trimmedName)
            return;
        onSave(trimmedName, tags);
        onOpenChange(false);
    };
    return (<Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Fill in product information to continue.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="product-name">Product Name</Label>
              <Input id="product-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter product name" autoFocus/>
            </div>
            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder="Press Enter to add tag" className="flex-1"/>
                <Button type="button" variant="outline" size="icon" onClick={addTag}>
                  <Plus className="size-4"/>
                </Button>
              </div>
              {tags.length > 0 && (<div className="flex flex-wrap gap-1.5 pt-1">
                  {tags.map((tag) => (<Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20">
                        <X className="size-3"/>
                      </button>
                    </Badge>))}
                </div>)}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);
}
