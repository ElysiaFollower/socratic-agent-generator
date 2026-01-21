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
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  ChecklistOutlined,
  DescriptionOutlined,
  MenuBookOutlined,
  PeopleOutline,
  CalendarTodayOutlined,
  PersonOutline,
  Edit,
  Check,
  Close,
} from "@mui/icons-material";
import { Profile, SocraticStep, CurriculumData } from "../../types";
import { extractCurriculumSteps } from "../../utils/curriculum";

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
            主题: {profile.topic_name}
          </Typography>
        </Stack>
        <Stack direction='row' spacing={1} alignItems='flex-start'>
          <PeopleOutline fontSize='small' color='action' sx={{ mt: "2px" }} />
          <Typography variant='caption' color='text.secondary'>
            目标受众: {profile.target_audience || "-"}
          </Typography>
        </Stack>
        <Stack direction='row' spacing={1} alignItems='flex-start'>
          <ChecklistOutlined
            fontSize='small'
            color='action'
            sx={{ mt: "2px" }}
          />
          <Typography variant='caption' color='text.secondary'>
            学习步骤: {stepCount} 个
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
  readonly onUpdatePersonaHints?: (profile: Profile, hints: string[]) => void;
  readonly isUpdatingPersonaHints?: boolean;
  readonly onUpdateCurriculum?: (
    profile: Profile,
    curriculum: CurriculumData,
  ) => void;
  readonly isUpdatingCurriculum?: boolean;
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
    onUpdatePersonaHints,
    isUpdatingPersonaHints,
    onUpdateCurriculum,
    isUpdatingCurriculum,
    actions,
  } = props;
  const displayName = profile.profile_name || profile.topic_name || "-";
  const [nameInput, setNameInput] = useState<string>(displayName);
  const steps = useMemo(
    () => extractCurriculumSteps(profile.curriculum),
    [profile.curriculum],
  );

  // Edit state management
  const [editingPersonaHints, setEditingPersonaHints] =
    useState<boolean>(false);
  const [personaHintsInput, setPersonaHintsInput] = useState<string[]>(
    profile.persona_hints.slice(),
  );
  const [editingCurriculum, setEditingCurriculum] = useState<boolean>(false);
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

  const canRename = mode in ["teacher", "admin"] && Boolean(onRename);
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

  const handleSavePersonaHints = () => {
    if (onUpdatePersonaHints) {
      onUpdatePersonaHints(profile, personaHintsInput);
    }
    setEditingPersonaHints(false);
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

  const handleSaveCurriculum = () => {
    if (onUpdateCurriculum) {
      // Convert array to CurriculumData format (preserve original structure)
      const curriculumData: CurriculumData = Array.isArray(profile.curriculum)
        ? curriculumInput.slice()
        : { root: curriculumInput.slice() };
      onUpdateCurriculum(profile, curriculumData);
    }
    setEditingCurriculum(false);
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

  const canEditPersonaHints =
    mode in ["teacher", "admin"] && Boolean(onUpdatePersonaHints);
  const canEditCurriculum =
    mode in ["teacher", "admin"] && Boolean(onUpdateCurriculum);

  return (
    <Card variant='outlined'>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={1}>
            {canRename ? (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <TextField
                  label='Profile名称'
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
                >
                  {isRenaming ? "保存中..." : "保存"}
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
                主题: {profile.topic_name}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <PeopleOutline
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                受众: {profile.target_audience || "-"}
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
                创建人: {profile.owner_id || "-"}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <CalendarTodayOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                创建日期: {formatDateTime(profile.create_at)}
              </Typography>
            </Stack>
            <Typography variant='caption' color='text.secondary'>
              Profile ID: {profile.profile_id}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              实验: {profile.lab_name || "-"}
            </Typography>
          </Stack>

          <Divider flexItem />

          <Stack spacing={1}>
            <Stack
              direction='row'
              justifyContent='space-between'
              alignItems='center'
            >
              <Typography variant='subtitle2'>Persona 提示</Typography>
              {canEditPersonaHints && !editingPersonaHints && (
                <IconButton
                  size='small'
                  onClick={handleStartEditPersonaHints}
                  aria-label='编辑Persona提示'
                >
                  <Edit fontSize='small' />
                </IconButton>
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
                      placeholder='输入提示内容'
                    />
                    <IconButton
                      size='small'
                      onClick={() => handleRemovePersonaHint(index)}
                      color='error'
                      aria-label='删除提示'
                    >
                      <Close fontSize='small' />
                    </IconButton>
                  </Stack>
                ))}
                <Stack direction='row' spacing={1}>
                  <Button
                    size='small'
                    onClick={handleAddPersonaHint}
                    startIcon={<Edit fontSize='small' />}
                  >
                    添加提示
                  </Button>
                  <Button
                    size='small'
                    variant='contained'
                    onClick={handleSavePersonaHints}
                    disabled={isUpdatingPersonaHints}
                    startIcon={<Check fontSize='small' />}
                  >
                    {isUpdatingPersonaHints ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    size='small'
                    color='inherit'
                    onClick={handleCancelEditPersonaHints}
                    startIcon={<Close fontSize='small' />}
                  >
                    取消
                  </Button>
                </Stack>
              </Stack>
            ) : profile.persona_hints.length === 0 ? (
              <Typography variant='caption' color='text.secondary'>
                暂无 Persona 提示
              </Typography>
            ) : (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                {profile.persona_hints.map((hint, index) => (
                  <Chip
                    key={`${profile.profile_id}-persona-${index}`}
                    label={hint}
                    size='small'
                  />
                ))}
              </Box>
            )}
          </Stack>

          <Stack spacing={1}>
            <Stack
              direction='row'
              justifyContent='space-between'
              alignItems='center'
            >
              <Typography variant='subtitle2'>学习步骤</Typography>
              {canEditCurriculum && !editingCurriculum && (
                <IconButton
                  size='small'
                  onClick={handleStartEditCurriculum}
                  aria-label='编辑学习步骤'
                >
                  <Edit fontSize='small' />
                </IconButton>
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
                      第{index + 1}步
                    </Typography>
                    <Stack spacing={1.5}>
                      <TextField
                        size='small'
                        label='步骤标题'
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
                        label='引导问题'
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
                        label='成功标准'
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
                        label='学习目标'
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
                          aria-label='删除步骤'
                        >
                          <Close fontSize='small' />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Box>
                ))}
                <Stack direction='row' spacing={1} alignItems='center'>
                  <Button
                    size='small'
                    onClick={handleAddStep}
                    startIcon={<Edit fontSize='small' />}
                  >
                    添加步骤
                  </Button>
                  <Button
                    size='small'
                    variant='contained'
                    onClick={handleSaveCurriculum}
                    disabled={isUpdatingCurriculum}
                    startIcon={<Check fontSize='small' />}
                  >
                    {isUpdatingCurriculum ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    size='small'
                    color='inherit'
                    onClick={handleCancelEditCurriculum}
                    startIcon={<Close fontSize='small' />}
                  >
                    取消
                  </Button>
                </Stack>
              </Stack>
            ) : steps.length === 0 ? (
              <Typography variant='caption' color='text.secondary'>
                暂无学习步骤
              </Typography>
            ) : (
              <Stack spacing={1}>
                {steps.map((step, index) => (
                  <Box
                    key={`${profile.profile_id}-step-${index}`}
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: "var(--color-surface-muted)",
                    }}
                  >
                    <Typography
                      variant='body2'
                      sx={{ fontWeight: 600, color: "primary.main", mb: 0.5 }}
                    >
                      第{index + 1}步: {step.step_title}
                    </Typography>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ display: "block", mb: 0.5 }}
                    >
                      <strong>引导问题:</strong> {step.guiding_question || "-"}
                    </Typography>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ display: "block", mb: 0.5 }}
                    >
                      <strong>成功标准:</strong> {step.success_criteria || "-"}
                    </Typography>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ display: "block" }}
                    >
                      <strong>学习目标:</strong> {step.learning_objective}
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
