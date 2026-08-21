import React, { useId } from 'react';

/** The circular "Z" monogram — a complete ring with the Z woven through it, matching the original splash-screen mark exactly (a standalone stroke mark, no background). */
export function LogoMark({ className, color = 'currentColor' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="41" stroke={color} strokeWidth="9" />
      <path d="M 30 32 L 80 22 L 20 78 L 70 68" stroke={color} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Real brand artwork (same source as the About page's 3D emblem, see
// public/emblems/ziyam-{plate,art}.svg) — an espresso plate, metallic ring,
// green accent arc, and the actual cream Z-swoosh, with the "ZIYAM SELF
// DRIVE" wordmark baked into that artwork deliberately dropped: every call
// site already renders the wordmark as separate live text next to this
// badge, and the full artwork turns to mush at icon size anyway. Gradient
// ids are per-instance (useId) since this badge renders more than once per
// page (navbar + footer) and SVG ids are global to the document.
export function LogoBadge({ className }: { className?: string }) {
  const uid = useId();
  const plate = `zplate-${uid}`;
  const ring = `zring-${uid}`;
  const cream = `zcream-${uid}`;
  const emboss = `zemboss-${uid}`;
  return (
    <svg viewBox="0 0 1024 1024" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={plate} cx="38%" cy="28%" r="84%">
          <stop offset="0%" stopColor="#3A302B" />
          <stop offset="52%" stopColor="#2A2320" />
          <stop offset="100%" stopColor="#161110" />
        </radialGradient>
        <linearGradient id={ring} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3ECDE" />
          <stop offset="34%" stopColor="#9C8E79" />
          <stop offset="56%" stopColor="#FFFBF1" />
          <stop offset="80%" stopColor="#8F8169" />
          <stop offset="100%" stopColor="#EFE7D7" />
        </linearGradient>
        <linearGradient id={cream} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="20%" stopColor="#F2EADB" />
          <stop offset="42%" stopColor="#CFC2AC" />
          <stop offset="56%" stopColor="#FFFBF0" />
          <stop offset="74%" stopColor="#DACDB6" />
          <stop offset="90%" stopColor="#B3A38B" />
          <stop offset="100%" stopColor="#F4EDE0" />
        </linearGradient>
        <filter id={emboss} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.6" floodColor="#000" floodOpacity="0.6" />
        </filter>
      </defs>
      <circle cx="512" cy="512" r="481" fill={`url(#${plate})`} />
      <circle cx="512" cy="512" r="470" fill="none" stroke={`url(#${ring})`} strokeWidth="11" />
      <path d="M 794.0 136.0 A 470.0 470.0 0 0 1 972.6 418.0" fill="none" stroke="#2F9E4F" strokeWidth="11" strokeLinecap="round" />
      <g fill={`url(#${cream})`} fillRule="evenodd" filter={`url(#${emboss})`}>
        <path d="M 342.99 237.33 L 341.59 239.97 L 337.90 245.07 L 335.96 248.23 L 335.44 249.64 L 331.39 255.79 L 330.16 258.78 L 328.93 260.53 L 326.82 264.93 L 325.94 266.16 L 323.48 271.08 L 318.91 281.63 L 315.75 291.47 L 314.87 293.23 L 314.17 296.57 L 311.71 304.13 L 311.00 307.99 L 309.60 312.74 L 308.89 317.66 L 308.02 320.47 L 307.49 325.39 L 306.96 327.33 L 306.61 331.90 L 305.55 337.87 L 304.85 351.06 L 304.85 367.58 L 306.26 384.98 L 307.49 391.13 L 308.02 397.11 L 309.25 401.68 L 309.60 404.67 L 311.18 410.12 L 311.53 412.75 L 314.17 421.72 L 316.45 427.17 L 316.80 428.92 L 318.56 433.85 L 322.08 442.28 L 324.36 446.68 L 325.59 450.02 L 331.04 460.39 L 333.33 462.32 L 335.26 462.15 L 337.19 460.39 L 338.25 458.81 L 344.40 452.13 L 347.39 448.26 L 359.17 435.60 L 360.22 434.20 L 360.92 432.44 L 360.57 429.80 L 359.52 428.05 L 356.88 421.19 L 355.47 418.55 L 350.20 402.73 L 347.56 391.13 L 344.93 374.43 L 344.93 369.51 L 344.40 364.59 L 344.58 348.42 L 345.10 344.38 L 345.28 339.81 L 346.86 328.03 L 350.73 310.98 L 352.84 306.23 L 354.24 301.66 L 358.11 292.52 L 358.99 289.71 L 362.86 281.10 L 367.25 273.19 L 369.18 271.26 L 371.65 270.55 L 492.93 270.55 L 502.07 270.90 L 524.22 270.73 L 525.45 271.43 L 525.80 272.49 L 525.80 273.19 L 525.27 274.07 L 523.51 275.83 L 518.42 282.33 L 514.02 287.08 L 508.75 293.75 L 503.12 299.38 L 490.82 313.27 L 483.79 322.05 L 480.27 325.57 L 477.81 328.73 L 462.87 345.43 L 457.42 351.06 L 455.31 354.22 L 450.92 359.32 L 442.31 368.63 L 441.60 369.86 L 437.38 374.26 L 432.81 379.88 L 421.56 391.84 L 418.93 395.18 L 408.03 407.30 L 405.75 410.29 L 398.54 418.03 L 395.37 422.07 L 387.64 430.33 L 381.84 437.36 L 377.80 441.40 L 345.98 478.32 L 345.46 480.78 L 346.33 483.24 L 347.74 485.17 L 349.67 487.11 L 353.72 492.55 L 364.26 504.16 L 371.12 510.66 L 375.51 514.17 L 383.07 521.03 L 395.55 529.99 L 397.84 531.22 L 400.47 533.33 L 410.14 538.61 L 415.24 541.77 L 418.75 543.18 L 425.96 546.87 L 430.88 548.63 L 436.51 551.26 L 439.49 552.14 L 446.70 555.13 L 449.69 555.83 L 455.31 557.94 L 456.90 558.12 L 458.65 558.82 L 460.94 559.17 L 465.68 560.58 L 472.89 561.63 L 476.41 562.51 L 488.71 564.27 L 491.35 564.27 L 499.43 565.15 L 507.87 565.15 L 512.26 565.50 L 522.81 565.32 L 537.05 564.27 L 549.18 562.51 L 553.22 561.46 L 562.71 559.70 L 567.46 558.12 L 571.67 557.24 L 573.61 556.36 L 581.17 554.07 L 583.98 552.67 L 592.77 549.50 L 594.88 548.27 L 602.26 545.29 L 604.54 543.88 L 607.36 542.83 L 609.99 541.42 L 612.45 539.66 L 628.27 530.35 L 635.48 525.42 L 647.61 515.23 L 660.44 503.10 L 660.79 502.22 L 660.62 500.99 L 658.68 499.23 L 640.40 499.41 L 635.83 499.76 L 602.79 499.76 L 598.74 501.34 L 590.13 506.26 L 584.68 509.08 L 582.57 509.78 L 579.94 511.36 L 575.54 512.94 L 573.08 514.17 L 569.92 515.05 L 564.82 517.34 L 550.93 521.38 L 540.39 523.49 L 533.53 524.02 L 530.37 524.72 L 522.11 525.42 L 503.30 525.42 L 500.84 525.07 L 493.63 524.90 L 489.06 524.02 L 479.39 522.79 L 474.30 521.38 L 469.73 520.68 L 463.75 518.74 L 460.94 518.22 L 449.16 514.00 L 440.55 509.78 L 438.44 509.08 L 434.57 506.79 L 428.42 503.98 L 424.90 501.69 L 422.80 500.82 L 416.12 496.42 L 404.16 487.63 L 398.19 482.54 L 395.37 479.72 L 395.02 477.97 L 395.73 476.56 L 397.66 474.10 L 400.82 470.93 L 409.08 461.62 L 415.76 453.36 L 426.13 441.93 L 430.70 436.31 L 438.09 428.57 L 445.65 419.78 L 454.08 410.64 L 457.77 405.90 L 468.85 393.42 L 469.73 392.01 L 482.91 377.60 L 483.96 376.02 L 489.94 369.69 L 492.05 367.05 L 495.04 364.06 L 506.81 350.00 L 511.56 344.90 L 514.37 341.21 L 529.84 324.52 L 540.56 312.21 L 545.84 305.71 L 554.27 296.22 L 558.14 292.35 L 563.59 285.67 L 567.10 282.15 L 570.27 277.94 L 574.49 273.72 L 575.72 271.96 L 579.76 267.74 L 584.15 262.12 L 585.56 259.48 L 586.26 257.37 L 586.79 254.21 L 586.79 250.51 L 586.44 248.23 L 585.39 245.07 L 583.10 241.37 L 579.94 238.21 L 577.65 236.80 L 574.84 235.57 L 569.21 234.52 L 347.56 234.52 L 345.10 235.22 Z" />
        <path d="M 365.49 211.67 L 364.26 213.43 L 364.26 214.66 L 366.02 216.59 L 419.98 216.59 L 422.62 215.89 L 429.47 211.84 L 437.56 207.80 L 438.79 206.92 L 448.99 202.35 L 458.13 198.84 L 471.84 194.79 L 475.88 193.92 L 479.22 193.56 L 483.09 192.51 L 501.72 190.22 L 519.12 190.05 L 525.97 190.40 L 544.96 193.04 L 546.19 193.56 L 549.00 193.92 L 553.57 195.32 L 561.30 197.08 L 565.52 198.31 L 569.57 200.07 L 572.55 200.95 L 581.17 204.99 L 582.57 205.34 L 591.36 209.91 L 592.59 210.26 L 601.38 215.54 L 603.84 217.47 L 608.24 220.11 L 615.09 224.85 L 617.73 227.14 L 619.31 228.02 L 625.11 233.11 L 628.45 236.45 L 628.80 237.16 L 628.80 238.56 L 628.27 239.62 L 623.00 246.12 L 609.47 261.06 L 601.91 270.03 L 594.53 278.11 L 593.12 280.04 L 586.09 287.60 L 582.22 292.35 L 573.61 301.49 L 566.93 309.57 L 562.01 314.67 L 558.32 319.24 L 541.27 338.05 L 540.39 339.46 L 536.17 344.38 L 532.30 348.42 L 529.67 351.94 L 510.33 373.03 L 490.64 396.05 L 486.25 400.62 L 485.19 402.21 L 479.22 409.06 L 468.14 421.01 L 467.62 422.07 L 456.02 434.90 L 454.79 436.83 L 450.74 440.88 L 446.52 446.15 L 441.43 451.77 L 438.79 455.82 L 438.09 457.75 L 437.38 462.67 L 437.38 465.49 L 437.91 469.70 L 438.44 471.46 L 440.37 474.98 L 443.18 477.97 L 446.17 479.72 L 451.27 481.30 L 461.82 481.66 L 677.84 481.66 L 679.25 481.30 L 681.36 479.20 L 690.15 465.84 L 694.19 458.81 L 695.95 455.11 L 698.93 450.19 L 699.99 447.20 L 702.63 441.76 L 703.50 438.59 L 706.32 432.09 L 709.13 423.65 L 710.71 420.14 L 713.52 409.77 L 716.34 395.00 L 716.51 392.19 L 717.92 385.33 L 719.15 369.34 L 719.15 344.90 L 717.92 330.84 L 715.28 315.20 L 714.58 313.44 L 712.82 305.53 L 708.43 292.17 L 707.90 289.36 L 705.09 282.68 L 703.86 278.81 L 701.40 273.54 L 700.87 271.61 L 696.83 264.23 L 694.72 259.48 L 692.96 256.32 L 690.15 253.50 L 688.74 253.50 L 687.86 253.85 L 685.40 256.14 L 683.82 258.25 L 680.83 261.24 L 677.14 265.98 L 672.04 271.26 L 665.01 279.69 L 663.96 280.57 L 663.25 281.98 L 663.25 285.14 L 665.54 289.71 L 668.00 296.57 L 670.81 303.25 L 671.16 305.18 L 673.97 313.44 L 674.33 315.55 L 675.91 320.65 L 676.26 323.81 L 678.72 336.29 L 679.42 342.80 L 680.13 357.21 L 679.78 369.69 L 679.42 374.43 L 678.19 381.11 L 677.84 385.51 L 676.44 390.43 L 676.26 392.89 L 675.21 396.76 L 674.15 402.73 L 672.57 407.13 L 669.23 418.20 L 667.65 421.37 L 665.36 427.52 L 662.37 433.49 L 661.32 436.48 L 657.63 442.81 L 655.17 445.27 L 568.16 445.62 L 498.73 445.27 L 497.50 443.51 L 498.03 441.93 L 499.78 439.65 L 510.33 428.22 L 515.08 422.25 L 539.16 395.53 L 541.62 392.36 L 551.81 380.94 L 555.68 376.02 L 559.20 372.50 L 560.07 371.10 L 562.71 368.46 L 567.81 362.31 L 577.30 352.29 L 579.41 349.48 L 585.03 343.50 L 592.24 334.71 L 595.05 331.90 L 601.56 324.34 L 603.49 322.58 L 612.98 311.51 L 617.20 307.11 L 620.01 303.42 L 625.46 297.62 L 626.52 296.04 L 631.09 291.12 L 632.32 289.36 L 643.92 276.70 L 652.35 266.33 L 658.16 260.36 L 660.62 257.19 L 672.92 244.01 L 677.67 237.86 L 678.02 236.98 L 677.84 233.64 L 671.51 224.85 L 668.17 221.51 L 664.13 216.77 L 654.29 206.75 L 639.87 194.09 L 633.37 189.17 L 628.45 186.18 L 623.70 182.84 L 620.89 181.44 L 615.79 178.10 L 610.70 175.81 L 606.13 173.17 L 595.23 167.90 L 593.12 167.20 L 590.31 165.62 L 580.82 162.63 L 578.00 161.22 L 574.84 160.17 L 572.55 159.82 L 567.10 157.71 L 551.46 154.37 L 534.41 151.73 L 511.91 150.50 L 502.07 150.85 L 484.32 152.43 L 471.31 155.07 L 468.32 155.42 L 464.63 156.48 L 456.72 158.06 L 450.74 160.17 L 445.82 161.40 L 441.60 163.16 L 434.57 165.44 L 414.89 174.93 L 403.64 181.44 L 393.79 187.76 L 391.51 189.70 L 388.17 191.81 L 377.97 199.89 Z" />
      </g>
    </svg>
  );
}

/** Full lockup: badge + "ZiyamSelfDrive" wordmark, matching the reference splash screen composition. */
export function LogoFull({ className, tagline = false }: { className?: string; tagline?: boolean }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ''}`}>
      <LogoBadge className="w-16 h-16" />
      <div className="text-center leading-tight">
        <span className="text-xl font-extrabold">Ziyam</span>
        <span className="text-xl font-medium">SelfDrive</span>
        {tagline && <p className="text-xs opacity-70 mt-0.5">By Eightlines</p>}
      </div>
    </div>
  );
}

export default function Logo({ className }: { className?: string }) {
  return (
    <a href="/" className={`flex items-center gap-2 ${className ?? ''}`}>
      <LogoBadge className="w-9 h-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-extrabold text-amber-500 tracking-tight">Ziyam<span className="font-semibold text-gray-700">SelfDrive</span></span>
      </span>
    </a>
  );
}
