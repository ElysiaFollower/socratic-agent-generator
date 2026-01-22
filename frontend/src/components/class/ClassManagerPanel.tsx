/**
 * Class management panel component.
 *
 * Provides class creation/joining and profile visibility management.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  ClassTwoTone,
  ContentCopy,
  DescriptionOutlined,
  Edit,
  PeopleOutline,
  Person,
  School,
  VpnKeyOff,
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
  deleteClass,
} from "../../api";
import {
  useAuth,
  useClipboard,
  useConfirmDialog,
  useNotification,
  useProfiles,
} from "../../hooks";
import { ProfileCard, ProfileDetailCard } from "../profile/ProfileCard";
import { color } from "../../styles/css-variables";

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { notifyError, notifySuccess, notifyWarning } = useNotification();
  const { copyToClipboard } = useClipboard();
  const { confirm } = useConfirmDialog();
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
  const [isUpdatingPersonaHints, setIsUpdatingPersonaHints] =
    useState<boolean>(false);
  const [isUpdatingCurriculum, setIsUpdatingCurriculum] =
    useState<boolean>(false);
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
    role === "teacher"
      ? t("class.role.teacher")
      : role === "student"
        ? t("class.role.student")
        : "-";
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
      const errorMessage =
        err instanceof Error ? err.message : t("class.loadClassesFailed");
      notifyError(errorMessage);
    } finally {
      setIsLoadingClasses(false);
    }
  }, [notifyError]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  // useEffect(() => {
  //   if (!selectedClassId && classes.length > 0) {
  //     setSelectedClassId(classes[0].class_id);
  //   }
  // }, [classes, selectedClassId]);

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
    // 额外检查：如果selectedClassId为空，直接返回（防止删除后的无效请求）
    if (!selectedClassId) {
      setInvites([]);
      return;
    }
    setIsLoadingInvites(true);
    try {
      const response = await listClassInvitations(selectedClassId);
      setInvites(response.invitation_codes);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("class.loadInviteCodesFailed");
      notifyError(errorMessage);
    } finally {
      setIsLoadingInvites(false);
    }
  }, [isTeacher, notifyError, selectedClassId]);

  const loadMembers = useCallback(async () => {
    if (!selectedClassId) {
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
      const errorMessage =
        err instanceof Error ? err.message : t("class.loadMembersFailed");
      notifyError(errorMessage);
    } finally {
      setIsLoadingMembers(false);
    }
  }, [notifyError, selectedClassId]);

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
    await copyToClipboard(
      code,
      t("class.inviteCodeCopied"),
      t("common.copyFailed"),
    );
  };

  const handleCreateClass = async () => {
    const name = createClassName.trim();
    if (!name) {
      notifyWarning(t("class.enterClassName"));
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
        notifyError(t("class.inviteCodeGenerateFailed"));
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

      notifySuccess(t("class.classCreated"));
      setIsCreateClassOpen(false);
      await loadClasses();
      setSelectedClassId(created.class_id);
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("class.classCreateFailed");
      notifyError(errorMessage);
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleJoinClass = async () => {
    const code = joinCode.trim();
    if (!code) {
      notifyWarning(t("class.enterInviteCode"));
      return;
    }
    try {
      const joined = await joinClass({ invitation_code: code });
      notifySuccess(t("class.classJoined"));
      setJoinCode("");
      setIsJoinClassOpen(false);
      await loadClasses();
      await refreshProfiles();
      setSelectedClassId(joined.class_id);
      // Load members and invites for the newly joined class
      await loadMembers();
      if (isTeacher) {
        await loadInvites();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("class.classJoinFailed");
      notifyError(errorMessage);
    }
  };

  const handleGenerateInvite = async () => {
    if (!selectedClassId) {
      notifyWarning(t("class.enterInviteCode"));
      return;
    }
    try {
      const response = await generateClassInvitationCode({
        class_id: selectedClassId,
        expires_in_days: expiresInDays,
      });
      notifySuccess(t("class.inviteCodeGenerated"));
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
        err instanceof Error
          ? err.message
          : t("class.inviteCodeGenerateFailed");
      notifyError(errorMessage);
    }
  };

  const handleDeleteInvite = async (code: string) => {
    if (!selectedClassId) {
      return;
    }
    if (!confirm(t("class.deleteConfirm"))) {
      return;
    }
    try {
      await deleteClassInvitationCode(selectedClassId, code);
      notifySuccess(t("class.inviteCodeDeleted"));
      setInvites((prev) =>
        prev.filter((invite) => invite.invitation_code !== code),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("class.inviteCodeDeleteFailed");
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
      notifyWarning(t("class.validityRange"));
      return;
    }
    setIsUpdatingInvite(true);
    try {
      const response = await updateClassInvitationCode(
        selectedClassId,
        editingInviteCode,
        editExpiresInDays,
      );
      notifySuccess(t("class.inviteCodeUpdated"));
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
        err instanceof Error ? err.message : t("class.inviteCodeUpdateFailed");
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
      notifySuccess(t("class.addedToClass"));
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("class.updateVisibilityFailed");
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
      notifySuccess(t("class.removedFromClass"));
      setActiveProfile((prev) =>
        prev?.profile_id === profile.profile_id ? null : prev,
      );
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("class.updateVisibilityFailed");
      notifyError(errorMessage);
    } finally {
      setIsUpdatingVisibility(false);
    }
  };

  const handleRenameProfile = async (profile: Profile, nextName: string) => {
    const trimmedName = nextName.trim();
    if (!trimmedName) {
      notifyWarning(t("class.profileNameRequired"));
      return;
    }
    setIsRenamingProfile(true);
    try {
      await renameProfile(profile.profile_id, { profile_name: trimmedName });
      notifySuccess(t("class.profileUpdated"));
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("class.updateProfileFailed");
      notifyError(errorMessage);
    } finally {
      setIsRenamingProfile(false);
    }
  };

  const handleUpdatePersonaHints = async (
    profile: Profile,
    hints: string[],
  ) => {
    setIsUpdatingPersonaHints(true);
    try {
      // TODO: Implement API call to update persona hints
      notifyWarning(t("class.updatePersonaHintsNotImplemented"));
      console.log("Update persona hints:", {
        profileId: profile.profile_id,
        hints,
      });
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : t("class.updatePersonaHintsFailed");
      notifyError(errorMessage);
    } finally {
      setIsUpdatingPersonaHints(false);
    }
  };

  const handleDeleteClass = async (classId: string) => {
    try {
      await deleteClass(classId);
      notifySuccess(t("class.classDeleted"));
      setClasses((prev) => prev.filter((item) => item.class_id !== classId));
      setClassMemberCounts((prev) => {
        if (!(classId in prev)) {
          return prev;
        }
        const next = { ...prev };
        delete next[classId];
        return next;
      });
      setInvites([]);
      setMembers([]);
      setSelectedClassId((prev) => (prev === classId ? null : prev));
      await loadClasses();
      await refreshProfiles();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("class.classDeleteFailed");
      notifyError(errorMessage);
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
                    {t("class.memberCount")}: {memberCount ?? "-"}
                  </Typography>
                </Stack>
                <Stack direction='row' spacing={0.5} alignItems='center'>
                  <CalendarTodayOutlined fontSize='inherit' color='action' />
                  <Typography variant='caption' color='text.secondary'>
                    {t("class.createdDate")}: {formatDate(item.created_at)}
                  </Typography>
                </Stack>
                <Stack direction='row' spacing={0.5} alignItems='center'>
                  <DescriptionOutlined fontSize='inherit' color='action' />
                  <Typography variant='caption' color='text.secondary'>
                    {t("class.profileCount")}: {profileCount}
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

  // Unified class detail view for both teachers and students.
  // Only teachers see the invite codes section.
  const classDetail = (
    <Stack spacing={2}>
      {/* Profile List Section - shown first */}
      <Stack spacing={1}>
        <Stack
          direction='row'
          alignItems='center'
          justifyContent='space-between'
        >
          <Typography variant='subtitle2'>
            {t("class.profilesInClass")}
          </Typography>
          {isTeacher && (
            <Button
              size='small'
              variant='outlined'
              startIcon={<Add />}
              onClick={() => setIsAddProfileOpen(true)}
              disabled={!selectedClassId}
            >
              {t("class.addProfile")}
            </Button>
          )}
        </Stack>
        {visibleProfilesForClass.length === 0 ? (
          <Typography variant='caption' color='text.secondary'>
            {t("class.noVisibleProfiles")}
          </Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
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

      {/* Member List Section - horizontal chip layout */}
      <Stack spacing={1}>
        <Typography variant='subtitle2'>{t("class.members")}</Typography>
        {isLoadingMembers ? (
          <CircularProgress size={20} />
        ) : members.length === 0 ? (
          <Typography variant='caption' color='text.secondary'>
            {t("class.noMembers")}
          </Typography>
        ) : (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            {members.map((member) => {
              const isTeacherOrAdmin = member.role_in_class === "teacher";
              return (
                <Chip
                  sx={{ px: 1, py: 1 }}
                  key={member.user_id}
                  icon={
                    isTeacherOrAdmin ? (
                      <School fontSize='small' />
                    ) : (
                      <Person fontSize='small' />
                    )
                  }
                  label={member.display_name || member.username}
                  size='small'
                />
              );
            })}
          </Box>
        )}
      </Stack>

      {/* Invite Codes Section - teachers only */}
      {isTeacher && (
        <Stack spacing={1}>
          <Stack
            direction='row'
            alignItems='center'
            justifyContent='space-between'
          >
            <Typography variant='subtitle2'>
              {t("class.inviteCodes")}
            </Typography>
            <Stack direction='row' spacing={1}>
              <TextField
                type='number'
                size='small'
                label={t("class.expiresInDays")}
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
                {isLoadingInvites
                  ? t("class.generating")
                  : t("class.generateInvite")}
              </Button>
            </Stack>
          </Stack>
          {isLoadingInvites ? (
            <CircularProgress size={20} />
          ) : invites.length === 0 ? (
            <Typography variant='caption' color='text.secondary'>
              {t("class.noInviteCodes")}
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
                          <Tooltip
                            title={
                              expired
                                ? t("class.codeExpired")
                                : t("class.copyInviteCode")
                            }
                          >
                            <span>
                              <IconButton
                                size='small'
                                aria-label={t("class.copyInviteCode")}
                                onClick={() =>
                                  copyToClipboard(
                                    invite.invitation_code,
                                    t("class.inviteCodeCopied"),
                                    t("common.copyFailed"),
                                  )
                                }
                                disabled={expired}
                              >
                                <ContentCopy fontSize='small' />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={t("class.modifyExpiry")}>
                            <span>
                              <IconButton
                                size='small'
                                aria-label={t("class.modifyExpiry")}
                                onClick={() => handleOpenEditInvite(invite)}
                              >
                                <Edit fontSize='small' />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={t("class.deleteInviteCode")}>
                            <span>
                              <IconButton
                                size='small'
                                aria-label={t("class.deleteInviteCode")}
                                onClick={() =>
                                  handleDeleteInvite(invite.invitation_code)
                                }
                                color='error'
                              >
                                <VpnKeyOff fontSize='small' />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Chip
                            size='small'
                            color={expired ? "default" : "success"}
                            label={
                              expired
                                ? t("class.expired")
                                : t("class.effective")
                            }
                            variant={expired ? "outlined" : "filled"}
                          />
                        </Stack>
                      </Stack>
                      <Stack direction='row' spacing={2} flexWrap='wrap'>
                        <Typography variant='caption' color='text.secondary'>
                          {t("class.createdAt")}:{" "}
                          {new Date(invite.created_at).toLocaleString("zh-CN")}
                        </Typography>
                        <Typography variant='caption' color='text.secondary'>
                          {t("class.expiresAt")}:{" "}
                          {invite.expires_at
                            ? new Date(invite.expires_at).toLocaleString(
                                "zh-CN",
                              )
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
      )}
    </Stack>
  );

  const body = (
    <Stack spacing={3} sx={{ pt: 2 }}>
      <Stack spacing={2}>
        <Typography variant='h6'>{t("class.title")}</Typography>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1}
          alignItems={{ md: "center" }}
        >
          <TextField
            value={classSearchText}
            onChange={(event) => setClassSearchText(event.target.value)}
            placeholder={t("class.searchPlaceholder")}
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
                {t("class.createClass")}
              </Button>
            )}
            <Button
              variant={isTeacher ? "outlined" : "contained"}
              onClick={handleOpenJoinClass}
              sx={{ whiteSpace: "nowrap" }}
            >
              {t("class.joinClass")}
            </Button>
          </Stack>
        </Stack>
      </Stack>

      <Divider flexItem />

      {isLoadingClasses ? (
        <Stack direction='row' spacing={1} alignItems='center'>
          <CircularProgress size={20} />
          <Typography variant='body2' color='text.secondary'>
            {t("common.loading")}
          </Typography>
        </Stack>
      ) : classes.length === 0 ? (
        <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
          <PeopleOutline
            sx={{ fontSize: 48, color: "var(--color-border)", mb: 2 }}
          />
          <Typography variant='h6' sx={{ mt: 2 }}>
            {t("class.noClasses")}
          </Typography>
          <Typography variant='body2'>{t("class.noClassesHint")}</Typography>
        </Box>
      ) : filteredClasses.length === 0 ? (
        <Typography variant='body2' color='text.secondary'>
          {t("class.noMatchingClasses")}
        </Typography>
      ) : (
        <Stack spacing={2}>
          {classList}
          {selectedClass && (
            <Paper variant='outlined' sx={{ p: 2 }}>
              <Stack
                direction='row'
                alignItems='center'
                justifyContent='space-between'
                sx={{ mb: 1 }}
              >
                <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                  {t("class.classDetails")} - {selectedClass.name}
                </Typography>
                {isTeacher && selectedClass.owner_id === user?.user_id && (
                  <Tooltip title={t("class.deleteClass")}>
                    <IconButton
                      sx={{
                        transition: "all 0.3s ease",
                        color: color.text.secondary,
                        "&:hover": {
                          color: "error.main",
                        },
                      }}
                      onClick={async () => {
                        const shouldDelete = await confirm({
                          title: t("class.deleteClass"),
                          description: t("class.deleteClassConfirm"),
                          confirmColor: "error",
                        });
                        if (shouldDelete) {
                          void handleDeleteClass(selectedClass.class_id);
                        }
                      }}
                    >
                      <ClassTwoTone />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
              {classDetail}
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
        <DialogTitle>{t("class.createClass")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label={t("class.name")}
              value={createClassName}
              onChange={(event) => setCreateClassName(event.target.value)}
              size='small'
              fullWidth
              disabled={isCreatingClass || Boolean(createdClassId)}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label={t("class.inviteCode")}
                value={createInviteCode}
                placeholder={
                  createdClassId
                    ? t("class.generateFailedRetry")
                    : t("class.autoGeneratedAfterCreate")
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
                placeholder={t("class.searchProfilePlaceholder")}
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
                  {t("class.noMatchingProfile")}
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
            {t("common.close")}
          </Button>
          <Button
            variant='contained'
            onClick={() => void handleCreateClass()}
            disabled={isCreatingClass || Boolean(createdClassId)}
          >
            {isCreatingClass ? t("class.creating") : t("class.createClass")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isJoinClassOpen}
        onClose={handleCloseJoinClass}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>{t("class.joinClass")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label={t("class.inviteCode")}
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
            {t("common.cancel")}
          </Button>
          <Button variant='contained' onClick={() => void handleJoinClass()}>
            {t("class.joinClass")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isAddProfileOpen}
        onClose={handleCloseAddProfile}
        fullWidth
        maxWidth='md'
      >
        <DialogTitle>{t("class.addProfileToClass")}</DialogTitle>
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
                  ? t("class.noProfilesToAdd")
                  : t("class.allProfilesAdded")}
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
                    actionLabel={t("common.add")}
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
            {t("common.close")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(activeProfile)}
        onClose={() => setActiveProfile(null)}
        fullWidth
        maxWidth='md'
      >
        <DialogTitle>{t("class.profileDetails")}</DialogTitle>
        <DialogContent dividers>
          {activeProfile && (
            <ProfileDetailCard
              profile={activeProfile}
              mode={
                user?.role === "admin"
                  ? "admin"
                  : user?.role === "teacher"
                    ? "teacher"
                    : "student"
              }
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
                      {t("class.removeFromClass")}
                    </Button>
                  </Stack>
                ) : null
              }
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveProfile(null)} color='inherit'>
            {t("common.close")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(editingInviteCode)}
        onClose={handleCloseEditInvite}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>{t("class.modifyExpiry")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <TextField
              label={t("class.expiresInDays")}
              type='number'
              inputProps={{ min: 1, max: 365 }}
              value={editExpiresInDays}
              onChange={(e) => setEditExpiresInDays(Number(e.target.value))}
              disabled={isUpdatingInvite}
              fullWidth
              helperText={t("class.validityRange")}
            />
            <Typography variant='body2' color='text.secondary'>
              {t("class.newExpiryFromNow")}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleCloseEditInvite}
            color='inherit'
            disabled={isUpdatingInvite}
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleUpdateInvite}
            variant='contained'
            disabled={
              isUpdatingInvite ||
              editExpiresInDays < 1 ||
              editExpiresInDays > 365
            }
          >
            {isUpdatingInvite ? t("class.updating") : t("class.confirmUpdate")}
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
