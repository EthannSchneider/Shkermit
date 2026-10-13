import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/auth-context";
import { api, type User } from "../lib/api";
import ProfileAvatar from "./profile-avatar";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export default function ProfilePictureSettings({ user }: { user: User }) {
  const { t } = useTranslation();
  const { setUser } = useAuth();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function choosePicture(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    setNotice(null);
    setFile(null);
    setPreviewUrl(null);
    if (!selected) return;
    const error = !imageTypes.has(selected.type)
      ? "Upload a JPEG, PNG, WebP, or GIF image."
      : selected.size > 5 * 1024 * 1024 ? "Images must be 5 MB or smaller." : null;
    if (error) {
      event.target.value = "";
      setNotice({ kind: "error", text: error });
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  }

  async function savePicture(remove = false) {
    if (!remove && !file) return;
    setBusy(true);
    setNotice(null);
    try {
      const result = remove ? await api.removeProfilePicture() : await api.updateProfilePicture(file!);
      setUser((current) => current?.id === result.user.id
        ? { ...current, profilePictureUrl: result.user.profilePictureUrl } : current);
      setFile(null);
      setPreviewUrl(null);
      if (inputRef.current) inputRef.current.value = "";
      setNotice({ kind: "success", text: remove ? "Profile picture removed." : "Profile picture updated." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void savePicture();
  }

  return (
    <form onSubmit={submit} className="profile-picture-form">
      <ProfileAvatar src={file ? previewUrl : user.profilePictureUrl} className="profile-avatar-large" />
      <label>
        {t("Profile picture")}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={choosePicture} disabled={busy} aria-describedby={hintId} />
      </label>
      <p id={hintId} className="field-hint">{t("JPEG, PNG, WebP, or GIF. Maximum 5 MB.")}</p>
      {notice && <div role={notice.kind === "error" ? "alert" : "status"}
        className={`form-message form-${notice.kind}`}>{t(notice.text)}</div>}
      <div className="profile-picture-actions">
        <button className="primary-button" disabled={busy || !file}>
          {busy ? t("Saving…") : t("Save picture")}
        </button>
        {user.profilePictureUrl && <button type="button" className="profile-picture-remove"
          disabled={busy} onClick={() => void savePicture(true)}>{t("Remove picture")}</button>}
      </div>
    </form>
  );
}
