/**
 * Profile management panel component.
 *
 * Provides tabs for generating and managing existing profiles.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { Delete } from "@mui/icons-material";
import { Profile } from "../types";
import {
  deleteProfile,
  listProfiles,
  renameProfile,
  type RenameProfileRequest,
} from "../api";
import { useConfirmDialog, useNotification } from "../hooks";
import { ProfileGeneratorAdvanced } from "./ProfileGeneratorAdvanced";
import { ProfileCard, ProfileDetailCard } from "./ProfileCard";

/**
 * Props for ProfileManagerPanel component.
 */
interface ProfileManagerPanelProps {
  readonly onGenerateSuccess?: (profile: Profile) => void;
  readonly onClose?: () => void;
  readonly variant?: "dialog" | "panel";
}

type TabKey = "generate" | "manage";

/**
 * Profile management panel component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileManagerPanel(
  props: ProfileManagerPanelProps,
): JSX.Element {
  const { onGenerateSuccess, onClose, variant = "panel" } = props;
  const { notifyError, notifySuccess, notifyWarning } = useNotification();
  const { confirm } = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<TabKey>("generate");
  const [profiles, setProfiles] = useState<readonly Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>("");
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(
    null,
  );
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isRenamingProfile, setIsRenamingProfile] = useState<boolean>(false);

  const loadProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    try {
      const list = await listProfiles();
      setProfiles(list);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载Profile列表失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, [notifyError]);

  useEffect(() => {
    if (activeTab === "manage") {
      void loadProfiles();
    }
  }, [activeTab, loadProfiles]);

  useEffect(() => {
    if (!activeProfile) {
      return;
    }
    const updated = profiles.find(
      (profile) => profile.profile_id === activeProfile.profile_id,
    );
    if (updated && updated !== activeProfile) {
      setActiveProfile(updated);
    }
  }, [activeProfile, profiles]);

  const filteredProfiles = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return profiles;
    }
    return profiles.filter((profile) => {
      const fields = [
        profile.profile_name,
        profile.topic_name,
        profile.target_audience,
        profile.lab_name,
        profile.profile_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(query);
    });
  }, [profiles, searchText]);

  const handleTabChange = (_event: React.SyntheticEvent, value: TabKey) => {
    setActiveTab(value);
  };

  const handleDelete = async (profileId: string) => {
    const shouldDelete = await confirm({
      title: "删除Profile",
      description: "确定要删除该Profile吗？此操作无法撤销。",
      confirmLabel: "删除",
      confirmColor: "error",
    });
    if (!shouldDelete) {
      return;
    }
    setDeletingProfileId(profileId);
    try {
      await deleteProfile(profileId);
      notifySuccess("Profile已删除");
      if (activeProfile?.profile_id === profileId) {
        setActiveProfile(null);
      }
      await loadProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "删除Profile失败";
      notifyError(errorMessage);
    } finally {
      setDeletingProfileId(null);
    }
  };

  const handleRenameProfile = async (profile: Profile, nextName: string) => {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      notifyWarning("Profile名称不能为空");
      return;
    }
    setIsRenamingProfile(true);
    try {
      const request: RenameProfileRequest = { profile_name: trimmedName };
      await renameProfile(profile.profile_id, request);
      notifySuccess("Profile已重命名");
      await loadProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "重命名失败，请重试";
      notifyError(errorMessage);
    } finally {
      setIsRenamingProfile(false);
    }
  };

  const handleGenerateSuccess = (profile: Profile) => {
    if (onGenerateSuccess) {
      onGenerateSuccess(profile);
    }
    setActiveTab("manage");
  };

  const manageBody = (
    <Stack spacing={2}>
      <TextField
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        placeholder='搜索Profile名称、主题或ID'
        size='small'
        fullWidth
      />

      {isLoadingProfiles ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <CircularProgress size={24} />
        </Box>
      ) : filteredProfiles.length === 0 ? (
        <Typography color='text.secondary' textAlign='center' sx={{ py: 4 }}>
          暂无Profile记录
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          {filteredProfiles.map((profile) => (
            <ProfileCard
              key={profile.profile_id}
              profile={profile}
              onClick={() => setActiveProfile(profile)}
            />
          ))}
        </Box>
      )}
    </Stack>
  );

  const body = (
    <Stack spacing={2}>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label='Profile管理标签页'
      >
        <Tab value='generate' label='生成Profile' />
        <Tab value='manage' label='管理Profile' />
      </Tabs>

      {activeTab === "generate" && (
        <ProfileGeneratorAdvanced
          variant='panel'
          onGenerateSuccess={handleGenerateSuccess}
        />
      )}

      {activeTab === "manage" && manageBody}
    </Stack>
  );

  const actions = onClose ? (
    <Stack direction='row' justifyContent='flex-end' sx={{ pt: 1 }}>
      <Button onClick={onClose} color='inherit'>
        关闭
      </Button>
    </Stack>
  ) : null;

  const detailDialog = (
    <Dialog
      open={Boolean(activeProfile)}
      onClose={() => setActiveProfile(null)}
      fullWidth
      maxWidth='md'
    >
      <DialogTitle>Profile 详情</DialogTitle>
      <DialogContent dividers>
        {activeProfile && (
          <ProfileDetailCard
            profile={activeProfile}
            mode='teacher'
            onRename={handleRenameProfile}
            isRenaming={isRenamingProfile}
            actions={
              <Stack
                direction='row'
                spacing={1}
                justifyContent='flex-end'
                sx={{ width: "100%" }}
              >
                <Button
                  variant='outlined'
                  color='error'
                  startIcon={<Delete fontSize='small' />}
                  onClick={() => handleDelete(activeProfile.profile_id)}
                  disabled={deletingProfileId === activeProfile.profile_id}
                >
                  删除Profile
                </Button>
              </Stack>
            }
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setActiveProfile(null)} color='inherit'>
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (variant === "panel") {
    return (
      <>
        {body}
        {actions}
        {detailDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth='lg'>
        <DialogTitle>Profile管理</DialogTitle>
        <DialogContent dividers>{body}</DialogContent>
        <DialogActions>{actions}</DialogActions>
      </Dialog>
      {detailDialog}
    </>
  );
}
