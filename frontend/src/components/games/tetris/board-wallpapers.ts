import shkermitImage from '../../../assets/img/3 TeteShkermit RTX.png';
import thugImage from '../../../assets/img/11 Shkermit MLG Thug Life WallPaper Modile.png';

export const BOARD_WALLPAPERS = [
  { id: 'classic', name: 'Classic', backgroundImage: 'none' },
  { id: 'pond', name: 'Moonlit pond', backgroundImage: 'radial-gradient(ellipse at 25% 85%, #315c43 0%, transparent 55%), linear-gradient(150deg, #071b21, #143b32)' },
  { id: 'sunset', name: 'Sunset', backgroundImage: 'radial-gradient(circle at 70% 35%, #a7743b 0%, transparent 40%), linear-gradient(170deg, #422446, #713a35 55%, #172433)' },
  { id: 'space', name: 'Deep space', backgroundImage: 'radial-gradient(ellipse at 25% 20%, #41345c, transparent 55%), radial-gradient(ellipse at 80% 85%, #244d61, transparent 60%), linear-gradient(#090c1e, #12162d)' },
  { id: 'shkermit', name: 'Shkermit', backgroundImage: `linear-gradient(rgba(2,7,4,.7), rgba(2,7,4,.7)), url("${shkermitImage}")` },
  { id: 'thug', name: 'Thug life', backgroundImage: `linear-gradient(rgba(2,7,4,.65), rgba(2,7,4,.65)), url("${thugImage}")` },
] as const;

export function getCustomBoardImageUrl(id?: string) {
  const key = id && /^custom:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:jpg|png|webp|gif))$/.exec(id)?.[1];
  return key ? `/api/board-wallpapers/${key}` : '';
}

export function getBoardWallpaper(id?: string, imagePreviewUrl?: string) {
  const imageUrl = getCustomBoardImageUrl(id)
    || (id === 'custom' && imagePreviewUrl?.startsWith('blob:') ? imagePreviewUrl : '');
  if (imageUrl) return {
    id: 'custom' as const,
    name: 'Custom image',
    backgroundImage: `linear-gradient(rgba(2,7,4,.6), rgba(2,7,4,.6)), url(${JSON.stringify(imageUrl)})`,
  };
  return BOARD_WALLPAPERS.find((wallpaper) => wallpaper.id === id) ?? BOARD_WALLPAPERS[0];
}
