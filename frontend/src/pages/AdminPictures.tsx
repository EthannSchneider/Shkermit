import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api, type Picture } from "../lib/api";
import { pictureSource } from "../lib/picture-assets";
import AdminNavigation from "../components/admin-navigation";

function byPosition(pictures: Picture[]) {
  return [...pictures].sort((left, right) => left.position - right.position || left.id - right.id);
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : "The request failed.";
}

function PictureEditor({
  picture,
  index,
  total,
  reordering,
  onSaved,
  onDeleted,
  onMove,
}: {
  picture: Picture;
  index: number;
  total: number;
  reordering: boolean;
  onSaved: (picture: Picture) => void;
  onDeleted: (id: number) => void;
  onMove: (id: number, direction: "up" | "down") => void;
}) {
  const [title, setTitle] = useState(picture.title);
  const [altText, setAltText] = useState(picture.altText);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData();
    form.set("title", title);
    form.set("altText", altText);
    if (file) form.set("image", file);
    try {
      const result = await api.updatePicture(picture.id, form);
      setFile(null);
      onSaved(result.picture);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${picture.title}”? This cannot be undone.`)) return;
    setBusy(true);
    setError("");
    try {
      await api.deletePicture(picture.id);
      onDeleted(picture.id);
    } catch (caught) {
      setError(messageFrom(caught));
      setBusy(false);
    }
  }

  return (
    <article className="admin-picture-card">
      <div className="admin-picture-preview">
        <img src={pictureSource(picture)} alt={picture.altText} />
        <div className="position-controls" aria-label={`Position controls for ${picture.title}`}>
          <button
            type="button"
            onClick={() => onMove(picture.id, "up")}
            disabled={index === 0 || reordering}
            aria-label={`Move ${picture.title} up`}
            title="Move up"
          >
            ⬆️
          </button>
          <span>{index + 1} / {total}</span>
          <button
            type="button"
            onClick={() => onMove(picture.id, "down")}
            disabled={index === total - 1 || reordering}
            aria-label={`Move ${picture.title} down`}
            title="Move down"
          >
            ⬇️
          </button>
        </div>
      </div>
      <form onSubmit={save}>
        <label>Title<input value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label>Alternative text<input value={altText} maxLength={240} onChange={(event) => setAltText(event.target.value)} required /></label>
        <label>Replace image<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
        {error && <div className="form-message form-error" role="alert">{error}</div>}
        <div className="admin-actions">
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          <button className="danger-button" type="button" onClick={remove} disabled={busy}>Delete</button>
        </div>
      </form>
    </article>
  );
}

export default function AdminPictures() {
  const { user, loading: authLoading } = useAuth();
  const [pictures, setPictures] = useState<Picture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState("");
  const [movingId, setMovingId] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.isAdmin) return;
    let active = true;
    api.listPictures()
      .then(({ pictures: gallery }) => { if (active) setPictures(gallery); })
      .catch((caught: unknown) => { if (active) setError(messageFrom(caught)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.isAdmin]);

  useEffect(() => {
    if (!createOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !creating) setCreateOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [createOpen, creating]);

  if (authLoading) return <main className="gallery-page"><p className="gallery-status">Checking access…</p></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/pictures" replace />;

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError("");
    const formElement = event.currentTarget;
    try {
      const result = await api.createPicture(new FormData(formElement));
      setPictures((current) => byPosition([...current, result.picture]));
      formElement.reset();
      setCreateOpen(false);
    } catch (caught) {
      setCreateError(messageFrom(caught));
    } finally {
      setCreating(false);
    }
  }

  function savePicture(saved: Picture) {
    setPictures((current) => byPosition(current.map((picture) => picture.id === saved.id ? saved : picture)));
  }

  async function movePicture(id: number, direction: "up" | "down") {
    setMovingId(id);
    setError("");
    try {
      const result = await api.movePicture(id, direction);
      setPictures(result.pictures);
    } catch (caught) {
      setError(messageFrom(caught));
    } finally {
      setMovingId(null);
    }
  }

  return (
    <main className="gallery-page admin-gallery-page">
      <div className="gallery-heading">
        <div>
          <p className="auth-eyebrow">Administration</p>
          <h1>Manage pictures</h1>
          <p className="gallery-status">Add, edit, order, replace, or remove gallery pictures.</p>
        </div>
        <div className="gallery-heading-actions">
          <button
            className="primary-button admin-add-button"
            type="button"
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
          >
            Add a picture
          </button>
          <Link className="account-cta" to="/pictures">View gallery</Link>
        </div>
      </div>

      <AdminNavigation />
      {createOpen && (
        <div
          className="admin-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) setCreateOpen(false);
          }}
        >
          <section
            className="settings-card admin-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-picture-title"
          >
            <div className="admin-modal-heading">
              <div>
                <p className="auth-eyebrow">New gallery item</p>
                <h2 id="add-picture-title">Add a picture</h2>
              </div>
              <button
                className="admin-modal-close"
                type="button"
                aria-label="Close add picture dialog"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
              >
                ×
              </button>
            </div>
            <form onSubmit={create}>
              <label>Title<input name="title" maxLength={100} autoFocus required /></label>
              <label>Alternative text<input name="altText" maxLength={240} required /></label>
              <label>Image<input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required /></label>
              <p className="field-hint">JPEG, PNG, WebP, or GIF. Maximum 5 MB. New pictures are added last.</p>
              {createError && <div className="form-message form-error" role="alert">{createError}</div>}
              <div className="admin-modal-actions">
                <button type="button" className="secondary-button" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</button>
                <button className="primary-button" type="submit" disabled={creating}>{creating ? "Uploading…" : "Add picture"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {error && <div className="form-message form-error" role="alert">{error}</div>}
      {loading ? <p className="gallery-status">Loading pictures…</p> : (
        <section className="admin-picture-list" aria-label="Existing pictures">
          {pictures.map((picture, index) => (
            <PictureEditor
              key={picture.id}
              picture={picture}
              index={index}
              total={pictures.length}
              reordering={movingId !== null}
              onSaved={savePicture}
              onDeleted={(id) => setPictures((current) => current.filter((item) => item.id !== id))}
              onMove={movePicture}
            />
          ))}
        </section>
      )}
    </main>
  );
}
