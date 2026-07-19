import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Close from "@mui/icons-material/Close";

type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
}: ConfirmModalProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#1A1A24",
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            m: { xs: 1, sm: 2 },
            width: { xs: "calc(100% - 16px)", sm: 444 },
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          color: "#F0F0F5",
          fontSize: { xs: "15px", sm: "17px" },
          fontWeight: 600,
          pb: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {title}
        <IconButton onClick={onClose} size="small" sx={{ color: "#55556A" }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 1 }}>
        <DialogContentText sx={{ color: "#8A8AA0", fontSize: { xs: "13px", sm: "14px" } }}>
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2, gap: { xs: 0.5, sm: 1 } }}>
        <Button
          onClick={onClose}
          variant="outlined"
          size="small"
          sx={{
            color: "#8A8AA0",
            borderColor: "#2A2A3A",
            textTransform: "none",
            borderRadius: 2,
            fontWeight: 500,
            flex: { xs: 1, sm: 0 },
            py: { xs: 1, sm: 0.5 },
            "&:hover": { borderColor: "#3D3D55", bgcolor: "#2A2A3A" },
          }}
        >
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          size="small"
          sx={{
            bgcolor: "#F87171",
            textTransform: "none",
            borderRadius: 2,
            fontWeight: 500,
            flex: { xs: 1, sm: 0 },
            py: { xs: 1, sm: 0.5 },
            "&:hover": { bgcolor: "#EF4444" },
          }}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
