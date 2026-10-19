/** Inline Sulwe (option B, star antenna). Groups keep the ids from sulwe-b.svg. */
export function SulweArt({
  pose = "",
  paused = false,
  twinkle = false,
}: {
  pose?: string;
  paused?: boolean;
  /** Gentle antenna twinkle while he waits in the corner. */
  twinkle?: boolean;
}) {
  const poseClass = pose ? ` sulwe-${pose}` : "";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      className={`sulwe-art h-full w-full${poseClass}${twinkle ? " sulwe-twinkle" : ""}${paused ? " sulwe-paused" : ""}`}
      aria-hidden="true"
    >
      <ellipse id="shadow" cx="100" cy="194" rx="36" ry="4" fill="#3A2418" opacity=".15" />
      <g id="sulwe">
        <g id="legs">
          <rect x="79" y="172" width="16" height="18" rx="8" fill="#C2562E" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          <rect x="105" y="172" width="16" height="18" rx="8" fill="#C2562E" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <g id="body">
          <rect x="77" y="144" width="46" height="36" rx="19" fill="#C2562E" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          <polygon points="100,154 102.1,159.1 107.6,159.5 103.4,163.1 104.7,168.5 100,165.6 95.3,168.5 96.6,163.1 92.4,159.5 97.9,159.1" fill="#E9B85C" stroke="#3A2418" strokeWidth="2.5" strokeLinejoin="round" />
        </g>
        <g id="antenna">
          <path d="M100 42V24" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          <circle id="glow" cx="100" cy="16" r="20" fill="#E9B85C" opacity=".35" />
          <polygon id="star" points="100,1 104.1,10.3 114.3,11.4 106.7,18.2 108.8,28.1 100,23 91.2,28.1 93.3,18.2 85.7,11.4 95.9,10.3" fill="#C8881A" stroke="#3A2418" strokeLinejoin="round" strokeLinecap="round" strokeWidth="4" />
        </g>
        <g id="sparkles" className="sulwe-spark">
          <polygon points="78,8 81,16 90,18 81,20 78,28 75,20 66,18 75,16" fill="#E9B85C" />
          <polygon points="124,4 127,13 136,15 127,17 124,26 121,17 112,15 121,13" fill="#C8881A" />
          <polygon points="100,30 102,36 108,37 102,39 100,45 98,39 92,37 98,36" fill="#FBF1DC" stroke="#3A2418" strokeWidth="1" />
        </g>
        <g id="head">
          <rect x="40" y="38" width="120" height="110" rx="52" fill="#C2562E" stroke="#3A2418" strokeLinejoin="round" strokeLinecap="round" strokeWidth="6" />
          <rect x="54" y="60" width="92" height="72" rx="34" fill="#FBF1DC" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          <g id="ears">
            <rect x="30" y="80" width="14" height="28" rx="7" fill="#C8881A" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            <rect x="156" y="80" width="14" height="28" rx="7" fill="#C8881A" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
          </g>
          <g id="eyes">
            <circle cx="79" cy="92" r="15" fill="#fff" stroke="#3A2418" strokeWidth="5" />
            <g id="pupilL">
              <circle cx="81" cy="94" r="9.3" fill="#3A2418" />
              <circle cx="85.5" cy="89" r="3.6" fill="#fff" />
              <circle cx="77.2" cy="97.2" r="1.5" fill="#fff" />
            </g>
            <path id="lidL" d="M64 92a15 15 0 0 1 30 0z" fill="#FBF1DC" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" opacity="0" />
            <circle cx="121" cy="92" r="15" fill="#fff" stroke="#3A2418" strokeWidth="5" />
            <g id="pupilR">
              <circle cx="123" cy="94" r="9.3" fill="#3A2418" />
              <circle cx="127.5" cy="89" r="3.6" fill="#fff" />
              <circle cx="119.2" cy="97.2" r="1.5" fill="#fff" />
            </g>
            <path id="lidR" d="M106 92a15 15 0 0 1 30 0z" fill="#FBF1DC" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" opacity="0" />
          </g>
          <g id="cheeks" opacity="0.75">
            <ellipse cx="70" cy="112" rx="6" ry="4" fill="#E8836A" />
            <ellipse cx="130" cy="112" rx="6" ry="4" fill="#E8836A" />
          </g>
          <g id="mouth">
            <path className="sulwe-smile" d="M92 113q8 8 16 0" fill="none" stroke="#3A2418" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
            <path className="sulwe-yawn-mouth" d="M94 110q6 16 12 0" fill="#3A2418" opacity="0" />
          </g>
        </g>
        <g id="armL">
          <path d="M80 155q-12 4 -12 18" fill="none" stroke="#3A2418" strokeWidth="12" strokeLinecap="round" />
          <path d="M80 155q-12 4 -12 18" fill="none" stroke="#C2562E" strokeWidth="5" strokeLinecap="round" />
          <circle cx="68" cy="175" r="7" fill="#E9B85C" stroke="#3A2418" strokeWidth="5" />
        </g>
        <g id="armR">
          <path d="M120 155q12 4 12 18" fill="none" stroke="#3A2418" strokeWidth="12" strokeLinecap="round" />
          <path d="M120 155q12 4 12 18" fill="none" stroke="#C2562E" strokeWidth="5" strokeLinecap="round" />
          <circle cx="132" cy="175" r="7" fill="#E9B85C" stroke="#3A2418" strokeWidth="5" />
        </g>
      </g>
    </svg>
  );
}

/** The tiny star he shrinks into. */
export function SulweStar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <polygon points="12,1.5 14.2,8 21,8.7 15.8,13.2 17.4,20 12,16.4 6.6,20 8.2,13.2 3,8.7 9.8,8" fill="#C8881A" stroke="#3A2418" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/** A small fairy wand pointing right, pivot at the left end. The tip matches his gold antenna star. */
export function SulweWandArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 24" className={className} aria-hidden="true">
      <path d="M3 12H31" stroke="#3A2418" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M3 12H31" stroke="#FBF1DC" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="35" cy="12" r="9" fill="#E9B85C" opacity=".45" />
      <polygon
        points="35,3.5 37.3,8.8 43,9.4 38.7,13.2 40,18.8 35,15.9 30,18.8 31.3,13.2 27,9.4 32.7,8.8"
        fill="#C8881A"
        stroke="#3A2418"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** One four-point sparkle with a soft glow baked in (no CSS filter, so it stays cheap to animate). */
export function SulweSparkArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#FBF1DC" opacity=".35" />
      <circle cx="10" cy="10" r="5" fill="#E9B85C" opacity=".55" />
      <path d="M10 1 11.9 8.1 19 10 11.9 11.9 10 19 8.1 11.9 1 10 8.1 8.1Z" fill="#FFF6DD" stroke="#C8881A" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}
