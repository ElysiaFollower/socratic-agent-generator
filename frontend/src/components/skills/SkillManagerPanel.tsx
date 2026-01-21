/**
 * Skill management panel component.
 *
 * Provides tabs for creating custom skills and managing existing ones.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Box, Tab, Tabs } from "@mui/material";
import { listProfiles } from "../../api";
import { type Profile } from "../../types";
import { useNotification } from "../../hooks";
import { SkillCreatePanel } from "./SkillCreatePanel";
import { SkillListPanel } from "./SkillListPanel";

type SkillTab = "create" | "list";

export function SkillManagerPanel(): JSX.Element {
  const { t } = useTranslation();
  const { notifyError } = useNotification();
  const [activeTab, setActiveTab] = useState<SkillTab>("create");
  const [profiles, setProfiles] = useState<readonly Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState<boolean>(false);

  const loadProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const list = await listProfiles();
      setProfiles(list);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("skill.loadProfilesFailed");
      notifyError(errorMessage);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, [notifyError, t]);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const handleTabChange = (_event: React.SyntheticEvent, value: SkillTab) => {
    setActiveTab(value);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tab label={t("skill.createTab")} value='create' />
        <Tab label={t("skill.listTab")} value='list' />
      </Tabs>
      {activeTab === "create" ? (
        <SkillCreatePanel
          profiles={profiles}
          isLoadingProfiles={isLoadingProfiles}
        />
      ) : (
        <SkillListPanel
          profiles={profiles}
          isLoadingProfiles={isLoadingProfiles}
        />
      )}
    </Box>
  );
}
