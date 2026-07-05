"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Job } from "@/lib/types";

function pinIcon(count: number) {
  const size = count > 9 ? 34 : 28;
  return L.divIcon({
    className: "",
    html: `<div class="map-pin" style="width:${size}px;height:${size}px">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function JobMap({ jobs, onOpen }: { jobs: Job[]; onOpen: (job: Job) => void }) {
  const located = jobs.filter((j) => typeof j.lat === "number" && typeof j.lng === "number");
  const groups = new Map<string, Job[]>();
  for (const j of located) {
    const key = `${j.lat},${j.lng}`;
    const arr = groups.get(key) ?? [];
    arr.push(j);
    groups.set(key, arr);
  }

  return (
    <MapContainer center={[51.16, 10.45]} zoom={6} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {Array.from(groups.entries()).map(([key, group]) => {
        const [lat, lng] = key.split(",").map(Number);
        return (
          <Marker key={key} position={[lat, lng]} icon={pinIcon(group.length)}>
            <Popup>
              <strong>{group[0].city}</strong> · {group.length} job{group.length !== 1 ? "s" : ""}
              <div style={{ marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
                {group.map((j) => (
                  <a
                    key={`${j.source}-${j.id}`}
                    className="popup-job"
                    onClick={(e) => {
                      e.preventDefault();
                      onOpen(j);
                    }}
                    href={j.url || `/jobs/${j.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {j.title} - {j.company}
                  </a>
                ))}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
