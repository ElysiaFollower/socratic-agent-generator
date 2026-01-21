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
import { AutoFixHigh, CloudUpload, NoteAdd } from "@mui/icons-material";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
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

export function SkillCreatePanel(props: SkillCreatePanelProps): JSX.Element {
  const { profiles, isLoadingProfiles } = props;
  const { notifyError, notifySuccess } = useNotification();
  const { confirm } = useConfirmDialog();
  const { t } = useTranslation();

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
  const [isLoadingMaterial, setIsLoadingMaterial] = useState<boolean>(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<number | null>(
    null,
  );

  const [draftDialogOpen, setDraftDialogOpen] = useState<boolean>(false);
  const [draftForm, setDraftForm] = useState<CustomSkillDraft | null>(null);
  const [draftHint, setDraftHint] = useState<string>("");
  const [isGeneratingDraft, setIsGeneratingDraft] = useState<boolean>(false);
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
      return t("skill.unknownTime");
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
        err instanceof Error ? err.message : t("skill.loadMaterialsFailed");
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
    const allowedExtensions = [".md", ".txt", ".markdown", ".pdf"];
    const fileExtension = file.name.toLowerCase().split(".").pop();
    if (fileExtension && !allowedExtensions.includes(`.${fileExtension}`)) {
      notifyError(t("skill.unsupportedFileType"));
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
    notifyError(t("skill.supportedTypesOnly"));
  }, [notifyError, t]);

  const supplementalDropzone = useDropzone({
    onDrop: handleSupplementalDrop,
    onDropRejected: handleSupplementalDropRejected,
    maxFiles: 1,
    multiple: false,
    accept: {
      "text/markdown": [".md", ".markdown"],
      "text/plain": [".txt"],
      "application/pdf": [".pdf"],
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
      notifyError(t("skill.selectProfileFirst"));
      return;
    }
    if (!supplementalFile) {
      notifyError(t("skill.selectMaterialFile"));
      return;
    }
    setIsUploadingSupplemental(true);
    try {
      await uploadSkillMaterial(
        selectedProfileId,
        supplementalFile,
        supplementalHint.trim() || undefined,
      );
      notifySuccess(t("skill.materialUploadSuccess"));
      setSupplementalFile(null);
      setSupplementalHint("");
      setSupplementalInputKey((prev) => prev + 1);
      await loadMaterials();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("skill.materialUploadFailed");
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
        err instanceof Error ? err.message : t("skill.loadMaterialFailed");
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
      title: t("skill.deleteMaterial"),
      description: t("skill.deleteMaterialConfirm"),
      confirmLabel: t("common.delete"),
      confirmColor: "error",
    });
    if (!shouldDelete) {
      return;
    }
    setDeletingMaterialId(materialId);
    try {
      await deleteSkillMaterial(selectedProfileId, materialId);
      notifySuccess(t("skill.materialDeleted"));
      await loadMaterials();
      setSelectedMaterialIds((prev) => prev.filter((id) => id !== materialId));
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("skill.deleteMaterialFailed");
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
      notifyError(t("skill.selectProfileFirst"));
      return;
    }
    if (selectedMaterialIds.length === 0) {
      notifyError(t("skill.selectAtLeastOneMaterial"));
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
        err instanceof Error ? err.message : t("skill.generateDraftFailed");
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

  const updateDraftField = (field: keyof CustomSkillDraft, value: string) => {
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
      notifyError(t("skill.fillNameAndDescription"));
      return;
    }
    if (!draftForm.tool_name.trim()) {
      notifyError(t("skill.fillToolName"));
      return;
    }
    if (retrievalNeeded && selectedMaterialIds.length === 0) {
      notifyError(t("skill.retrievalNeedsMaterials"));
      return;
    }
    setIsSavingSkill(true);
    try {
      const metaInfo = {
        ...(draftForm.meta_info || {}),
        retrieval_needed: retrievalNeeded,
      };
      const created = await createCustomSkill(selectedProfileId, {
        skill_key: draftForm.skill_key ?? undefined,
        name: draftForm.name,
        description: draftForm.description,
        skill_type: draftForm.skill_type ?? undefined,
        tool_name: draftForm.tool_name,
        instructions: draftForm.instructions ?? undefined,
        index_path: draftForm.index_path ?? undefined,
        status: retrievalNeeded ? "pending" : "ready",
        meta_info: metaInfo,
        material_ids: selectedMaterialIds,
      });

      if (retrievalNeeded && autoRebuildIndex) {
        try {
          await rebuildCustomSkillIndex(created.id);
          notifySuccess(t("skill.skillCreatedWithIndex"));
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : t("skill.indexBuildFailed");
          notifyError(errorMessage);
        }
      } else {
        notifySuccess(t("skill.skillCreated"));
      }
      setDraftDialogOpen(false);
      setDraftForm(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("skill.createSkillFailed");
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
      <DialogTitle>{t("skill.materialContent")}</DialogTitle>
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
              {viewingMaterial.filename ||
                `${t("skill.materialPrefix")}${viewingMaterial.id}`}{" "}
              ·{" "}
              {viewingMaterial.size
                ? `${(viewingMaterial.size / 1024).toFixed(2)} KB`
                : t("skill.unknownSize")}
            </Typography>
          </>
        ) : (
          <Typography variant='body2' color='text.secondary'>
            {t("skill.noContent")}
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
          {t("common.close")}
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
      <DialogTitle>{t("skill.skillDraft")}</DialogTitle>
      <DialogContent dividers>
        {draftForm ? (
          <Stack spacing={2}>
            <TextField
              label={t("skill.skillName")}
              value={draftForm.name}
              onChange={(event) => updateDraftField("name", event.target.value)}
              fullWidth
            />
            <TextField
              label={t("skill.skillDescription")}
              value={draftForm.description}
              onChange={(event) =>
                updateDraftField("description", event.target.value)
              }
              fullWidth
              maxRows={3}
              multiline
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label={t("skill.toolName")}
                value={draftForm.tool_name}
                onChange={(event) =>
                  updateDraftField("tool_name", event.target.value)
                }
                fullWidth
              />
              <TextField
                label={t("skill.skillType")}
                value={draftForm.skill_type || ""}
                onChange={(event) =>
                  updateDraftField("skill_type", event.target.value)
                }
                fullWidth
              />
            </Stack>
            <TextField
              label={t("skill.skillInstructions")}
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
                  onChange={(event) => setRetrievalNeeded(event.target.checked)}
                />
              }
              label={t("skill.needsRetrieval")}
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
                label={t("skill.autoRebuildIndex")}
              />
            )}
            <Typography variant='caption' color='text.secondary'>
              {t("skill.associatedMaterials", {
                count: selectedMaterialIds.length,
              })}
            </Typography>
          </Stack>
        ) : (
          <Typography variant='body2' color='text.secondary'>
            {t("skill.noDraft")}
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
          {t("common.cancel")}
        </Button>
        <Button
          onClick={handleSaveSkill}
          variant='contained'
          disabled={!draftForm || isSavingSkill}
        >
          {isSavingSkill ? t("skill.saving") : t("skill.saveSkill")}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <>
      <Stack spacing={2}>
        <Paper variant='outlined' sx={{ p: 2 }}>
          <Stack
            spacing={2}
            component='form'
            onSubmit={handleSupplementalUpload}
          >
            <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
              {t("skill.uploadMaterial")}
            </Typography>

            <FormControl size='small' fullWidth>
              <InputLabel id='profile-select-label' shrink>
                {t("skill.selectProfile")}
              </InputLabel>
              <Select
                labelId='profile-select-label'
                label={t("skill.selectProfile")}
                value={selectedProfileId}
                displayEmpty
                renderValue={(value) => {
                  if (!value) {
                    return "";
                  }
                  const profile = profiles.find((p) => p.profile_id === value);
                  return profile?.profile_name || profile?.topic_name || "";
                }}
                onChange={(event) => setSelectedProfileId(event.target.value)}
                disabled={isLoadingProfiles}
              >
                <MenuItem value=''>
                  <em>{t("skill.noProfilesAvailable")}</em>
                </MenuItem>
                {profiles.map((profile) => (
                  <MenuItem key={profile.profile_id} value={profile.profile_id}>
                    {profile.profile_name || profile.topic_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Paper
              variant='outlined'
              {...supplementalDropzone.getRootProps({
                role: "button",
                "aria-label": t("skill.uploadMaterial"),
              })}
              sx={{
                p: 3,
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
                  sx={{ fontSize: 32 }}
                />
                <Typography variant='subtitle1'>
                  {supplementalDropzone.isDragReject
                    ? t("skill.dropzoneReject")
                    : supplementalDropzone.isDragActive
                      ? t("skill.dropzoneActive")
                      : t("skill.dropzoneDefault")}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {supplementalDropzone.isDragReject
                    ? t("skill.supportedTypesOnly")
                    : t("skill.dropzoneHelp")}
                </Typography>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ mt: 1 }}
                >
                  {t("skill.supportedFormats")}
                  <br />
                  {t("skill.pdfNote")}
                </Typography>
                {supplementalFile && (
                  <Typography variant='body2' sx={{ mt: 1 }}>
                    {t("skill.fileSelected", {
                      fileName: supplementalFile.name,
                      size: (supplementalFile.size / 1024).toFixed(2),
                    })}
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

            {supplementalFile && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  width: "100%",
                }}
              >
                <Stack spacing={1} sx={{ width: "100%", maxWidth: 640, mt: 2 }}>
                  <Typography variant='caption' color='text.secondary'>
                    {t("skill.materialHintLabel")}
                  </Typography>
                  <TextField
                    size='small'
                    value={supplementalHint}
                    onChange={(event) =>
                      setSupplementalHint(event.target.value)
                    }
                    fullWidth
                  />
                </Stack>

                <Stack
                  direction='row'
                  spacing={1}
                  alignItems='center'
                  justifyContent='flex-end'
                  sx={{ mt: 2, width: "100%", maxWidth: 640 }}
                >
                  <Button
                    type='submit'
                    variant='contained'
                    disabled={!selectedProfileId || isUploadingSupplemental}
                    sx={{ flex: 1, maxWidth: "fit-content" }}
                  >
                    {isUploadingSupplemental
                      ? t("skill.uploading")
                      : t("skill.upload")}
                  </Button>
                  <Button
                    onClick={() => {
                      setSupplementalFile(null);
                      setSupplementalHint("");
                      setSupplementalInputKey((prev) => prev + 1);
                    }}
                    color='inherit'
                    disabled={isUploadingSupplemental}
                  >
                    {t("skill.reselect")}
                  </Button>
                </Stack>
              </Box>
            )}
          </Stack>
        </Paper>

        <Paper variant='outlined' sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction='row' justifyContent='space-between'>
              <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                {t("skill.materialList")}
              </Typography>
              <Button
                size='small'
                onClick={handleToggleAllMaterials}
                disabled={materials.length === 0}
              >
                {selectedMaterialIds.length === materials.length
                  ? t("skill.deselectAll")
                  : t("skill.selectAll")}
              </Button>
            </Stack>

            {isLoadingMaterials ? (
              <Box sx={{ py: 3, textAlign: "center" }}>
                <CircularProgress size={20} />
              </Box>
            ) : materials.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                {t("skill.noMaterials")}
              </Typography>
            ) : (
              <Stack spacing={1.5}>
                {materials.map((material) => {
                  const hint = getMaterialHint(material);
                  const isSelected = selectedMaterialIds.includes(material.id);
                  return (
                    <Paper key={material.id} variant='outlined' sx={{ p: 1.5 }}>
                      <Stack
                        direction='row'
                        spacing={1}
                        alignItems='flex-start'
                      >
                        <Checkbox
                          checked={isSelected}
                          onChange={() =>
                            handleToggleMaterialSelection(material.id)
                          }
                        />
                        <Stack spacing={0.5} sx={{ flex: 1 }}>
                          <Typography variant='body2' sx={{ fontWeight: 600 }}>
                            {material.filename ||
                              `${t("skill.materialPrefix")}${material.id}`}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {material.size
                              ? `${(material.size / 1024).toFixed(2)} KB`
                              : t("skill.unknownSize")}
                            {" · "}
                            {formatTimestamp(material.upload_time)}
                          </Typography>
                          {hint && (
                            <Typography
                              variant='caption'
                              color='text.secondary'
                            >
                              {t("skill.hintPrefix")}
                              {hint}
                            </Typography>
                          )}
                        </Stack>
                        <Stack direction='row' spacing={1}>
                          <Button
                            size='small'
                            onClick={() => handleViewMaterial(material.id)}
                          >
                            {t("skill.view")}
                          </Button>
                          <Button
                            size='small'
                            color='error'
                            disabled={deletingMaterialId === material.id}
                            onClick={() => handleDeleteMaterial(material.id)}
                          >
                            {deletingMaterialId === material.id
                              ? t("skill.deleting")
                              : t("common.delete")}
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
                {t("skill.createSkill")}
              </Typography>
              <Button
                size='small'
                variant='outlined'
                startIcon={<AutoFixHigh fontSize='small' />}
                onClick={handleGenerateDraft}
                disabled={selectedMaterialIds.length === 0 || isGeneratingDraft}
              >
                {isGeneratingDraft
                  ? t("skill.generating")
                  : t("skill.generateDraft")}
              </Button>
              <Button
                size='small'
                variant='outlined'
                startIcon={<NoteAdd fontSize='small' />}
                onClick={handleOpenManualDraft}
                disabled={!selectedProfileId}
              >
                {t("skill.createSkill")}
              </Button>
            </Stack>

            <TextField
              size='small'
              label={t("skill.generationHintLabel")}
              value={draftHint}
              onChange={(event) => setDraftHint(event.target.value)}
              fullWidth
            />

            <Typography variant='caption' color='text.secondary'>
              {t("skill.selectedMaterialsCount", {
                count: selectedMaterialIds.length,
              })}
            </Typography>
          </Stack>
        </Paper>
      </Stack>

      {materialDialog}
      {draftDialog}
    </>
  );
}
