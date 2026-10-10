import { useEffect, useRef } from 'react';
import { useAuth } from '../../../context/auth-context';
import { api } from '../../../lib/api';
import { BoardWallpaperSettings } from './board-wallpaper-settings';

export function BoardWallpaperDialog({ onClose }: { onClose: () => void }) {
  const { user, setUser } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  if (!user) return null;
  return (
    <dialog ref={dialogRef} aria-labelledby="board-wallpaper-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => event.stopPropagation()}
      className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-lime-300/25 bg-[#061008] p-5 text-white shadow-2xl backdrop:bg-black/80 sm:p-7">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="board-wallpaper-title" className="text-lg text-lime-200">Board wallpaper</h2>
        <button type="button" onClick={onClose} autoFocus className="rounded-lg border border-white/25 px-3 py-2 text-sm">Done</button>
      </div>
      <BoardWallpaperSettings key={user.id} wallpaper={user.boardWallpaper} allowCustomUpload={user.isAdmin} onSave={async (wallpaper, image) => {
        const result = await api.updateBoardWallpaper(wallpaper, image);
        setUser((current) => current?.id === result.user.id ? { ...current, boardWallpaper: result.user.boardWallpaper } : current);
        return result.user.boardWallpaper;
      }} />
    </dialog>
  );
}
