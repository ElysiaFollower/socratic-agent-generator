/**
 * Reusable profile card components.
 *
 * Provides compact and detail variants for profile display.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Checkbox,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ChecklistOutlined,
  DescriptionOutlined,
  PeopleOutline,
  CalendarTodayOutlined,
  PersonOutline,
  Edit,
  Check,
  Close,
} from "@mui/icons-material";
import { CircularProgress } from "../common/CircularProgress";
import { useTranslation } from "react-i18next";
import { Profile, SocraticStep } from "../../types";
import { extractCurriculumSteps } from "../../utils/curriculum";
import {
  updatePersonaHints,
  updateProfileCurriculum,
  type UpdatePersonaHintsRequest,
  type UpdateCurriculumRequest,
} from "../../api";
import { useNotification, useUsers } from "../../hooks";

/**
 * Props for ProfileCard component.
 */
export interface ProfileCardProps {
  readonly profile: Profile;
  readonly onClick?: () => void;
  readonly selectable?: boolean;
  readonly selected?: boolean;
  readonly onSelectToggle?: () => void;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionDisabled?: boolean;
  readonly highlight?: boolean;
}

/**
 * Compact profile card component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileCard(props: ProfileCardProps): JSX.Element {
  const {
    profile,
    onClick,
    selectable,
    selected,
    onSelectToggle,
    actionLabel,
    onAction,
    actionDisabled,
    highlight,
  } = props;
  const { t } = useTranslation();
  const displayName = profile.profile_name || profile.topic_name || "-";
  const stepCount = extractCurriculumSteps(profile.curriculum).length;
  const isHighlighted = Boolean(highlight || selected);
  const isClickable = Boolean(onClick || onSelectToggle);

  const handleCardClick = () => {
    if (selectable && onSelectToggle) {
      onSelectToggle();
      return;
    }
    onClick?.();
  };

  const content = (
    <CardContent>
      <Stack spacing={0.5}>
        <Stack direction='row' spacing={1} alignItems='flex-start'>
          <Typography variant='subtitle1' sx={{ fontWeight: 600 }} noWrap>
            {displayName}
          </Typography>
        </Stack>
        <Stack direction='row' spacing={1} alignItems='flex-start'>
          <DescriptionOutlined
            fontSize='small'
            color='action'
            sx={{ mt: "2px" }}
          />
          <Typography variant='caption' color='text.secondary'>
            {t("profile.card.topic")}: {profile.topic_name}
          </Typography>
        </Stack>
        <Stack direction='row' spacing={1} alignItems='flex-start'>
          <PeopleOutline fontSize='small' color='action' sx={{ mt: "2px" }} />
          <Typography variant='caption' color='text.secondary'>
            {t("profile.card.targetAudience")}: {profile.target_audience || "-"}
          </Typography>
        </Stack>
        <Stack direction='row' spacing={1} alignItems='flex-start'>
          <ChecklistOutlined
            fontSize='small'
            color='action'
            sx={{ mt: "2px" }}
          />
          <Typography variant='caption' color='text.secondary'>
            {t("profile.card.learningSteps")}: {stepCount}{t("profile.card.stepsCount")}
          </Typography>
        </Stack>
      </Stack>
    </CardContent>
  );

  return (
    <Card
      variant='outlined'
      sx={{
        height: "100%",
        position: selectable ? "relative" : "static",
        borderColor: isHighlighted ? "primary.main" : "divider",
      }}
    >
      {selectable && (
        <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
          <Checkbox
            size='small'
            checked={Boolean(selected)}
            onChange={() => onSelectToggle?.()}
            onClick={(event) => event.stopPropagation()}
          />
        </Box>
      )}
      {isClickable ? (
        <CardActionArea onClick={handleCardClick}>{content}</CardActionArea>
      ) : (
        content
      )}
      {actionLabel && onAction && (
        <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
          <Button
            variant='contained'
            size='small'
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionLabel}
          </Button>
        </CardActions>
      )}
    </Card>
  );
}

/**
 * Props for ProfileDetailCard component.
 */
export interface ProfileDetailCardProps {
  readonly profile: Profile;
  readonly mode?: "teacher" | "student" | "admin";
  readonly onRename?: (profile: Profile, name: string) => void;
  readonly isRenaming?: boolean;
  readonly onUpdate?: () => void;
  readonly actions?: React.ReactNode;
}

/**
 * Detailed profile card component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileDetailCard(props: ProfileDetailCardProps): JSX.Element {
  const {
    profile,
    mode = "student",
    onRename,
    isRenaming,
    onUpdate,
    actions,
  } = props;
  const { notifySuccess, notifyError } = useNotification();
  const { getUserDisplayName } = useUsers();
  const { t } = useTranslation();
  const displayName = profile.profile_name || profile.topic_name || "-";

  // Owner display name state
  const [ownerDisplayName, setOwnerDisplayName] = useState<string>("");

  // Fetch owner display name when profile changes
  useEffect(() => {
    if (profile.owner_id) {
      getUserDisplayName(profile.owner_id).then(setOwnerDisplayName);
    } else {
      setOwnerDisplayName("");
    }
  }, [profile.owner_id, getUserDisplayName]);
  const [nameInput, setNameInput] = useState<string>(displayName);
  const steps = useMemo(
    () => extractCurriculumSteps(profile.curriculum),
    [profile.curriculum],
  );

  // Edit state management
  const [editingPersonaHints, setEditingPersonaHints] =
    useState<boolean>(false);
  const [isUpdatingPersonaHints, setIsUpdatingPersonaHints] =
    useState<boolean>(false);
  const [personaHintsInput, setPersonaHintsInput] = useState<string[]>(
    profile.persona_hints.slice(),
  );
  const [editingCurriculum, setEditingCurriculum] = useState<boolean>(false);
  const [isUpdatingCurriculum, setIsUpdatingCurriculum] =
    useState<boolean>(false);
  const [curriculumInput, setCurriculumInput] = useState<
    readonly SocraticStep[]
  >(steps.slice());

  useEffect(() => {
    setNameInput(profile.profile_name || profile.topic_name || "");
  }, [profile.profile_id, profile.profile_name, profile.topic_name]);

  // Sync edit states with profile data
  useEffect(() => {
    if (!editingPersonaHints) {
      setPersonaHintsInput(profile.persona_hints.slice());
    }
  }, [profile.persona_hints, editingPersonaHints]);

  useEffect(() => {
    if (!editingCurriculum) {
      const currentSteps = extractCurriculumSteps(profile.curriculum);
      setCurriculumInput(currentSteps.slice());
    }
  }, [profile.curriculum, editingCurriculum]);

  const canRename =
    (mode === "teacher" || mode === "admin") && Boolean(onRename);
  const trimmedName = nameInput.trim();
  const isNameDirty = trimmedName !== displayName && trimmedName.length > 0;

  const formatDateTime = (value?: string) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }
    return parsed.toLocaleString("zh-CN");
  };

  // Persona hints edit handlers
  const handleStartEditPersonaHints = () => {
    setEditingPersonaHints(true);
    setPersonaHintsInput(profile.persona_hints.slice());
  };

  const handleSavePersonaHints = async () => {
    setIsUpdatingPersonaHints(true);
    try {
      const request: UpdatePersonaHintsRequest = {
        persona_hints: personaHintsInput,
      };
      await updatePersonaHints(profile.profile_id, request);
      notifySuccess(t("profile.personaHintsUpdated"));
      setEditingPersonaHints(false);
      onUpdate?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("profile.personaHintsUpdateFailed");
      notifyError(errorMessage);
    } finally {
      setIsUpdatingPersonaHints(false);
    }
  };

  const handleCancelEditPersonaHints = () => {
    setPersonaHintsInput(profile.persona_hints.slice());
    setEditingPersonaHints(false);
  };

  const handlePersonaHintChange = (index: number, value: string) => {
    const newHints = [...personaHintsInput];
    newHints[index] = value;
    setPersonaHintsInput(newHints);
  };

  const handleAddPersonaHint = () => {
    setPersonaHintsInput([...personaHintsInput, ""]);
  };

  const handleRemovePersonaHint = (index: number) => {
    const newHints = personaHintsInput.filter((_, i) => i !== index);
    setPersonaHintsInput(newHints);
  };

  // Curriculum edit handlers
  const handleStartEditCurriculum = () => {
    setEditingCurriculum(true);
    const currentSteps = extractCurriculumSteps(profile.curriculum);
    setCurriculumInput(currentSteps.slice());
  };

  const handleSaveCurriculum = async () => {
    setIsUpdatingCurriculum(true);
    try {
      // Convert array to SocraticCurriculum format (RootModel expects plain array)
      const curriculumRequest: UpdateCurriculumRequest = {
        curriculum: curriculumInput as any,
      };
      await updateProfileCurriculum(profile.profile_id, curriculumRequest);
      notifySuccess(t("profile.learningStepsUpdated"));
      setEditingCurriculum(false);
      onUpdate?.();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("profile.learningStepsUpdateFailed");
      notifyError(errorMessage);
    } finally {
      setIsUpdatingCurriculum(false);
    }
  };

  const handleCancelEditCurriculum = () => {
    const currentSteps = extractCurriculumSteps(profile.curriculum);
    setCurriculumInput(currentSteps.slice());
    setEditingCurriculum(false);
  };

  const handleStepFieldChange = (
    index: number,
    field: keyof SocraticStep,
    value: string,
  ) => {
    const newSteps = [...curriculumInput];
    newSteps[index] = {
      ...newSteps[index],
      [field]: value,
    };
    setCurriculumInput(newSteps);
  };

  const handleAddStep = () => {
    const newStep: SocraticStep = {
      step_title: "",
      guiding_question: "",
      success_criteria: "",
      learning_objective: "",
    };
    setCurriculumInput([...curriculumInput, newStep]);
  };

  const handleRemoveStep = (index: number) => {
    const newSteps = curriculumInput.filter((_, i) => i !== index);
    setCurriculumInput(newSteps);
  };

  const canEditPersonaHints = mode === "teacher" || mode === "admin";
  const canEditCurriculum = mode === "teacher" || mode === "admin";

  return (
    <Card variant='outlined'>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={1}>
            {canRename ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  label={t("profile.card.profileName")}
                  value={nameInput}
                  onChange={(event) => setNameInput(event.target.value)}
                  size='small'
                  fullWidth
                />
                <Button
                  variant='contained'
                  onClick={() => onRename?.(profile, trimmedName)}
                  disabled={!isNameDirty || Boolean(isRenaming)}
                  sx={{ whiteSpace: "nowrap" }}
                  startIcon={isRenaming ? <CircularProgress size={14} /> : undefined}
                >
                  {isRenaming ? t("profile.card.saving") : t("profile.card.save")}
                </Button>
              </Stack>
            ) : (
              <Typography variant='h6' sx={{ fontWeight: 600 }}>
                {displayName}
              </Typography>
            )}
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <DescriptionOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("profile.card.topic")}: {profile.topic_name}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <PeopleOutline
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("profile.card.audience")}: {profile.target_audience || "-"}
              </Typography>
            </Stack>
          </Stack>

          <Divider flexItem />

          <Stack spacing={1}>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <PersonOutline
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("profile.card.createdBy")}: {ownerDisplayName || profile.owner_id || "-"}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <CalendarTodayOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("profile.card.createdAt")}: {formatDateTime(profile.create_at)}
              </Typography>
            </Stack>
          </Stack>

          <Divider flexItem />

          <Stack spacing={1}>
            <Stack
              direction='row'
              justifyContent='space-between'
              alignItems='center'
            >
              <Typography variant='subtitle2'>{t("profile.card.personaHints")}</Typography>
              {canEditPersonaHints && !editingPersonaHints && (
                <IconButton
                  size='small'
                  onClick={handleStartEditPersonaHints}
                  aria-label={t("profile.card.editPersonaHints")}
                >
                  <Edit fontSize='small' />
                </IconButton>
              )}
              {canEditPersonaHints && editingPersonaHints && (
                <Stack direction='row' spacing={0.5}>
                  <Button
                    size='small'
                    onClick={handleAddPersonaHint}
                    startIcon={<Edit fontSize='small' />}
                  >
                    {t("profile.card.add")}
                  </Button>
                  <Button
                    size='small'
                    variant='contained'
                    onClick={handleSavePersonaHints}
                    disabled={isUpdatingPersonaHints}
                    startIcon={
                      isUpdatingPersonaHints ? (
                        <CircularProgress size={14} />
                      ) : (
                        <Check fontSize='small' />
                      )
                    }
                  >
                    {isUpdatingPersonaHints ? t("profile.card.saving") : t("profile.card.save")}
                  </Button>
                  <Button
                    size='small'
                    color='inherit'
                    onClick={handleCancelEditPersonaHints}
                    startIcon={<Close fontSize='small' />}
                  >
                    {t("profile.card.cancel")}
                  </Button>
                </Stack>
              )}
            </Stack>
            {editingPersonaHints ? (
              <Stack spacing={1}>
                {personaHintsInput.map((hint, index) => (
                  <Stack
                    key={`edit-persona-${index}`}
                    direction='row'
                    spacing={1}
                    alignItems='center'
                  >
                    <TextField
                      size='small'
                      value={hint}
                      onChange={(e) =>
                        handlePersonaHintChange(index, e.target.value)
                      }
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={3}
                      placeholder={t("profile.card.hintPlaceholder")}
                    />
                    <IconButton
                      size='small'
                      onClick={() => handleRemovePersonaHint(index)}
                      color='error'
                      aria-label={t("profile.card.deleteHint")}
                    >
                      <Close fontSize='small' />
                    </IconButton>
                  </Stack>
                ))}
              </Stack>
            ) : profile.persona_hints.length === 0 ? (
              <Typography variant='caption' color='text.secondary'>
                {t("profile.card.noPersonaHints")}
              </Typography>
            ) : (
              <Stack spacing={0.5}>
                {profile.persona_hints.map((hint, index) => (
                  <Box
                    key={`${profile.profile_id}-persona-${index}`}
                    sx={{
                      position: "relative",
                      pl: 2.5,
                      py: 0.5,
                      pr: 1,
                      "&:before": {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 8,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "primary.main",
                        opacity: 0.6,
                      },
                    }}
                  >
                    <Typography
                      variant='body2'
                      sx={{
                        color: "text.primary",
                        lineHeight: 1.5,
                      }}
                    >
                      {hint}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>

          <Stack spacing={1}>
            <Stack
              direction='row'
              justifyContent='space-between'
              alignItems='center'
            >
              <Typography variant='subtitle2'>{t("profile.card.learningStepsTitle")}</Typography>
              {canEditCurriculum && !editingCurriculum && (
                <IconButton
                  size='small'
                  onClick={handleStartEditCurriculum}
                  aria-label={t("profile.card.editLearningSteps")}
                >
                  <Edit fontSize='small' />
                </IconButton>
              )}
              {canEditCurriculum && editingCurriculum && (
                <Stack direction='row' spacing={0.5}>
                  <Button
                    size='small'
                    onClick={handleAddStep}
                    startIcon={<Edit fontSize='small' />}
                  >
                    {t("profile.card.add")}
                  </Button>
                  <Button
                    size='small'
                    variant='contained'
                    onClick={handleSaveCurriculum}
                    disabled={isUpdatingCurriculum}
                    startIcon={
                      isUpdatingCurriculum ? (
                        <CircularProgress size={14} />
                      ) : (
                        <Check fontSize='small' />
                      )
                    }
                  >
                    {isUpdatingCurriculum ? t("profile.card.saving") : t("profile.card.save")}
                  </Button>
                  <Button
                    size='small'
                    color='inherit'
                    onClick={handleCancelEditCurriculum}
                    startIcon={<Close fontSize='small' />}
                  >
                    {t("profile.card.cancel")}
                  </Button>
                </Stack>
              )}
            </Stack>
            {editingCurriculum ? (
              <Stack spacing={2}>
                {curriculumInput.map((step, index) => (
                  <Box
                    key={`edit-step-${index}`}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      border: "1px solid var(--color-border)",
                      bgcolor: "var(--color-surface)",
                    }}
                  >
                    <Typography
                      variant='subtitle2'
                      sx={{ mb: 1, color: "primary.main" }}
                    >
                      {t("profile.card.stepNumber", { index: index + 1 })}
                    </Typography>
                    <Stack spacing={1.5}>
                      <TextField
                        size='small'
                        label={t("profile.card.stepTitleLabel")}
                        value={step.step_title}
                        onChange={(e) =>
                          handleStepFieldChange(
                            index,
                            "step_title",
                            e.target.value,
                          )
                        }
                        fullWidth
                        required
                      />
                      <TextField
                        size='small'
                        label={t("profile.card.guidingQuestionLabel")}
                        value={step.guiding_question}
                        onChange={(e) =>
                          handleStepFieldChange(
                            index,
                            "guiding_question",
                            e.target.value,
                          )
                        }
                        fullWidth
                        multiline
                        minRows={2}
                      />
                      <TextField
                        size='small'
                        label={t("profile.card.successCriteriaLabel")}
                        value={step.success_criteria}
                        onChange={(e) =>
                          handleStepFieldChange(
                            index,
                            "success_criteria",
                            e.target.value,
                          )
                        }
                        fullWidth
                        multiline
                        minRows={2}
                      />
                      <TextField
                        size='small'
                        label={t("profile.card.learningObjectiveLabel")}
                        value={step.learning_objective}
                        onChange={(e) =>
                          handleStepFieldChange(
                            index,
                            "learning_objective",
                            e.target.value,
                          )
                        }
                        fullWidth
                        multiline
                        minRows={2}
                      />
                      <Stack direction='row' justifyContent='flex-end'>
                        <IconButton
                          size='small'
                          onClick={() => handleRemoveStep(index)}
                          color='error'
                          aria-label={t("profile.card.deleteStep")}
                        >
                          <Close fontSize='small' />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            ) : steps.length === 0 ? (
              <Typography variant='caption' color='text.secondary'>
                {t("profile.card.noLearningSteps")}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {steps.map((step, index) => (
                  <Box
                    key={`${profile.profile_id}-step-${index}`}
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      bgcolor: "var(--color-surface-muted)",
                    }}
                  >
                    <Typography
                      variant='body1'
                      sx={{ fontWeight: 600, color: "primary.main", mb: 1 }}
                    >
                      {t("profile.card.stepNumberWithTitle", { index: index + 1, title: step.step_title })}
                    </Typography>
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ display: "block", mb: 0.5 }}
                    >
                      <strong>{t("profile.card.guidingQuestionLabel")}:</strong> {step.guiding_question || "-"}
                    </Typography>
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ display: "block", mb: 0.5 }}
                    >
                      <strong>{t("profile.card.successCriteriaLabel")}:</strong> {step.success_criteria || "-"}
                    </Typography>
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ display: "block" }}
                    >
                      <strong>{t("profile.card.learningObjectiveLabel")}:</strong> {step.learning_objective}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Stack>
        </Stack>
      </CardContent>
      {actions && <CardActions sx={{ px: 2, pb: 2 }}>{actions}</CardActions>}
    </Card>
  );
}
