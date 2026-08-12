import { useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../store/store";

type UserAvatarProps = {
  imageUrl: string | null;
  userName: string;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

import { getInitials, avatarGradient } from "../lib/avatar";

export default function UserAvatar({ imageUrl, userName, size = "md" }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const reduxUser = useSelector((s: RootState) => s.userAuth.user);
  const dim = sizeClasses[size];
  if (!reduxUser){
    return;
  }

  if (imageUrl && !imgError) {
    return (
      <img
        src={imageUrl}
        alt={userName}
        onError={() => setImgError(true)}
        className={`${dim} rounded-full object-cover ring-1 ring-border-light`}
      />
    );
  }

  return (
    <div
      className={`${dim} flex items-center justify-center rounded-full font-semibold text-white ring-1 ring-border-light`}
      style={{ background: avatarGradient(userName) }}
    >
      {getInitials(userName)}
    </div>
  );
}
