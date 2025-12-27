/**
 * Utility functions for curriculum data manipulation.
 *
 * This module provides helper functions for working with curriculum
 * data structures.
 */

import {CurriculumData, SocraticStep, SocraticCurriculum} from '../types';

/**
 * Safely extracts curriculum steps from curriculum data.
 *
 * Handles both array format and object format with root field.
 *
 * @param curriculum - The curriculum data (array or object)
 * @returns Array of Socratic steps
 */
export function extractCurriculumSteps(
  curriculum: CurriculumData,
): readonly SocraticStep[] {
  if (Array.isArray(curriculum)) {
    return curriculum;
  }
  if (curriculum && typeof curriculum === 'object' && 'root' in curriculum) {
    return (curriculum as SocraticCurriculum).root;
  }
  return [];
}




