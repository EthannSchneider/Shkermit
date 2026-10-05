export function createUserModel(prisma, { adminEmails = [] } = {}) {
  const adminEmailSet = new Set(adminEmails.map((email) => email.toLowerCase()));
  const withRole = (user) => user && ({
    ...user,
    isAdmin: Boolean(user.emailVerifiedAt) && adminEmailSet.has(user.email.toLowerCase()),
  });

  return {
    async create({ username, email, passwordHash }) {
      return withRole(await prisma.user.create({
        data: {
          username,
          usernameKey: username.toLowerCase(),
          email,
          passwordHash,
        },
      }));
    },

    async findById(id) {
      return withRole(await prisma.user.findUnique({ where: { id } }));
    },

    async findByIdentifier(identifier) {
      const identityKey = identifier.toLowerCase();
      return withRole(await prisma.user.findFirst({
        where: {
          OR: [{ email: identityKey }, { usernameKey: identityKey }],
        },
      }));
    },

    async findByEmail(email) {
      return withRole(await prisma.user.findUnique({ where: { email } }));
    },

    async updateProfile(id, { username, email, emailVerifiedAt }) {
      return withRole(await prisma.user.update({
        where: { id },
        data: {
          username,
          usernameKey: username.toLowerCase(),
          email,
          emailVerifiedAt,
        },
      }));
    },

    async updatePassword(id, passwordHash) {
      return withRole(await prisma.user.update({
        where: { id },
        data: { passwordHash },
      }));
    },

    async markEmailVerified(id) {
      return withRole(await prisma.user.update({
        where: { id },
        data: { emailVerifiedAt: new Date() },
      }));
    },

    async deleteById(id) {
      return withRole(await prisma.user.delete({ where: { id } }));
    },
  };
}
