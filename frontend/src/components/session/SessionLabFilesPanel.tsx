import React, {ChangeEvent, useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  listSessionFiles,
  putSessionFileToRemote,
  uploadSessionFile,
} from "../../api";
import {RemoteBindingSummary, SessionFileInfo} from "../../types";
import {CircularProgress} from "../common/CircularProgress";

interface SessionLabFilesPanelProps {
  readonly sessionId: string | null;
  readonly remoteBinding?: RemoteBindingSummary | null;
  readonly disabled?: boolean;
}

export function SessionLabFilesPanel({
  sessionId,
  remoteBinding,
  disabled = false,
}: SessionLabFilesPanelProps) {
  const {t} = useTranslation();
  const [files, setFiles] = useState<readonly SessionFileInfo[]>([]);
  const [remotePaths, setRemotePaths] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canUseFiles = Boolean(sessionId && remoteBinding);
  const machineLabel = remoteBinding?.display_name || remoteBinding?.runner_machine_name || "";

  const refreshFiles = useCallback(async () => {
    if (!sessionId || !remoteBinding) {
      setFiles([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const nextFiles = await listSessionFiles(sessionId);
      setFiles(nextFiles);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setIsLoading(false);
    }
  }, [remoteBinding, sessionId]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  const defaultRemoteDir = useMemo(() => {
    const cwd = remoteBinding?.default_cwd?.replace(/\/+$/, "");
    return cwd ? `${cwd}/socratic-labs/session-labsetup` : "socratic-labs/session-labsetup";
  }, [remoteBinding?.default_cwd]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !sessionId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const uploaded = await uploadSessionFile(sessionId, file);
      setFiles((prev) => {
        const withoutExisting = prev.filter(
          (item) => item.filename !== uploaded.filename,
        );
        return [...withoutExisting, uploaded].sort((a, b) =>
          a.filename.localeCompare(b.filename),
        );
      });
      setRemotePaths((prev) => ({
        ...prev,
        [uploaded.filename]:
          prev[uploaded.filename] || `${defaultRemoteDir}/${uploaded.filename}`,
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemotePut = async (filename: string) => {
    if (!sessionId) {
      return;
    }
    const remotePath = remotePaths[filename]?.trim();
    if (!remotePath) {
      setError(t("sessionFiles.remotePathRequired"));
      return;
    }
    setActiveFile(filename);
    setError(null);
    try {
      await putSessionFileToRemote(sessionId, filename, remotePath);
      await refreshFiles();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setActiveFile(null);
    }
  };

  if (!canUseFiles) {
    return null;
  }

  return (
    <Box
      sx={{
        borderTop: "1px solid",
        borderColor: "divider",
        pt: 1.25,
        mb: 1.25,
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction={{xs: "column", sm: "row"}}
          spacing={1}
          alignItems={{xs: "stretch", sm: "center"}}
        >
          <Typography
            variant='body2'
            sx={{fontWeight: 600, color: "text.secondary", flex: 1}}
          >
            {t("sessionFiles.title", {machine: machineLabel})}
          </Typography>
          <Stack direction='row' spacing={0.5} justifyContent='flex-end'>
            <Tooltip title={t("common.refresh")} arrow>
              <span>
                <IconButton
                  size='small'
                  disabled={disabled || isLoading}
                  onClick={refreshFiles}
                  aria-label={t("common.refresh")}
                >
                  {isLoading ? <CircularProgress size={18} /> : <RefreshIcon fontSize='small' />}
                </IconButton>
              </span>
            </Tooltip>
            <Button
              component='label'
              size='small'
              variant='outlined'
              startIcon={<AttachFileIcon fontSize='small' />}
              disabled={disabled || isLoading}
            >
              {t("sessionFiles.upload")}
              <input type='file' hidden onChange={handleFileChange} />
            </Button>
          </Stack>
        </Stack>
        {error && <Alert severity='error'>{error}</Alert>}
        {files.length > 0 && (
          <Stack spacing={1}>
            {files.map((file) => (
              <Stack
                key={file.filename}
                direction={{xs: "column", md: "row"}}
                spacing={1}
                alignItems={{xs: "stretch", md: "center"}}
              >
                <Typography
                  variant='body2'
                  sx={{
                    minWidth: {md: 180},
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={file.filename}
                >
                  {file.filename}
                </Typography>
                <TextField
                  size='small'
                  value={remotePaths[file.filename] ?? `${defaultRemoteDir}/${file.filename}`}
                  onChange={(event) =>
                    setRemotePaths((prev) => ({
                      ...prev,
                      [file.filename]: event.target.value,
                    }))
                  }
                  disabled={disabled || activeFile === file.filename}
                  placeholder={t("sessionFiles.remotePath")}
                  sx={{flex: 1}}
                />
                <Button
                  size='small'
                  variant='contained'
                  startIcon={
                    activeFile === file.filename ? (
                      <CircularProgress size={14} />
                    ) : (
                      <CloudUploadIcon fontSize='small' />
                    )
                  }
                  disabled={disabled || Boolean(activeFile)}
                  onClick={() => handleRemotePut(file.filename)}
                >
                  {t("sessionFiles.put")}
                </Button>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
