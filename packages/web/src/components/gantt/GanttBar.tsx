import { useState } from 'react'

interface GanttBarProps {
  x: number
  y: number
  width: number
  color: string
  title: string
  height?: number
}

export function GanttBar({ x, y, width, color, title, height = 24 }: GanttBarProps) {
  const [hovered, setHovered] = useState(false)
  const showLabel = width > 60

  return (
    <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <rect
        x={x}
        y={y}
        width={Math.max(width, 4)}
        height={height}
        rx={2}
        ry={2}
        fill={color}
        opacity={0.85}
        className="transition-opacity"
        style={{ opacity: hovered ? 1 : 0.85 }}
      />
      {showLabel && (
        <text
          x={x + 6}
          y={y + height / 2 + 1}
          dominantBaseline="middle"
          className="text-[10px] font-medium"
          fill="white"
        >
          {title.length > Math.floor(width / 7) ? title.slice(0, Math.floor(width / 7) - 1) + '...' : title}
        </text>
      )}
      {hovered && !showLabel && (
        <g>
          <rect
            x={x + width + 4}
            y={y}
            width={title.length * 6.5 + 12}
            height={height}
            rx={3}
            fill="var(--color-ink)"
            opacity={0.9}
          />
          <text
            x={x + width + 10}
            y={y + height / 2 + 1}
            dominantBaseline="middle"
            className="text-[10px]"
            fill="white"
          >
            {title}
          </text>
        </g>
      )}
    </g>
  )
}
