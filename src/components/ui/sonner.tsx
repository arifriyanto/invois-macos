"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-400" />,
        info: <InfoIcon className="size-4 text-blue-400" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-400" />,
        error: <OctagonXIcon className="size-4 text-red-400" />,
        loading: <Loader2Icon className="size-4 animate-spin text-slate-300" />,
      }}
      style={
        {
          // Fixed navy toasts (palette-independent), white text, colored icon.
          "--normal-bg": "#1a1a2e",
          "--normal-text": "#ffffff",
          "--normal-border": "color-mix(in srgb, #ffffff 14%, #1a1a2e)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
