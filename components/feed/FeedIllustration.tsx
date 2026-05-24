type Props = {
  variant?: "default" | "error";
  className?: string;
};

export function FeedIllustration({ variant = "default", className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 100 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {variant === "default" ? (
        /* Smooth curved trail — forward momentum */
        <path
          d="M 13 31 C 8 28 5 22 3 16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          strokeLinecap="round"
          opacity="0.4"
        />
      ) : (
        /* Turbulent/broken trail — disruption */
        <path
          d="M 13 31 Q 10 37 8 32 Q 6 27 4 31 Q 2 35 2 28"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
        />
      )}

      {/* Upper wing */}
      <path
        d="M 14 6 L 94 32 L 56 42 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />

      {/* Lower body */}
      <path
        d="M 14 58 L 94 32 L 56 42 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.04"
      />

      {/* Center crease */}
      <line
        x1="14"
        y1="32"
        x2="56"
        y2="42"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.45"
      />
    </svg>
  );
}
