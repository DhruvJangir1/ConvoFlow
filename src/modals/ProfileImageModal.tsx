import { X, Eye, Camera, Upload, Trash2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import UserAvatar from "../components/UserAvatar";
import { useDispatch } from "react-redux";
import { updateUserProfileImage } from "../store/userAuthSlice";
import { clerkFetch } from "../lib/clerkFetch";

interface Props {
  onClose: () => void;
  imageUrl: string | null;
  userName: string;
}

export default function ProfileImageModal({ onClose, imageUrl, userName }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dispatch = useDispatch();

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function handleSaveImage() {
    if (!fileInputRef.current || !fileInputRef.current.files || fileInputRef.current.files.length === 0) {
      return;
    }

    const file = fileInputRef.current.files[0];

    try {
       const formData = new FormData();
       formData.append("image", file, file.name);

      const res = await clerkFetch("/api/users/profile-image", {
        method: "PATCH",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to upload image");
      }

      const data = await res.json();

      dispatch(updateUserProfileImage(data.imageUrl));

    }
    catch(err){
      console.error("Error uploading image:", err);
    }

    handleClose();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files ? event.target.files[0] : null;
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleRemoveImage() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleOpenPicker() {
    fileInputRef.current?.click();
  }

  function handleClose() {
    handleRemoveImage();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="animate-modal-in w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-[15px] font-semibold text-text-primary">Profile Photo</h2>
          <button
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Avatar / Preview */}
        <div className="flex items-center justify-center px-6 py-6">
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="New profile preview"
                className="h-14 w-14 rounded-full object-cover ring-1 ring-border-light"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white transition-colors hover:bg-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <UserAvatar imageUrl={imageUrl} userName={userName} size="lg" />
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Actions */}
        <div className="flex gap-2 border-t border-border px-4 py-3">
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Eye className="h-4 w-4" />
            View
          </button>
          {previewUrl ? (
            <button
              onClick={handleSaveImage}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              <Upload className="h-4 w-4" />
              Save
            </button>
          ) : (
            <button
              onClick={handleOpenPicker}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent/10 py-2.5 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
            >
              <Camera className="h-4 w-4" />
              Change Image
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
