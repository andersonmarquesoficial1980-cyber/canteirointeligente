import { To, useLocation, useNavigate, useSearchParams } from "react-router-dom";

function isInternalPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

export function useSmartBack(fallback: To) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  return () => {
    const returnTo = searchParams.get("returnTo") || (location.state as any)?.from;
    const current = `${location.pathname}${location.search}`;

    if (typeof returnTo === "string" && returnTo && isInternalPath(returnTo) && returnTo !== current) {
      navigate(returnTo, { replace: true });
      return;
    }

    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate(fallback, { replace: true });
  };
}
