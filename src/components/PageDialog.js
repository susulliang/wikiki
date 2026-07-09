import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
export default function PageDialog({ open, onOpenChange, onSave }) {
    const [name, setName] = useState('');
    const handleOpenChange = (next) => {
        if (next)
            setName('');
        onOpenChange(next);
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed)
            return;
        onSave(trimmed);
        onOpenChange(false);
    };
    return (<Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Page</DialogTitle>
            <DialogDescription>Enter a name for the new page.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-2">
              <Label htmlFor="page-name">Page Name</Label>
              <Input id="page-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter page name" autoFocus/>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);
}
