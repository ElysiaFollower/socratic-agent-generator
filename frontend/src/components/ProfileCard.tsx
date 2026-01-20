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
} from "@mui/icons-material";
import { Profile } from "../types";
import { extractCurriculumSteps } from "../utils/curriculum";

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
  readonly mode?: "teacher" | "student";
  readonly onRename?: (profile: Profile, name: string) => void;
  readonly isRenaming?: boolean;
  readonly actions?: React.ReactNode;
}

/**
 * Detailed profile card component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileDetailCard(props: ProfileDetailCardProps): JSX.Element {
  const { profile, mode = "student", onRename, isRenaming, actions } = props;
  const displayName = profile.profile_name || profile.topic_name || "-";
  const [nameInput, setNameInput] = useState<string>(displayName);
  const steps = useMemo(
    () => extractCurriculumSteps(profile.curriculum),
    [profile.curriculum],
  );

  useEffect(() => {
    setNameInput(profile.profile_name || profile.topic_name || "");
  }, [profile.profile_id, profile.profile_name, profile.topic_name]);

  const canRename = mode === "teacher" && Boolean(onRename);
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
            <Typography variant='subtitle2'>Persona 提示</Typography>
            {profile.persona_hints.length === 0 ? (
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
            <Typography variant='subtitle2'>学习步骤</Typography>
            {steps.length === 0 ? (
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
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                      {step.step_title}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {step.learning_objective}
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
