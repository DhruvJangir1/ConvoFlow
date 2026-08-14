import ConfirmModal from "./ConfirmModal";

type ConfirmDeleteAllNotificationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteAllNotificationModal({
  isOpen,
  onClose,
  onConfirm,
}: ConfirmDeleteAllNotificationModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete all notifications"
      message="Do you want to delete all notifications? This action cannot be undone."
      confirmLabel="Accept"
      cancelLabel="Cancel"
    />
  );
}
