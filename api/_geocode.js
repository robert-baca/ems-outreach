export async function geocodeCity(name) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name + ', Texas, USA')}&format=json&limit=1`;
  const r = await fetch(url, {
    headers: { 'User-Agent': 'EMS-Outreach-App/1.0 (ems@baylorscottwhite.com)' },
  });
  const results = await r.json();
  if (!results.length) return null;
  return { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
}
