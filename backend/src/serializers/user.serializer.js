export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    isAdmin: Boolean(user.isAdmin),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
