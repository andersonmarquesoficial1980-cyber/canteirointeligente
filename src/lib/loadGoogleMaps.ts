let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  if ((window as any).google?.maps) return Promise.resolve();
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_KEY not configured"));
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    // Usa a nova API do Google Maps (v=beta) com places para evitar deprecação
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,places-service&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return loadPromise;
}
