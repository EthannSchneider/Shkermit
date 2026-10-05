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

    findByEmail(email) {
      return prisma.user.findUnique({ where: { email } });
    },

    updateProfile(id, { username, email, emailVerifiedAt }) {
      return prisma.user.update({
        where: { id },
        data: {
          username,
          usernameKey: username.toLowerCase(),
          email,
          emailVerifiedAt,
        },
      });
    },

    updatePassword(id, passwordHash) {
      return prisma.user.update({
        where: { id },
        data: { passwordHash },
      });
    },

    markEmailVerified(id) {
      return prisma.user.update({
        where: { id },
        data: { emailVerifiedAt: new Date() },
      });
    },

    deleteById(id) {
      return prisma.user.delete({ where: { id } });
    },
  };
}
