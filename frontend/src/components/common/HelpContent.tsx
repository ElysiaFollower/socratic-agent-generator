/**
 * Help content components for user manuals.
 *
 * Provides formatted content components for different management panels.
 */

import React from "react";
import { Box, Stack, Typography, Divider } from "@mui/material";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Section component for help content.
 */
interface HelpSectionProps {
  readonly icon: string;
  readonly title: string;
  readonly content: string;
}

function HelpSection(props: HelpSectionProps): JSX.Element {
  const { icon, title, content } = props;
  const markdownStyles = {
    "& p": { m: 0, mb: 1, lineHeight: 1.7 },
    "& p:last-child": { mb: 0 },
    "& ul, & ol": { pl: 2, my: 1, listStylePosition: "outside" },
    "& ul": { listStyleType: "disc" },
    "& ol": { listStyleType: "decimal" },
    "& li": { mb: 0.5 },
    "& code": {
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "0.85em",
      px: 0.6,
      py: 0.2,
      borderRadius: 0.75,
      bgcolor: "var(--color-surface-muted)",
    },
    "& pre": {
      m: 0,
      mb: 1,
      p: 1.5,
      borderRadius: 1,
      overflowX: "auto",
      bgcolor: "var(--color-surface-muted)",
    },
    "& pre code": {
      bgcolor: "transparent",
      p: 0,
    },
    "& blockquote": {
      m: 0,
      mb: 1,
      pl: 1.5,
      borderLeft: "3px solid var(--color-border)",
      color: "text.secondary",
    },
    "& a": {
      color: "inherit",
      textDecoration: "underline",
    },
    "& strong": {
      fontWeight: 600,
    },
  } as const;

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 1.5 }}>
        <Typography variant='h6' sx={{ fontSize: "1.1rem", fontWeight: 600 }}>
          {icon} {title}
        </Typography>
      </Stack>
      <Box sx={{ pl: 1, ...markdownStyles }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </Box>
    </Box>
  );
}

/**
 * Lab manual help content component.
 */
export function LabManualHelpContent(): JSX.Element {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <HelpSection
        icon='🎯'
        title={t("help.coreValue")}
        content={t("help.labManual.coreValue")}
      />

      <Divider />

      <HelpSection
        icon='📚'
        title={t("help.designPhilosophy")}
        content={t("help.labManual.designPhilosophy")}
      />

      <Divider />

      <HelpSection
        icon='🚀'
        title={t("help.usageProcess")}
        content={t("help.labManual.usageProcess")}
      />

      <Divider />

      <HelpSection
        icon='💡'
        title={t("help.bestPractices")}
        content={t("help.labManual.bestPractices")}
      />

      <Divider />

      <HelpSection
        icon='🔗'
        title={t("help.nextStep")}
        content={t("help.labManual.nextStep")}
      />
    </Stack>
  );
}

/**
 * Profile manager help content component.
 */
export function ProfileManagerHelpContent(): JSX.Element {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <HelpSection
        icon='🎯'
        title={t("help.coreValue")}
        content={t("help.profile.coreValue")}
      />

      <Divider />

      <HelpSection
        icon='📚'
        title={t("help.designPhilosophy")}
        content={t("help.profile.designPhilosophy")}
      />

      <Divider />

      <HelpSection
        icon='🚀'
        title={t("help.usageProcess")}
        content={t("help.profile.usageProcess")}
      />

      <Divider />

      <HelpSection
        icon='💡'
        title={t("help.bestPractices")}
        content={t("help.profile.bestPractices")}
      />

      <Divider />

      <HelpSection
        icon='🔗'
        title={t("help.relatedFeatures")}
        content={t("help.profile.relatedFeatures")}
      />
    </Stack>
  );
}

/**
 * Skill manager help content component.
 */
export function SkillManagerHelpContent(): JSX.Element {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <HelpSection
        icon='🎯'
        title={t("help.coreValue")}
        content={t("help.skill.coreValue")}
      />

      <Divider />

      <HelpSection
        icon='📚'
        title={t("help.designPhilosophy")}
        content={t("help.skill.designPhilosophy")}
      />

      <Divider />

      <HelpSection
        icon='🚀'
        title={t("help.usageProcess")}
        content={t("help.skill.usageProcess")}
      />

      <Divider />

      <HelpSection
        icon='💡'
        title={t("help.bestPractices")}
        content={t("help.skill.bestPractices")}
      />

      <Divider />

      <HelpSection
        icon='🔗'
        title={t("help.relatedFeatures")}
        content={t("help.skill.relatedFeatures")}
      />
    </Stack>
  );
}
