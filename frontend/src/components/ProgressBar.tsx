/**
 * ProgressBar component for displaying learning progress.
 *
 * This component shows the current step progress and curriculum information.
 */

import React from 'react';
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

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
        <span>学习进度</span>
        <span>
          {currentStep} / {curriculum.length}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
          style={{width: `${progressPercentage}%`}}
        ></div>
      </div>
      <div className="mt-2 text-xs text-gray-500">
        {currentStep < curriculum.length ? (
          <div>
            <div className="font-medium">
              当前步骤: {curriculum[currentStep]?.step_title}
            </div>
            <div className="mt-1 text-gray-400">
              学习目标: {curriculum[currentStep]?.learning_objective}
            </div>
          </div>
        ) : (
          <span>🎉 恭喜！您已完成所有学习步骤</span>
        )}
      </div>
    </div>
  );
}


