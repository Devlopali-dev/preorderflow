import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

// Types manuels pour components.jsx (JS pur, sans PropTypes) — sans ce
// fichier, TS infère des props "required" à partir des destructurations
// sans valeur par défaut (ex: onClick, error, hint), ce qui casse tout
// consommateur TypeScript du design system.

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "link";
  size?: "sm" | "md" | "lg" | "xl" | "icon";
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  type?: "button" | "submit" | "reset";
}
export function Button(props: ButtonProps): JSX.Element;

export function Badge(props: {
  children?: ReactNode;
  variant?: string;
  dot?: boolean;
  className?: string;
}): JSX.Element;

export function Card(props: { children?: ReactNode; hoverable?: boolean; className?: string }): JSX.Element;
export function CardHeader(props: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }): JSX.Element;
export function CardBody(props: { children?: ReactNode; className?: string }): JSX.Element;
export function CardFooter(props: { children?: ReactNode }): JSX.Element;
export function StatCard(props: {
  label?: ReactNode;
  value?: ReactNode;
  delta?: ReactNode;
  deltaLabel?: ReactNode;
  icon?: ReactNode;
}): JSX.Element;

export interface FormGroupProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children?: ReactNode;
  required?: boolean;
}
export function FormGroup(props: FormGroupProps): JSX.Element;

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id?: string;
  error?: ReactNode;
  className?: string;
}
export function Input(props: InputProps): JSX.Element;

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  id?: string;
  error?: ReactNode;
  className?: string;
}
export function Textarea(props: TextareaProps): JSX.Element;

export function Select(props: {
  id?: string;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  error?: ReactNode;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  [key: string]: unknown;
}): JSX.Element;

export function Avatar(props: { src?: string; name?: string; size?: string; className?: string }): JSX.Element;

export function Table(props: {
  columns?: Array<{ key: string; label: string }>;
  rows?: Array<Record<string, unknown>>;
  onRowClick?: (row: Record<string, unknown>) => void;
  emptyLabel?: string;
  loading?: boolean;
}): JSX.Element;

export function Modal(props: {
  isOpen: boolean;
  onClose?: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: string;
}): JSX.Element;

export function useToast(duration?: number): {
  toasts: unknown[];
  push: (toast: unknown) => void;
  dismiss: (id: unknown) => void;
};
export function ToastContainer(props: { toasts?: unknown[]; onDismiss?: (id: unknown) => void }): JSX.Element;

export function Tabs(props: {
  tabs?: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
}): JSX.Element;

export function AppLayout(props: { sidebar?: ReactNode; topbar?: ReactNode; children?: ReactNode }): JSX.Element;
export function PageHeader(props: { title?: ReactNode; description?: ReactNode; actions?: ReactNode }): JSX.Element;
export function EmptyState(props: {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}): JSX.Element;
