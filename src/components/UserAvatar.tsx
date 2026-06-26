import { useState } from "react";

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

export default function UserAvatar({ imageUrl, userName, size = "md" }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const dim = sizeClasses[size];

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
