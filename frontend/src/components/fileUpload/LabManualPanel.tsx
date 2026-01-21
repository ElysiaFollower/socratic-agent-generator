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
  CircularProgress,
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
import { useDropzone } from "react-dropzone";
import {
  uploadLabManual,
  listLabManuals,
  getLabManualContent,
  deleteLabManual,
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
  const [deletingLab, setDeletingLab] = useState<string | null>(null);

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
    const allowedExtensions = [".md", ".txt", ".markdown", ".pdf"];
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
        "text/plain": [".txt"],
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
  const handleViewContent = async (labName: string) => {
    setViewingLabName(labName);
    setViewingContent(null);
    setIsLoadingContent(true);
    try {
      const content = await getLabManualContent(labName);
      setViewingContent(content);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("labManual.loadContentFailed");
      notifyError(errorMessage);
    } finally {
      setIsLoadingContent(false);
    }
  };

  /**
   * Handles deleting a lab manual.
   */
  const handleDelete = async (labName: string) => {
    const shouldDelete = await confirm({
      title: t("labManual.deleteConfirmTitle"),
      description: t("labManual.deleteConfirmDescription", { labName }),
      confirmLabel: t("labManual.deleteConfirmButton"),
      confirmColor: "error",
    });
    if (!shouldDelete) {
      return;
    }

    setDeletingLab(labName);
    try {
      await deleteLabManual(labName);
      await loadLabManuals();
      notifySuccess(t("labManual.deletedSuccess", { labName }));
      if (viewingLabName === labName) {
        setViewingLabName(null);
        setViewingContent(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : t("labManual.deleteFailed");
      notifyError(errorMessage);
    } finally {
      setDeletingLab(null);
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
        lab.lab_name.toLowerCase().includes(normalizedQuery),
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
              <Paper key={lab.lab_name} variant='outlined' sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    justifyContent='space-between'
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Box>
                      <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                        {lab.lab_name}
                      </Typography>
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
                          onClick={() => handleViewContent(lab.lab_name)}
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
                        startIcon={<Delete fontSize='small' />}
                        onClick={() => handleDelete(lab.lab_name)}
                        disabled={deletingLab === lab.lab_name}
                      >
                        {deletingLab === lab.lab_name
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
