'use client';
import { useEffect, useRef, useState } from 'react';
export const googleDirectoryEnabled = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY);
let googleLoader: Promise<any> | undefined;
export function loadGoogleDirectory(): Promise<any> {
    if (!googleDirectoryEnabled)
        return Promise.reject(new Error('Google Maps is not configured.'));
    if ((window as any).google?.maps?.importLibrary)
        return Promise.resolve((window as any).google.maps);
    if (!googleLoader)
        googleLoader = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timeout = window.setTimeout(() => script.onerror?.(new Event('error')), 15000);
            const callback = '__aim4priceDirectoryMapsReady';
            (window as any)[callback] = () => { window.clearTimeout(timeout); delete (window as any)[callback]; resolve((window as any).google.maps); };
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!)}&loading=async&libraries=places&v=weekly&callback=${callback}`;
            script.async = true;
            script.onerror = () => { window.clearTimeout(timeout); googleLoader = undefined; script.remove(); delete (window as any)[callback]; reject(new Error('Map unavailable. You can still choose a business from the directory.')); };
            document.head.appendChild(script);
        });
    return googleLoader;
}
type Point = {
    userId: string;
    displayName: string;
    businessName: string;
    latitude: number | null;
    longitude: number | null;
};
export default function GoogleDirectoryMap({ partners, selectedId, center, zoom, onSelect, onBounds, fitResults, onFitted }: {
    partners: Point[];
    selectedId?: string;
    center: [
        number,
        number
    ];
    zoom: number;
    fitResults?: boolean;
    onFitted?: () => void;
    onSelect: (id: string) => void;
    onBounds: (bounds: {
        west: number;
        south: number;
        east: number;
        north: number;
    }) => void;
}) {
    const element = useRef<HTMLDivElement>(null), map = useRef<any>(null);
    const callbacks = useRef({ onSelect, onBounds });
    callbacks.current = { onSelect, onBounds };
    const [ready, setReady] = useState(false), [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        let idle: any;
        let observer: ResizeObserver | undefined;
        loadGoogleDirectory().then(maps => {
            if (!active || !element.current)
                return;
            map.current = new maps.Map(element.current, { center: { lat: center[0], lng: center[1] }, zoom, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
            idle = map.current.addListener('idle', () => { const bounds = map.current?.getBounds(); if (bounds)
                callbacks.current.onBounds(bounds.toJSON()); });
            observer = new ResizeObserver(() => maps.event.trigger(map.current, 'resize'));
            observer.observe(element.current);
            setReady(true);
        }).catch(e => { if (active)
            setError(e.message); });
        return () => { active = false; idle?.remove(); observer?.disconnect(); map.current = null; };
        // Initial location is fixed for this mounted search; panning must not reset it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (!ready || !map.current)
            return;
        const maps = (window as any).google.maps;
        const markers = partners.filter(p => p.latitude != null && p.longitude != null).map(p => {
            const marker = new maps.Marker({ map: map.current, position: { lat: Number(p.latitude), lng: Number(p.longitude) }, title: p.businessName || p.displayName, icon: { path: maps.SymbolPath.CIRCLE, scale: p.userId === selectedId ? 11 : 8, fillColor: '#146b50', fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2 } });
            marker.addListener('click', () => callbacks.current.onSelect(p.userId));
            return marker;
        });
        return () => markers.forEach(m => { maps.event.clearInstanceListeners(m); m.setMap(null); });
    }, [partners, selectedId, ready]);
    useEffect(() => {
        if (!ready || !map.current || !fitResults || !partners.length)
            return;
        const maps = (window as any).google.maps;
        const bounds = new maps.LatLngBounds();
        partners.forEach(p => { if (p.latitude != null && p.longitude != null)
            bounds.extend({ lat: Number(p.latitude), lng: Number(p.longitude) }); });
        if (!bounds.isEmpty()) {
            onFitted?.();
            map.current.fitBounds(bounds, 40);
        }
    }, [ready, partners, fitResults, onFitted]);
    return <><div ref={element} style={{ height: '100%', minHeight: 360, width: '100%' }} aria-label="Business locations on Google Maps"/>{error ? <p role="status">{error}</p> : null}</>;
}
