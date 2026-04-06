import { useState, useEffect } from "react";
import { AvatarPickerModal } from "./AvatarPickerModal";

interface AvatarUploadProps {
  session: {
    user: {
      name: string | null;
      email: string;
      image?: string | null;
      [key: string]: unknown;
    };
  };
}

export function AvatarUpload({ session }: AvatarUploadProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const initials = session.user.name?.slice(0, 2).toUpperCase() || "U";
  const avatarUrl = session.user.image ?? null;

  // Extract current avatar ID from proxy URL
  const currentAvatarId = avatarUrl?.match(/\/api\/v1\/avatar\/(.+)/)?.[1] ?? null;

  // Reset image loaded state when URL changes
  useEffect(() => {
    setImageLoaded(false);
  }, [avatarUrl]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar display with onLoad gate */}
      <div className="relative">
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-20 w-20 rounded-full object-cover border-2 border-outline-variant/30"
            style={{ display: imageLoaded ? "block" : "none" }}
            onLoad={() => setImageLoaded(true)}
          />
        )}
        {(!avatarUrl || !imageLoaded) && (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-secondary text-lg font-bold text-white">
            {initials}
          </div>
        )}
      </div>

      {/* Trigger button — opens modal instead of file picker */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        Alterar foto
      </button>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentAvatarId={currentAvatarId}
        session={session}
      />
    </div>
  );
}
