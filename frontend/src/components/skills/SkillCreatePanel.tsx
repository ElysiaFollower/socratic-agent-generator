/**
 * Skill creation panel.
 *
 * Handles supplemental material upload and custom skill creation.
 */

import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Box,
  Button,
  Checkbox,
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
  TextField,
  Typography,
} from "@mui/material";
import {
  AutoFixHigh,
  CloudUpload,
  NoteAdd,
} from "@mui/icons-material";
import { useDropzone } from "react-dropzone";
import {
  createCustomSkill,
  deleteSkillMaterial,
  generateCustomSkillDraft,
  getSkillMaterial,
  listSkillMaterials,
  rebuildCustomSkillIndex,
  uploadSkillMaterial,
  type CustomSkillDraft,
  type SkillMaterialDetail,
  type SkillMaterialInfo,
} from "../../api";
import { type Profile } from "../../types";
import { useConfirmDialog, useNotification } from "../../hooks";

interface SkillCreatePanelProps {
  readonly profiles: readonly Profile[];
  readonly isLoadingProfiles: boolean;
}

export function SkillCreatePanel(
  props: SkillCreatePanelProps,
): JSX.Element {
  const { profiles, isLoadingProfiles } = props;
  const { notifyError, notifySuccess } = useNotification();
  const { confirm } = useConfirmDialog();

  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [materials, setMaterials] = useState<readonly SkillMaterialInfo[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<number[]>([]);

  const [supplementalFile, setSupplementalFile] = useState<File | null>(null);
  const [supplementalHint, setSupplementalHint] = useState<string>("");
  const [supplementalInputKey, setSupplementalInputKey] = useState<number>(0);
  const [isUploadingSupplemental, setIsUploadingSupplemental] =
    useState<boolean>(false);

  const [viewingMaterialId, setViewingMaterialId] = useState<number | null>(
    null,
  );
  const [viewingMaterial, setViewingMaterial] =
    useState<SkillMaterialDetail | null>(null);
  const [isLoadingMaterial, setIsLoadingMaterial] =
    useState<boolean>(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<number | null>(
    null,
  );

  const [draftDialogOpen, setDraftDialogOpen] = useState<boolean>(false);
  const [draftForm, setDraftForm] = useState<CustomSkillDraft | null>(null);
  const [draftHint, setDraftHint] = useState<string>("");
  const [isGeneratingDraft, setIsGeneratingDraft] =
    useState<boolean>(false);
  const [isSavingSkill, setIsSavingSkill] = useState<boolean>(false);
  const [retrievalNeeded, setRetrievalNeeded] = useState<boolean>(false);
  const [autoRebuildIndex, setAutoRebuildIndex] = useState<boolean>(true);

  useEffect(() => {
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(profiles[0].profile_id);
    }
  }, [profiles, selectedProfileId]);

  const selectedProfile = profiles.find(
    (profile) => profile.profile_id === selectedProfileId,
  );

  const formatTimestamp = (value?: string | null): string => {
    if (!value) {
      return "未知时间";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const getMaterialHint = (material: SkillMaterialInfo): string | null => {
    const hint = material.meta_info?.hint;
    return typeof hint === "string" ? hint : null;
  };

  const loadMaterials = useCallback(async () => {
    if (!selectedProfileId) {
      setMaterials([]);
      setSelectedMaterialIds([]);
      return;
    }
    setIsLoadingMaterials(true);
    try {
      const list = await listSkillMaterials(selectedProfileId);
      setMaterials(list);
      setSelectedMaterialIds((prev) =>
        prev.filter((id) => list.some((material) => material.id === id)),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载补充资料失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingMaterials(false);
    }
  }, [notifyError, selectedProfileId]);

  useEffect(() => {
    void loadMaterials();
    setViewingMaterialId(null);
    setViewingMaterial(null);
  }, [loadMaterials, selectedProfileId]);

  const applySupplementalFile = (file: File) => {
    const allowedExtensions = [".md", ".txt", ".markdown"];
    const fileExtension = file.name.toLowerCase().split(".").pop();
    if (fileExtension && !allowedExtensions.includes(`.${fileExtension}`)) {
      notifyError(
        `不支持的文件类型。支持的类型：${allowedExtensions.join(", ")}`,
      );
      setSupplementalFile(null);
      return;
    }
    setSupplementalFile(file);
  };

  const handleSupplementalDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        applySupplementalFile(file);
      }
    },
    [applySupplementalFile],
  );

  const handleSupplementalDropRejected = useCallback(() => {
    notifyError("不支持的文件类型，仅支持 .md、.txt、.markdown");
  }, [notifyError]);

  const supplementalDropzone = useDropzone({
    onDrop: handleSupplementalDrop,
    onDropRejected: handleSupplementalDropRejected,
    maxFiles: 1,
    multiple: false,
    accept: {
      "text/markdown": [".md", ".markdown"],
      "text/plain": [".txt"],
    },
  });

  const handleSupplementalFileChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      applySupplementalFile(file);
    }
  };

  const handleSupplementalUpload = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!selectedProfileId) {
      notifyError("请先选择一个Profile");
      return;
    }
    if (!supplementalFile) {
      notifyError("请选择补充资料文件");
      return;
    }
    setIsUploadingSupplemental(true);
    try {
      await uploadSkillMaterial(
        selectedProfileId,
        supplementalFile,
        supplementalHint.trim() || undefined,
      );
      notifySuccess("补充资料上传成功");
      setSupplementalFile(null);
      setSupplementalHint("");
      setSupplementalInputKey((prev) => prev + 1);
      await loadMaterials();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "补充资料上传失败";
      notifyError(errorMessage);
    } finally {
      setIsUploadingSupplemental(false);
    }
  };

  const handleViewMaterial = async (materialId: number) => {
    if (!selectedProfileId) {
      return;
    }
    setViewingMaterialId(materialId);
    setViewingMaterial(null);
    setIsLoadingMaterial(true);
    try {
      const detail = await getSkillMaterial(selectedProfileId, materialId);
      setViewingMaterial(detail);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载补充资料失败";
      notifyError(errorMessage);
    } finally {
      setIsLoadingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (materialId: number) => {
    if (!selectedProfileId) {
      return;
    }
    const shouldDelete = await confirm({
      title: "删除补充资料",
      description: "确定要删除这份补充资料吗？此操作无法撤销。",
      confirmLabel: "删除",
      confirmColor: "error",
    });
    if (!shouldDelete) {
      return;
    }
    setDeletingMaterialId(materialId);
    try {
      await deleteSkillMaterial(selectedProfileId, materialId);
      notifySuccess("补充资料已删除");
      await loadMaterials();
      setSelectedMaterialIds((prev) =>
        prev.filter((id) => id !== materialId),
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "删除补充资料失败";
      notifyError(errorMessage);
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const handleToggleMaterialSelection = (materialId: number) => {
    setSelectedMaterialIds((prev) => {
      if (prev.includes(materialId)) {
        return prev.filter((id) => id !== materialId);
      }
      return [...prev, materialId];
    });
  };

  const handleToggleAllMaterials = () => {
    if (materials.length === 0) {
      return;
    }
    if (selectedMaterialIds.length === materials.length) {
      setSelectedMaterialIds([]);
    } else {
      setSelectedMaterialIds(materials.map((material) => material.id));
    }
  };

  const buildEmptyDraft = (): CustomSkillDraft => ({
    name: "",
    description: "",
    tool_name: "custom_",
    meta_info: {},
  });

  const handleGenerateDraft = async () => {
    if (!selectedProfileId) {
      notifyError("请先选择一个Profile");
      return;
    }
    if (selectedMaterialIds.length === 0) {
      notifyError("请至少选择一份补充资料");
      return;
    }
    setIsGeneratingDraft(true);
    try {
      const response = await generateCustomSkillDraft(selectedProfileId, {
        material_ids: selectedMaterialIds,
        hint: draftHint.trim() || undefined,
      });
      setDraftForm(response.draft);
      setRetrievalNeeded(Boolean(response.draft.meta_info?.retrieval_needed));
      setDraftDialogOpen(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "生成技能草稿失败";
      notifyError(errorMessage);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleOpenManualDraft = () => {
    setDraftForm(buildEmptyDraft());
    setRetrievalNeeded(false);
    setDraftDialogOpen(true);
  };

  const updateDraftField = (
    field: keyof CustomSkillDraft,
    value: string,
  ) => {
    setDraftForm((prev) => {
      if (!prev) {
        return prev;
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const handleSaveSkill = async () => {
    if (!selectedProfileId || !draftForm) {
      return;
    }
    if (!draftForm.name.trim() || !draftForm.description.trim()) {
      notifyError("请填写技能名称与描述");
      return;
    }
    if (!draftForm.tool_name.trim()) {
      notifyError("请填写工具名称");
      return;
    }
    if (retrievalNeeded && selectedMaterialIds.length === 0) {
      notifyError("检索型技能需要关联补充资料");
      return;
    }
    setIsSavingSkill(true);
    try {
      const metaInfo = {
        ...(draftForm.meta_info || {}),
        retrieval_needed: retrievalNeeded,
      };
      const created = await createCustomSkill(selectedProfileId, {
        skill_key: draftForm.skill_key,
        name: draftForm.name,
        description: draftForm.description,
        skill_type: draftForm.skill_type,
        tool_name: draftForm.tool_name,
        instructions: draftForm.instructions,
        index_path: draftForm.index_path ?? undefined,
        status: retrievalNeeded ? "pending" : "ready",
        meta_info: metaInfo,
        material_ids: selectedMaterialIds,
      });

      if (retrievalNeeded && autoRebuildIndex) {
        try {
          await rebuildCustomSkillIndex(created.id);
          notifySuccess("技能已创建并完成索引构建");
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "索引构建失败";
          notifyError(errorMessage);
        }
      } else {
        notifySuccess("技能已创建");
      }
      setDraftDialogOpen(false);
      setDraftForm(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "创建技能失败";
      notifyError(errorMessage);
    } finally {
      setIsSavingSkill(false);
    }
  };

  const materialDialog = (
    <Dialog
      open={Boolean(viewingMaterialId)}
      onClose={() => {
        setViewingMaterialId(null);
        setViewingMaterial(null);
      }}
      fullWidth
      maxWidth='md'
    >
      <DialogTitle>补充资料内容</DialogTitle>
      <DialogContent dividers>
        {isLoadingMaterial ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : viewingMaterial ? (
          <>
            <Paper
              variant='outlined'
              sx={{
                p: 2,
                bgcolor: "var(--color-surface-muted)",
                maxHeight: 480,
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
                {viewingMaterial.content}
              </Typography>
            </Paper>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ mt: 1, display: "block" }}
            >
              {viewingMaterial.filename || `资料 #${viewingMaterial.id}`} ·{" "}
              {viewingMaterial.size
                ? `${(viewingMaterial.size / 1024).toFixed(2)} KB`
                : "未知大小"}
            </Typography>
          </>
        ) : (
          <Typography variant='body2' color='text.secondary'>
            暂无内容
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setViewingMaterialId(null);
            setViewingMaterial(null);
          }}
          color='inherit'
        >
          关闭
        </Button>
      </DialogActions>
    </Dialog>
  );

  const draftDialog = (
    <Dialog
      open={draftDialogOpen}
      onClose={() => {
        setDraftDialogOpen(false);
        setDraftForm(null);
      }}
      fullWidth
      maxWidth='md'
    >
      <DialogTitle>自定义技能草稿</DialogTitle>
      <DialogContent dividers>
        {draftForm ? (
          <Stack spacing={2}>
            <TextField
              label='技能名称'
              value={draftForm.name}
              onChange={(event) => updateDraftField("name", event.target.value)}
              fullWidth
            />
            <TextField
              label='技能描述'
              value={draftForm.description}
              onChange={(event) =>
                updateDraftField("description", event.target.value)
              }
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label='工具名称'
                value={draftForm.tool_name}
                onChange={(event) =>
                  updateDraftField("tool_name", event.target.value)
                }
                fullWidth
              />
              <TextField
                label='技能类型'
                value={draftForm.skill_type || ""}
                onChange={(event) =>
                  updateDraftField("skill_type", event.target.value)
                }
                fullWidth
              />
            </Stack>
            <TextField
              label='技能指令'
              value={draftForm.instructions || ""}
              onChange={(event) =>
                updateDraftField("instructions", event.target.value)
              }
              fullWidth
              multiline
              minRows={6}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={retrievalNeeded}
                  onChange={(event) =>
                    setRetrievalNeeded(event.target.checked)
                  }
                />
              }
              label='需要检索补充资料'
            />
            {retrievalNeeded && (
              <FormControlLabel
                control={
                  <Switch
                    checked={autoRebuildIndex}
                    onChange={(event) =>
                      setAutoRebuildIndex(event.target.checked)
                    }
                  />
                }
                label='创建后自动构建索引'
              />
            )}
            <Typography variant='caption' color='text.secondary'>
              关联资料数量：{selectedMaterialIds.length}
            </Typography>
          </Stack>
        ) : (
          <Typography variant='body2' color='text.secondary'>
            暂无草稿
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setDraftDialogOpen(false);
            setDraftForm(null);
          }}
          color='inherit'
        >
          取消
        </Button>
        <Button
          onClick={handleSaveSkill}
          variant='contained'
          disabled={!draftForm || isSavingSkill}
        >
          {isSavingSkill ? "保存中..." : "保存技能"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      <Stack spacing={2}>
        <Paper variant='outlined' sx={{ p: 2 }}>
          <Stack spacing={2} component='form' onSubmit={handleSupplementalUpload}>
            <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
              上传补充资料
            </Typography>

            <FormControl size='small' fullWidth>
              <InputLabel id='profile-select-label'>选择Profile</InputLabel>
              <Select
                labelId='profile-select-label'
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

            <Typography variant='caption' color='text.secondary'>
              {selectedProfile
                ? `绑定课程：${selectedProfile.profile_name || selectedProfile.topic_name}`
                : "请选择要绑定的Profile"}
            </Typography>

            <Paper
              variant='outlined'
              {...supplementalDropzone.getRootProps({
                role: "button",
                "aria-label": "上传补充资料",
              })}
              sx={{
                p: 2,
                borderStyle: "dashed",
                borderColor: supplementalDropzone.isDragReject
                  ? "error.main"
                  : supplementalDropzone.isDragActive
                    ? "primary.main"
                    : "divider",
                textAlign: "center",
                cursor: "pointer",
                bgcolor: supplementalDropzone.isDragActive
                  ? "action.hover"
                  : "transparent",
                transition:
                  "background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease",
                width: "100%",
                maxWidth: 640,
                alignSelf: "center",
                mx: "auto",
                outline: "none",
                "&:hover": {
                  boxShadow: 0.5,
                  bgcolor: "action.hover",
                },
              }}
            >
              <Stack spacing={1} alignItems='center'>
                <CloudUpload
                  color={
                    supplementalDropzone.isDragReject
                      ? "error"
                      : supplementalDropzone.isDragActive
                        ? "primary"
                        : "action"
                  }
                  sx={{ fontSize: 28 }}
                />
                <Typography variant='body2'>
                  {supplementalDropzone.isDragReject
                    ? "不支持的文件类型"
                    : supplementalDropzone.isDragActive
                      ? "释放鼠标以上传"
                      : "拖拽文件到此处上传"}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {supplementalDropzone.isDragReject
                    ? "仅支持 .md、.txt、.markdown"
                    : "支持 .md, .txt, .markdown"}
                </Typography>
                {supplementalFile && (
                  <Typography variant='caption'>
                    已选择：{supplementalFile.name} (
                    {(supplementalFile.size / 1024).toFixed(2)} KB)
                  </Typography>
                )}
              </Stack>
              <input
                {...supplementalDropzone.getInputProps({
                  onChange: handleSupplementalFileChange,
                })}
                key={supplementalInputKey}
              />
            </Paper>

            <TextField
              size='small'
              label='资料用途提示（可选）'
              value={supplementalHint}
              onChange={(event) => setSupplementalHint(event.target.value)}
            />

            <Stack direction='row' spacing={1}>
              <Button
                type='submit'
                variant='contained'
                disabled={
                  !supplementalFile || !selectedProfileId || isUploadingSupplemental
                }
              >
                {isUploadingSupplemental ? "上传中..." : "上传补充资料"}
              </Button>
              {supplementalFile && (
                <Button
                  color='inherit'
                  onClick={() => {
                    setSupplementalFile(null);
                    setSupplementalHint("");
                    setSupplementalInputKey((prev) => prev + 1);
                  }}
                  disabled={isUploadingSupplemental}
                >
                  重新选择
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        <Paper variant='outlined' sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                补充资料列表
              </Typography>
              <Button
                size='small'
                onClick={handleToggleAllMaterials}
                disabled={materials.length === 0}
              >
                {selectedMaterialIds.length === materials.length
                  ? "取消全选"
                  : "全选"}
              </Button>
            </Stack>

            {isLoadingMaterials ? (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <CircularProgress size={20} />
              </Box>
            ) : materials.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                暂无补充资料
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {materials.map((material) => {
                  const hint = getMaterialHint(material);
                  const isSelected = selectedMaterialIds.includes(material.id);
                  return (
                    <Paper key={material.id} variant='outlined' sx={{ p: 1.5 }}>
                      <Stack direction='row' spacing={1} alignItems='flex-start'>
                        <Checkbox
                          checked={isSelected}
                          onChange={() =>
                            handleToggleMaterialSelection(material.id)
                          }
                        />
                        <Stack spacing={0.5} sx={{ flex: 1 }}>
                          <Typography variant='body2' sx={{ fontWeight: 600 }}>
                            {material.filename || `资料 #${material.id}`}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {material.size
                              ? `${(material.size / 1024).toFixed(2)} KB`
                              : "未知大小"}
                            {" · "}
                            {formatTimestamp(material.upload_time)}
                          </Typography>
                          {hint && (
                            <Typography variant='caption' color='text.secondary'>
                              提示：{hint}
                            </Typography>
                          )}
                        </Stack>
                        <Stack direction='row' spacing={1}>
                          <Button
                            size='small'
                            onClick={() => handleViewMaterial(material.id)}
                          >
                            查看
                          </Button>
                          <Button
                            size='small'
                            color='error'
                            disabled={deletingMaterialId === material.id}
                            onClick={() => handleDeleteMaterial(material.id)}
                          >
                            {deletingMaterialId === material.id
                              ? "删除中..."
                              : "删除"}
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Stack>
        </Paper>

        <Paper variant='outlined' sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction='row' alignItems='center' spacing={1}>
              <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                生成自定义技能
              </Typography>
              <Button
                size='small'
                variant='outlined'
                startIcon={<AutoFixHigh fontSize='small' />}
                onClick={handleGenerateDraft}
                disabled={
                  selectedMaterialIds.length === 0 || isGeneratingDraft
                }
              >
                {isGeneratingDraft ? "生成中..." : "生成草稿"}
              </Button>
              <Button
                size='small'
                variant='outlined'
                startIcon={<NoteAdd fontSize='small' />}
                onClick={handleOpenManualDraft}
                disabled={!selectedProfileId}
              >
                新建技能
              </Button>
            </Stack>

            <TextField
              size='small'
              label='技能生成提示（可选）'
              value={draftHint}
              onChange={(event) => setDraftHint(event.target.value)}
              fullWidth
            />

            <Typography variant='caption' color='text.secondary'>
              已选择 {selectedMaterialIds.length} 份资料用于技能生成
            </Typography>
          </Stack>
        </Paper>
      </Stack>

      {materialDialog}
      {draftDialog}
    </>
  );
}
