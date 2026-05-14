/**
 * Lab manual panel component.
 *
 * This component provides a UI for uploading, viewing, and deleting lab manual files,
 * following Google TypeScript Style Guide.
 */

import React, {
  useState,
  ChangeEvent,
  FormEvent,
  useEffect,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Check,
  Close,
  CloudUpload,
  Delete,
  DescriptionOutlined,
  Edit,
  MenuBookOutlined,
  PersonOutline,
  Search,
  Visibility,
  AttachFile,
  List,
} from "@mui/icons-material";
import { CircularProgress } from "../common/CircularProgress";
import { useDropzone } from "react-dropzone";
import {
  uploadLabManual,
  listLabManuals,
  getLabManualContent,
  getLabManualContentById,
  updateLabManualDisplayName,
  deleteLabManual,
  deleteLabManualById,
  type UploadLabManualRequest,
  type UploadLabManualResponse,
  type LabManualInfo,
  type LabManualContent,
} from "../../api";
import { useConfirmDialog, useNotification } from "../../hooks";

/**
 * Props for LabManualPanel component.
 */
interface LabManualPanelProps {
  readonly onUploadSuccess?: (response: UploadLabManualResponse) => void;
  readonly onClose?: () => void;
  readonly variant?: "dialog" | "panel";
}

/**
 * Lab manual panel component.
 *
 * @param props - Component props
 * @returns React component
 */
export function LabManualPanel(props: LabManualPanelProps): JSX.Element {
  const { t } = useTranslation();
  const { onUploadSuccess, onClose, variant = "dialog" } = props;
  const { notifyError, notifySuccess } = useNotification();
  const { confirm } = useConfirmDialog();

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [labName, setLabName] = useState<string>("");
  const [labNameDraft, setLabNameDraft] = useState<string>("");
  const [isEditingLabName, setIsEditingLabName] = useState<boolean>(false);
  const [inputKey, setInputKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [uploadResponse, setUploadResponse] =
    useState<UploadLabManualResponse | null>(null);

  // Manage state
  const [labManuals, setLabManuals] = useState<readonly LabManualInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoadingManuals, setIsLoadingManuals] = useState<boolean>(false);
  const [viewingContent, setViewingContent] = useState<LabManualContent | null>(
    null,
  );
  const [viewingLabName, setViewingLabName] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [deletingDocumentId, setDeletingDocumentId] = useState<number | null>(
    null,
  );
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(
    null,
  );
  const [displayNameDraft, setDisplayNameDraft] = useState<string>("");
  const [savingDocumentId, setSavingDocumentId] = useState<number | null>(null);

  const buildDefaultLabName = (file: File): string => {
    const name = file.name;
    const lastDotIndex = name.lastIndexOf(".");
    if (lastDotIndex > 0) {
      return name.slice(0, lastDotIndex);
    }
    return name;
  };

  /**
   * Loads lab manuals list.
   */
  const loadLabManuals = useCallback(async () => {
    setIsLoadingManuals(true);
    try {
      const manuals = await listLabManuals();
      setLabManuals(manuals);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("labManual.loadFailed");
      notifyError(errorMessage);
      console.error("Failed to load lab manuals:", err);
    } finally {
      setIsLoadingManuals(false);
    }
  }, [notifyError]);

  /**
   * Loads lab manuals on mount.
   */
  useEffect(() => {
    void loadLabManuals();
  }, [loadLabManuals]);

  useEffect(() => {
    if (!uploadResponse) {
      return;
    }
    notifySuccess(
      t("labManual.uploadSuccess", {
        labName: uploadResponse.lab_name,
        size: (uploadResponse.size / 1024).toFixed(2),
      }),
    );
    setUploadResponse(null);
  }, [uploadResponse, notifySuccess, t]);

  /**
   * Applies a selected file.
   */
  const applySelectedFile = (file: File) => {
    const allowedExtensions = [".md", ".txt", ".markdown", ".tex", ".pdf"];
    const fileExtension = file.name.toLowerCase().split(".").pop();
    if (fileExtension && !allowedExtensions.includes(`.${fileExtension}`)) {
      notifyError(
        t("labManual.unsupportedFileType", {
          extensions: allowedExtensions.join(", "),
        }),
      );
      setSelectedFile(null);
      return;
    }

    const defaultLabName = buildDefaultLabName(file);
    setSelectedFile(file);
    setUploadResponse(null);
    setLabName(defaultLabName);
    setLabNameDraft(defaultLabName);
    setIsEditingLabName(false);
  };

  const handleDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        applySelectedFile(file);
      }
    },
    [applySelectedFile],
  );

  const handleDropRejected = useCallback(() => {
    notifyError(t("labManual.supportedTypesOnly"));
  }, [notifyError, t]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop: handleDrop,
      onDropRejected: handleDropRejected,
      maxFiles: 1,
      multiple: false,
      accept: {
        "text/markdown": [".md", ".markdown"],
        "text/plain": [".txt", ".tex"],
        "application/pdf": [".pdf"], // 新增PDF支持
      },
      maxSize: 10 * 1024 * 1024, // 10MB限制（可选，后端也会验证）
    });

  /**
   * Handles file selection.
   *
   * @param event - File input change event
   */
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      applySelectedFile(file);
    }
  };

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      notifyError(t("labManual.selectFile"));
      return;
    }
    if (!labName.trim()) {
      notifyError(t("labManual.enterFileName"));
      return;
    }

    setIsLoading(true);

    try {
      const request: UploadLabManualRequest = {
        file: selectedFile,
        lab_name: labName.trim(),
      };
      const response = await uploadLabManual(request);
      setUploadResponse(response);
      if (onUploadSuccess) {
        onUploadSuccess(response);
      }
      await loadLabManuals();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("labManual.uploadFailed");
      notifyError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles reset for new upload.
   */
  const handleReset = () => {
    setSelectedFile(null);
    setLabName("");
    setLabNameDraft("");
    setUploadResponse(null);
    setIsEditingLabName(false);
    setInputKey((prev) => prev + 1);
  };

  /**
   * Handles viewing lab manual content.
   */
  const getLabTitle = (lab: LabManualInfo): string =>
    lab.display_name || lab.lab_name;

  const formatFileSize = (sizeBytes?: number | null): string => {
    if (!sizeBytes) {
      return t("labManual.unknownSize");
    }
    if (sizeBytes < 1024 * 1024) {
      return `${(sizeBytes / 1024).toFixed(1)} KB`;
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleViewContent = async (lab: LabManualInfo) => {
    setViewingLabName(getLabTitle(lab));
    setViewingContent(null);
    setIsLoadingContent(true);
    try {
      const content = lab.document_id
        ? await getLabManualContentById(lab.document_id)
        : await getLabManualContent(lab.lab_name);
      setViewingContent(content);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("labManual.loadContentFailed");
      notifyError(errorMessage);
    } finally {
      setIsLoadingContent(false);
    }
  };

  const handleStartDisplayNameEdit = (lab: LabManualInfo) => {
    setEditingDocumentId(lab.document_id);
    setDisplayNameDraft(getLabTitle(lab));
  };

  const handleCancelDisplayNameEdit = () => {
    setEditingDocumentId(null);
    setDisplayNameDraft("");
  };

  const handleSaveDisplayName = async (lab: LabManualInfo) => {
    const nextName = displayNameDraft.trim();
    if (!nextName) {
      notifyError(t("labManual.displayNameRequired"));
      return;
    }
    setSavingDocumentId(lab.document_id);
    try {
      await updateLabManualDisplayName(lab.document_id, {
        display_name: nextName,
      });
      await loadLabManuals();
      notifySuccess(t("labManual.displayNameUpdated"));
      setEditingDocumentId(null);
      setDisplayNameDraft("");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("labManual.displayNameFailed");
      notifyError(errorMessage);
    } finally {
      setSavingDocumentId(null);
    }
  };

  /**
   * Handles deleting a lab manual.
   */
  const handleDelete = async (lab: LabManualInfo) => {
    const labTitle = getLabTitle(lab);
    const referencedProfiles = lab?.referenced_profiles ?? [];
    const referenceSummary =
      referencedProfiles.length > 0
        ? `\n\n${t("labManual.deleteReferencedProfiles")}\n${referencedProfiles
            .map((profile) => `- ${profile.profile_name || profile.profile_id}`)
            .join("\n")}\n\n${t("labManual.deleteUnlinkNotice")}`
        : "";
    const shouldDelete = await confirm({
      title: t("labManual.deleteConfirmTitle"),
      description:
        t("labManual.deleteConfirmDescription", { labName: labTitle }) +
        referenceSummary,
      confirmLabel: t("labManual.deleteConfirmButton"),
      confirmColor: "error",
    });
    if (!shouldDelete) {
      return;
    }

    setDeletingDocumentId(lab.document_id);
    try {
      const response = lab.document_id
        ? await deleteLabManualById(lab.document_id)
        : await deleteLabManual(lab.lab_name);
      await loadLabManuals();
      notifySuccess(
        t("labManual.deletedSuccess", {
          labName: labTitle,
          count: response.affected_profile_count,
        }),
      );
      if (viewingLabName === labTitle) {
        setViewingLabName(null);
        setViewingContent(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("labManual.deleteFailed");
      notifyError(errorMessage);
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleEditLabName = () => {
    setLabNameDraft(labName);
    setIsEditingLabName(true);
  };

  const handleSaveLabName = () => {
    if (!labNameDraft.trim()) {
      notifyError(t("labManual.enterFileNamePrompt"));
      return;
    }
    setLabName(labNameDraft.trim());
    setIsEditingLabName(false);
  };

  const handleCancelLabName = () => {
    setLabNameDraft(labName);
    setIsEditingLabName(false);
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredManuals = normalizedQuery
    ? labManuals.filter((lab) =>
        [
          lab.lab_name,
          lab.display_name,
          lab.filename || "",
          lab.owner_id || "",
          lab.source_path || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : labManuals;

  const renderStatusIcon = (
    label: string,
    isReady: boolean,
    icon: React.ReactNode,
  ) => (
    <Tooltip title={label} arrow>
      <Box
        component='span'
        sx={{
          color: isReady ? "success.main" : "text.disabled",
          display: "inline-flex",
          alignItems: "center",
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  );

  const body = (
    <Stack spacing={3} sx={{ pt: 2 }}>
      <Stack spacing={2} component='form' onSubmit={handleSubmit}>
        <Stack direction={"row"} alignItems='center' spacing={0.5}>
          <AttachFile fontSize='small' />
          <Typography sx={{ fontWeight: 600 }}>
            {t("labManual.uploadSection")}
          </Typography>
        </Stack>

        <Paper
          variant='outlined'
          {...getRootProps({
            role: "button",
            "aria-label": t("labManual.uploadSection"),
          })}
          sx={{
            p: 3,
            borderStyle: "dashed",
            borderColor: isDragReject
              ? "error.main"
              : isDragActive
                ? "primary.main"
                : "divider",
            textAlign: "center",
            cursor: "pointer",
            bgcolor: isDragActive ? "action.hover" : "transparent",
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
                isDragReject ? "error" : isDragActive ? "primary" : "action"
              }
              sx={{ fontSize: 32 }}
            />
            <Typography variant='subtitle1'>
              {isDragReject
                ? t("labManual.dropzoneReject")
                : isDragActive
                  ? t("labManual.dropzoneActive")
                  : t("labManual.dropzoneDefault")}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {isDragReject
                ? t("labManual.dropzoneRejectText")
                : t("labManual.dropzoneHelp")}
            </Typography>
            <Typography variant='caption' color='text.secondary' sx={{ mt: 1 }}>
              {t("labManual.supportedFormats")}
              <br />
              {t("labManual.pdfNote")}
            </Typography>
            {selectedFile && (
              <Typography variant='body2' sx={{ mt: 1 }}>
                {t("labManual.fileSelected", {
                  fileName: selectedFile.name,
                  size: (selectedFile.size / 1024).toFixed(2),
                })}
              </Typography>
            )}
          </Stack>
          <input
            {...getInputProps({
              onChange: handleFileChange,
            })}
            key={inputKey}
          />
        </Paper>

        {selectedFile && (
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
                {t("labManual.fileNameLabel")}
              </Typography>
              <TextField
                size='small'
                value={labName}
                onChange={(event) => setLabName(event.target.value)}
                disabled={isLoading}
                sx={{ width: "100%" }}
              />
            </Stack>

            <Stack
              direction='row'
              spacing={1}
              alignItems='center'
              justifyContent='flex-end'
              sx={{ mt: 2, width: "100%", maxWidth: 640 }}
            >
              {onClose && (
                <Button onClick={onClose} color='inherit' disabled={isLoading}>
                  {t("labManual.cancel")}
                </Button>
              )}
              <Button
                type='submit'
                variant='contained'
                disabled={isLoading || !selectedFile || !labName.trim()}
                sx={{ flex: 1, maxWidth: "fit-content" }}
              >
                {isLoading ? t("labManual.uploading") : t("labManual.upload")}
              </Button>
              {selectedFile && (
                <Button
                  onClick={handleReset}
                  color='inherit'
                  disabled={isLoading}
                >
                  {t("labManual.reselect")}
                </Button>
              )}
            </Stack>
          </Box>
        )}
      </Stack>

      <Divider flexItem />

      <Stack spacing={2}>
        <Stack direction={"row"} alignItems='center' spacing={1}>
          <List fontSize='small' />
          <Typography sx={{ fontWeight: 600 }}>
            {t("labManual.managementSection")}
          </Typography>
        </Stack>

        <TextField
          placeholder={t("labManual.searchPlaceholder")}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          size='small'
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <Search fontSize='small' color='action' />
              </InputAdornment>
            ),
          }}
        />

        {isLoadingManuals ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : filteredManuals.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <DescriptionOutlined
              sx={{ fontSize: 48, color: "var(--color-border)", mb: 2 }}
            />
            <Typography variant='h6' sx={{ mt: 2 }}>
              {labManuals.length === 0
                ? t("labManual.noManuals")
                : t("labManual.noMatchingManuals")}
            </Typography>
            <Typography variant='body2'>
              {labManuals.length === 0
                ? t("labManual.uploadFirstManual")
                : t("labManual.tryDifferentSearch")}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            {filteredManuals.map((lab) => (
              <Paper key={lab.document_id} variant='outlined' sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    justifyContent='space-between'
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      {editingDocumentId === lab.document_id ? (
                        <Stack direction='row' spacing={1} alignItems='center'>
                          <TextField
                            size='small'
                            value={displayNameDraft}
                            onChange={(event) =>
                              setDisplayNameDraft(event.target.value)
                            }
                            fullWidth
                            autoFocus
                          />
                          <Tooltip title={t("common.save")} arrow>
                            <IconButton
                              size='small'
                              onClick={() => handleSaveDisplayName(lab)}
                              disabled={savingDocumentId === lab.document_id}
                            >
                              {savingDocumentId === lab.document_id ? (
                                <CircularProgress size={16} />
                              ) : (
                                <Check fontSize='small' />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t("common.cancel")} arrow>
                            <IconButton
                              size='small'
                              onClick={handleCancelDisplayNameEdit}
                              disabled={savingDocumentId === lab.document_id}
                            >
                              <Close fontSize='small' />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ) : (
                        <Stack
                          direction='row'
                          spacing={1}
                          alignItems='center'
                          sx={{ minWidth: 0 }}
                        >
                          <Typography
                            variant='subtitle1'
                            sx={{ fontWeight: 600 }}
                            noWrap
                          >
                            {getLabTitle(lab)}
                          </Typography>
                          <Tooltip title={t("labManual.editDisplayName")} arrow>
                            <span>
                              <IconButton
                                size='small'
                                onClick={() => handleStartDisplayNameEdit(lab)}
                              >
                                <Edit fontSize='small' />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      )}
                      {lab.display_name !== lab.lab_name && (
                        <Typography variant='caption' color='text.secondary'>
                          {lab.lab_name}
                        </Typography>
                      )}
                      <Stack
                        direction='row'
                        spacing={1}
                        sx={{ mt: 0.75, flexWrap: "wrap", gap: 0.5 }}
                      >
                        <Chip
                          size='small'
                          label={
                            lab.is_builtin
                              ? t("labManual.builtinSource")
                              : t("labManual.uploadedSource")
                          }
                          variant='outlined'
                        />
                        {lab.filename && (
                          <Chip
                            size='small'
                            label={lab.filename}
                            variant='outlined'
                          />
                        )}
                        <Chip
                          size='small'
                          label={formatFileSize(lab.size_bytes)}
                          variant='outlined'
                        />
                      </Stack>
                      {(lab.referenced_profile_count ?? 0) > 0 && (
                        <Typography variant='caption' color='text.secondary'>
                          {t("labManual.referencedProfileCount", {
                            count: lab.referenced_profile_count,
                          })}
                        </Typography>
                      )}
                      <Stack direction='row' spacing={1} sx={{ mt: 1 }}>
                        {renderStatusIcon(
                          t("labManual.documentStatus"),
                          lab.has_lab_manual,
                          <DescriptionOutlined fontSize='small' />,
                        )}
                        {renderStatusIcon(
                          t("labManual.personaStatus"),
                          lab.has_persona,
                          <PersonOutline fontSize='small' />,
                        )}
                        {renderStatusIcon(
                          t("labManual.curriculumStatus"),
                          lab.has_curriculum,
                          <MenuBookOutlined fontSize='small' />,
                        )}
                      </Stack>
                    </Box>
                    <Stack direction='row' spacing={1} alignItems='center'>
                      {lab.has_lab_manual && (
                        <Button
                          variant='outlined'
                          size='small'
                          startIcon={<Visibility fontSize='small' />}
                          onClick={() => handleViewContent(lab)}
                          disabled={isLoadingContent}
                        >
                          {isLoadingContent
                            ? t("labManual.loading")
                            : t("labManual.view")}
                        </Button>
                      )}
                      <Button
                        variant='contained'
                        color='error'
                        size='small'
                        startIcon={
                          deletingDocumentId === lab.document_id ? (
                            <CircularProgress size={14} />
                          ) : (
                            <Delete fontSize='small' />
                          )
                        }
                        onClick={() => handleDelete(lab)}
                        disabled={deletingDocumentId === lab.document_id}
                      >
                        {deletingDocumentId === lab.document_id
                          ? t("labManual.deleting")
                          : t("labManual.delete")}
                      </Button>
                    </Stack>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Box>
        )}
      </Stack>
    </Stack>
  );

  const actions = onClose ? (
    <Stack direction='row' justifyContent='flex-end' sx={{ pt: 1 }}>
      <Button onClick={onClose} color='inherit'>
        {t("labManual.close")}
      </Button>
    </Stack>
  ) : null;

  const contentDialog = (
    <Dialog
      open={Boolean(viewingLabName)}
      onClose={() => {
        setViewingLabName(null);
        setViewingContent(null);
      }}
      fullWidth
      maxWidth='md'
    >
      <DialogTitle>
        {viewingLabName
          ? t("labManual.contentDialogTitleWithName", {
              labName: viewingLabName,
            })
          : t("labManual.contentDialogTitle")}
      </DialogTitle>
      <DialogContent dividers>
        {isLoadingContent ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <CircularProgress size={24} />
          </Box>
        ) : viewingContent ? (
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
                {viewingContent.content}
              </Typography>
            </Paper>
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ mt: 1, display: "block" }}
            >
              {t("labManual.fileSize", {
                size: (viewingContent.size / 1024).toFixed(2),
              })}
            </Typography>
          </>
        ) : (
          <Typography variant='body2' color='text.secondary'>
            {t("labManual.noContent")}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            setViewingLabName(null);
            setViewingContent(null);
          }}
          color='inherit'
        >
          {t("labManual.close")}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (variant === "panel") {
    return (
      <>
        {body}
        {actions}
        {contentDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open onClose={onClose} fullWidth maxWidth='lg'>
        <DialogTitle>{t("labManual.dialogTitle")}</DialogTitle>
        <DialogContent dividers>{body}</DialogContent>
        <DialogActions>{actions}</DialogActions>
      </Dialog>
      {contentDialog}
    </>
  );
}
