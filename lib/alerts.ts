export type AlertPayload = {
  title?: string;
  message: string;
  variant?: "info" | "success" | "warning" | "error";
  confirmText?: string;
  onConfirm?: () => void;
};

export const ALERT_EVENT = "app-alert";

export function showAlert(payload: AlertPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ALERT_EVENT, { detail: payload }));
}
