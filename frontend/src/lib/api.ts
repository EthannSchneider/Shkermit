export type User = {
  id: number;
  username: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Picture = {
  id: number;
  title: string;
  altText: string;
  assetKey: string | null;
  imageUrl: string | null;
  filename: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminUser = User & { canManage: boolean };
export type AdminUsersResponse = { users: AdminUser[]; total: number; page: number; pageSize: number };

export type GameScore = {
  game: string;
  mode: string;
  score: number;
};

export type LeaderboardEntry = {
  rank: number;
  username: string;
  score: number;
};

export type GameLeaderboard = {
  game: string;
  mode: string;
  entries: LeaderboardEntry[];
};

type UserResponse = { user: User };

export class ApiError extends Error {
  status: number;
  code?: string;
  email?: string;

  constructor(message: string, status: number, details?: { code?: string; email?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = details?.code;
    this.email = details?.email;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
      code?: string;
      email?: string;
    } | null;
    throw new ApiError(body?.error ?? "The request failed.", response.status, body ?? undefined);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  listUsers: (search: string, page: number) =>
    request<AdminUsersResponse>(`/api/admin/users?${new URLSearchParams({ search, page: String(page) })}`),
  updateUser: (id: number, username: string, email: string) =>
    request<{ user: AdminUser; warning?: string }>(`/api/admin/users/${id}`, {
      method: "PATCH", body: JSON.stringify({ username, email }),
    }),
  resendUserVerification: (id: number) =>
    request<{ message: string }>(`/api/admin/users/${id}/resend-verification`, { method: "POST" }),
  confirmUserEmail: (id: number, email: string) =>
    request<{ user: AdminUser }>(`/api/admin/users/${id}/confirm-email`, {
      method: "POST", body: JSON.stringify({ email }),
    }),
  deleteUser: (id: number) => request<void>(`/api/admin/users/${id}`, { method: "DELETE" }),
  setUserSuspended: (id: number, suspended: boolean) =>
    request<{ user: AdminUser }>(`/api/admin/users/${id}/suspension`, {
      method: "PATCH", body: JSON.stringify({ suspended }),
    }),
  me: () => request<UserResponse>("/api/auth/me"),
  register: (username: string, email: string, password: string) =>
    request<{ message: string; email: string }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),
  verifyEmail: (token: string) =>
    request<UserResponse>("/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  resendVerification: (email: string) =>
    request<{ message: string }>("/api/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
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
  listPictures: () => request<{ pictures: Picture[] }>("/api/pictures"),
  createPicture: (form: FormData) =>
    request<{ picture: Picture }>("/api/pictures", { method: "POST", body: form }),
  updatePicture: (id: number, form: FormData) =>
    request<{ picture: Picture }>(`/api/pictures/${id}`, { method: "PATCH", body: form }),
  movePicture: (id: number, direction: "up" | "down") =>
    request<{ pictures: Picture[] }>(`/api/pictures/${id}/position`, {
      method: "PATCH",
      body: JSON.stringify({ direction }),
    }),
  deletePicture: (id: number) =>
    request<void>(`/api/pictures/${id}`, { method: "DELETE" }),
  getBestScore: (game: string, mode: string) =>
    request<GameScore>(`/api/scores/${encodeURIComponent(game)}/${encodeURIComponent(mode)}`),
  saveBestScore: (game: string, mode: string, score: number) =>
    request<GameScore>(`/api/scores/${encodeURIComponent(game)}/${encodeURIComponent(mode)}`, {
      method: "PUT",
      body: JSON.stringify({ score }),
    }),
  getLeaderboards: () =>
    request<{ leaderboards: GameLeaderboard[] }>("/api/scores/leaderboard"),
};
