export function isUniqueConstraint(error) {
  return error?.code === "P2002";
}
