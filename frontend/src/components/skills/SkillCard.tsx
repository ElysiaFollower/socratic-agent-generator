/**
 * Reusable skill card components.
 *
 * Provides compact and detail variants for skill display.
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
  DescriptionOutlined,
  LinkOutlined,
  CalendarTodayOutlined,
  BuildOutlined,
  AssignmentOutlined,
  Refresh,
} from "@mui/icons-material";
import { CircularProgress } from "../common/CircularProgress";
import { useTranslation } from "react-i18next";
import { CustomSkillInfo, CustomSkillDetail } from "../../api";

/**
 * Props for SkillCard component.
 */
export interface SkillCardProps {
  readonly skill: CustomSkillInfo;
  readonly onClick?: () => void;
  readonly selectable?: boolean;
  readonly selected?: boolean;
  readonly onSelectToggle?: () => void;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly actionDisabled?: boolean;
  readonly highlight?: boolean;
  readonly showDetails?: boolean;
  readonly className?: string;
  readonly onRebuild?: (skillId: number) => void;
  readonly onDelete?: (skillId: number) => void;
  readonly isRebuilding?: boolean;
  readonly isDeleting?: boolean;
}

/**
 * Compact skill card component.
 *
 * @param props - Component props
 * @returns React component
 */
export function SkillCard(props: SkillCardProps): JSX.Element {
  const {
    skill,
    onClick,
    selectable,
    selected,
    onSelectToggle,
    actionLabel,
    onAction,
    actionDisabled,
    highlight,
    showDetails = false,
    className,
    onRebuild,
    onDelete,
    isRebuilding = false,
    isDeleting = false,
  } = props;
  const { t } = useTranslation();
  const displayName = skill.name || "-";
  const retrievalNeeded = Boolean(skill.meta_info?.retrieval_needed);
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
            {t("skill.card.description")}: {skill.description}
          </Typography>
        </Stack>
        <Stack direction='row' spacing={1} alignItems='flex-start'>
          <AssignmentOutlined
            fontSize='small'
            color='action'
            sx={{ mt: "2px" }}
          />
          <Typography variant='caption' color='text.secondary'>
            {t("skill.card.status")}: {skill.status}
          </Typography>
        </Stack>
        <Stack direction='row' spacing={1} alignItems='flex-start'>
          <BuildOutlined fontSize='small' color='action' sx={{ mt: "2px" }} />
          <Typography variant='caption' color='text.secondary'>
            {t("skill.card.retrieval")}: {retrievalNeeded ? t("skill.card.yes") : t("skill.card.no")}
          </Typography>
        </Stack>

        {showDetails && (
          <>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <LinkOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='caption' color='text.secondary'>
                {t("skill.card.toolName")}: {skill.tool_name}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <LinkOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='caption' color='text.secondary'>
                {t("skill.card.materialsLinked")}: {skill.material_ids.join(", ") || t("skill.card.none")}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <CalendarTodayOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='caption' color='text.secondary'>
                {t("skill.card.createdAt")}: {skill.create_at || t("skill.card.unknown")}
              </Typography>
            </Stack>
          </>
        )}
      </Stack>
    </CardContent>
  );

  return (
    <Card
      variant='outlined'
      className={`animate-fade-in ${className || ""}`}
      sx={{
        height: "100%",
        position: selectable ? "relative" : "static",
        borderColor: isHighlighted ? "primary.main" : "divider",
        transition: "all var(--transition-duration-200) var(--transition-timing-default)",
        "&:hover": {
          boxShadow: "var(--shadow-md)",
          borderColor: "primary.light",
          transform: "translateY(-2px)",
        },
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
      <CardActions sx={{ justifyContent: "flex-end", px: 2, pb: 2, pt: 0 }}>
        {onAction && (
          <Button
            variant='outlined'
            size='small'
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionLabel || t("skill.card.view")}
          </Button>
        )}
        {retrievalNeeded && onRebuild && (
          <Button
            variant='outlined'
            size='small'
            startIcon={
              isRebuilding ? undefined : <Refresh fontSize='small' />
            }
            onClick={() => onRebuild(skill.id)}
            disabled={isRebuilding}
          >
            {isRebuilding ? (
              <Stack direction='row' spacing={1} alignItems='center'>
                <CircularProgress size={14} />
                <span>{t("skill.card.rebuilding")}</span>
              </Stack>
            ) : (
              t("skill.card.rebuildIndex")
            )}
          </Button>
        )}
        {onDelete && (
          <Button
            variant='outlined'
            size='small'
            color='error'
            onClick={() => onDelete(skill.id)}
            disabled={isDeleting}
            startIcon={isDeleting ? <CircularProgress size={14} /> : undefined}
          >
            {isDeleting ? t("skill.card.deleting") : t("skill.card.delete")}
          </Button>
        )}
      </CardActions>
    </Card>
  );
}

/**
 * Props for SkillDetailCard component.
 */
export interface SkillDetailCardProps {
  readonly skill: CustomSkillDetail;
  readonly onRebuild?: (skillId: number) => void;
  readonly onDelete?: (skillId: number) => void;
  readonly onView?: (skillId: number) => void;
  readonly isRebuilding?: boolean;
  readonly isDeleting?: boolean;
  readonly actions?: React.ReactNode;
  readonly className?: string;
}

/**
 * Detailed skill card component.
 *
 * @param props - Component props
 * @returns React component
 */
export function SkillDetailCard(props: SkillDetailCardProps): JSX.Element {
  const {
    skill,
    onRebuild,
    onDelete,
    onView,
    isRebuilding = false,
    isDeleting = false,
    actions,
    className,
  } = props;
  const { t } = useTranslation();
  const displayName = skill.name || "-";
  const retrievalNeeded = Boolean(skill.meta_info?.retrieval_needed);

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    if (isNaN(parsed.getTime())) {
      return "-";
    }
    return parsed.toLocaleString("zh-CN");
  };

  return (
    <Card variant='outlined' className={`animate-scale-up ${className || ""}`}>
      <CardContent>
        <Stack spacing={2}>
          <Stack spacing={1}>
            <Typography variant='h6' sx={{ fontWeight: 600 }}>
              {displayName}
            </Typography>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <DescriptionOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("skill.card.description")}: {skill.description}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <AssignmentOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("skill.card.status")}: {skill.status}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <BuildOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("skill.card.retrieval")}: {retrievalNeeded ? t("skill.card.yes") : t("skill.card.no")}
              </Typography>
            </Stack>
          </Stack>

          <Divider flexItem />

          <Stack spacing={1}>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <LinkOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("skill.card.toolName")}: {skill.tool_name}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <LinkOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("skill.card.materialsLinked")}: {skill.material_ids.join(", ") || t("skill.card.none")}
              </Typography>
            </Stack>
            <Stack direction='row' spacing={1} alignItems='flex-start'>
              <CalendarTodayOutlined
                fontSize='small'
                color='action'
                sx={{ mt: "2px" }}
              />
              <Typography variant='body2' color='text.secondary'>
                {t("skill.card.createdAt")}: {formatDateTime(skill.create_at)}
              </Typography>
            </Stack>
            <Typography variant='caption' color='text.secondary'>
              {t("skill.card.skillId")}: {skill.id}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Profile ID: {skill.profile_id}
            </Typography>
          </Stack>

          <Divider flexItem />

          <Stack spacing={1}>
            <Typography variant='subtitle2'>{t("skill.card.skillInstructions")}</Typography>
            {skill.instructions && typeof skill.instructions === "string" ? (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 1,
                  bgcolor: "var(--color-surface-muted)",
                  maxHeight: 300,
                  overflowY: "auto",
                  fontFamily: "var(--font-heading)",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {skill.instructions}
                </pre>
              </Box>
            ) : (
              <Typography variant='caption' color='text.secondary'>
                {t("skill.card.noInstructions")}
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
      {actions && <CardActions sx={{ px: 2, pb: 2 }}>{actions}</CardActions>}
    </Card>
  );
}
