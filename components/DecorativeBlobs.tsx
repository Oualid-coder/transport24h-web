import type { CSSProperties } from "react"

interface BlobConfig {
  /** Tailwind background color class, e.g. "bg-green-light" */
  colorClass: string
  /** CSS clamp() string for both width and height, e.g. "clamp(120px, 35vw, 520px)" */
  size: string
  /** Absolute positioning values — prefer clamp() or % over fixed px */
  position: Pick<CSSProperties, "top" | "right" | "bottom" | "left">
  opacity?: number
}

interface DecorativeBlobsProps {
  blobs: BlobConfig[]
}

/**
 * Decorative background circles.
 *
 * Safety guarantee: every blob is rendered at z-index: -1 within the nearest
 * isolate stacking context. Place `isolate` on the parent section so blobs
 * stay behind all content without escaping to the page stacking context.
 *
 * Usage:
 *   <section className="relative isolate overflow-hidden">
 *     <DecorativeBlobs blobs={[...]} />
 *     <div>content — always above blobs regardless of size</div>
 *   </section>
 */
export function DecorativeBlobs({ blobs }: DecorativeBlobsProps) {
  return (
    <>
      {blobs.map((blob, index) => (
        <div
          key={index}
          aria-hidden="true"
          className={`-z-10 pointer-events-none absolute rounded-full ${blob.colorClass}`}
          style={{
            width: blob.size,
            height: blob.size,
            opacity: blob.opacity,
            ...blob.position,
          }}
        />
      ))}
    </>
  )
}
