import Image from "next/image";

const AVATAR_PALETTE = [
  "color-mix(in srgb, var(--primary) 18%, var(--card))",
  "color-mix(in srgb, var(--success) 18%, var(--card))",
  "color-mix(in srgb, var(--destructive) 14%, var(--card))",
  "color-mix(in srgb, var(--muted-foreground) 20%, var(--card))",
  "color-mix(in srgb, var(--chart-3) 16%, var(--card))",
] as const;

function avatarBg(fullName: string): string {
  const sum = Array.from(fullName).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

function initials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type AvatarSize = "sm" | "md" | "lg";

const AVATAR_SIZE_CLASS: Record<AvatarSize, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-10 w-10 text-[12px]",
  lg: "h-12 w-12 text-[14px]",
};

type PostAvatarProps = {
  fullName: string;
  avatarUrl: string | null;
  size?: AvatarSize;
};

export function PostAvatar({ fullName, avatarUrl, size = "md" }: PostAvatarProps) {
  const sizeClass = AVATAR_SIZE_CLASS[size];

  if (avatarUrl) {
    return (
      <span className={`relative shrink-0 overflow-hidden rounded-full ${sizeClass}`}>
        <Image src={avatarUrl} alt="" fill className="object-cover" sizes="48px" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-bold text-[var(--foreground)] ${sizeClass}`}
      style={{ background: avatarBg(fullName) }}
    >
      {initials(fullName)}
    </span>
  );
}

export function ImageFallback() {
  return (
    <div aria-hidden className="relative h-full w-full bg-[var(--muted)]">
      <svg
        viewBox="0 0 200 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full text-[var(--muted-foreground)]"
        aria-hidden
      >
        <path
          d="M -10 90 C 50 10 130 110 210 30"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeOpacity="0.18"
          fill="none"
        />
      </svg>
    </div>
  );
}
