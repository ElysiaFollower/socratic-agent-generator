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
  const [viewingSkill, setViewingSkill] =
    useState<CustomSkillDetail | null>(null);
  const [isLoadingSkill, setIsLoadingSkill] = useState<boolean>(false);
  const [assignProfileId, setAssignProfileId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  const [deletingSkillId, setDeletingSkillId] = useState<number | null>(null);
  const [rebuildingSkillId, setRebuildingSkillId] = useState<number | null>(
    null,
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
      const target = profiles.find((profile) => profile.profile_id !== detail.profile_id);
      setAssignProfileId(target?.profile_id || "");
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
      const errorMessage =
        err instanceof Error ? err.message : "删除技能失败";
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
      const errorMessage =
        err instanceof Error ? err.message : "索引重建失败";
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
      const errorMessage =
        err instanceof Error ? err.message : "技能分配失败";
      notifyError(errorMessage);
    } finally {
      setIsAssigning(false);
    }
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
            <Box>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                {viewingSkill.name}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {viewingSkill.description}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                工具名：{viewingSkill.tool_name} · 状态：{viewingSkill.status}
              </Typography>
            </Box>
            <Paper
              variant='outlined'
              sx={{
                p: 2,
                bgcolor: "var(--color-surface-muted)",
                maxHeight: 420,
                overflowY: "auto",
              }}
            >
              <Typography
                component='pre'
                variant='body2'
                sx={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {viewingSkill.instructions || "暂无指令内容"}
              </Typography>
            </Paper>
            <Typography variant='caption' color='text.secondary'>
              资料关联：{viewingSkill.material_ids.join(", ") || "无"}
            </Typography>

            <Stack spacing={1}>
              <Typography variant='subtitle2'>分配到其他Profile</Typography>
              <FormControl size='small' fullWidth>
                <InputLabel id='assign-profile-label'>目标Profile</InputLabel>
                <Select
                  labelId='assign-profile-label'
                  label='目标Profile'
                  value={assignProfileId}
                  onChange={(event) => setAssignProfileId(event.target.value)}
                >
                  {profiles.map((profile) => (
                    <MenuItem key={profile.profile_id} value={profile.profile_id}>
                      {profile.profile_name || profile.topic_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography variant='caption' color='text.secondary'>
                分配后会复制技能定义，资料需重新关联。
              </Typography>
            </Stack>
          </Stack>
        ) : (
          <Typography variant='body2' color='text.secondary'>
            暂无内容
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setViewingSkillId(null);
            setViewingSkill(null);
          }}
          color='inherit'
        >
          关闭
        </Button>
        <Button
          onClick={handleAssignSkill}
          variant='contained'
          disabled={!viewingSkill || isAssigning}
        >
          {isAssigning ? "分配中..." : "分配"}
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
              <InputLabel id='skill-profile-select-label'>选择Profile</InputLabel>
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
              <Paper key={skill.id} variant='outlined' sx={{ p: 2 }}>
                <Stack spacing={1.5}>
                  <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                    {skill.name}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {skill.description}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    状态：{skill.status}
                    {" · "}
                    检索：{getSkillRetrievalFlag(skill) ? "是" : "否"}
                  </Typography>
                  {showDetails && (
                    <>
                      <Typography variant='caption' color='text.secondary'>
                        工具名：{skill.tool_name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        资料关联：{skill.material_ids.join(", ") || "无"}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        创建时间：{skill.create_at || "未知"}
                      </Typography>
                    </>
                  )}
                  <Stack direction='row' spacing={1} alignItems='center'>
                    <Button size='small' onClick={() => handleViewSkill(skill.id)}>
                      查看
                    </Button>
                    {getSkillRetrievalFlag(skill) && (
                      <Button
                        size='small'
                        startIcon={<Refresh fontSize='small' />}
                        onClick={() => handleRebuildSkill(skill.id)}
                        disabled={rebuildingSkillId === skill.id}
                      >
                        {rebuildingSkillId === skill.id
                          ? "重建中..."
                          : "重建索引"}
                      </Button>
                    )}
                    <Button
                      size='small'
                      color='error'
                      onClick={() => handleDeleteSkill(skill.id)}
                      disabled={deletingSkillId === skill.id}
                    >
                      {deletingSkillId === skill.id ? "删除中..." : "删除"}
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Stack>
      {skillDialog}
    </>
  );
}
