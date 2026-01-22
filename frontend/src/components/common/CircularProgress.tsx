/**
 * Custom CircularProgress component using native CSS animation
 * to ensure consistent spinning behavior across all machines
 */
import { Box, SxProps, Theme } from "@mui/material";

interface CircularProgressProps {
  size?: number;
  color?:
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning"
    | "inherit";
  thickness?: number;
  value?: number;
  variant?: "determinate" | "indeterminate";
  sx?: SxProps<Theme>;
  className?: string;
}

const colorMap = {
  primary: "#1976d2",
  secondary: "#9c27b0",
  error: "#d32f2f",
  info: "#0288d1",
  success: "#2e7d32",
  warning: "#ed6c02",
  inherit: "currentColor",
};

export const CircularProgress = ({
  size = 40,
  color = "primary",
  thickness = 3.6,
  value,
  variant = "indeterminate",
  sx,
  className,
}: CircularProgressProps) => {
  const strokeColor = colorMap[color];
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset =
    variant === "determinate" && value !== undefined
      ? circumference - (value / 100) * circumference
      : circumference * 0.75;

  return (
    <Box
      className={className}
      sx={{
        width: size,
        height: size,
        display: "inline-block",
        position: "relative",
        ...sx,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{
          display: "block",
          animation:
            variant === "indeterminate"
              ? "mui-circular-rotate 1.4s linear infinite"
              : undefined,
        }}
      >
        <style>{`
          @keyframes mui-circular-rotate {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
          @keyframes mui-circular-dash {
            0% {
              stroke-dasharray: ${circumference};
              stroke-dashoffset: ${circumference * 0.75};
            }
            50% {
              stroke-dasharray: ${circumference};
              stroke-dashoffset: ${circumference * 0.25};
            }
            100% {
              stroke-dasharray: ${circumference};
              stroke-dashoffset: ${circumference * 0.75};
            }
          }
        `}</style>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill='none'
          stroke={strokeColor}
          strokeWidth={thickness}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap='round'
          style={
            variant === "indeterminate"
              ? {
                  animation: "mui-circular-dash 1.4s ease-in-out infinite",
                }
              : undefined
          }
        />
      </svg>
    </Box>
  );
};

export default CircularProgress;
