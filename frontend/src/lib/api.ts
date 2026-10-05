export type User = {
  id: number;
  username: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

type UserResponse = { user: User };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(body?.error ?? "The request failed.", response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  me: () => request<UserResponse>("/api/auth/me"),
  register: (username: string, email: string, password: string) =>
    request<UserResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),
  login: (identifier: string, password: string) =>
    request<UserResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  updateProfile: (username: string, email: string) =>
    request<UserResponse>("/api/account", {
      method: "PATCH",
      body: JSON.stringify({ username, email }),
    }),
  updatePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/api/account/password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  deleteAccount: (password: string) =>
    request<void>("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
};
