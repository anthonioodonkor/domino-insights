import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, ArrowUpRight, LoaderCircle } from "lucide-react";
import { label } from "../lib/format";

export function Button({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function useCommand() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function run(
    action: () => Promise<void>,
    message = "Change applied.",
  ) {
    if (pending) return;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await action();
      setSuccess(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }
  return { pending, error, success, run };
}
export function CommandFeedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <div className="feedback feedback-error" role="alert">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="feedback feedback-success" role="status">
          {success}
        </div>
      )}
    </>
  );
}
export function ActionButton({
  action,
  children,
  disabled,
  variant = "secondary",
  className,
}: {
  action: () => Promise<void>;
  children: ReactNode;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}) {
  const command = useCommand();
  return (
    <div className={`action-control ${className ?? ""}`}>
      <Button
        variant={variant}
        disabled={disabled || command.pending}
        onClick={() => void command.run(action)}
      >
        {command.pending && <LoaderCircle size={15} className="spin" />}
        {children}
      </Button>
      <CommandFeedback error={command.error} success={command.success} />
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return (
    <span className={`badge badge-${value}`}>
      {value === "critical" && <span className="badge-dot" />}
      {label(value)}
    </span>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">D</div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function SectionTitle({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function TextLink({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
