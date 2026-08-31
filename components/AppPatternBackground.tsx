import type { ReactNode } from 'react';

import styles from './AppPatternBackground.module.css';

type AppPatternBackgroundProps = {
  children: ReactNode;
  className?: string;
};

const CONTOUR_PATHS = [
  'M-66 54 C-10 -9 91 -25 166 17 C239 58 260 139 222 209 C188 272 105 301 28 273 C-38 249 -80 187 -75 111 C-73 87 -70 69 -66 54 Z',
  'M-47 64 C1 11 85 -2 148 32 C209 65 227 135 195 193 C166 246 97 270 34 248 C-21 229 -55 177 -52 118 C-51 96 -50 78 -47 64 Z',
  'M-27 74 C12 31 78 21 129 47 C177 73 193 130 167 177 C143 218 90 238 41 221 C-1 206 -31 166 -29 121 C-29 103 -28 86 -27 74 Z',
  'M-8 85 C22 51 72 43 111 62 C149 81 160 125 140 160 C122 191 82 207 47 194 C15 183 -7 153 -7 121 C-7 106 -7 94 -8 85 Z',
  'M13 96 C35 72 69 66 95 79 C121 92 129 122 116 147 C104 169 77 179 53 171 C32 163 17 143 17 121 C17 111 15 103 13 96 Z',
  'M35 107 C47 94 66 91 80 98 C95 105 100 121 92 135 C85 148 70 154 57 149 C45 145 37 134 37 122 C37 116 36 111 35 107 Z',
  'M176 -34 C220 4 258 15 302 3 C349 -10 403 -4 448 27 C470 42 488 61 499 82',
  'M163 -15 C210 28 254 40 305 27 C353 15 402 22 440 51 C459 65 474 82 484 101',
  'M151 7 C201 53 251 66 307 52 C352 41 395 49 429 76 C446 90 459 106 468 125',
  'M244 119 C309 91 392 112 440 170 C483 221 473 294 418 337 C371 373 290 365 241 319 C199 279 197 217 224 164 C231 148 238 133 244 119 Z',
  'M263 137 C317 114 383 131 421 176 C455 217 447 276 403 310 C365 339 302 333 263 297 C230 266 228 217 250 176 C255 162 260 149 263 137 Z',
  'M283 155 C325 137 376 150 405 185 C431 216 424 260 390 286 C361 308 313 304 284 277 C258 253 257 216 274 185 C278 174 281 164 283 155 Z',
  'M304 174 C335 161 370 170 391 195 C409 217 405 246 382 264 C361 280 328 277 307 258 C289 241 288 216 300 194 C302 186 303 180 304 174 Z',
  'M325 193 C344 185 366 191 378 206 C390 220 387 238 372 249 C360 259 339 257 327 245 C315 235 314 219 322 207 C324 201 325 197 325 193 Z',
  'M447 289 C423 270 410 245 412 218 C415 189 436 164 466 151 C484 143 502 141 521 144',
  'M457 312 C428 288 413 257 416 224 C420 188 446 157 483 142 C503 134 523 132 544 136',
] as const;

function TopographicContours() {
  return (
    <svg
      className={styles.topography}
      viewBox="0 0 920 680"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <pattern
          id="aim4price-topographic-contours"
          width="460"
          height="340"
          patternUnits="userSpaceOnUse"
        >
          <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            {CONTOUR_PATHS.map((path) => (
              <path key={path} d={path} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#aim4price-topographic-contours)" />
    </svg>
  );
}

export default function AppPatternBackground({ children, className }: AppPatternBackgroundProps) {
  const rootClassName = className ? `${styles.background} ${className}` : styles.background;

  return (
    <div className={rootClassName} data-app-pattern="topographic-contours">
      <div className={styles.decoration} aria-hidden="true">
        <TopographicContours />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
