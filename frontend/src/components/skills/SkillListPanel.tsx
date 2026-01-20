/**
 * Skill list panel.
 *
 * Shows existing custom skills and allows assignment to profiles.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { Refresh } from "@mui/icons-material";
import {
  assignCustomSkill,
  deleteCustomSkill,
  getCustomSkill,
  listCustomSkills,
  rebuildCustomSkillIndex,
  type CustomSkillDetail,
  type CustomSkillInfo,
} from "../../api";
import { type Profile } from "../../types";
import { useConfirmDialog, useNotification } from "../../hooks";
import { SkillCard, SkillDetailCard } from "./SkillCard";
import { ProfileCard } from "../profile/ProfileCard";

interface SkillListPanelProps {
  readonly profiles: readonly Profile[];
  readonly isLoadingProfiles: boolean;
}

export function SkillListPanel(props: SkillListPanelProps): JSX.Element {
  const { profiles, isLoadingProfiles } = props;
  const { notifyError, notifySuccess } = useNotification();
  const { confirm } = useConfirmDialog();

  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [skills, setSkills] = useState<readonly CustomSkillInfo[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState<boolean>(false);
  const [showDetails, setShowDetails] = useState<boolean>(false);

  const [viewingSkillId, setViewingSkillId] = useState<number | null>(null);
  const [viewingSkill, setViewingSkill] = useState<CustomSkillDetail | null>(
    null,
  );
  const [isLoadingSkill, setIsLoadingSkill] = useState<boolean>(false);
  const [assignProfileId, setAssignProfileId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const [deletingSkillId, setDeletingSkillId] = useState<number | null>(null);
  const [rebuildingSkillId, setRebuildingSkillId] = useState<number | null>(
    null,
  );

  // State for managing profile assignment modal
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(profiles[0].profile_id);
    }
  }, [profiles, selectedProfileId]);

  const getSkillRetrievalFlag = (skill: CustomSkillInfo): boolean => {
    const flag = skill.meta_info?.retrieval_needed;
    return Boolean(flag);
  };

  const loadSkills = useCallback(async () => {
    if (!selectedProfileId) {
      setSkills([]);
      return;
    }
    setIsLoadingSkills(true);
    try {
      const list = await listCustomSkills(selectedProfileId);
      setSkills(list);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载自定义技能失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingSkills(false);
    }
  }, [notifyError, selectedProfileId]);

  useEffect(() => {
    void loadSkills();
    setViewingSkillId(null);
    setViewingSkill(null);
  }, [loadSkills, selectedProfileId]);

  const handleViewSkill = async (skillId: number) => {
    setViewingSkillId(skillId);
    setViewingSkill(null);
    setIsLoadingSkill(true);
    try {
      const detail = await getCustomSkill(skillId);
      setViewingSkill(detail);
      const target = profiles.find(
        (profile) => profile.profile_id !== detail.profile_id,
      );
      setAssignProfileId(target?.profile_id || "");

      // Initialize selected profiles with the current skill's profile
      setSelectedProfiles(new Set([detail.profile_id]));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载技能详情失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingSkill(false);
    }
  };

  const handleDeleteSkill = async (skillId: number) => {
    const shouldDelete = await confirm({
      title: "删除自定义技能",
      description: "确定要删除该技能吗？此操作无法撤销。",
      confirmLabel: "删除",
      confirmColor: "error",
    });
    if (!shouldDelete) {
      return;
    }
    setDeletingSkillId(skillId);
    try {
      await deleteCustomSkill(skillId);
      notifySuccess("技能已删除");
      await loadSkills();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "删除技能失败";
      notifyError(errorMessage);
    } finally {
      setDeletingSkillId(null);
    }
  };

  const handleRebuildSkill = async (skillId: number) => {
    setRebuildingSkillId(skillId);
    try {
      await rebuildCustomSkillIndex(skillId);
      notifySuccess("索引重建完成");
      await loadSkills();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "索引重建失败";
      notifyError(errorMessage);
    } finally {
      setRebuildingSkillId(null);
    }
  };

  const handleAssignSkill = async () => {
    if (!viewingSkill || !assignProfileId) {
      notifyError("请选择目标Profile");
      return;
    }
    if (assignProfileId === viewingSkill.profile_id) {
      notifyError("请选择不同的Profile进行分配");
      return;
    }
    setIsAssigning(true);
    try {
      await assignCustomSkill(viewingSkill.id, {
        profile_id: assignProfileId,
        material_ids: [],
      });
      notifySuccess("技能已分配到目标Profile");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "技能分配失败";
      notifyError(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleOpenProfileModal = () => {
    if (viewingSkill) {
      // Initialize selected profiles with the current skill's profile
      setSelectedProfiles(new Set([viewingSkill.profile_id]));
      setIsProfileModalOpen(true);
    }
  };

  const handleCloseProfileModal = () => {
    setIsProfileModalOpen(false);
  };

  const handleSaveProfileAssignments = async () => {
    if (!viewingSkill) {
      return;
    }

    // Find profiles that were added (in selected but not in original)
    const originalProfileSet = new Set([viewingSkill.profile_id]);
    const addedProfiles = [...selectedProfiles].filter(
      (id) => !originalProfileSet.has(id),
    );

    // Find profiles that were removed (in original but not in selected)
    const removedProfiles = [...originalProfileSet].filter(
      (id) => !selectedProfiles.has(id),
    );

    // Process assignments
    for (const profileId of addedProfiles) {
      try {
        await assignCustomSkill(viewingSkill.id, {
          profile_id: profileId,
          material_ids: [],
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "添加技能到Profile失败";
        notifyError(`${errorMessage}: ${profileId}`);
      }
    }

    // Note: Currently, we can't remove skills from profiles with the available API
    // The assignCustomSkill API creates a copy of the skill in the target profile
    // So effectively, we're only adding skills to new profiles

    notifySuccess("技能分配已更新");
    setIsProfileModalOpen(false);
  };

  const handleProfileSelectionChange = (profileId: string) => {
    setSelectedProfiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(profileId)) {
        newSet.delete(profileId);
      } else {
        newSet.add(profileId);
      }
      return newSet;
    });
  };

  const skillDialog = (
    <Dialog
      open={Boolean(viewingSkillId)}
      onClose={() => {
        setViewingSkillId(null);
        setViewingSkill(null);
        setAssignProfileId("");
      }}
      fullWidth
      maxWidth='md'
    >
      <DialogTitle>技能详情</DialogTitle>
      <DialogContent dividers>
        {isLoadingSkill ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : viewingSkill ? (
          <Stack spacing={2}>
            <SkillDetailCard skill={viewingSkill} />

            <Stack direction='row' spacing={1} alignItems='center'>
              <Typography variant='subtitle2'>技能使用情况</Typography>
              <Button
                variant='outlined'
                size='small'
                onClick={handleOpenProfileModal}
              >
                编辑
              </Button>
            </Stack>

            <Stack spacing={1}>
              {profiles
                .filter((profile) => selectedProfiles.has(profile.profile_id))
                .map((profile) => (
                  <Stack
                    key={profile.profile_id}
                    direction='row'
                    spacing={1}
                    alignItems='center'
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: "var(--color-surface-muted)",
                    }}
                  >
                    <Box>
                      <Typography variant='body2' sx={{ fontWeight: 500 }}>
                        {profile.profile_name || profile.topic_name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {profile.profile_id}
                      </Typography>
                    </Box>
                  </Stack>
                ))}
            </Stack>
          </Stack>
        ) : (
          <Typography variant='body2' color='text.secondary'>
            暂无内容
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );

  // Profile assignment modal
  const profileModal = (
    <Dialog
      open={isProfileModalOpen}
      onClose={handleCloseProfileModal}
      fullWidth
      maxWidth='sm'
    >
      <DialogTitle>编辑技能使用情况</DialogTitle>
      <DialogContent dividers>
        <Typography variant='body2' color='text.secondary' gutterBottom>
          将此技能共享给Profile:
        </Typography>
        <Box sx={{ py: 1, maxHeight: 400, overflow: "auto" }}>
          <Stack spacing={1}>
            {profiles.map((profile) => (
              <ProfileCard
                key={`profile-${profile.profile_id}`}
                profile={profile}
                selectable
                selected={selectedProfiles.has(profile.profile_id)}
                onSelectToggle={() =>
                  handleProfileSelectionChange(profile.profile_id)
                }
              />
            ))}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCloseProfileModal} color='inherit'>
          取消
        </Button>
        <Button onClick={handleSaveProfileAssignments} variant='contained'>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      <Stack spacing={2}>
        <Paper variant='outlined' sx={{ p: 2 }}>
          <Stack spacing={2}>
            <FormControl size='small' fullWidth>
              <InputLabel id='skill-profile-select-label'>
                选择Profile
              </InputLabel>
              <Select
                labelId='skill-profile-select-label'
                label='选择Profile'
                value={selectedProfileId}
                displayEmpty
                onChange={(event) => setSelectedProfileId(event.target.value)}
                disabled={isLoadingProfiles}
              >
                <MenuItem value=''>
                  <em>请选择Profile</em>
                </MenuItem>
                {profiles.map((profile) => (
                  <MenuItem key={profile.profile_id} value={profile.profile_id}>
                    {profile.profile_name || profile.topic_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={showDetails}
                  onChange={(event) => setShowDetails(event.target.checked)}
                />
              }
              label='显示详情'
            />
          </Stack>
        </Paper>

        {isLoadingSkills ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : skills.length === 0 ? (
          <Typography variant='body2' color='text.secondary' textAlign='center'>
            暂无自定义技能
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            {skills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                showDetails={showDetails}
                onAction={() => handleViewSkill(skill.id)}
                onRebuild={handleRebuildSkill}
                onDelete={handleDeleteSkill}
                isRebuilding={rebuildingSkillId === skill.id}
                isDeleting={deletingSkillId === skill.id}
              />
            ))}
          </Box>
        )}
      </Stack>
      {skillDialog}
      {profileModal}
    </>
  );
}
