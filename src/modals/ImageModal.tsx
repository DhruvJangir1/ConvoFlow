import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import Close from "@mui/icons-material/Close";

type ImageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  src: string;
};

export default function ImageModal({ isOpen, onClose, src }: ImageModalProps) {
  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "transparent",
            boxShadow: "none",
            borderRadius: 0,
            overflow: "hidden",
            m: { xs: 0, sm: 2 },
            width: { xs: "100%", sm: "calc(100% - 32px)" },
          },
        },
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          top: { xs: 4, sm: 8 },
          right: { xs: 4, sm: 8 },
          zIndex: 1,
          color: "#fff",
          bgcolor: "rgba(0,0,0,0.5)",
          "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
        }}
        size="small"
      >
        <Close fontSize="small" />
      </IconButton>
      <img
        src={src}
        alt="Full size"
        style={{
          display: "block",
          maxWidth: "100%",
          maxHeight: "90vh",
          objectFit: "contain",
          margin: "0 auto",
          width: "auto",
          height: "auto",
        }}
      />
    </Dialog>
  );
}
