/**
 * ProgressBar component for displaying learning progress.
 *
 * This component shows the current step progress and curriculum information.
 */

import React from "react";
import { Box, LinearProgress, Stack, Tooltip, Typography } from "@mui/material";
import { SocraticStep } from "../types";
import TaskAltIcon from "@mui/icons-material/TaskAlt";

/**
 * Props for ProgressBar component.
 */
export interface ProgressBarProps {
  readonly currentStep: number;
  readonly curriculum: readonly SocraticStep[];
  readonly isLoading?: boolean;
}

/**
 * ProgressBar component for displaying learning progress.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProgressBar(props: ProgressBarProps): JSX.Element {
  const { currentStep, curriculum, isLoading = false } = props;

  if (curriculum.length === 0) {
    return (
      <Box sx={{ mt: 2 }}>
        <Stack direction='row' justifyContent='space-between' sx={{ mb: 1 }}>
          <Typography variant='caption' color='text.secondary'>
            学习进度
          </Typography>
          <Typography variant='caption' color='text.secondary'>
            {isLoading ? "加载中..." : "暂无课程"}
          </Typography>
        </Stack>
        <LinearProgress
          variant={isLoading ? "indeterminate" : "determinate"}
          value={isLoading ? undefined : 0}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: "var(--color-surface-muted)",
            "& .MuiLinearProgress-bar": {
              borderRadius: 3,
              bgcolor: "var(--color-primary)",
            },
          }}
        />
      </Box>
    );
  }

  const totalSteps = curriculum.length;
  const isFinished = currentStep >= totalSteps;
  const activeIndex = Math.min(currentStep, totalSteps - 1);
  const progressPercentage =
    totalSteps <= 1
      ? 100
      : (Math.min(currentStep, totalSteps - 1) / (totalSteps - 1)) * 100;

  const activeStep = curriculum[activeIndex];

  return (
    <Box sx={{ mt: 2 }}>
      <Stack direction='row' justifyContent='space-between' sx={{ mb: 1 }}>
        <Typography variant='caption' color='text.secondary'>
          学习进度
        </Typography>
        <Typography variant='caption' color='text.secondary'>
          {currentStep} / {curriculum.length}
        </Typography>
      </Stack>
      <Box
        sx={{
          position: "relative",
          height: 18,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          "&::before": {
            content: '""',
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 999,
            bgcolor: "var(--color-surface-muted)",
            transform: "translateY(-50%)",
          },
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: `${progressPercentage}%`,
            height: 4,
            borderRadius: 999,
            bgcolor: "var(--color-primary)",
            transform: "translateY(-50%)",
            transition: "width 0.2s ease",
          }}
        />
        {curriculum.map((step, index) => {
          const isComplete = isFinished || index < currentStep;
          const isActive = index === currentStep && !isFinished;
          const dotColor = isActive
            ? "primary.main"
            : isComplete
              ? "primary.main"
              : "divider";

          return (
            <Tooltip
              key={`${step.step_title}-${index}`}
              title={
                <Stack spacing={0.5}>
                  <Typography sx={{ fontWeight: 600 }}>
                    <TaskAltIcon fontSize='small' sx={{ mr: 0.5 }} />
                    {step.step_title}
                  </Typography>
                  <Typography variant='caption'>
                    学习目标: {step.learning_objective}
                  </Typography>
                </Stack>
              }
              slotProps={{
                tooltip: {
                  sx: {
                    maxWidth: "30vw",
                  },
                },
              }}
              arrow
            >
              <Box
                component='span'
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  bgcolor: dotColor,
                  border: isActive ? "2px solid var(--color-primary)" : "none",
                  zIndex: 1,
                  transition: "transform 0.2s ease",
                  "&:hover": { transform: "scale(1.1)" },
                }}
              />
            </Tooltip>
          );
        })}
      </Box>
      <Box sx={{ mt: 1 }}>
        {currentStep < curriculum.length ? (
          <>
            <Typography variant='caption' sx={{ fontWeight: 600 }}>
              当前步骤: {activeStep?.step_title}
            </Typography>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ display: "block", mt: 0.5 }}
            >
              学习目标: {activeStep?.learning_objective}
            </Typography>
          </>
        ) : (
          <Typography variant='caption' color='text.secondary'>
            学习流程已完成。
          </Typography>
        )}
      </Box>
    </Box>
  );
}
