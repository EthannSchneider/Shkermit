export function publicPicture(picture) {
  return {
    id: picture.id,
    title: picture.title,
    altText: picture.altText,
    assetKey: picture.assetKey,
    imageUrl: picture.assetKey ? null : `/api/pictures/${picture.id}/content?v=${picture.updatedAt.getTime()}`,
    filename: picture.filename,
    position: picture.position,
    createdAt: picture.createdAt,
    updatedAt: picture.updatedAt,
  };
}
