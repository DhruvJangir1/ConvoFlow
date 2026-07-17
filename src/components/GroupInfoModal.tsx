import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Close from "@mui/icons-material/Close";
import type { ChatMember } from "../types/chat";
import UserAvatar from "./UserAvatar";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function hashToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function avatarGradient(name: string): string {
  const hue = hashToHue(name);
  return `linear-gradient(135deg, hsl(${hue}, 60%, 40%), hsl(${(hue + 60) % 360}, 50%, 30%))`;
}

type GroupInfoModalProps = {
  open: boolean;
  onClose: () => void;
  members: ChatMember[];
};

export default function GroupInfoModal({ open, onClose, members }: GroupInfoModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "#1A1A24",
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            backgroundImage: "none",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          color: "#F0F0F5",
          fontSize: "17px",
          fontWeight: 600,
          pb: 1,
          pt: 2.5,
          px: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        Group Members
        <IconButton onClick={onClose} size="small" sx={{ color: "#55556A" }}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 2 }}>
        <div className="flex flex-col gap-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/5">
              <UserAvatar imageUrl={member.image_url ?? null} userName={member.user_name} size="md" />
              <span className="text-sm font-medium text-text-primary truncate">
                {member.user_name}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
