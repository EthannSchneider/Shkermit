export function createUserModel(prisma, { adminEmails = [] } = {}) {
  const adminEmailSet = new Set(adminEmails.map((email) => email.toLowerCase()));
  const withRole = (user) => user && ({
    ...user,
    isAdmin: Boolean(user.emailVerifiedAt) && adminEmailSet.has(user.email.toLowerCase()),
    isAdminAccount: adminEmailSet.has(user.email.toLowerCase()),
  });

  return {
    isAdminEmail(email) {
      return adminEmailSet.has(email.toLowerCase());
    },

    async list({ search, skip, take }) {
      const where = search ? {
        OR: [
          { usernameKey: { contains: search.toLowerCase() } },
          { email: { contains: search.toLowerCase() } },
        ],
      } : {};
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where, skip, take,
          orderBy: { id: "desc" },
          select: {
            id: true, username: true, email: true, emailVerifiedAt: true, suspendedAt: true,
            createdAt: true, updatedAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);
      return { users: users.map(withRole), total };
    },

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

    async setSuspended(id, suspended) {
      return withRole(await prisma.user.update({
        where: { id },
        data: { suspendedAt: suspended ? new Date() : null },
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
