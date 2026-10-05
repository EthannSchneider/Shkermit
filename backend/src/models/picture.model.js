export function createPictureModel(prisma) {
  const summarySelection = {
    id: true,
    title: true,
    altText: true,
    assetKey: true,
    storageKey: true,
    mimeType: true,
    filename: true,
    position: true,
    createdAt: true,
    updatedAt: true,
  };

  return {
    list() {
      return prisma.picture.findMany({
        select: summarySelection,
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });
    },

    findById(id) {
      return prisma.picture.findUnique({ where: { id }, select: summarySelection });
    },

    findContentById(id) {
      return prisma.picture.findUnique({
        where: { id },
        select: { storageKey: true, mimeType: true, filename: true, updatedAt: true },
      });
    },

    async nextPosition() {
      const result = await prisma.picture.aggregate({ _max: { position: true } });
      return (result._max.position ?? -1) + 1;
    },

    create(data) {
      return prisma.picture.create({ data, select: summarySelection });
    },

    update(id, data) {
      return prisma.picture.update({ where: { id }, data, select: summarySelection });
    },

    delete(id) {
      return prisma.picture.delete({ where: { id }, select: summarySelection });
    },

    async move(id, direction) {
      return prisma.$transaction(async (transaction) => {
        const pictures = await transaction.picture.findMany({
          select: summarySelection,
          orderBy: [{ position: "asc" }, { id: "asc" }],
        });
        const currentIndex = pictures.findIndex((picture) => picture.id === id);
        if (currentIndex === -1) return null;
        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= pictures.length) return pictures;

        [pictures[currentIndex], pictures[targetIndex]] = [pictures[targetIndex], pictures[currentIndex]];
        await Promise.all(pictures.map((picture, position) =>
          transaction.picture.update({ where: { id: picture.id }, data: { position } }),
        ));
        return transaction.picture.findMany({
          select: summarySelection,
          orderBy: [{ position: "asc" }, { id: "asc" }],
        });
      });
    },
  };
}
