import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

interface AvatarContextValue {
  avatarUrl: string;
  setAvatarUrl: (url: string) => void;
}

const AvatarContext = createContext<AvatarContextValue | null>(null);

export function AvatarProvider({
  children,
  defaultUrl,
}: {
  children: ReactNode;
  defaultUrl: string;
}) {
  const [avatarUrl, setAvatarUrlState] = useState(defaultUrl);
  const objectUrlRef = useRef<string | null>(null);

  const setAvatarUrl = useCallback((url: string) => {
    if (objectUrlRef.current && objectUrlRef.current !== url) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    objectUrlRef.current = url.startsWith("blob:") ? url : null;
    setAvatarUrlState(url);
  }, []);

  const value = useMemo(
    () => ({ avatarUrl, setAvatarUrl }),
    [avatarUrl, setAvatarUrl]
  );

  return (
    <AvatarContext.Provider value={value}>{children}</AvatarContext.Provider>
  );
}

export function useAvatar() {
  const ctx = useContext(AvatarContext);
  if (!ctx) {
    throw new Error("useAvatar must be used within AvatarProvider");
  }
  return ctx;
}

export function useOptionalAvatar() {
  return useContext(AvatarContext);
}
