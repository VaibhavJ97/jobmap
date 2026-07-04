"use client";

import dynamic from "next/dynamic";
import type { Job } from "@/lib/types";

const JobMap = dynamic(() => import("./JobMap"), {
  ssr: false,
  loading: () => <div className="empty">Loading map…</div>,
});

export default function MapView({ jobs, onOpen }: { jobs: Job[]; onOpen: (job: Job) => void }) {
  return (
    <div className="map-panel">
      <JobMap jobs={jobs} onOpen={onOpen} />
    </div>
  );
}
