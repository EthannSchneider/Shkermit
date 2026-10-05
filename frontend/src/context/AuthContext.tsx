import { useEffect, useState, type ReactNode } from "react";
import { ApiError, api, type User } from "../lib/api";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch((error: unknown) => {
        if (!(error instanceof ApiError) || error.status !== 401) {
          console.error("Could not restore the user session", error);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function register(username: string, email: string, password: string) {
    const result = await api.register(username, email, password);
    return { email: result.email };
  }

  async function verifyEmail(token: string) {
    const result = await api.verifyEmail(token);
    setUser(result.user);
  }

  async function login(identifier: string, password: string) {
    const result = await api.login(identifier, password);
    setUser(result.user);
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, verifyEmail, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}
