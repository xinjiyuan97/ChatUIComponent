import type { SVGProps } from 'react'

/**
 * Hand-rolled icon set.
 *
 * A dependency-free set keeps stroke weight, cap style and optical size consistent with
 * the rest of the design language — mixing an icon pack in is the fastest way to make a
 * minimal interface look assembled from parts. All glyphs share a 24px grid and a 1.5px
 * stroke so they align optically with 15px text at 16px rendered size.
 */
export type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Icon({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5.5 15H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v.5" />
  </Icon>
)

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Icon>
)

export const RegenerateIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20 11a8 8 0 0 0-14.1-5.1L3 9" />
    <path d="M4 13a8 8 0 0 0 14.1 5.1L21 15" />
    <path d="M3 4.5V9h4.5M21 19.5V15h-4.5" />
  </Icon>
)

export const ThumbUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 10.5 11 3a2.2 2.2 0 0 1 2.2 2.2V9h4.6a2 2 0 0 1 2 2.4l-1.3 6A2 2 0 0 1 16.5 19H7" />
    <rect x="3" y="10.5" width="4" height="8.5" rx="1.2" />
  </Icon>
)

export const ThumbDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 13.5 11 21a2.2 2.2 0 0 0 2.2-2.2V15h4.6a2 2 0 0 0 2-2.4l-1.3-6A2 2 0 0 0 16.5 5H7" />
    <rect x="3" y="5" width="4" height="8.5" rx="1.2" />
  </Icon>
)

export const EditIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 6 3 3" />
  </Icon>
)

export const TrashIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h16M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M6.5 7 7 18.5A1.5 1.5 0 0 0 8.5 20h7a1.5 1.5 0 0 0 1.5-1.5L17.5 7" />
  </Icon>
)

export const ShareIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M12 3 8 7M12 3l4 4" />
    <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
  </Icon>
)

export const ChevronDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 9.5 6 6 6-6" />
  </Icon>
)

export const ChevronRightIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9.5 6 6 6-6 6" />
  </Icon>
)

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 4.5v15M12 19.5 6 13.5M12 19.5l6-6" />
  </Icon>
)

export const ArrowUpIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 19.5v-15M12 4.5 6 10.5M12 4.5l6 6" />
  </Icon>
)

export const StopIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="7" y="7" width="10" height="10" rx="1.8" fill="currentColor" stroke="none" />
  </Icon>
)

export const PaperclipIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M19 11.5 12 18.5a4.6 4.6 0 0 1-6.5-6.5l7.6-7.6a3.1 3.1 0 0 1 4.4 4.4L9.8 16.4a1.6 1.6 0 0 1-2.2-2.2l6.9-6.9" />
  </Icon>
)

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Icon>
)

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const MoreIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none" />
  </Icon>
)

export const ThinkingIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.5a4.2 4.2 0 0 0-4.1 3.3A3.6 3.6 0 0 0 6.4 13a3.9 3.9 0 0 0 2.2 5.4 3.4 3.4 0 0 0 6.8 0A3.9 3.9 0 0 0 17.6 13a3.6 3.6 0 0 0-1.5-6.2A4.2 4.2 0 0 0 12 3.5Z" />
    <path d="M12 8v9" />
  </Icon>
)

export const ToolIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14.5 3.8a4.7 4.7 0 0 0-5.6 6l-5 5a1.9 1.9 0 0 0 2.7 2.7l5-5a4.7 4.7 0 0 0 6-5.6L15 9.5 12.9 8l-.8-3.4Z" />
  </Icon>
)

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10.6 4.3 2.9 17.5A1.6 1.6 0 0 0 4.3 20h15.4a1.6 1.6 0 0 0 1.4-2.5L13.4 4.3a1.6 1.6 0 0 0-2.8 0Z" />
    <path d="M12 9.5v4M12 16.8v.01" />
  </Icon>
)

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
)

export const PinIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 3.5h6l-.8 5 3.3 3.2H6.5L9.8 8.5 9 3.5Z" />
    <path d="M12 11.7V20.5" />
  </Icon>
)

export const SidebarIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
    <path d="M9.5 4.5v15" />
  </Icon>
)

export const SpinnerIcon = ({ size = 16, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth={1.8} opacity={0.22} />
    <path
      d="M20.5 12A8.5 8.5 0 0 0 12 3.5"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  </svg>
)

export const ExternalLinkIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M14 4h6v6M20 4l-8.5 8.5" />
    <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
  </Icon>
)

export const FileIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5l-5-5Z" />
    <path d="M13.5 3.5v5h5" />
  </Icon>
)

export const SendIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4.5 12h13M12 5.5l6 6.5-6 6.5" />
  </Icon>
)

export const WrapIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 6h16M4 18h7" />
    <path d="M4 12h13a3 3 0 0 1 0 6h-2.5M14 15l-2 3 2 3" transform="translate(0 -3)" />
  </Icon>
)

export const MicIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="9" y="2.75" width="6" height="11.5" rx="3" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.25" />
  </Icon>
)

export const ImageIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <circle cx="9" cy="9.75" r="1.35" />
    <path d="m4.5 16.5 4.2-4.2a1.6 1.6 0 0 1 2.3 0l4.3 4.3M14 14.6l1.6-1.6a1.6 1.6 0 0 1 2.3 0l1.6 1.6" />
  </Icon>
)

/** An image that could not be loaded. The slash carries the meaning without adding colour. */
export const ImageOffIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
    <path d="m4.5 16.5 4.2-4.2a1.6 1.6 0 0 1 2.3 0l2 2" />
    <path d="M4 20 20 4" />
  </Icon>
)

export const UploadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 16.5V4M7.5 8.5 12 4l4.5 4.5" />
    <path d="M4.5 15v3.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />
  </Icon>
)

/** Fallback glyph for an agent with no `avatar` and no usable initial. */
export const AgentIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="4" y="7.5" width="16" height="12" rx="3" />
    <path d="M12 4v3.5" />
    <circle cx="9.5" cy="13" r="1.15" />
    <circle cx="14.5" cy="13" r="1.15" />
  </Icon>
)

/**
 * Filled on purpose — the only solid glyph in the set.
 *
 * Every other icon here is a 1.5px outline, and a "run" button that looks exactly like
 * "copy" and "wrap" is the one place in a code block where a misclick actually costs
 * something.
 */
export const PlayIcon = ({ size = 16, className, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
    className={className}
    {...rest}
  >
    <path d="M8 5.6a1 1 0 0 1 1.52-.85l9 6.4a1 1 0 0 1 0 1.7l-9 6.4A1 1 0 0 1 8 18.4z" />
  </svg>
)

/** Marks a rendered Mermaid diagram and its "back to the source" toggle. */
export const DiagramIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="8.5" y="3.5" width="7" height="5" rx="1.5" />
    <rect x="3" y="15.5" width="7" height="5" rx="1.5" />
    <rect x="14" y="15.5" width="7" height="5" rx="1.5" />
    <path d="M12 8.5v3.5M6.5 15.5V12h11v3.5" />
  </Icon>
)

/** Marks a pending approval. The one glyph in the set that means "stop and read". */
export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3.2 4.8 6v6.1c0 4 3 7.2 7.2 8.7 4.2-1.5 7.2-4.7 7.2-8.7V6L12 3.2Z" />
  </Icon>
)

/** Read-back glyph for a denied request; the mirror of `CheckIcon`. */
export const BanIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </Icon>
)

/** Header of a todo block. */
export const ListChecksIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3 6.5 4.5 8l3-3M3 17.5 4.5 19l3-3" />
    <path d="M11 6.5h10M11 17.5h10" />
  </Icon>
)

/**
 * Todo row status: not started, and started.
 *
 * A hollow ring versus a ring with a filled core — the difference is legible at 13px and,
 * unlike a colour change, survives being printed or read without colour vision.
 */
export const CircleIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="7.5" />
  </Icon>
)

export const CircleDotIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none" />
  </Icon>
)

/**
 * Callout glyphs.
 *
 * One per GitHub alert level. They differ in *silhouette*, not just in colour — a circle,
 * a bulb, a bubble, a triangle and an octagon are told apart at a glance and, more to the
 * point, without colour vision.
 */
export const InfoIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.5M12 7.8v.01" />
  </Icon>
)

export const LightbulbIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 17a6 6 0 1 1 6 0v1.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 18.5V17Z" />
    <path d="M9.5 17h5" />
  </Icon>
)

export const ImportantIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M20.5 14.5a2 2 0 0 1-2 2H9l-4.5 3.5v-3.5h-1a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h15a2 2 0 0 1 2 2Z" />
    <path d="M11.75 6.5v4.2M11.75 13.4v.01" />
  </Icon>
)

export const OctagonAlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8.4 3.5h7.2l5.1 5.1v7.2l-5.1 5.1H8.4l-5.1-5.1V8.6Z" />
    <path d="M12 8v5M12 16.2v.01" />
  </Icon>
)

/** Blockquote marker, and the "quote this reply" action. */
export const QuoteIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M10 6.5C7 7.6 5.5 10 5.5 13.2c0 2.4 1.3 4.3 3.4 4.3 1.8 0 3.1-1.3 3.1-3.1 0-1.7-1.2-2.9-2.8-2.9-.3 0-.6 0-.8.1.4-1.6 1.5-2.8 3.1-3.5Z" />
    <path d="M19 6.5c-3 1.1-4.5 3.5-4.5 6.7 0 2.4 1.3 4.3 3.4 4.3 1.8 0 3.1-1.3 3.1-3.1 0-1.7-1.2-2.9-2.8-2.9-.3 0-.6 0-.8.1.4-1.6 1.5-2.8 3.1-3.5Z" />
  </Icon>
)
