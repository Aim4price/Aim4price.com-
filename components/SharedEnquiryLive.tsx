'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
/** Mounted only after an authorised enquiry has been opened, never for previews. */
export default function SharedEnquiryLive({ token, recordActivity = true }: {
    token: string;
    recordActivity?: boolean;
}) {
    const router = useRouter();
    useEffect(() => {
        let stopped = false;
        const record = () => fetch(`/api/asset-share-links/${token}/activity`, { method: 'POST', credentials: 'include', cache: 'no-store' }).then(response => { if (!response.ok && !stopped)
            router.refresh(); }).catch(() => { });
        const refresh = () => { if (document.visibilityState === 'visible') {
            router.refresh();
            if (recordActivity) void record();
        } };
        if (recordActivity) void record();
        const interval = setInterval(refresh, 30000);
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => { stopped = true; clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
    }, [token, router, recordActivity]);
    return null;
}
