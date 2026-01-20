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
} from "../api";
import { useConfirmDialog, useNotification } from "../hooks";

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
        err instanceof Error ? err.message : "加载实验文档列表失败";
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
      `上传成功：${uploadResponse.lab_name} (${(
        uploadResponse.size / 1024
      ).toFixed(2)} KB)`,
    );
    setUploadResponse(null);
  }, [uploadResponse, notifySuccess]);

  /**
   * Applies a selected file.
   */
  const applySelectedFile = (file: File) => {
    const allowedExtensions = [".md", ".txt", ".markdown"];
    const fileExtension = file.name.toLowerCase().split(".").pop();
    if (fileExtension && !allowedExtensions.includes(`.${fileExtension}`)) {
      notifyError(
        `不支持的文件类型。支持的类型：${allowedExtensions.join(", ")}`,
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
    notifyError("不支持的文件类型，仅支持 .md、.txt、.markdown");
  }, [notifyError]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } =
    useDropzone({
      onDrop: handleDrop,
      onDropRejected: handleDropRejected,
      maxFiles: 1,
      multiple: false,
      accept: {
        "text/markdown": [".md", ".markdown"],
        "text/plain": [".txt"],
      },
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
      notifyError("请选择一个文件");
      return;
    }
    if (!labName.trim()) {
      notifyError("请输入文件名");
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
        err instanceof Error ? err.message : "上传失败，请重试";
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
        err instanceof Error ? err.message : "加载文档内容失败";
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
      title: "删除实验文档",
      description: `确定要删除实验文档 "${labName}" 吗？此操作将删除整个实验目录及其所有内容，无法撤销。`,
      confirmLabel: "删除",
      confirmColor: "error",
    });
    if (!shouldDelete) {
      return;
    }

    setDeletingLab(labName);
    try {
      await deleteLabManual(labName);
      await loadLabManuals();
      notifySuccess(`已删除实验文档：${labName}`);
      if (viewingLabName === labName) {
        setViewingLabName(null);
        setViewingContent(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "删除失败";
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
      notifyError("请输入文件名");
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
          <Typography sx={{ fontWeight: 600 }}>上传文档</Typography>
        </Stack>

        <Paper
          variant='outlined'
          {...getRootProps({
            role: "button",
            "aria-label": "上传实验文档",
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
                ? "不支持的文件类型"
                : isDragActive
                  ? "释放鼠标以上传"
                  : "拖拽文件到此处上传"}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {isDragReject
                ? "仅支持 .md、.txt、.markdown"
                : "点击区域选择文件（支持 .md, .txt, .markdown）"}
            </Typography>
            {selectedFile && (
              <Typography variant='body2' sx={{ mt: 1 }}>
                已选择：{selectedFile.name} (
                {(selectedFile.size / 1024).toFixed(2)} KB)
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

        <Stack spacing={1}>
          <Typography variant='caption' color='text.secondary'>
            文件名（默认来自原始文件名）
          </Typography>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
          >
            {isEditingLabName ? (
              <TextField
                size='small'
                value={labNameDraft}
                onChange={(event) => setLabNameDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSaveLabName();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    handleCancelLabName();
                  }
                }}
                autoFocus
                disabled={isLoading}
                sx={{ minWidth: { xs: "100%", sm: 260 } }}
              />
            ) : (
              <Typography variant='body2'>
                {labName || "请选择文件以生成文件名"}
              </Typography>
            )}
            <Stack direction='row' spacing={1} alignItems='center'>
              {isEditingLabName ? (
                <>
                  <IconButton
                    size='small'
                    onClick={handleSaveLabName}
                    disabled={isLoading}
                    aria-label='保存文件名'
                  >
                    <Check fontSize='small' />
                  </IconButton>
                  <IconButton
                    size='small'
                    onClick={handleCancelLabName}
                    disabled={isLoading}
                    aria-label='取消编辑文件名'
                  >
                    <Close fontSize='small' />
                  </IconButton>
                </>
              ) : (
                <Tooltip title='编辑名称' arrow>
                  <span>
                    <IconButton
                      size='small'
                      onClick={handleEditLabName}
                      disabled={!selectedFile || isLoading}
                      aria-label='编辑文件名'
                    >
                      <Edit fontSize='small' />
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </Stack>
          </Stack>
          <Typography variant='caption' color='text.secondary'>
            将作为实验名称创建 data_raw/{labName || "实验名称"}/lab_manual.md
          </Typography>
        </Stack>

        <Stack direction='row' spacing={1} alignItems='center'>
          {onClose && (
            <Button onClick={onClose} color='inherit' disabled={isLoading}>
              取消
            </Button>
          )}
          <Button
            type='submit'
            variant='contained'
            disabled={isLoading || !selectedFile || !labName.trim()}
          >
            {isLoading ? "上传中..." : "上传"}
          </Button>
          {selectedFile && (
            <Button onClick={handleReset} color='inherit' disabled={isLoading}>
              重新选择
            </Button>
          )}
        </Stack>
      </Stack>

      <Divider flexItem />

      <Stack spacing={2}>
        <Stack direction={"row"} alignItems='center' spacing={1}>
          <List fontSize='small' />
          <Typography sx={{ fontWeight: 600 }}>文档管理</Typography>
        </Stack>

        <TextField
          placeholder='搜索实验名称'
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
          <Typography color='text.secondary' textAlign='center' sx={{ py: 4 }}>
            {labManuals.length === 0 ? "暂无实验文档" : "没有匹配的实验文档"}
          </Typography>
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
                          "文档",
                          lab.has_lab_manual,
                          <DescriptionOutlined fontSize='small' />,
                        )}
                        {renderStatusIcon(
                          "Persona",
                          lab.has_persona,
                          <PersonOutline fontSize='small' />,
                        )}
                        {renderStatusIcon(
                          "Curriculum",
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
                          {isLoadingContent ? "加载中..." : "查看"}
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
                        {deletingLab === lab.lab_name ? "删除中..." : "删除"}
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
        关闭
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
        {viewingLabName ? `${viewingLabName} - 文档内容` : "文档内容"}
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
              文件大小: {(viewingContent.size / 1024).toFixed(2)} KB
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
            setViewingLabName(null);
            setViewingContent(null);
          }}
          color='inherit'
        >
          关闭
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
        <DialogTitle>实验文档管理</DialogTitle>
        <DialogContent dividers>{body}</DialogContent>
        <DialogActions>{actions}</DialogActions>
      </Dialog>
      {contentDialog}
    </>
  );
}
