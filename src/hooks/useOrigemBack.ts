import { To, useLocation, useSearchParams } from "react-router-dom";

type OrigemBackMap = Record<string, To>;

export function useOrigemBack(fallback: To, origemMap: OrigemBackMap = {}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || (location.state as any)?.from || "";
  const origem = searchParams.get("origem") || "";

  if (typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }

  if (origem && origemMap[origem]) {
    return origemMap[origem];
  }

  return fallback;
}
