import { useTranslation } from 'react-i18next';
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/auth-context";
import { api, type Picture as PictureRecord } from "../lib/api";
import { pictureSource } from "../lib/picture-assets";

export default function Picture() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pictures, setPictures] = useState<PictureRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.listPictures()
      .then(({ pictures: gallery }) => {
        if (active) setPictures(gallery);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Could not load pictures.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="gallery-page">
      <div className="gallery-heading">
        <div>
          <p className="auth-eyebrow">{t("The collection")}</p>
          <h1>{t("Shkermit pictures")}</h1>
        </div>
        {user?.isAdmin && <Link className="account-cta" to="/admin/pictures">{t("Manage pictures")}</Link>}
      </div>

      {loading && <p className="gallery-status">{t("Loading pictures…")}</p>}
      {error && <div className="form-message form-error" role="alert">{t(error)}</div>}
      {!loading && !error && pictures.length === 0 && (
        <p className="gallery-status">{t("No pictures have been published yet.")}</p>
      )}
      <div className="picture-grid">
        {pictures.map((picture) => (
          <figure className="picture-card" key={picture.id}>
            <img src={pictureSource(picture)} alt={picture.altText} loading="lazy" />
            <figcaption>{picture.title}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
