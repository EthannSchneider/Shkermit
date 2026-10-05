export function createUserModel(prisma) {
  return {
    create({ username, email, passwordHash }) {
      return prisma.user.create({
        data: {
          username,
          usernameKey: username.toLowerCase(),
          email,
          passwordHash,
        },
      });
    },

    findById(id) {
      return prisma.user.findUnique({ where: { id } });
    },

    findByIdentifier(identifier) {
      const identityKey = identifier.toLowerCase();
      return prisma.user.findFirst({
        where: {
          OR: [{ email: identityKey }, { usernameKey: identityKey }],
        },
      });
    },

    updateProfile(id, { username, email }) {
      return prisma.user.update({
        where: { id },
        data: {
          username,
          usernameKey: username.toLowerCase(),
          email,
        },
      });
    },

    updatePassword(id, passwordHash) {
      return prisma.user.update({
        where: { id },
        data: { passwordHash },
      });
    },

    deleteById(id) {
      return prisma.user.delete({ where: { id } });
    },
  };
}
