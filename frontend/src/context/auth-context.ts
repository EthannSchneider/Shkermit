import { createContext, useContext } from "react";
import type { User } from "../lib/api";

export type AuthContextValue = {
  user: User | null;
  loading: boolean;
  register: (username: string, email: string, password: string) => Promise<{ email: string }>;
  verifyEmail: (token: string) => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
