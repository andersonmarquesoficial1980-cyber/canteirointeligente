import { useNavigate } from "react-router-dom";
import logoCi from "@/assets/logo-workflux.png";

interface Props {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Logo do Workflux que funciona como botão Home em qualquer página.
 * Clique simples → vai para o Hub ("/").
 * Substitui o <img src={logoCi}> nos headers de todas as páginas internas.
 */
export function LogoHomeButton({ className, style }: Props) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/")}
      title="Ir para o Hub"
      aria-label="Ir para o Hub"
      className="flex-shrink-0 hover:opacity-75 active:scale-95 transition-all duration-150 cursor-pointer"
    >
      <img
        src={logoCi}
        alt="Workflux — Hub"
        className={className}
        style={style}
      />
    </button>
  );
}
