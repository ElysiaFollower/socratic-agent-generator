/**
 * Profile management panel component.
 *
 * Provides tabs for generating and managing existing profiles.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { Profile } from "../types";
import {
  deleteProfile,
  listProfiles,
  renameProfile,
  type RenameProfileRequest,
} from "../api";
import { extractCurriculumSteps } from "../utils/curriculum";
import { useNotification } from "../hooks";
import { ProfileGeneratorAdvanced } from "./ProfileGeneratorAdvanced";

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
  const { notifyError, notifySuccess } = useNotification();
  const [activeTab, setActiveTab] = useState<TabKey>("generate");
  const [profiles, setProfiles] = useState<readonly Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState<string>("");
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(
    null,
  );
  const [renamingProfile, setRenamingProfile] = useState<Profile | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setIsLoadingProfiles(true);
    setError(null);
    try {
      const list = await listProfiles();
      setProfiles(list);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载Profile列表失败";
      setError(errorMessage);
    } finally {
      setIsLoadingProfiles(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "manage") {
      void loadProfiles();
    }
  }, [activeTab, loadProfiles]);

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
    setError(null);
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm("确定要删除该Profile吗？此操作无法撤销。")) {
      return;
    }
    setDeletingProfileId(profileId);
    try {
      await deleteProfile(profileId);
      notifySuccess("Profile已删除");
      await loadProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "删除Profile失败";
      notifyError(errorMessage);
    } finally {
      setDeletingProfileId(null);
    }
  };

  const handleOpenRename = (profile: Profile) => {
    setRenamingProfile(profile);
    setRenameValue(profile.profile_name || profile.topic_name || "");
    setRenameError(null);
  };

  const handleRenameConfirm = async () => {
    if (!renamingProfile) {
      return;
    }
    const nextName = renameValue.trim();
    if (!nextName) {
      setRenameError("Profile名称不能为空");
      return;
    }
    setIsRenaming(true);
    try {
      const request: RenameProfileRequest = { profile_name: nextName };
      await renameProfile(renamingProfile.profile_id, request);
      notifySuccess("Profile已重命名");
      setRenamingProfile(null);
      await loadProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "重命名失败，请重试";
      setRenameError(errorMessage);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleGenerateSuccess = (profile: Profile) => {
    if (onGenerateSuccess) {
      onGenerateSuccess(profile);
    }
    void loadProfiles();
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
        <Stack spacing={2}>
          {filteredProfiles.map((profile) => (
            <Paper key={profile.profile_id} variant='outlined' sx={{ p: 2 }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                justifyContent='space-between'
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                    {profile.profile_name || profile.topic_name}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    <Typography variant='body2' color='text.secondary'>
                      主题: {profile.topic_name}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      目标受众: {profile.target_audience}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Profile ID: {profile.profile_id}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      实验: {profile.lab_name || "-"}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      学习步骤: {extractCurriculumSteps(profile.curriculum).length} 个
                    </Typography>
                  </Stack>
                </Box>
                <Stack direction='row' spacing={1} alignItems='center'>
                  <Tooltip title='重命名'>
                    <IconButton
                      size='small'
                      aria-label='重命名Profile'
                      onClick={() => handleOpenRename(profile)}
                    >
                      <Edit fontSize='small' />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='删除'>
                    <span>
                      <IconButton
                        size='small'
                        aria-label='删除Profile'
                        onClick={() => handleDelete(profile.profile_id)}
                        disabled={deletingProfileId === profile.profile_id}
                        color='error'
                      >
                        <Delete fontSize='small' />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
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

      {error && <Alert severity='error'>{error}</Alert>}

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

  if (variant === "panel") {
    return (
      <>
        {body}
        {actions}
        <Dialog
          open={Boolean(renamingProfile)}
          onClose={() => setRenamingProfile(null)}
          fullWidth
          maxWidth='sm'
        >
          <DialogTitle>重命名Profile</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              {renameError && <Alert severity='error'>{renameError}</Alert>}
              <TextField
                label='Profile名称'
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                fullWidth
                size='small'
                autoFocus
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setRenamingProfile(null)}
              color='inherit'
              disabled={isRenaming}
            >
              取消
            </Button>
            <Button
              onClick={handleRenameConfirm}
              variant='contained'
              disabled={isRenaming}
            >
              {isRenaming ? "保存中..." : "保存"}
            </Button>
          </DialogActions>
        </Dialog>
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
      <Dialog
        open={Boolean(renamingProfile)}
        onClose={() => setRenamingProfile(null)}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>重命名Profile</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {renameError && <Alert severity='error'>{renameError}</Alert>}
            <TextField
              label='Profile名称'
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              fullWidth
              size='small'
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setRenamingProfile(null)}
            color='inherit'
            disabled={isRenaming}
          >
            取消
          </Button>
          <Button
            onClick={handleRenameConfirm}
            variant='contained'
            disabled={isRenaming}
          >
            {isRenaming ? "保存中..." : "保存"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
