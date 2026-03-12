import { useState } from "react"

interface DeviceImagePreviewProps {
  frontImageUrl: string | null
  rearImageUrl: string | null
  face?: "front" | "rear"
  deviceName: string
}

export function DeviceImagePreview({
  frontImageUrl,
  rearImageUrl,
  face = "front",
  deviceName,
}: DeviceImagePreviewProps) {
  const [activeFace, setActiveFace] = useState<"front" | "rear">(face)
  const [error, setError] = useState<Record<string, boolean>>({})

  const hasFront = frontImageUrl && !error[frontImageUrl]
  const hasRear = rearImageUrl && !error[rearImageUrl]

  if (!hasFront && !hasRear) return null

  const activeUrl = activeFace === "front" ? frontImageUrl : rearImageUrl
  const showToggle = hasFront && hasRear

  return (
    <div className="space-y-1.5">
      {showToggle && (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActiveFace("front")}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              activeFace === "front"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setActiveFace("rear")}
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
              activeFace === "rear"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Rear
          </button>
        </div>
      )}

      {activeUrl && !error[activeUrl] && (
        <div className="rounded-md border border-border bg-background/50 p-1.5 flex items-center justify-center">
          <img
            src={activeUrl}
            alt={`${deviceName} ${activeFace} view`}
            className="max-w-[200px] max-h-[120px] object-contain"
            loading="lazy"
            onError={() => setError((prev) => ({ ...prev, [activeUrl]: true }))}
          />
        </div>
      )}
    </div>
  )
}
