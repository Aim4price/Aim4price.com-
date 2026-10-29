import styles from './AdStudioClient.module.css';

export type StudioIconName =
  | 'share'
  | 'copy'
  | 'styles'
  | 'plus'
  | 'edit'
  | 'star'
  | 'delete'
  | 'details'
  | 'layout'
  | 'palette'
  | 'review'
  | 'check'
  | 'back'
  | 'next'
  | 'preview'
  | 'download'
  | 'image-add'
  | 'image'
  | 'language'
  | 'price'
  | 'chevron';

export default function StudioIcon({ name }: { name: StudioIconName }) {
  const svgProps = {
    'aria-hidden': true,
    focusable: 'false',
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
  } as const;
  const strokeProps = {
    stroke: 'currentColor',
    strokeWidth: 1.85,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    vectorEffect: 'non-scaling-stroke',
  } as const;

  return (
    <svg {...svgProps} className={styles.studioIcon}>
      {name === 'styles' ? (
        <>
          <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" opacity="0.12" />
          <path {...strokeProps} d="M8 8h8M8 12h5M8 16h3" />
          <path {...strokeProps} d="m16.2 13.8.55 1.1 1.2.18-.87.85.2 1.2-1.08-.57-1.08.57.2-1.2-.87-.85 1.2-.18.55-1.1Z" />
        </>
      ) : null}
      {name === 'share' ? <><circle {...strokeProps} cx="18" cy="5" r="3" /><circle {...strokeProps} cx="6" cy="12" r="3" /><circle {...strokeProps} cx="18" cy="19" r="3" /><path {...strokeProps} d="m8.6 10.5 6.8-4m-6.8 7 6.8 4" /></> : null}
      {name === 'copy' ? <><rect {...strokeProps} x="8" y="8" width="12" height="13" rx="2" /><path {...strokeProps} d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3" /></> : null}
      {name === 'download' ? <path {...strokeProps} d="M12 3v12m-4-4 4 4 4-4M5 16v4h14v-4" /> : null}
      {name === 'plus' ? <path {...strokeProps} d="M12 5v14M5 12h14" /> : null}
      {name === 'edit' ? (
        <>
          <path {...strokeProps} d="M5 19h4l9.6-9.6a2.2 2.2 0 0 0-3.1-3.1L5.9 15.9 5 19Z" />
          <path {...strokeProps} d="m14.2 7.6 3.1 3.1" />
        </>
      ) : null}
      {name === 'star' ? <path {...strokeProps} d="m12 4 2.35 4.75 5.25.76-3.8 3.7.9 5.23L12 16l-4.7 2.44.9-5.23-3.8-3.7 5.25-.76L12 4Z" /> : null}
      {name === 'delete' ? (
        <>
          <path {...strokeProps} d="M5 7h14M9 7V4.8h6V7M7.2 7l.7 12h8.2l.7-12M10 10.5v5M14 10.5v5" />
        </>
      ) : null}
      {name === 'details' ? (
        <>
          <circle cx="9" cy="8" r="3" fill="currentColor" opacity="0.12" />
          <circle {...strokeProps} cx="9" cy="8" r="3" />
          <path {...strokeProps} d="M4.5 19c.4-3.2 2-5 4.5-5s4.1 1.8 4.5 5M15.5 7h4M15.5 11h4M15.5 15h3" />
        </>
      ) : null}
      {name === 'layout' ? (
        <>
          <rect x="4" y="5" width="16" height="14" rx="2.5" fill="currentColor" opacity="0.1" />
          <rect {...strokeProps} x="4" y="5" width="16" height="14" rx="2.5" />
          <path {...strokeProps} d="M13 5v14M13 10h7" />
        </>
      ) : null}
      {name === 'palette' ? (
        <>
          <path {...strokeProps} d="M12 4.2a7.8 7.8 0 1 0 0 15.6h1.3a1.8 1.8 0 0 0 0-3.6h-.5a1.4 1.4 0 0 1 0-2.8H15a4.8 4.8 0 0 0 0-9.2h-3Z" />
          <circle cx="8" cy="9" r="1" fill="currentColor" />
          <circle cx="11.5" cy="7" r="1" fill="currentColor" />
          <circle cx="7.5" cy="13" r="1" fill="currentColor" />
        </>
      ) : null}
      {name === 'review' ? (
        <>
          <rect x="5" y="4" width="14" height="16" rx="2.5" fill="currentColor" opacity="0.1" />
          <rect {...strokeProps} x="5" y="4" width="14" height="16" rx="2.5" />
          <path {...strokeProps} d="m8.5 10 1.4 1.4 2.5-2.8M8.5 15h7" />
        </>
      ) : null}
      {name === 'check' ? <path {...strokeProps} d="m5 12.5 4.2 4.2L19 7" /> : null}
      {name === 'back' ? <path {...strokeProps} d="m14.5 6-6 6 6 6" /> : null}
      {name === 'next' ? <path {...strokeProps} d="m9.5 6 6 6-6 6" /> : null}
      {name === 'preview' ? (
        <>
          <path {...strokeProps} d="M3.8 12s3-5 8.2-5 8.2 5 8.2 5-3 5-8.2 5-8.2-5-8.2-5Z" />
          <circle {...strokeProps} cx="12" cy="12" r="2.2" />
        </>
      ) : null}
      {name === 'image-add' ? (
        <>
          <path {...strokeProps} d="M13 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8" />
          <circle {...strokeProps} cx="8" cy="9" r="1.5" />
          <path {...strokeProps} d="m3 17 5-5 4 4 3-3 6 6M19 2v6M16 5h6" />
        </>
      ) : null}
      {name === 'image' ? (
        <>
          <rect {...strokeProps} x="4" y="5" width="16" height="14" rx="2.5" />
          <circle cx="9" cy="10" r="1.4" fill="currentColor" />
          <path {...strokeProps} d="m6.5 17 4.1-4.2 2.6 2.5 1.7-1.7 2.6 3.4" />
        </>
      ) : null}
      {name === 'language' ? (
        <>
          <circle {...strokeProps} cx="12" cy="12" r="8" />
          <path {...strokeProps} d="M4.5 9h15M4.5 15h15M12 4c2.1 2.2 3.1 4.9 3.1 8s-1 5.8-3.1 8c-2.1-2.2-3.1-4.9-3.1-8S9.9 6.2 12 4Z" />
        </>
      ) : null}
      {name === 'price' ? (
        <>
          <path {...strokeProps} d="M4.5 6.5v5.1L12.9 20l7.1-7.1-8.4-8.4H6.5a2 2 0 0 0-2 2Z" />
          <circle cx="8.3" cy="8.3" r="1.25" fill="currentColor" />
        </>
      ) : null}
      {name === 'chevron' ? <path {...strokeProps} d="m7 9.5 5 5 5-5" /> : null}
    </svg>
  );
}

