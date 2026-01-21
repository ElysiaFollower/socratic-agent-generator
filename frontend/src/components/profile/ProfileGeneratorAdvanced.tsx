/**
 * Advanced profile generator component.
 *
 * This component provides a UI for generating tutor profiles from lab manuals,
 * following the workflow in main.py: select lab -> generate/edit persona &
 * curriculum -> generate profile.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import {
  ArrowBack,
  CheckCircle,
  ChevronRight,
  ErrorOutline,
  MenuBook,
  PersonOutline,
} from "@mui/icons-material";
import {
  listLabManuals,
  getPersona,
  savePersona,
  getCurriculum,
  saveCurriculum,
  generatePersona,
  generateCurriculum,
  generateProfileFromLab,
  type LabManualInfo,
  type TutorPersona,
  type SocraticCurriculum,
} from "../../api";
import { Profile } from "../../types";
import { useNotification } from "../../hooks";

/**
 * Props for ProfileGeneratorAdvanced component.
 */
interface ProfileGeneratorAdvancedProps {
  readonly onGenerateSuccess?: (profile: Profile) => void;
  readonly onClose?: () => void;
  readonly variant?: "panel" | "dialog";
}

type Step = "select" | "generate" | "finalize";

const DEFAULT_SPLIT_RATIO = 2 / 5;
const MIN_SPLIT_RATIO = 0.25;
const MAX_SPLIT_RATIO = 0.75;

/**
 * Advanced profile generator component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileGeneratorAdvanced(
  props: ProfileGeneratorAdvancedProps,
): JSX.Element {
  const { t } = useTranslation();
  const { onGenerateSuccess, onClose, variant = "panel" } = props;
  const { notifyError, notifySuccess, notifyWarning } = useNotification();
  const [currentStep, setCurrentStep] = useState<Step>("select");
  const [labManuals, setLabManuals] = useState<readonly LabManualInfo[]>([]);
  const [isLoadingManuals, setIsLoadingManuals] = useState<boolean>(true);
  const [selectedLab, setSelectedLab] = useState<string | null>(null);
  const [persona, setPersona] = useState<TutorPersona | null>(null);
  const [curriculum, setCurriculum] = useState<SocraticCurriculum | null>(null);
  const [profileName, setProfileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [personaStatus, setPersonaStatus] = useState<
    "idle" | "generating" | "generated" | "error"
  >("idle");
  const [curriculumStatus, setCurriculumStatus] = useState<
    "idle" | "generating" | "generated" | "error"
  >("idle");
  const [personaError, setPersonaError] = useState<string | null>(null);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);
  const [isGeneratingProfile, setIsGeneratingProfile] =
    useState<boolean>(false);
  const [splitRatio, setSplitRatio] = useState<number>(DEFAULT_SPLIT_RATIO);
  const [isResizingSplit, setIsResizingSplit] = useState<boolean>(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  /**
   * Loads lab manuals list.
   */
  const loadLabManuals = useCallback(async () => {
    setIsLoadingManuals(true);
    setError(null);
    try {
      const manuals = await listLabManuals();
      setLabManuals(manuals);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("labManual.loadFailed");
      setError(errorMessage);
    } finally {
      setIsLoadingManuals(false);
    }
  }, []);

  useEffect(() => {
    void loadLabManuals();
  }, [loadLabManuals]);

  useEffect(() => {
    if (!error) {
      return;
    }
    notifyError(error);
    setError(null);
  }, [error, notifyError]);

  useEffect(() => {
    if (!personaError) {
      return;
    }
    notifyError(personaError);
    setPersonaError(null);
  }, [personaError, notifyError]);

  useEffect(() => {
    if (!curriculumError) {
      return;
    }
    notifyError(curriculumError);
    setCurriculumError(null);
  }, [curriculumError, notifyError]);

  useEffect(() => {
    if (!isResizingSplit) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!splitContainerRef.current) {
        return;
      }
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (!rect.width) {
        return;
      }
      const nextRatio = (event.clientX - rect.left) / rect.width;
      const clamped = Math.min(
        MAX_SPLIT_RATIO,
        Math.max(MIN_SPLIT_RATIO, nextRatio),
      );
      setSplitRatio(clamped);
    };

    const handleMouseUp = () => {
      setIsResizingSplit(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizingSplit]);

  /**
   * Handles lab selection.
   */
  const handleSelectLab = async (labName: string) => {
    setSelectedLab(labName);
    setError(null);
    setPersonaStatus("idle");
    setCurriculumStatus("idle");
    setPersonaError(null);
    setCurriculumError(null);
    setPersona(null);
    setCurriculum(null);

    setIsLoading(true);
    try {
      // Try to load existing persona and curriculum regardless of labInfo status
      // to be more robust against stale labManuals state
      const [personaRes, curriculumRes] = await Promise.allSettled([
        getPersona(labName),
        getCurriculum(labName),
      ]);

      if (personaRes.status === "fulfilled") {
        setPersona(personaRes.value);
        setPersonaStatus("generated");
      }

      if (curriculumRes.status === "fulfilled") {
        const normalized = normalizeCurriculum(curriculumRes.value);
        if (normalized) {
          setCurriculum(normalized);
          setCurriculumStatus("generated");
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("profile.loadLabFailed");
      notifyWarning(errorMessage);
    } finally {
      setIsLoading(false);
    }

    setCurrentStep("generate");
  };

  /**
   * Handles persona generation.
   */
  const handleGeneratePersona = async () => {
    if (!selectedLab) {
      return;
    }

    setPersonaStatus("generating");
    setPersonaError(null);
    setError(null);

    try {
      const generated = await generatePersona(selectedLab);
      setPersona(generated);
      setPersonaStatus("generated");
      void loadLabManuals();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("profile.generatePersonaFailed");
      setPersonaError(errorMessage);
      setPersonaStatus("error");
    }
  };

  /**
   * Handles persona save.
   */
  const handleSavePersona = async () => {
    if (!selectedLab || !persona) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await savePersona(selectedLab, persona);
      void loadLabManuals();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("profile.savePersonaFailed");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Normalizes curriculum data format.
   * Handles both {root: [...]} and direct array formats.
   */
  const normalizeCurriculum = (data: any): SocraticCurriculum | null => {
    if (!data) {
      return null;
    }
    if (data.root && Array.isArray(data.root)) {
      return data as SocraticCurriculum;
    }
    if (Array.isArray(data)) {
      return { root: data as any };
    }
    return null;
  };

  /**
   * Handles curriculum generation.
   */
  const handleGenerateCurriculum = async () => {
    if (!selectedLab) {
      return;
    }

    setCurriculumStatus("generating");
    setCurriculumError(null);
    setError(null);

    try {
      const generated = await generateCurriculum(selectedLab);
      const normalized = normalizeCurriculum(generated);
      if (normalized) {
        setCurriculum(normalized);
        setCurriculumStatus("generated");
        void loadLabManuals();
      } else {
        setCurriculumError(t("profile.curriculumFormatError"));
        setCurriculumStatus("error");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("profile.generateCurriculumFailed");
      setCurriculumError(errorMessage);
      setCurriculumStatus("error");
    }
  };

  /**
   * Handles curriculum save.
   */
  const handleSaveCurriculum = async () => {
    if (!selectedLab || !curriculum) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await saveCurriculum(selectedLab, curriculum);
      void loadLabManuals();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("profile.saveCurriculumFailed");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles both persona and curriculum generation in parallel.
   */
  const handleGenerateBoth = async () => {
    if (!selectedLab) {
      return;
    }

    setPersonaStatus("generating");
    setCurriculumStatus("generating");
    setPersonaError(null);
    setCurriculumError(null);
    setError(null);

    const personaPromise = generatePersona(selectedLab)
      .then((generated) => {
        setPersona(generated);
        setPersonaStatus("generated");
        void loadLabManuals();
        return { status: "fulfilled" as const };
      })
      .catch((err) => {
        const errorMessage =
          err instanceof Error
            ? err.message
            : t("profile.generatePersonaFailed");
        setPersonaError(errorMessage);
        setPersonaStatus("error");
        return { status: "rejected" as const, error: errorMessage };
      });

    const curriculumPromise = generateCurriculum(selectedLab)
      .then((generated) => {
        const normalized = normalizeCurriculum(generated);
        if (normalized) {
          setCurriculum(normalized);
          setCurriculumStatus("generated");
          void loadLabManuals();
          return { status: "fulfilled" as const };
        }
        const errorMessage = t("profile.curriculumFormatError");
        setCurriculumError(errorMessage);
        setCurriculumStatus("error");
        return { status: "rejected" as const, error: errorMessage };
      })
      .catch((err) => {
        const errorMessage =
          err instanceof Error
            ? err.message
            : t("profile.generateCurriculumFailed");
        setCurriculumError(errorMessage);
        setCurriculumStatus("error");
        return { status: "rejected" as const, error: errorMessage };
      });

    // Generate both in parallel
    const results = await Promise.all([personaPromise, curriculumPromise]);
    if (results.every((result) => result.status === "rejected")) {
      setError(t("profile.generateBothFailed"));
    }
  };

  const handleSplitMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsResizingSplit(true);
  };

  /**
   * Handles moving to finalize step - save and reload data like main.py.
   */
  const handleFinalize = async () => {
    if (!selectedLab || !persona || !curriculum) {
      setError(t("profile.requirePersonaAndCurriculum"));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Save persona and curriculum first
      await Promise.all([
        savePersona(selectedLab, persona),
        saveCurriculum(selectedLab, curriculum),
      ]);

      // Reload from files (like main.py does)
      const [reloadedPersona, reloadedCurriculum] = await Promise.all([
        getPersona(selectedLab),
        getCurriculum(selectedLab),
      ]);

      setPersona(reloadedPersona);

      const normalized = normalizeCurriculum(reloadedCurriculum);
      if (normalized) {
        setCurriculum(normalized);
        setCurriculumStatus("generated");
      } else {
        notifyWarning(t("profile.curriculumReloadError"));
      }

      void loadLabManuals();
      setCurrentStep("finalize");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("profile.saveOrLoadFailed");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles profile generation.
   */
  const handleGenerateProfile = async () => {
    if (!selectedLab || !persona || !curriculum) {
      setError(t("profile.requirePersonaAndCurriculum"));
      return;
    }

    setIsGeneratingProfile(true);
    setError(null);

    try {
      const profile = await generateProfileFromLab(
        selectedLab,
        profileName.trim() || undefined,
      );
      notifySuccess(
        t("profile.profileGenerated", {
          name: profile.profile_name || profile.topic_name,
        }),
      );
      if (onGenerateSuccess) {
        onGenerateSuccess(profile);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("profile.generateProfileFailed");
      setError(errorMessage);
    } finally {
      setIsGeneratingProfile(false);
    }
  };

  const stepIndexMap: Record<Step, number> = {
    select: 0,
    generate: 1,
    finalize: 2,
  };
  const activeStepIndex = stepIndexMap[currentStep];
  const rootSx = variant === "dialog" ? { p: 3 } : {};

  const renderStatusIndicator = (
    status: "idle" | "generating" | "generated" | "error",
  ) => {
    if (status === "generating") {
      return <CircularProgress size={16} />;
    }
    if (status === "generated") {
      return <CheckCircle fontSize='small' color='success' />;
    }
    if (status === "error") {
      return <ErrorOutline fontSize='small' color='error' />;
    }
    return null;
  };

  const renderLabChip = (label: string, isReady: boolean) => (
    <Chip
      size='small'
      label={label}
      color={isReady ? "success" : "default"}
      variant={isReady ? "filled" : "outlined"}
    />
  );

  return (
    <Stack spacing={3} sx={rootSx}>
      {variant === "dialog" && onClose && (
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={onClose} color='inherit'>
            {t("common.close")}
          </Button>
        </Box>
      )}

      <Stepper activeStep={activeStepIndex} alternativeLabel>
        <Step>
          <StepLabel>{t("profile.stepSelect")}</StepLabel>
        </Step>
        <Step>
          <StepLabel>{t("profile.stepGenerate")}</StepLabel>
        </Step>
        <Step>
          <StepLabel>{t("profile.stepFinalize")}</StepLabel>
        </Step>
      </Stepper>

      {currentStep === "select" && (
        <Stack spacing={2}>
          <Typography variant='h6'>{t("profile.selectLabTitle")}</Typography>
          {isLoadingManuals ? (
            <Stack direction='row' spacing={1} alignItems='center'>
              <CircularProgress size={18} />
              <Typography variant='body2' color='text.secondary'>
                {t("profile.loading")}
              </Typography>
            </Stack>
          ) : labManuals.length === 0 ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                border: "1px dashed var(--color-border)",
                bgcolor: "var(--color-surface-muted)",
              }}
            >
              <Typography variant='body2' color='text.secondary'>
                {t("profile.noLabsHint")}
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {labManuals.map((lab) => (
                <Paper
                  key={lab.lab_name}
                  variant='outlined'
                  sx={{
                    borderRadius: 2,
                    "&:hover": { bgcolor: "var(--color-surface-muted)" },
                  }}
                >
                  <ButtonBase
                    onClick={() => handleSelectLab(lab.lab_name)}
                    sx={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      textAlign: "left",
                      p: 2,
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                        {lab.lab_name}
                      </Typography>
                      <Stack
                        direction='row'
                        spacing={1}
                        sx={{ mt: 1, flexWrap: "wrap" }}
                      >
                        {renderLabChip(
                          `${t("labManual.documentStatus")} ${lab.has_lab_manual ? t("profile.docReady") : t("profile.docNotReady")}`,
                          lab.has_lab_manual,
                        )}
                        {renderLabChip(
                          `Persona ${lab.has_persona ? t("profile.personaReady") : t("profile.personaNotReady")}`,
                          lab.has_persona,
                        )}
                        {renderLabChip(
                          `Curriculum ${lab.has_curriculum ? t("profile.curriculumReady") : t("profile.curriculumNotReady")}`,
                          lab.has_curriculum,
                        )}
                      </Stack>
                    </Box>
                    <ChevronRight fontSize='small' color='action' />
                  </ButtonBase>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {currentStep === "generate" && selectedLab && (
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent='space-between'
          >
            <Typography variant='h6'>
              {t("profile.generateTitle", { labName: selectedLab })}
            </Typography>
            <Button
              onClick={() => {
                setCurrentStep("select");
                setPersona(null);
                setCurriculum(null);
                setPersonaStatus("idle");
                setCurriculumStatus("idle");
              }}
              startIcon={<ArrowBack />}
              color='inherit'
            >
              {t("profile.backToSelect")}
            </Button>
          </Stack>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent='flex-end'
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Button
                onClick={handleGeneratePersona}
                variant='outlined'
                disabled={personaStatus === "generating"}
              >
                {personaStatus === "generating"
                  ? t("profile.generatingPersona")
                  : t("profile.generatePersonaOnly")}
              </Button>
              <Button
                onClick={handleGenerateCurriculum}
                variant='outlined'
                disabled={curriculumStatus === "generating"}
              >
                {curriculumStatus === "generating"
                  ? t("profile.generatingCurriculum")
                  : t("profile.generateCurriculumOnly")}
              </Button>

              <Button
                onClick={handleGenerateBoth}
                variant='contained'
                disabled={
                  personaStatus === "generating" ||
                  curriculumStatus === "generating"
                }
              >
                {personaStatus === "generating" ||
                curriculumStatus === "generating"
                  ? t("profile.generatingBoth")
                  : t("profile.generateBoth")}
              </Button>
            </Stack>
            {persona && curriculum && (
              <Button
                onClick={handleFinalize}
                variant='contained'
                disabled={isLoading}
              >
                {isLoading
                  ? t("profile.savingAndLoading")
                  : t("profile.nextStep")}
              </Button>
            )}
          </Stack>

          <Stack
            ref={splitContainerRef}
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems='stretch'
          >
            <Box
              sx={{
                flex: { xs: "1 1 auto", md: `${splitRatio} 1 0` },
                minWidth: 0,
              }}
            >
              <Paper variant='outlined' sx={{ p: 2, height: "100%" }}>
                <Stack
                  direction='row'
                  alignItems='center'
                  justifyContent='space-between'
                  spacing={2}
                >
                  <Stack direction='row' alignItems='center' spacing={1}>
                    <PersonOutline fontSize='small' color='action' />
                    <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                      {t("profile.personaTitle")}
                    </Typography>
                  </Stack>
                  <Stack direction='row' alignItems='center' spacing={1}>
                    {renderStatusIndicator(personaStatus)}
                    <Button
                      onClick={handleSavePersona}
                      variant='contained'
                      color='success'
                      size='small'
                      disabled={isLoading || !persona}
                    >
                      {isLoading ? t("common.saving") : t("common.save")}
                    </Button>
                  </Stack>
                </Stack>
                <Divider sx={{ my: 2 }} />

                {persona ? (
                  <Stack spacing={2}>
                    <TextField
                      label={t("profile.topicNameLabel")}
                      value={persona.topic_name}
                      onChange={(e) =>
                        setPersona({ ...persona, topic_name: e.target.value })
                      }
                      size='small'
                      fullWidth
                    />
                    <TextField
                      label={t("profile.targetAudienceLabel")}
                      value={persona.target_audience}
                      onChange={(e) =>
                        setPersona({
                          ...persona,
                          target_audience: e.target.value,
                        })
                      }
                      size='small'
                      multiline
                      maxRows={5}
                      fullWidth
                    />
                    <TextField
                      label={t("profile.personaHintsLabel")}
                      value={(persona.persona_hints || []).join("\n")}
                      onChange={(e) =>
                        setPersona({
                          ...persona,
                          persona_hints: e.target.value
                            .split("\n")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                      size='small'
                      fullWidth
                      multiline
                      minRows={3}
                    />
                    <TextField
                      label={t("profile.domainConstraintsLabel")}
                      value={(persona.domain_specific_constraints || []).join(
                        "\n",
                      )}
                      onChange={(e) =>
                        setPersona({
                          ...persona,
                          domain_specific_constraints: e.target.value
                            .split("\n")
                            .map((value) => value.trim())
                            .filter(Boolean),
                        })
                      }
                      size='small'
                      fullWidth
                      multiline
                      minRows={3}
                    />
                  </Stack>
                ) : (
                  <Typography variant='body2' color='text.secondary'>
                    {personaStatus === "generating"
                      ? t("profile.generating")
                      : t("profile.personaNotGenerated")}
                  </Typography>
                )}
              </Paper>
            </Box>

            <Box
              onMouseDown={handleSplitMouseDown}
              role='separator'
              aria-orientation='vertical'
              sx={{
                display: { xs: "none", md: "flex" },
                alignSelf: "stretch",
                my: 2,
                width: 8,
                cursor: "col-resize",
                justifyContent: "center",
                alignItems: "center",
                "& .split-handle": {
                  width: 2,
                  borderRadius: 999,
                  height: "calc(100% - 32px)",
                  bgcolor: isResizingSplit ? "text.secondary" : "divider",
                  transition: "all 0.3s ease",
                },
                "&:hover .split-handle": {
                  // bgcolor: "text.secondary",
                  width: 3,
                },
              }}
            >
              <Box className='split-handle' />
            </Box>

            <Box
              sx={{
                flex: { xs: "1 1 auto", md: `${1 - splitRatio} 1 0` },
                minWidth: 0,
              }}
            >
              <Paper variant='outlined' sx={{ p: 2, height: "100%" }}>
                <Stack
                  direction='row'
                  alignItems='center'
                  justifyContent='space-between'
                  spacing={2}
                >
                  <Stack direction='row' alignItems='center' spacing={1}>
                    <MenuBook fontSize='small' color='action' />
                    <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                      {t("profile.curriculumTitle")}
                    </Typography>
                  </Stack>
                  <Stack direction='row' alignItems='center' spacing={1}>
                    {renderStatusIndicator(curriculumStatus)}
                    <Button
                      onClick={handleSaveCurriculum}
                      variant='contained'
                      color='success'
                      size='small'
                      disabled={isLoading || !curriculum}
                    >
                      {isLoading ? t("common.saving") : t("common.save")}
                    </Button>
                  </Stack>
                </Stack>
                <Divider sx={{ my: 2 }} />

                {curriculum && curriculum.root ? (
                  <Stack spacing={1}>
                    <Typography variant='caption' color='text.secondary'>
                      {t("profile.totalSteps", {
                        count: curriculum.root.length,
                      })}
                    </Typography>
                    <Stack
                      spacing={2}
                      sx={{ maxHeight: "100%", overflowY: "auto" }}
                    >
                      {curriculum.root.map((step, index) => (
                        <Box key={index}>
                          <Typography
                            variant='subtitle1'
                            sx={{ mb: 2, fontWeight: 500 }}
                          >
                            {t("profile.stepTitle", {
                              index: index + 1,
                              title: step.step_title,
                            })}
                          </Typography>
                          <Stack spacing={1.5}>
                            <TextField
                              label={t("profile.guidingQuestionLabel")}
                              value={step.guiding_question}
                              onChange={(e) => {
                                const newRoot = [...curriculum.root];
                                newRoot[index] = {
                                  ...step,
                                  guiding_question: e.target.value,
                                };
                                setCurriculum({ root: newRoot });
                              }}
                              size='small'
                              fullWidth
                              multiline
                              minRows={2}
                            />
                            <TextField
                              label={t("profile.successCriteriaLabel")}
                              value={step.success_criteria}
                              onChange={(e) => {
                                const newRoot = [...curriculum.root];
                                newRoot[index] = {
                                  ...step,
                                  success_criteria: e.target.value,
                                };
                                setCurriculum({ root: newRoot });
                              }}
                              size='small'
                              fullWidth
                              multiline
                              minRows={2}
                            />
                            <TextField
                              label={t("profile.learningObjectiveLabel")}
                              value={step.learning_objective}
                              onChange={(e) => {
                                const newRoot = [...curriculum.root];
                                newRoot[index] = {
                                  ...step,
                                  learning_objective: e.target.value,
                                };
                                setCurriculum({ root: newRoot });
                              }}
                              size='small'
                              fullWidth
                              multiline
                              minRows={2}
                            />
                          </Stack>
                          {index < curriculum.root.length - 1 && (
                            <Divider sx={{ mt: 2 }} />
                          )}
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant='body2' color='text.secondary'>
                    {curriculumStatus === "generating"
                      ? t("profile.generating")
                      : t("profile.curriculumNotGenerated")}
                  </Typography>
                )}
              </Paper>
            </Box>
          </Stack>
        </Stack>
      )}

      {currentStep === "finalize" && selectedLab && (
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent='space-between'
          >
            <Typography variant='h6'>
              {t("profile.finalizeTitle", { labName: selectedLab })}
            </Typography>
            <Button
              onClick={() => setCurrentStep("generate")}
              startIcon={<ArrowBack />}
              color='inherit'
            >
              {t("profile.backToGenerate")}
            </Button>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={4}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent='flex-end'
          >
            <TextField
              label={t("profile.profileNameLabel")}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder={t("profile.profileNamePlaceholder")}
              size='small'
              fullWidth
            />

            <Button
              onClick={handleGenerateProfile}
              variant='contained'
              disabled={isGeneratingProfile || !persona || !curriculum}
              sx={{
                whiteSpace: "nowrap",
              }}
            >
              {isGeneratingProfile
                ? t("profile.generatingProfile")
                : t("profile.generateProfile")}
            </Button>
          </Stack>

          <Paper
            variant='outlined'
            sx={{ p: 2, bgcolor: "var(--color-surface-muted)" }}
          >
            <Typography variant='subtitle2' sx={{ mb: 1 }}>
              {t("profile.previewInfo")}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant='body2' color='text.secondary'>
                {t("profile.labDocument", { labName: selectedLab })}
              </Typography>
              {persona && (
                <>
                  <Typography variant='body2' color='text.secondary'>
                    {t("profile.topic", { topicName: persona.topic_name })}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {t("profile.targetAudience", {
                      audience: persona.target_audience,
                    })}
                  </Typography>
                </>
              )}
              {curriculum && curriculum.root && (
                <Typography variant='body2' color='text.secondary'>
                  {t("profile.stepCount", { count: curriculum.root.length })}
                </Typography>
              )}
            </Stack>
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
