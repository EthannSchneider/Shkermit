const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function validateUsername(value) {
  const username = typeof value === "string" ? value.trim() : "";
  if (username.length < 3 || username.length > 24) {
    return "Username must be between 3 and 24 characters.";
  }
  if (!USERNAME_PATTERN.test(username)) {
    return "Username can only contain letters, numbers, underscores, and hyphens.";
  }
  return null;
}

export function validateEmail(value) {
  const email = typeof value === "string" ? value.trim() : "";
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validatePassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    return "Password must be between 10 and 128 characters.";
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return "Password must contain an uppercase letter, a lowercase letter, and a number.";
  }
  return null;
}

export function normalizedEmail(value) {
  return value.trim().toLowerCase();
}

export function normalizedUsername(value) {
  return value.trim();
}
