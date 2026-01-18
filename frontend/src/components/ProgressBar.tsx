/**
 * ProgressBar component for displaying learning progress.
 *
 * This component shows the current step progress and curriculum information.
 */

import React from 'react';
import {Box, LinearProgress, Stack, Typography} from '@mui/material';
import {SocraticStep} from '../types';

/**
 * Props for ProgressBar component.
 */
export interface ProgressBarProps {
  readonly currentStep: number;
  readonly curriculum: readonly SocraticStep[];
}

/**
 * ProgressBar component for displaying learning progress.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProgressBar(props: ProgressBarProps): JSX.Element {
  const {currentStep, curriculum} = props;

  if (curriculum.length === 0) {
    return <></>;
  }

  const progressPercentage = Math.min(
    (currentStep / curriculum.length) * 100,
    100,
  );

  const activeStep = curriculum[currentStep];

  return (
    <Box sx={{mt: 2}}>
      <Stack direction="row" justifyContent="space-between" sx={{mb: 1}}>
        <Typography variant="caption" color="text.secondary">
          学习进度
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {currentStep} / {curriculum.length}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={progressPercentage}
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: 'var(--color-surface-muted)',
          '& .MuiLinearProgress-bar': {
            borderRadius: 3,
            bgcolor: 'var(--color-primary)',
          },
        }}
      />
      <Box sx={{mt: 1}}>
        {currentStep < curriculum.length ? (
          <>
            <Typography variant="caption" sx={{fontWeight: 600}}>
              当前步骤: {activeStep?.step_title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{display: 'block', mt: 0.5}}>
              学习目标: {activeStep?.learning_objective}
            </Typography>
          </>
        ) : (
          <Typography variant="caption" color="text.secondary">
            学习流程已完成。
          </Typography>
        )}
      </Box>
    </Box>
  );
}



