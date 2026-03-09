import { createContext, useContext } from "react";
import type { LanIdentity } from "../../shared/types";

export interface IdentityContextValue {
  identity: LanIdentity | null;
  setIdentity: (identity: LanIdentity) => void;
}

export const IdentityContext = createContext<IdentityContextValue>({
  identity: null,
  setIdentity: () => {}
});

export function useIdentity() {
  return useContext(IdentityContext);
}
