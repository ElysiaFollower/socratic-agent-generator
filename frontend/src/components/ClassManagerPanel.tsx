/**
 * Class management panel component.
 *
 * Provides class creation/joining and profile visibility management.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Add, Group, Key, Person } from "@mui/icons-material";
import {
  ClassInfo,
  ClassMemberInfo,
  InvitationCodeInfo,
  Profile,
} from "../types";
import {
  createClass,
  joinClass,
  listClassInvitations,
  listClassMembers,
  listClasses,
  updateProfileVisibility,
  generateClassInvitationCode,
} from "../api";
import { useAuth, useNotification, useProfiles } from "../hooks";

/**
 * Props for ClassManagerPanel component.
 */
interface ClassManagerPanelProps {
  readonly onClose?: () => void;
  readonly variant?: "dialog" | "panel";
}

/**
 * Class management panel component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ClassManagerPanel(props: ClassManagerPanelProps): JSX.Element {
  const { variant = "panel" } = props;
  const { user } = useAuth();
  const { notifyError, notifySuccess, notifyWarning } = useNotification();
  const { profiles, refresh: refreshProfiles } = useProfiles();

  const [classes, setClasses] = useState<readonly ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState<boolean>(false);
  const [newClassName, setNewClassName] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [invites, setInvites] = useState<readonly InvitationCodeInfo[]>([]);
  const [members, setMembers] = useState<readonly ClassMemberInfo[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState<boolean>(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] =
    useState<boolean>(false);

  const isTeacher = user?.role === "teacher" || user?.role === "admin";
  const formatRole = (role?: string) =>
    role === "teacher" ? "教师" : role === "student" ? "学生" : "-";

  const selectedClass = useMemo(
    () => classes.find((item) => item.class_id === selectedClassId) || null,
    [classes, selectedClassId],
  );

  const loadClasses = useCallback(async () => {
    setIsLoadingClasses(true);
    try {
      const response = await listClasses();
      setClasses(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载班级失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingClasses(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].class_id);
    }
  }, [classes, selectedClassId]);

  const loadInvites = useCallback(async () => {
    if (!selectedClassId || !isTeacher) {
      setInvites([]);
      return;
    }
    setIsLoadingInvites(true);
    try {
      const response = await listClassInvitations(selectedClassId);
      setInvites(response.invitation_codes);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载邀请码失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingInvites(false);
    }
  }, [isTeacher, notifyError, selectedClassId]);

  const loadMembers = useCallback(async () => {
    if (!selectedClassId || !isTeacher) {
      setMembers([]);
      return;
    }
    setIsLoadingMembers(true);
    try {
      const response = await listClassMembers(selectedClassId);
      setMembers(response);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加载成员失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [isTeacher, notifyError, selectedClassId]);

  useEffect(() => {
    void loadInvites();
    void loadMembers();
  }, [loadInvites, loadMembers]);

  const handleCreateClass = async () => {
    const name = newClassName.trim();
    if (!name) {
      notifyWarning("请输入班级名称");
      return;
    }
    try {
      const created = await createClass({ name });
      notifySuccess("班级创建成功");
      setNewClassName("");
      await loadClasses();
      setSelectedClassId(created.class_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "创建班级失败";
      notifyError(errorMessage);
    }
  };

  const handleJoinClass = async () => {
    const code = joinCode.trim();
    if (!code) {
      notifyWarning("请输入邀请码");
      return;
    }
    try {
      const joined = await joinClass({ invitation_code: code });
      notifySuccess("加入班级成功");
      setJoinCode("");
      await loadClasses();
      setSelectedClassId(joined.class_id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "加入班级失败";
      notifyError(errorMessage);
    }
  };

  const handleGenerateInvite = async () => {
    if (!selectedClassId) {
      notifyWarning("请选择班级");
      return;
    }
    try {
      const response = await generateClassInvitationCode({
        class_id: selectedClassId,
        expires_in_days: expiresInDays,
      });
      notifySuccess("邀请码生成成功");
      setInvites((prev) => [
        {
          invitation_code: response.invitation_code,
          class_id: response.class_id,
          created_by: response.created_by,
          created_at: response.created_at || new Date().toISOString(),
          expires_at: response.expires_at,
        },
        ...prev,
      ]);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "生成邀请码失败";
      notifyError(errorMessage);
    }
  };

  const handleToggleVisibility = async (
    profile: Profile,
    nextVisible: boolean,
  ) => {
    if (!selectedClassId) {
      return;
    }
    setIsUpdatingVisibility(true);
    try {
      await updateProfileVisibility(selectedClassId, profile.profile_id, {
        visible: nextVisible,
      });
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "更新可见性失败";
      notifyError(errorMessage);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const visibleProfilesForClass = useMemo(() => {
    if (!selectedClassId) {
      return [];
    }
    return profiles.filter((profile) =>
      (profile.visible_class_ids || []).includes(selectedClassId),
    );
  }, [profiles, selectedClassId]);

  const classList = (
    <Stack spacing={1.5}>
      {classes.map((item) => (
        <Paper
          key={item.class_id}
          variant='outlined'
          sx={{
            p: 1.5,
            borderRadius: 2,
            cursor: "pointer",
            borderColor:
              item.class_id === selectedClassId ? "primary.main" : "divider",
            bgcolor:
              item.class_id === selectedClassId
                ? "var(--color-surface-muted)"
                : "transparent",
          }}
          onClick={() => setSelectedClassId(item.class_id)}
        >
          <Stack direction='row' spacing={1} alignItems='center'>
            <Group fontSize='small' color='action' />
            <Typography variant='body2' sx={{ fontWeight: 600 }}>
              {item.name}
            </Typography>
            {item.role_in_class && (
              <Chip size='small' label={formatRole(item.role_in_class)} />
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );

  const teacherDetail = (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant='subtitle2'>班级邀请码</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            label='有效期（天）'
            type='number'
            inputProps={{ min: 1, max: 365 }}
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(Number(e.target.value))}
            size='small'
          />
          <Button
            variant='contained'
            onClick={handleGenerateInvite}
            disabled={!selectedClassId}
          >
            生成邀请码
          </Button>
        </Stack>
        {isLoadingInvites ? (
          <CircularProgress size={20} />
        ) : invites.length === 0 ? (
          <Typography variant='caption' color='text.secondary'>
            暂无邀请码
          </Typography>
        ) : (
          <Stack spacing={1}>
            {invites.map((invite) => (
              <Paper
                key={invite.invitation_code}
                variant='outlined'
                sx={{ p: 1 }}
              >
                <Stack direction='row' spacing={1} alignItems='center'>
                  <Key fontSize='small' color='action' />
                  <Typography variant='body2'>
                    {invite.invitation_code}
                  </Typography>
                </Stack>
                <Typography variant='caption' color='text.secondary'>
                  过期时间:{" "}
                  {invite.expires_at
                    ? new Date(invite.expires_at).toLocaleString("zh-CN")
                    : "-"}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>

      <Stack spacing={1}>
        <Typography variant='subtitle2'>班级成员</Typography>
        {isLoadingMembers ? (
          <CircularProgress size={20} />
        ) : members.length === 0 ? (
          <Typography variant='caption' color='text.secondary'>
            暂无成员
          </Typography>
        ) : (
          <Stack spacing={1}>
            {members.map((member) => (
              <Stack key={member.user_id} direction='row' spacing={1}>
                <Person fontSize='small' color='action' />
                <Typography variant='body2'>
                  {member.display_name || member.username}
                </Typography>
                <Chip size='small' label={formatRole(member.role_in_class)} />
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>

      <Stack spacing={1}>
        <Typography variant='subtitle2'>Profile 可见性</Typography>
        {profiles.length === 0 ? (
          <Typography variant='caption' color='text.secondary'>
            暂无Profile
          </Typography>
        ) : (
          <Stack spacing={1}>
            {profiles.map((profile) => {
              const isVisible = (profile.visible_class_ids || []).includes(
                selectedClassId || "",
              );
              return (
                <Paper
                  key={profile.profile_id}
                  variant='outlined'
                  sx={{ p: 1 }}
                >
                  <Stack direction='row' alignItems='center' spacing={1}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        {profile.profile_name || profile.topic_name}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ display: "block" }}
                      >
                        {profile.topic_name}
                      </Typography>
                    </Box>
                    <Switch
                      checked={isVisible}
                      onChange={(_, checked) =>
                        handleToggleVisibility(profile, checked)
                      }
                      disabled={!selectedClassId || isUpdatingVisibility}
                    />
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Stack>
  );

  const studentDetail = (
    <Stack spacing={1}>
      <Typography variant='subtitle2'>班级可见 Profile</Typography>
      {visibleProfilesForClass.length === 0 ? (
        <Typography variant='caption' color='text.secondary'>
          暂无可见 Profile
        </Typography>
      ) : (
        <Stack spacing={1}>
          {visibleProfilesForClass.map((profile) => (
            <Paper key={profile.profile_id} variant='outlined' sx={{ p: 1 }}>
              <Typography variant='body2' sx={{ fontWeight: 600 }}>
                {profile.profile_name || profile.topic_name}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {profile.topic_name}
              </Typography>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  );

  const body = (
    <Stack spacing={3} sx={{ pt: 2 }}>
      <Stack spacing={2}>
        <Typography variant='h6'>我的班级</Typography>
        {isTeacher ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label='班级名称'
              value={newClassName}
              onChange={(event) => setNewClassName(event.target.value)}
              size='small'
              fullWidth
            />
            <Button
              variant='contained'
              startIcon={<Add />}
              onClick={handleCreateClass}
              sx={{ whiteSpace: "nowrap" }}
            >
              创建班级
            </Button>
          </Stack>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label='班级邀请码'
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              size='small'
              fullWidth
            />
            <Button
              variant='contained'
              onClick={handleJoinClass}
              sx={{ whiteSpace: "nowrap" }}
            >
              加入班级
            </Button>
          </Stack>
        )}
      </Stack>

      <Divider flexItem />

      {isLoadingClasses ? (
        <Stack direction='row' spacing={1} alignItems='center'>
          <CircularProgress size={20} />
          <Typography variant='body2' color='text.secondary'>
            加载中...
          </Typography>
        </Stack>
      ) : classes.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          暂无班级
        </Typography>
      ) : (
        <Stack spacing={2}>
          {classList}
          {selectedClass && (
            <Paper variant='outlined' sx={{ p: 2 }}>
              <Typography variant='subtitle1' sx={{ mb: 1, fontWeight: 600 }}>
                班级详情 - {selectedClass.name}
              </Typography>
              {isTeacher ? teacherDetail : studentDetail}
            </Paper>
          )}
        </Stack>
      )}
    </Stack>
  );

  if (variant === "panel") {
    return <>{body}</>;
  }

  return (
    <Paper variant='outlined' sx={{ p: 3 }}>
      {body}
    </Paper>
  );
}
