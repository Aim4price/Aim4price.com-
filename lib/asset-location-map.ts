'use client';
const LEAFLET_SCRIPT_ID = 'aim4price-leaflet-script';
const LEAFLET_CSS_ID = 'aim4price-leaflet-css';
const LEAFLET_CLUSTER_SCRIPT_ID = 'aim4price-leaflet-cluster-script';
const LEAFLET_CLUSTER_CSS_ID = 'aim4price-leaflet-cluster-css';
const LEAFLET_CLUSTER_DEFAULT_CSS_ID = 'aim4price-leaflet-cluster-default-css';
let leafletLoaderPromise: Promise<any> | null = null;
function loadLeafletMarkerCluster(leaflet: any): Promise<any> {
  if (leaflet?.markerClusterGroup) return Promise.resolve(leaflet);

  if (!document.getElementById(LEAFLET_CLUSTER_CSS_ID)) {
    const link = document.createElement('link');
    link.id = LEAFLET_CLUSTER_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }
  if (!document.getElementById(LEAFLET_CLUSTER_DEFAULT_CSS_ID)) {
    const link = document.createElement('link');
    link.id = LEAFLET_CLUSTER_DEFAULT_CSS_ID;
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
    link.crossOrigin = '';
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(LEAFLET_CLUSTER_SCRIPT_ID) as HTMLScriptElement | null;
    const handleLoaded = () => leaflet?.markerClusterGroup
      ? resolve(leaflet)
      : reject(new Error('Marker clustering did not initialise correctly.'));
    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load marker clustering.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = LEAFLET_CLUSTER_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
    script.async = true;
    script.crossOrigin = '';
    script.addEventListener('load', handleLoaded, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load marker clustering.')), { once: true });
    document.body.appendChild(script);
  });
}

export function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet can only load in the browser.'));
  }

  if (window.L?.markerClusterGroup) {
    return Promise.resolve(window.L);
  }

  if (leafletLoaderPromise) {
    return leafletLoaderPromise;
  }

  leafletLoaderPromise = new Promise((resolve, reject) => {
    if (window.L) {
      void loadLeafletMarkerCluster(window.L).then(resolve, () => resolve(window.L));
      return;
    }

    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link');
      link.id = LEAFLET_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const existingScript = document.getElementById(LEAFLET_SCRIPT_ID) as HTMLScriptElement | null;

    const handleLoaded = () => {
      if (window.L) {
        void loadLeafletMarkerCluster(window.L).then(resolve, () => resolve(window.L));
        return;
      }

      reject(new Error('The partner map did not initialise correctly.'));
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoaded, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load the partner map.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = LEAFLET_SCRIPT_ID;
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.crossOrigin = '';
    script.addEventListener('load', handleLoaded, { once: true });
    script.addEventListener('error', () => reject(new Error('Failed to load the partner map.')), { once: true });
    document.body.appendChild(script);
  });

  return leafletLoaderPromise;
}
