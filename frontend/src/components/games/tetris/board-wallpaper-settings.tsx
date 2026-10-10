import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { BoardGrid } from './board-grid';
import { BOARD_WALLPAPERS, getBoardWallpaper, getCustomBoardImageUrl } from './board-wallpapers';
import type { RenderedCell } from './types';

const previewCells = new Map<string, RenderedCell>([
  ['0:9', { cell: { type: 'J', owner: 1 } }],
  ['1:9', { cell: { type: 'J', owner: 1 } }],
  ['2:9', { cell: { type: 'J', owner: 1 } }],
  ['0:8', { cell: { type: 'J', owner: 1 } }],
  ['3:9', { cell: { type: 'O', owner: 1 } }],
  ['4:9', { cell: { type: 'O', owner: 1 } }],
  ['3:8', { cell: { type: 'O', owner: 1 } }],
  ['4:8', { cell: { type: 'O', owner: 1 } }],
  ['1:5', { cell: { type: 'T', owner: 1 }, active: true }],
  ['2:5', { cell: { type: 'T', owner: 1 }, active: true }],
  ['3:5', { cell: { type: 'T', owner: 1 }, active: true }],
  ['2:4', { cell: { type: 'T', owner: 1 }, active: true }],
]);

export function BoardWallpaperSettings({ wallpaper, allowCustomUpload = false, onSave }: {
  wallpaper: string;
  allowCustomUpload?: boolean;
  onSave: (wallpaper: string, image?: File) => Promise<string>;
}) {
  const groupName = useId();
  const [selected, setSelected] = useState(getBoardWallpaper(wallpaper).id);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [customWallpaper, setCustomWallpaper] = useState(getCustomBoardImageUrl(wallpaper) ? wallpaper : '');
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const choices = [...BOARD_WALLPAPERS, ...(customWallpaper || image ? [{ id: 'custom' as const, name: 'Custom image' }] : [])];

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.url);
  }, [image]);

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setNotice({ error: true, text: 'Choose a JPEG, PNG, WebP, or GIF image, 5 MB or smaller.' });
      return;
    }
    setImage({ file, url: URL.createObjectURL(file) });
    setSelected('custom');
    setNotice(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const savedWallpaper = await onSave(selected === 'custom' ? customWallpaper || 'custom' : selected,
        selected === 'custom' ? image?.file : undefined);
      setCustomWallpaper(getCustomBoardImageUrl(savedWallpaper) ? savedWallpaper : '');
      setImage(null);
      setNotice({ error: false, text: 'Board wallpaper saved.' });
    } catch (error) {
      setNotice({ error: true, text: error instanceof Error ? error.message : 'Could not save the wallpaper.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="board-wallpaper-form">
      <fieldset disabled={busy} className="space-y-4">
        <legend className="mb-4 text-sm text-white/70">Choose your Stacks board wallpaper</legend>
        <div className="flex flex-wrap items-start gap-5">
          <div className="grid min-w-48 flex-1 grid-cols-2 gap-3">
            {choices.map((option) => (
              <label key={option.id} className={`board-wallpaper-choice flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm text-white ${selected === option.id ? 'border-lime-300 bg-lime-300/10' : 'border-white/20 bg-white/5'}`}>
                <input type="radio" name={groupName} value={option.id} checked={selected === option.id}
                  onChange={() => { setSelected(option.id); setNotice(null); }} className="accent-lime-300" />
                {option.name}
              </label>
            ))}
          </div>
          <div aria-label="Board wallpaper preview">
            <BoardGrid cells={previewCells} cols={5} rows={10} width="120px" height="240px" accent="#b5ff4a" label="PREVIEW"
              wallpaper={selected === 'custom' ? image ? 'custom' : customWallpaper : selected} imagePreviewUrl={image?.url} />
          </div>
        </div>
        {allowCustomUpload ? <label className="block text-sm text-white/80">
          Upload a custom board image
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={chooseImage}
            className="mt-2 block w-full rounded-lg border border-white/20 p-2 text-sm" />
          <span className="mt-2 block text-xs text-white/55">JPEG, PNG, WebP, or GIF · up to 5 MB. Preview the image, then save to assign it to this account.</span>
          {image && <span className="mt-2 block text-xs text-lime-200">Selected: {image.file.name}</span>}
        </label> : <p className="text-xs text-white/55">Custom images are assigned by an administrator.</p>}
        <p className="text-xs leading-5 text-white/60">Saved to this account across devices. Applies to your view in solo, co-op, and duel.</p>
        {notice && <p role={notice.error ? 'alert' : 'status'} className={`text-sm ${notice.error ? 'text-red-300' : 'text-lime-200'}`}>{notice.text}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className="rounded-lg bg-lime-300 px-4 py-3 text-sm font-semibold text-[#061008] disabled:opacity-50">{busy ? 'Saving…' : 'Save wallpaper'}</button>
          <button type="button" className="rounded-lg border border-white/25 px-4 py-3 text-sm text-white" onClick={() => { setSelected('classic'); setNotice(null); }}>Select default</button>
        </div>
      </fieldset>
    </form>
  );
}
