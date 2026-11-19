"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminGlobalAsset } from "../../../lib/admin-global-assets-shared";
import styles from "./page.module.css";

export default function AssetPhotos({ asset }: { asset: AdminGlobalAsset }) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [index, setIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function loadPhotos() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setStatus("loading");
    setImageFailed(false);
    try {
      const query = new URLSearchParams({ assetId: asset.id, ownerId: asset.ownerUserId });
      const response = await fetch(`/api/admin/asset-map/photos?${query}`, {
        signal: controller.signal, cache: "no-store",
      });
      if (!response.ok) throw new Error("Photo request failed");
      const data = await response.json();
      if (!Array.isArray(data.photos)) throw new Error("Invalid photo list");
      if (controller.signal.aborted) return;
      setPhotos(data.photos);
      setIndex(0);
      setStatus("ready");
    } catch {
      if (!controller.signal.aborted) setStatus("error");
    }
  }

  function showPhoto(next: number) {
    setImageFailed(false);
    setIndex(next);
  }

  return <section className={styles.photos} aria-label="Asset photos">
    {status === "ready" && photos.length > 0 ? <>
      {imageFailed ? <p role="status">This photo could not be displayed.</p> :
        <img key={photos[index]} src={photos[index]} alt={`${asset.title}, photo ${index + 1}`}
          referrerPolicy="no-referrer" onError={() => setImageFailed(true)} />}
      <div className={styles.photoControls}>
        {photos.length > 1 && <button type="button" disabled={index === 0} onClick={() => showPhoto(index - 1)}>Previous</button>}
        <span aria-live="polite">Photo {index + 1} of {photos.length}</span>
        {photos.length > 1 && <button type="button" disabled={index === photos.length - 1} onClick={() => showPhoto(index + 1)}>Next</button>}
        {imageFailed && <button type="button" onClick={() => setImageFailed(false)}>Retry photo</button>}
      </div>
    </> : status === "ready" ? <p role="status">No photos saved for this asset.</p> : <>
      {status === "error" && <p role="status">Photos could not be loaded.</p>}
      <button type="button" disabled={status === "loading"} onClick={() => void loadPhotos()}>
        {status === "loading" ? "Loading photos…" : status === "error" ? "Retry loading photos" : "Load photos"}
      </button>
    </>}
  </section>;
}
