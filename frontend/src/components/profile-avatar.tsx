import { useState } from "react";
import defaultAvatar from "../assets/img/1 ShkermitRTX.png";

type ProfileAvatarProps = {
  src?: string | null;
  className?: string;
};

export default function ProfileAvatar({ src, className = "" }: ProfileAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <img
      src={src && src !== failedSrc ? src : defaultAvatar}
      alt=""
      className={`profile-avatar ${className}`}
      onError={() => setFailedSrc(src ?? null)}
    />
  );
}
