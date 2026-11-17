import React, { createContext, useContext, useState } from "react";
import type { PropsWithChildren } from "react";

type AuthContextValue = {
  signedIn: boolean;
  setSignedIn: (signedIn: boolean) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [signedIn, setSignedIn] = useState(false);

  return (
    <AuthContext.Provider value={{ signedIn, setSignedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return context;
}
