/**
 * Class management panel component.
 *
 * Provides class creation/joining and profile visibility management.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Add,
  CalendarTodayOutlined,
  ContentCopy,
  Delete,
  DescriptionOutlined,
  Edit,
  Key,
  PeopleOutline,
  Person,
} from "@mui/icons-material";
import {
  ClassInfo,
  ClassMemberInfo,
  InvitationCodeInfo,
  Profile,
} from "../../types";
import {
  createClass,
  joinClass,
  listClassInvitations,
  listClassMembers,
  listClasses,
  renameProfile,
  updateProfileVisibility,
  generateClassInvitationCode,
  deleteClassInvitationCode,
  updateClassInvitationCode,
} from "../../api";
import {
  useAuth,
  useClipboard,
  useNotification,
  useProfiles,
} from "../../hooks";
import { ProfileCard, ProfileDetailCard } from "../profile/ProfileCard";

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
  const { copyToClipboard } = useClipboard();
  const { profiles, refresh: refreshProfiles } = useProfiles();

  const [classes, setClasses] = useState<readonly ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState<boolean>(false);
  const [joinCode, setJoinCode] = useState<string>("");
  const [isJoinClassOpen, setIsJoinClassOpen] = useState<boolean>(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(30);
  const [invites, setInvites] = useState<readonly InvitationCodeInfo[]>([]);
  const [members, setMembers] = useState<readonly ClassMemberInfo[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState<boolean>(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] =
    useState<boolean>(false);
  const [isRenamingProfile, setIsRenamingProfile] = useState<boolean>(false);
  const [isAddProfileOpen, setIsAddProfileOpen] = useState<boolean>(false);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [classSearchText, setClassSearchText] = useState<string>("");
  const [isCreateClassOpen, setIsCreateClassOpen] = useState<boolean>(false);
  const [createClassName, setCreateClassName] = useState<string>("");
  const [createInviteCode, setCreateInviteCode] = useState<string>("");
  const [isCreatingClass, setIsCreatingClass] = useState<boolean>(false);
  const [createdClassId, setCreatedClassId] = useState<string | null>(null);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(
    new Set(),
  );
  const [createProfileSearchText, setCreateProfileSearchText] =
    useState<string>("");
  const [editingInviteCode, setEditingInviteCode] = useState<string | null>(
    null,
  );
  const [editExpiresInDays, setEditExpiresInDays] = useState<number>(30);
  const [isUpdatingInvite, setIsUpdatingInvite] = useState<boolean>(false);
  const [classMemberCounts, setClassMemberCounts] = useState<
    Record<string, number>
  >({});

  const isTeacher = user?.role === "teacher" || user?.role === "admin";
  const formatRole = (role?: string) =>
    role === "teacher" ? "教师" : role === "student" ? "学生" : "-";
  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }
    return parsed.toLocaleDateString("zh-CN");
  };
  const buildAvatarLabel = (name: string) =>
    name.replace(/\s+/g, "").slice(0, 4);

  const selectedClass = useMemo(
    () => classes.find((item) => item.class_id === selectedClassId) || null,
    [classes, selectedClassId],
  );

  const filteredClasses = useMemo(() => {
    const query = classSearchText.trim().toLowerCase();
    if (!query) {
      return classes;
    }
    return classes.filter((item) => {
      const fields = [item.name, item.class_id]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(query);
    });
  }, [classSearchText, classes]);

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

  useEffect(() => {
    if (filteredClasses.length === 0) {
      return;
    }
    if (
      selectedClassId &&
      filteredClasses.some((item) => item.class_id === selectedClassId)
    ) {
      return;
    }
    setSelectedClassId(filteredClasses[0].class_id);
  }, [filteredClasses, selectedClassId]);

  useEffect(() => {
    setIsAddProfileOpen(false);
    setActiveProfile(null);
  }, [selectedClassId]);

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

  useEffect(() => {
    if (!isTeacher || classes.length === 0) {
      setClassMemberCounts({});
      return;
    }

    let isActive = true;
    const loadCounts = async () => {
      const results = await Promise.all(
        classes.map(async (item) => {
          try {
            const response = await listClassMembers(item.class_id);
            return [item.class_id, response.length] as const;
          } catch (err) {
            return [item.class_id, 0] as const;
          }
        }),
      );
      if (!isActive) {
        return;
      }
      setClassMemberCounts(Object.fromEntries(results));
    };

    void loadCounts();

    return () => {
      isActive = false;
    };
  }, [classes, isTeacher]);

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
      setClassMemberCounts((prev) => ({
        ...prev,
        [selectedClassId]: response.length,
      }));
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

  const resetCreateModal = () => {
    setCreateClassName("");
    setCreateInviteCode("");
    setCreatedClassId(null);
    setSelectedProfileIds(new Set());
    setCreateProfileSearchText("");
  };

  const handleOpenCreateClass = () => {
    resetCreateModal();
    setIsCreateClassOpen(true);
  };

  const handleCloseCreateClass = () => {
    setIsCreateClassOpen(false);
    resetCreateModal();
  };

  const handleOpenJoinClass = () => {
    setJoinCode("");
    setIsJoinClassOpen(true);
  };

  const handleCloseJoinClass = () => {
    setIsJoinClassOpen(false);
    setJoinCode("");
  };

  const handleToggleProfileSelection = (profileId: string) => {
    if (createdClassId || isCreatingClass) {
      return;
    }
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else {
        next.add(profileId);
      }
      return next;
    });
  };

  const copyInviteCode = async (code: string) => {
    if (!code) {
      return;
    }
    await copyToClipboard(code, "邀请码已复制", "复制失败，请重试");
  };

  const handleCreateClass = async () => {
    const name = createClassName.trim();
    if (!name) {
      notifyWarning("请输入班级名称");
      return;
    }
    setIsCreatingClass(true);
    try {
      const created = await createClass({ name });
      setCreatedClassId(created.class_id);
      let inviteCode = "";
      try {
        const invite = await generateClassInvitationCode({
          class_id: created.class_id,
          expires_in_days: expiresInDays,
        });
        inviteCode = invite.invitation_code;
        setCreateInviteCode(inviteCode);
      } catch (err) {
        notifyError("邀请码生成失败，请稍后重试");
      }

      if (selectedProfileIds.size > 0) {
        await Promise.all(
          Array.from(selectedProfileIds).map((profileId) =>
            updateProfileVisibility(created.class_id, profileId, {
              visible: true,
            }),
          ),
        );
      }

      notifySuccess("班级创建成功");
      await loadClasses();
      setSelectedClassId(created.class_id);
      await refreshProfiles();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "创建班级失败";
      notifyError(errorMessage);
    } finally {
      setIsCreatingClass(false);
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
      setIsJoinClassOpen(false);
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

  const handleDeleteInvite = async (code: string) => {
    if (!selectedClassId) {
      return;
    }
    if (!confirm("确定要删除此邀请码吗？")) {
      return;
    }
    try {
      await deleteClassInvitationCode(selectedClassId, code);
      notifySuccess("邀请码已删除");
      setInvites((prev) => prev.filter((invite) => invite.invitation_code !== code));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "删除邀请码失败";
      notifyError(errorMessage);
    }
  };

  const handleOpenEditInvite = (invite: InvitationCodeInfo) => {
    if (!invite.expires_at) {
      setEditExpiresInDays(30);
    } else {
      const expiresAt = new Date(invite.expires_at);
      const now = new Date();
      const daysRemaining = Math.ceil(
        (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      setEditExpiresInDays(Math.max(1, daysRemaining));
    }
    setEditingInviteCode(invite.invitation_code);
  };

  const handleCloseEditInvite = () => {
    setEditingInviteCode(null);
    setEditExpiresInDays(30);
  };

  const handleUpdateInvite = async () => {
    if (!selectedClassId || !editingInviteCode) {
      return;
    }
    if (editExpiresInDays < 1 || editExpiresInDays > 365) {
      notifyWarning("有效期必须在1-365天之间");
      return;
    }
    setIsUpdatingInvite(true);
    try {
      const response = await updateClassInvitationCode(
        selectedClassId,
        editingInviteCode,
        editExpiresInDays,
      );
      notifySuccess("邀请码过期日期已更新");
      setInvites((prev) =>
        prev.map((invite) =>
          invite.invitation_code === editingInviteCode
            ? {
                ...invite,
                expires_at: response.expires_at,
              }
            : invite,
        ),
      );
      handleCloseEditInvite();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "更新邀请码失败";
      notifyError(errorMessage);
    } finally {
      setIsUpdatingInvite(false);
    }
  };

  const handleCloseAddProfile = () => {
    setIsAddProfileOpen(false);
  };

  const handleAddProfileToClass = async (profile: Profile) => {
    if (!selectedClassId) {
      return;
    }
    setIsUpdatingVisibility(true);
    try {
      await updateProfileVisibility(selectedClassId, profile.profile_id, {
        visible: true,
      });
      notifySuccess("已添加到班级");
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "更新可见性失败";
      notifyError(errorMessage);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleRemoveProfileFromClass = async (profile: Profile) => {
    if (!selectedClassId) {
      return;
    }
    setIsUpdatingVisibility(true);
    try {
      await updateProfileVisibility(selectedClassId, profile.profile_id, {
        visible: false,
      });
      notifySuccess("已从班级移除");
      setActiveProfile((prev) =>
        prev?.profile_id === profile.profile_id ? null : prev,
      );
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "更新可见性失败";
      notifyError(errorMessage);
    } finally {
      setIsUpdatingVisibility(false);
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
      await renameProfile(profile.profile_id, { profile_name: trimmedName });
      notifySuccess("Profile已更新");
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "更新Profile失败";
      notifyError(errorMessage);
    } finally {
      setIsRenamingProfile(false);
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

  const availableProfilesForClass = useMemo(() => {
    if (!selectedClassId) {
      return [];
    }
    const visibleIds = new Set(
      visibleProfilesForClass.map((profile) => profile.profile_id),
    );
    return profiles.filter((profile) => !visibleIds.has(profile.profile_id));
  }, [profiles, selectedClassId, visibleProfilesForClass]);

  const filteredCreateProfiles = useMemo(() => {
    const query = createProfileSearchText.trim().toLowerCase();
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
  }, [createProfileSearchText, profiles]);

  const profileCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    profiles.forEach((profile) => {
      (profile.visible_class_ids || []).forEach((classId) => {
        counts[classId] = (counts[classId] || 0) + 1;
      });
    });
    return counts;
  }, [profiles]);

  const classList = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr 1fr" },
        gap: 2,
      }}
    >
      {filteredClasses.map((item) => {
        const isSelected = item.class_id === selectedClassId;
        const memberCount = classMemberCounts[item.class_id];
        const profileCount = profileCounts[item.class_id] || 0;
        const avatarLabel = buildAvatarLabel(item.name) || "-";

        return (
          <Card
            key={item.class_id}
            variant='outlined'
            onClick={() => setSelectedClassId(item.class_id)}
            sx={{
              cursor: "pointer",
              borderColor: isSelected ? "primary.main" : "divider",
              bgcolor: isSelected
                ? "var(--color-surface-muted)"
                : "transparent",
              transition: "border-color 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                boxShadow: 1,
              },
            }}
          >
            <CardContent
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                "&:last-child": { pb: 2 },
              }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Stack direction='row' spacing={1} alignItems='center'>
                  <Typography
                    variant='subtitle1'
                    sx={{ fontWeight: 600 }}
                    noWrap
                  >
                    {item.name}
                  </Typography>
                  {item.role_in_class && (
                    <Chip size='small' label={formatRole(item.role_in_class)} />
                  )}
                </Stack>
                <Stack direction='row' spacing={0.5} alignItems='center'>
                  <PeopleOutline fontSize='inherit' color='action' />
                  <Typography variant='caption' color='text.secondary'>
                    人数: {memberCount ?? "-"}
                  </Typography>
                </Stack>
                <Stack direction='row' spacing={0.5} alignItems='center'>
                  <CalendarTodayOutlined fontSize='inherit' color='action' />
                  <Typography variant='caption' color='text.secondary'>
                    创建日期: {formatDate(item.created_at)}
                  </Typography>
                </Stack>
                <Stack direction='row' spacing={0.5} alignItems='center'>
                  <DescriptionOutlined fontSize='inherit' color='action' />
                  <Typography variant='caption' color='text.secondary'>
                    Profile数: {profileCount}
                  </Typography>
                </Stack>
              </Stack>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  bgcolor: "var(--color-surface-muted)",
                  color: "text.primary",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: 0.5,
                  flexShrink: 0,
                  padding: 1,
                }}
              >
                {avatarLabel}
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );

  const isCodeExpired = (expiresAt?: string | null): boolean => {
    if (!expiresAt) {
      return false;
    }
    const expiresTime = Date.parse(expiresAt);
    if (Number.isNaN(expiresTime)) {
      return false;
    }
    return Date.now() > expiresTime;
  };

  const teacherDetail = (
    <Stack spacing={2}>
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
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
        >
          <Typography variant='subtitle2'>班级邀请码</Typography>
          <Stack direction='row' spacing={1}>
            <TextField
              type='number'
              size='small'
              label='有效期（天）'
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              inputProps={{ min: 1, max: 365 }}
              sx={{ width: 120 }}
            />
            <Button
              size='small'
              variant='outlined'
              onClick={handleGenerateInvite}
              disabled={!selectedClassId || isLoadingInvites}
            >
              {isLoadingInvites ? "生成中..." : "生成邀请码"}
            </Button>
          </Stack>
        </Stack>
        {isLoadingInvites ? (
          <CircularProgress size={20} />
        ) : invites.length === 0 ? (
          <Typography variant='caption' color='text.secondary'>
            暂无邀请码，点击"生成邀请码"创建
          </Typography>
        ) : (
          <Stack spacing={1}>
            {invites.map((invite) => {
              const expired = isCodeExpired(invite.expires_at);
              return (
                <Box
                  key={invite.invitation_code}
                  sx={{
                    border: "1px solid var(--color-border)",
                    borderRadius: 1,
                    p: 1.5,
                    bgcolor: "var(--color-surface)",
                  }}
                >
                  <Stack spacing={1}>
                    <Stack
                      direction='row'
                      alignItems='center'
                      justifyContent='space-between'
                    >
                      <Typography
                        variant='body2'
                        color={expired ? "text.secondary" : "text.primary"}
                        sx={{
                          fontWeight: 600,
                          fontFamily: "monospace",
                        }}
                      >
                        {invite.invitation_code}
                      </Typography>
                      <Stack direction='row' spacing={1} alignItems='center'>
                        <Tooltip title={expired ? "邀请码已过期" : "复制邀请码"}>
                          <span>
                            <IconButton
                              size='small'
                              aria-label='复制邀请码'
                              onClick={() =>
                                copyToClipboard(
                                  invite.invitation_code,
                                  "邀请码已复制",
                                  "复制失败",
                                )
                              }
                              disabled={expired}
                            >
                              <ContentCopy fontSize='small' />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title='修改过期日期'>
                          <span>
                            <IconButton
                              size='small'
                              aria-label='修改过期日期'
                              onClick={() => handleOpenEditInvite(invite)}
                            >
                              <Edit fontSize='small' />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title='删除邀请码'>
                          <span>
                            <IconButton
                              size='small'
                              aria-label='删除邀请码'
                              onClick={() => handleDeleteInvite(invite.invitation_code)}
                              color='error'
                            >
                              <Delete fontSize='small' />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Chip
                          size='small'
                          color={expired ? "default" : "success"}
                          label={expired ? "过期" : "有效"}
                          variant={expired ? "outlined" : "filled"}
                        />
                      </Stack>
                    </Stack>
                    <Stack direction='row' spacing={2} flexWrap='wrap'>
                      <Typography variant='caption' color='text.secondary'>
                        创建时间:{" "}
                        {new Date(invite.created_at).toLocaleString("zh-CN")}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        到期时间:{" "}
                        {invite.expires_at
                          ? new Date(invite.expires_at).toLocaleString("zh-CN")
                          : "-"}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </Stack>

      <Stack spacing={1}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
        >
          <Typography variant='subtitle2'>班级内的Profile</Typography>
          <Button
            size='small'
            variant='outlined'
            startIcon={<Add />}
            onClick={() => setIsAddProfileOpen(true)}
            disabled={!selectedClassId}
          >
            添加Profile
          </Button>
        </Stack>
        {visibleProfilesForClass.length === 0 ? (
          <Typography variant='caption' color='text.secondary'>
            暂无可见 Profile
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            {visibleProfilesForClass.map((profile) => (
              <ProfileCard
                key={profile.profile_id}
                profile={profile}
                onClick={() => setActiveProfile(profile)}
              />
            ))}
          </Box>
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
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 2,
          }}
        >
          {visibleProfilesForClass.map((profile) => (
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
    <Stack spacing={3} sx={{ pt: 2 }}>
      <Stack spacing={2}>
        <Typography variant='h6'>我的班级</Typography>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ md: "center" }}
        >
          <TextField
            value={classSearchText}
            onChange={(event) => setClassSearchText(event.target.value)}
            placeholder='搜索班级名称或ID'
            size='small'
            fullWidth
          />
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ width: { xs: "100%", md: "auto" } }}
          >
            {isTeacher && (
              <Button
                variant='contained'
                startIcon={<Add />}
                onClick={handleOpenCreateClass}
                sx={{ whiteSpace: "nowrap" }}
              >
                创建班级
              </Button>
            )}
            <Button
              variant={isTeacher ? "outlined" : "contained"}
              onClick={handleOpenJoinClass}
              sx={{ whiteSpace: "nowrap" }}
            >
              加入班级
            </Button>
          </Stack>
        </Stack>
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
      ) : filteredClasses.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          未找到匹配的班级
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

  const profileDialogs = (
    <>
      <Dialog
        open={isCreateClassOpen}
        onClose={handleCloseCreateClass}
        fullWidth
        maxWidth='md'
      >
        <DialogTitle>创建班级</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label='班级名称'
              value={createClassName}
              onChange={(event) => setCreateClassName(event.target.value)}
              size='small'
              fullWidth
              disabled={isCreatingClass || Boolean(createdClassId)}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label='邀请码'
                value={createInviteCode}
                placeholder={
                  createdClassId
                    ? "邀请码生成失败，可在班级详情重试"
                    : "创建后自动生成"
                }
                size='small'
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <IconButton
                color='primary'
                onClick={() => void copyInviteCode(createInviteCode)}
                disabled={!createInviteCode}
                sx={{ alignSelf: "center" }}
              >
                <ContentCopy fontSize='small' />
              </IconButton>
            </Stack>
            <Divider flexItem />
            <Stack spacing={1}>
              <TextField
                value={createProfileSearchText}
                onChange={(event) =>
                  setCreateProfileSearchText(event.target.value)
                }
                placeholder='搜索Profile名称、主题或ID'
                size='small'
                fullWidth
                disabled={isCreatingClass || Boolean(createdClassId)}
              />
              {filteredCreateProfiles.length === 0 ? (
                <Typography
                  variant='body2'
                  color='text.secondary'
                  textAlign='center'
                  sx={{ py: 3 }}
                >
                  未找到匹配Profile
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                  }}
                >
                  {filteredCreateProfiles.map((profile) => (
                    <ProfileCard
                      key={profile.profile_id}
                      profile={profile}
                      selectable
                      selected={selectedProfileIds.has(profile.profile_id)}
                      onSelectToggle={() =>
                        handleToggleProfileSelection(profile.profile_id)
                      }
                      actionDisabled={isCreatingClass}
                    />
                  ))}
                </Box>
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateClass} color='inherit'>
            关闭
          </Button>
          <Button
            variant='contained'
            onClick={() => void handleCreateClass()}
            disabled={isCreatingClass || Boolean(createdClassId)}
          >
            {isCreatingClass ? "创建中..." : "创建班级"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isJoinClassOpen}
        onClose={handleCloseJoinClass}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>加入班级</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label='班级邀请码'
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              size='small'
              fullWidth
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseJoinClass} color='inherit'>
            取消
          </Button>
          <Button variant='contained' onClick={() => void handleJoinClass()}>
            加入班级
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isAddProfileOpen}
        onClose={handleCloseAddProfile}
        fullWidth
        maxWidth='md'
      >
        <DialogTitle>添加 Profile 到班级</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {availableProfilesForClass.length === 0 ? (
              <Typography
                variant='body2'
                color='text.secondary'
                textAlign='center'
                sx={{ py: 4 }}
              >
                {profiles.length === 0
                  ? "暂无Profile可添加"
                  : "该班级已添加所有Profile"}
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2,
                }}
              >
                {availableProfilesForClass.map((profile) => (
                  <ProfileCard
                    key={profile.profile_id}
                    profile={profile}
                    actionLabel='添加'
                    onAction={() => handleAddProfileToClass(profile)}
                    actionDisabled={isUpdatingVisibility}
                  />
                ))}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddProfile} color='inherit'>
            关闭
          </Button>
        </DialogActions>
      </Dialog>

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
              mode={isTeacher ? "teacher" : "student"}
              onRename={isTeacher ? handleRenameProfile : undefined}
              isRenaming={isRenamingProfile}
              actions={
                isTeacher && selectedClassId ? (
                  <Stack
                    direction='row'
                    spacing={1}
                    justifyContent='flex-end'
                    sx={{ width: "100%" }}
                  >
                    <Button
                      variant='outlined'
                      color='error'
                      onClick={() =>
                        activeProfile
                          ? void handleRemoveProfileFromClass(activeProfile)
                          : undefined
                      }
                      disabled={isUpdatingVisibility}
                    >
                      从班级移除
                    </Button>
                  </Stack>
                ) : null
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

      <Dialog
        open={Boolean(editingInviteCode)}
        onClose={handleCloseEditInvite}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>修改邀请码过期日期</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <TextField
              label='有效期（天）'
              type='number'
              inputProps={{ min: 1, max: 365 }}
              value={editExpiresInDays}
              onChange={(e) => setEditExpiresInDays(Number(e.target.value))}
              disabled={isUpdatingInvite}
              fullWidth
              helperText='设置邀请码的有效期，范围：1-365天'
            />
            <Typography variant='body2' color='text.secondary'>
              新的过期时间将从当前时间开始计算
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditInvite} color='inherit' disabled={isUpdatingInvite}>
            取消
          </Button>
          <Button
            onClick={handleUpdateInvite}
            variant='contained'
            disabled={isUpdatingInvite || editExpiresInDays < 1 || editExpiresInDays > 365}
          >
            {isUpdatingInvite ? "更新中..." : "确认更新"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );

  if (variant === "panel") {
    return (
      <>
        {body}
        {profileDialogs}
      </>
    );
  }

  return (
    <>
      <Paper variant='outlined' sx={{ p: 3 }}>
        {body}
      </Paper>
      {profileDialogs}
    </>
  );
}
