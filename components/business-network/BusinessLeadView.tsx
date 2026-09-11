"use client";
import { useEffect, useState } from "react";
import type { BusinessLeadView as View } from "../../lib/business-network-shared";
import styles from "./BusinessNetwork.module.css";
function RequestPhoto({
  token,
  asset,
  photo,
}: {
  token: string;
  asset: number;
  photo: number;
}) {
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true,
      objectUrl = "";
    fetch(`/api/business-network/request?asset=${asset}&photo=${photo}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        if (r.headers.get("content-type")?.includes("application/json")) {
          const data = await r.json();
          if (live) setUrl(data.url);
        } else {
          objectUrl = URL.createObjectURL(await r.blob());
          if (live) setUrl(objectUrl);
          else URL.revokeObjectURL(objectUrl);
        }
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, asset, photo]);
  if (failed) return <span>Photo unavailable</span>;
  return url ? (
    <img
      src={url}
      alt="Shared asset"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  ) : (
    <span>{failed ? "Photo unavailable" : "Loading photo…"}</span>
  );
}
export default function BusinessLeadView({
  view,
  token,
}: {
  view: View;
  token?: string;
}) {
  return (
    <div className={styles.panel}>
      <h2>{view.umbrella || "Asset enquiry"}</h2>
      <p>To {view.businessName}</p>
      <section className={styles.card}>
        <h3>Contact</h3>
        <strong>{view.contact.name}</strong>
        <a href={`mailto:${view.contact.email}`}>{view.contact.email}</a>
        {view.contact.phone ? <span>{view.contact.phone}</span> : null}
        {view.contact.additional ? (
          <p className={styles.message}>{view.contact.additional}</p>
        ) : null}
      </section>
      {view.message ? (
        <section className={styles.card}>
          <h3>Message / problem</h3>
          <p className={styles.message}>{view.message}</p>
        </section>
      ) : null}
      {view.assets.map((asset, i) => (
        <section key={i} className={styles.card}>
          <h3>{asset.title}</h3>
          <dl className={styles.details}>
            {asset.details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className={styles.photos}>
            {asset.photos.map((photo, j) =>
              token ? (
                <RequestPhoto key={j} token={token} asset={i} photo={j} />
              ) : (
                <img key={j} src={photo} alt="Shared asset" />
              ),
            )}
          </div>
        </section>
      ))}
      <p className={styles.muted}>
        Read-only enquiry. Reports, documents and ongoing asset access are not
        included.
      </p>
    </div>
  );
}
