import { useState } from "react";
import { UserPlus } from "lucide-react";
import AddNewFriendModal from "../modals/AddNewFriendModal";
import { clerkFetch } from "../lib/clerkFetch";

type AddFriendButtonProps = {
  compact?: boolean;
};

export default function AddFriendButton({ compact }: AddFriendButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSend(userTag: string): Promise<void> {
    console.log(`[AddFriendButton] handleSend called with userTag: ${userTag}`);
    setSending(true);
    try {
      console.log("[AddFriendButton] Sending POST /api/friends/send...");
      const res = await clerkFetch("/api/friends/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userTag }),
      });

      const data = await res.json();
      console.log("[AddFriendButton] Response:", res.status, data);

      if (!res.ok) {
        return Promise.reject(new Error(data.error || "Failed to send request"));
      }
      console.log("[AddFriendButton] Friend request sent successfully");
    } finally {
      console.log("[AddFriendButton] Resetting sending state");
      setSending(false);
    }
  }

  if (compact) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className="group flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors duration-150 hover:bg-surface-raised hover:text-text-primary"
        >
          <UserPlus className="h-4 w-4 transition-transform duration-150 group-hover:scale-110" />
        </button>
        <AddNewFriendModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSend={handleSend}
          sending={sending}
        />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-accent-hover"
      >
        <UserPlus className="h-4 w-4" />
        Add Friend
      </button>
      <AddNewFriendModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSend={handleSend}
        sending={sending}
      />
    </>
  );
}
