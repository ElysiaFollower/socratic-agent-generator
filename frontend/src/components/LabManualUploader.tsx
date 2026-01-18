/**
 * Lab manual uploader component.
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
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { Cancel, CheckCircle, Close } from "@mui/icons-material";
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

/**
 * Props for LabManualUploader component.
 */
interface LabManualUploaderProps {
  readonly onUploadSuccess?: (response: UploadLabManualResponse) => void;
  readonly onClose?: () => void;
  readonly variant?: "dialog" | "panel";
}

type TabKey = "upload" | "manage";

/**
 * Lab manual uploader component.
 *
 * @param props - Component props
 * @returns React component
 */
export function LabManualUploader(props: LabManualUploaderProps): JSX.Element {
  const { onUploadSuccess, onClose, variant = "dialog" } = props;
  const [activeTab, setActiveTab] = useState<TabKey>("upload");

  // Upload tab state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [labName, setLabName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] =
    useState<UploadLabManualResponse | null>(null);

  // Manage tab state
  const [labManuals, setLabManuals] = useState<readonly LabManualInfo[]>([]);
  const [isLoadingManuals, setIsLoadingManuals] = useState<boolean>(false);
  const [viewingContent, setViewingContent] = useState<LabManualContent | null>(
    null,
  );
  const [viewingLabName, setViewingLabName] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState<boolean>(false);
  const [deletingLab, setDeletingLab] = useState<string | null>(null);

  /**
   * Loads lab manuals list.
   */
  const loadLabManuals = useCallback(async () => {
    setIsLoadingManuals(true);
    setError(null);
    try {
      const manuals = await listLabManuals();
      setLabManuals(manuals);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载实验文档列表失败";
      setError(errorMessage);
      console.error("Failed to load lab manuals:", err);
    } finally {
      setIsLoadingManuals(false);
    }
  }, []);

  /**
   * Loads lab manuals when manage tab is active.
   */
  useEffect(() => {
    if (activeTab === "manage") {
      void loadLabManuals();
    }
  }, [activeTab, loadLabManuals]);

  /**
   * Handles file selection.
   *
   * @param event - File input change event
   */
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      // Validate file type
      const allowedExtensions = [".md", ".txt", ".markdown"];
      const fileExtension = file.name.toLowerCase().split(".").pop();
      if (fileExtension && !allowedExtensions.includes(`.${fileExtension}`)) {
        setError(
          `不支持的文件类型。支持的类型：${allowedExtensions.join(", ")}`,
        );
        setSelectedFile(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
      setUploadResponse(null);
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
      setError("请选择一个文件");
      return;
    }
    if (!labName.trim()) {
      setError("请输入实验名称");
      return;
    }

    setError(null);
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
      // Refresh lab manuals list if on manage tab
      if (activeTab === "manage") {
        await loadLabManuals();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "上传失败，请重试";
      setError(errorMessage);
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
    setUploadResponse(null);
    setError(null);
    // Reset file input
    const fileInput = document.getElementById(
      "lab-manual-file",
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  /**
   * Handles viewing lab manual content.
   */
  const handleViewContent = async (labName: string) => {
    setViewingLabName(labName);
    setViewingContent(null);
    setIsLoadingContent(true);
    setError(null);
    try {
      const content = await getLabManualContent(labName);
      setViewingContent(content);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "加载文档内容失败";
      setError(errorMessage);
    } finally {
      setIsLoadingContent(false);
    }
  };

  /**
   * Handles deleting a lab manual.
   */
  const handleDelete = async (labName: string) => {
    if (
      !confirm(
        `确定要删除实验文档 "${labName}" 吗？此操作将删除整个实验目录及其所有内容，无法撤销。`,
      )
    ) {
      return;
    }

    setDeletingLab(labName);
    setError(null);
    try {
      await deleteLabManual(labName);
      await loadLabManuals();
      if (viewingLabName === labName) {
        setViewingLabName(null);
        setViewingContent(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "删除失败";
      setError(errorMessage);
    } finally {
      setDeletingLab(null);
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, value: TabKey) => {
    setActiveTab(value);
    setError(null);
    setViewingContent(null);
  };

  const renderStatusChip = (label: string, isReady: boolean) => (
    <Chip
      size='small'
      label={label}
      color={isReady ? "success" : "default"}
      variant={isReady ? "filled" : "outlined"}
    />
  );

  const body = (
    <Stack spacing={2}>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        aria-label='实验文档管理标签页'
      >
        <Tab value='upload' label='上传文档' />
        <Tab value='manage' label='管理文档' />
      </Tabs>

      {error && <Alert severity='error'>{error}</Alert>}

      {activeTab === "upload" && (
        <>
          {uploadResponse ? (
            <Stack spacing={2}>
              <Alert severity='success'>上传成功。</Alert>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  实验名称
                </Typography>
                <Typography variant='body2'>
                  {uploadResponse.lab_name}
                </Typography>
              </Box>
              <Box>
                <Typography variant='caption' color='text.secondary'>
                  文件大小
                </Typography>
                <Typography variant='body2'>
                  {(uploadResponse.size / 1024).toFixed(2)} KB
                </Typography>
              </Box>
              <Stack direction='row' spacing={1}>
                <Button onClick={handleReset} color='inherit'>
                  上传新文件
                </Button>
                {onClose && (
                  <Button onClick={onClose} variant='contained'>
                    完成
                  </Button>
                )}
              </Stack>
            </Stack>
          ) : (
            <Stack component='form' spacing={2} onSubmit={handleSubmit}>
              <TextField
                id='lab-name'
                label='实验名称'
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                disabled={isLoading}
                fullWidth
                required
                helperText='将创建 data_raw/{实验名称}/lab_manual.md'
              />
              <Box>
                <Stack direction='row' spacing={2} alignItems='center'>
                  <Button
                    variant='outlined'
                    component='label'
                    disabled={isLoading}
                  >
                    选择文件
                    <input
                      id='lab-manual-file'
                      name='lab-manual-file'
                      type='file'
                      accept='.md,.txt,.markdown'
                      onChange={handleFileChange}
                      hidden
                    />
                  </Button>
                  {selectedFile && (
                    <Typography variant='body2'>
                      {selectedFile.name} (
                      {(selectedFile.size / 1024).toFixed(2)} KB)
                    </Typography>
                  )}
                </Stack>
                <Typography
                  variant='caption'
                  color='text.secondary'
                  sx={{ mt: 1, display: "block" }}
                >
                  支持的文件类型：.md, .txt, .markdown
                </Typography>
              </Box>
              <Stack direction='row' spacing={1}>
                {onClose && (
                  <Button
                    onClick={onClose}
                    color='inherit'
                    disabled={isLoading}
                  >
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
              </Stack>
            </Stack>
          )}
        </>
      )}

      {activeTab === "manage" && (
        <Stack spacing={2}>
          {isLoadingManuals ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <CircularProgress size={24} />
            </Box>
          ) : labManuals.length === 0 ? (
            <Typography
              color='text.secondary'
              textAlign='center'
              sx={{ py: 4 }}
            >
              暂无实验文档
            </Typography>
          ) : (
            <Stack spacing={2}>
              {labManuals.map((lab) => (
                <Paper key={lab.lab_name} variant='outlined' sx={{ p: 2 }}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    justifyContent='space-between'
                  >
                    <Box>
                      <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                        {lab.lab_name}
                      </Typography>
                      <Stack
                        direction='row'
                        spacing={1}
                        sx={{ mt: 1, flexWrap: "wrap" }}
                      >
                        {renderStatusChip(
                          `文档 ${lab.has_lab_manual ? "✓" : "✗"}`,
                          lab.has_lab_manual,
                        )}
                        {renderStatusChip(
                          `Persona ${lab.has_persona ? "✓" : "✗"}`,
                          lab.has_persona,
                        )}
                        {renderStatusChip(
                          `Curriculum ${lab.has_curriculum ? "✓" : "✗"}`,
                          lab.has_curriculum,
                        )}
                      </Stack>
                    </Box>
                    <Stack direction='row' spacing={1} alignItems='center'>
                      {lab.has_lab_manual && (
                        <Button
                          variant='outlined'
                          size='small'
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
                        onClick={() => handleDelete(lab.lab_name)}
                        disabled={deletingLab === lab.lab_name}
                      >
                        {deletingLab === lab.lab_name ? "删除中..." : "删除"}
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Stack>
      )}
    </Stack>
  );

  const actions = onClose ? (
    <Stack direction='row' justifyContent='flex-end' sx={{ pt: 1 }}>
      <Button onClick={onClose} color='inherit'>
        关闭
      </Button>
    </Stack>
  ) : null;

  if (variant === "panel") {
    return (
      <>
        {body}
        {actions}
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
            {viewingLabName ? `${viewingLabName}` : "文档内容"}
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
    </>
  );
}
