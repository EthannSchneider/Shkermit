export function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    isAdmin: Boolean(user.isAdmin),
    isSuspended: Boolean(user.suspendedAt),
    boardWallpaper: user.boardWallpaper ?? "classic",
    profilePictureUrl: user.profilePicture ? `/api/profile-pictures/${user.profilePicture}` : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
