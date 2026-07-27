import { To, useSearchParams } from "react-router-dom";

type OrigemBackMap = Record<string, To>;

export function useOrigemBack(fallback: To, origemMap: OrigemBackMap = {}) {
  const [searchParams] = useSearchParams();
  const origem = searchParams.get("origem") || "";

  if (origem && origemMap[origem]) {
    return origemMap[origem];
  }

  return fallback;
}
