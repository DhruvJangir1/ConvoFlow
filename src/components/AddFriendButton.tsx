import { useState } from "react";
import { UserPlus } from "lucide-react";
import AddNewFriendModal from "../modals/AddNewFriendModal";

type AddFriendButtonProps = {
  compact?: boolean;
};

export default function AddFriendButton({ compact }: AddFriendButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

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
      />
    </>
  );
}
