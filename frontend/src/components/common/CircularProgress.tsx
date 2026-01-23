/**
 * CircularProgress component wrapper for Material-UI CircularProgress.
 *
 * This is a thin wrapper around Material-UI's CircularProgress component
 * to ensure consistent API and browser compatibility.
 */
import {
  CircularProgress as MuiCircularProgress,
  SxProps,
  Theme,
} from "@mui/material";

interface CircularProgressProps {
  readonly size?: number;
  readonly color?:
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning"
    | "inherit";
  readonly thickness?: number;
  readonly value?: number;
  readonly variant?: "determinate" | "indeterminate";
  readonly sx?: SxProps<Theme>;
  readonly className?: string;
}

/**
 * CircularProgress component using Material-UI's implementation.
 *
 * This wrapper ensures consistent API while leveraging Material-UI's
 * well-tested and visually polished CircularProgress component.
 */
export function CircularProgress({
  size = 40,
  color = "primary",
  thickness,
  value,
  variant = "indeterminate",
  sx,
  className,
}: CircularProgressProps): JSX.Element {
  return (
    <MuiCircularProgress
      size={size}
      color={color}
      thickness={thickness}
      value={value}
      variant={variant}
      sx={sx}
      className={className}
    />
  );
}

export default CircularProgress;
