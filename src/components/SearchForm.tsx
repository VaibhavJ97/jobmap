"use client";

import { useState } from "react";

export default function SearchForm({ onSearch, loading }: { onSearch: (keywords: string, location: string) => void; loading: boolean }) {
  const [keywords, setKeywords] = useState("");
  const [location, setLocation] = useState("");

  return (
    <form
      className="search-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (keywords.trim()) onSearch(keywords.trim(), location.trim());
      }}
    >
      <input
        type="text"
        placeholder="Role or keywords, e.g. backend developer, python"
        value={keywords}
        onChange={(e) => setKeywords(e.target.value)}
        aria-label="Keywords"
      />
      <input
        type="text"
        placeholder="City (optional), e.g. Berlin"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        aria-label="Location"
        style={{ flex: "0 1 200px" }}
      />
      <button className="btn" type="submit" disabled={loading}>
        {loading ? "Searching…" : "Search"}
      </button>
    </form>
  );
}
