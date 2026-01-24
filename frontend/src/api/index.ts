/**
 * API module exports.
 *
 * This module re-exports all API services for convenient importing.
 */

export * from './client';
export * from './profiles';
export * from './customSkills';
export {
  uploadLabManual,
  generateProfile,
  listLabManuals,
  getLabManualContent,
  deleteLabManual,
  renameProfile,
  deleteProfile,
  getPersona,
  savePersona,
  getCurriculum,
  saveCurriculum,
  generatePersona,
  generateCurriculum,
  generateProfileFromLab,
  type UploadLabManualRequest,
  type UploadLabManualResponse,
  type GenerateProfileRequest,
  type RenameProfileRequest,
  type LabManualInfo,
  type LabManualContent,
  type TutorPersona,
  type SocraticStep,
  type SocraticCurriculum,
} from './profiles';
export * from './sessions';
export * from './tutor';
export * from './health';
export * from './auth';
export * from './classes';
export * from './settings';
