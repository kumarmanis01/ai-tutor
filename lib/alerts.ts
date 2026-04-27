// Semantic alert helpers for admin UX
export const alerts = {
  info(message: string, title = "Info") {
    showAlert({ title, message, variant: "info" });
  },

  success(message: string, title = "Success") {
    showAlert({ title, message, variant: "success" });
  },

  warning(message: string, title = "Warning") {
    showAlert({ title, message, variant: "warning" });
  },

  error(message: string, title = "Error") {
    showAlert({ title, message, variant: "error" });
  },

  confirm(
    message: string,
    onConfirm: () => void,
    title = "Confirm action",
    confirmText = "Confirm"
  ) {
    showAlert({
      title,
      message,
      variant: "warning",
      confirmText,
      onConfirm,
    });
  },
};
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
