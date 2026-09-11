"use client";
import { useEffect, useRef, useState } from "react";
import towns from "../../database/seeds/aim4price-assistance-locations.json";
import styles from "./BusinessNetwork.module.css";
let loader: Promise<any> | undefined;
function leaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!loader)
    loader = new Promise((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(css);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.onload = () => resolve(window.L);
      script.onerror = () => {
        loader = undefined;
        script.remove();
        reject(
          new Error(
            "Map unavailable. Use current location or enter coordinates.",
          ),
        );
      };
      document.head.appendChild(script);
    });
  return loader;
}
export default function BusinessLocation({
  latitude,
  longitude,
  town,
  onChange,
}: {
  latitude: string;
  longitude: string;
  town: string;
  onChange: (lat: string, lng: string, town?: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<any>(null),
    marker = useRef<any>(null),
    callback = useRef(onChange);
  callback.current = onChange;
  const [error, setError] = useState(""),
    [search, setSearch] = useState(town);
  useEffect(() => {
    let active = true;
    leaflet()
      .then((L) => {
        if (!active || !element.current) return;
        map.current = L.map(element.current).setView([-29, 24], 5);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map.current);
        map.current.on("click", (event: any) =>
          callback.current(String(event.latlng.lat), String(event.latlng.lng)),
        );
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    let active = true;
    leaflet()
      .then((L) => {
        if (!active || !map.current || latitude === "" || longitude === "")
          return;
        const coords = [Number(latitude), Number(longitude)];
        if (coords.some((v) => !Number.isFinite(v))) return;
        if (marker.current) marker.current.setLatLng(coords);
        else
          marker.current = L.circleMarker(coords, {
            radius: 9,
            color: "#235d40",
            fillOpacity: 1,
          }).addTo(map.current);
        map.current.setView(coords, Math.max(map.current.getZoom(), 12));
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [latitude, longitude]);
  return (
    <div className={styles.panel}>
      <label>
        Find your town
        <input
          value={search}
          list="business-towns"
          onChange={(e) => {
            setSearch(e.target.value);
            const t = towns.find(
              (t) => t.town.toLowerCase() === e.target.value.toLowerCase(),
            );
            if (t)
              callback.current(String(t.latitude), String(t.longitude), t.town);
          }}
        />
      </label>
      <datalist id="business-towns">
        {towns.map((t) => (
          <option key={t.slug} value={t.town} />
        ))}
      </datalist>
      <div
        ref={element}
        style={{ height: 280, width: "100%", borderRadius: 12, zIndex: 0 }}
        aria-label="Choose business location on map"
      />
      <p className={styles.muted}>
        {error ||
          "Choose a nearby town, then tap the map to place your business."}
      </p>
    </div>
  );
}
