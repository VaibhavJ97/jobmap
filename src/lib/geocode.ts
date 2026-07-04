// Static coordinate table for the most common German + European cities.
// Covers the large majority of results with zero API calls. Unknown cities
// are simply left off the map in Phase 1; a Nominatim fallback + Postgres
// cache is the next slice.
const CITIES: Record<string, [number, number]> = {
  berlin: [52.52, 13.405],
  münchen: [48.1351, 11.582],
  munich: [48.1351, 11.582],
  hamburg: [53.5511, 9.9937],
  köln: [50.9375, 6.9603],
  cologne: [50.9375, 6.9603],
  frankfurt: [50.1109, 8.6821],
  stuttgart: [48.7758, 9.1829],
  düsseldorf: [51.2277, 6.7735],
  dortmund: [51.5136, 7.4653],
  essen: [51.4556, 7.0116],
  leipzig: [51.3397, 12.3731],
  dresden: [51.0504, 13.7373],
  hannover: [52.3759, 9.732],
  nürnberg: [49.4521, 11.0767],
  nuremberg: [49.4521, 11.0767],
  bremen: [53.0793, 8.8017],
  karlsruhe: [49.0069, 8.4037],
  mannheim: [49.4875, 8.466],
  bonn: [50.7374, 7.0982],
  münster: [51.9607, 7.6261],
  freiburg: [47.999, 7.8421],
  heidelberg: [49.3988, 8.6724],
  augsburg: [48.3705, 10.8978],
  aachen: [50.7753, 6.0839],
  kiel: [54.3233, 10.1228],
  wien: [48.2082, 16.3738],
  vienna: [48.2082, 16.3738],
  zürich: [47.3769, 8.5417],
  zurich: [47.3769, 8.5417],
  amsterdam: [52.3676, 4.9041],
  paris: [48.8566, 2.3522],
  london: [51.5074, -0.1278],
  madrid: [40.4168, -3.7038],
  barcelona: [41.3874, 2.1686],
  lisbon: [38.7223, -9.1393],
  dublin: [53.3498, -6.2603],
  brussels: [50.8503, 4.3517],
  warsaw: [52.2297, 21.0122],
  prague: [50.0755, 14.4378],
  stockholm: [59.3293, 18.0686],
  copenhagen: [55.6761, 12.5683],
  milan: [45.4642, 9.19],
  rome: [41.9028, 12.4964],
};

export function geocode(location: string): { lat: number; lng: number; city: string } | null {
  if (!location) return null;
  const loc = location.toLowerCase();
  for (const [city, [lat, lng]] of Object.entries(CITIES)) {
    if (loc.includes(city)) return { lat, lng, city: city[0].toUpperCase() + city.slice(1) };
  }
  return null;
}
