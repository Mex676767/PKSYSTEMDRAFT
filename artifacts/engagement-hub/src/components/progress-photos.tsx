import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useProgressPhotos,
  useAddProgressPhoto,
  useDeleteProgressPhoto,
  getProgressPhotoUrl,
  type ProgressPhotoTargetType,
} from "@/hooks/use-progress-photos";
import { getErrorMessage } from "@/lib/utils";
import { ImagePickerButton } from "@/components/image-picker-button";

export function ProgressPhotos(
  {
    targetType,
    targetId,
    canUpload,
  }: {
    targetType: ProgressPhotoTargetType;
    targetId: string;
    canUpload: boolean;
  }
) {
  const { session, isAdmin } = useAuth();
  const { data: photos = [] } = useProgressPhotos(targetType, targetId);
  const addPhoto = useAddProgressPhoto(targetType, targetId);
  const deletePhoto = useDeleteProgressPhoto(targetType, targetId);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  if (photos.length === 0 && !canUpload) return null;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    addPhoto.mutate({ file }, { onError: (err) => setError(getErrorMessage(err)) });
  };

  return (
    <div className="space-y-2">
      {photos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {photos.map((p) => (
            <div key={p.id} className="relative group shrink-0">
              <button
                type="button"
                onClick={() => setPreview(getProgressPhotoUrl(p.image_path))}
                title={`Progress photo by @${p.uploader?.username ?? "unknown"}`}
              >
                <img
                  src={getProgressPhotoUrl(p.image_path)}
                  alt={`Progress photo by @${p.uploader?.username ?? "unknown"}`}
                  className="w-14 h-14 rounded-lg object-cover border border-border"
                />
              </button>
              {(p.uploader_id === session?.user.id || isAdmin) && (
                <button
                  type="button"
                  onClick={() => window.confirm("Delete this progress photo?") && deletePhoto.mutate(p.id)}
                  disabled={deletePhoto.isPending}
                  title="Delete photo"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canUpload && (
        <ImagePickerButton onImage={handleFile} disabled={addPhoto.isPending} label="Add progress photo" />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {preview && (
        <div
          className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <button
            type="button"
            onClick={() => setPreview(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={preview} alt="Progress photo, full size" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
