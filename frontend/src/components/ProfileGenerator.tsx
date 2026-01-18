/**
 * Profile generator component.
 *
 * This component provides a UI for generating tutor profiles from lab manuals,
 * following Google TypeScript Style Guide.
 */

import React, {useState, FormEvent, ChangeEvent} from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {generateProfile, type GenerateProfileRequest} from '../api';
import {Profile} from '../types';

/**
 * Props for ProfileGenerator component.
 */
interface ProfileGeneratorProps {
  readonly labManualContent?: string;
  readonly labManualFilename?: string | null;
  readonly onGenerateSuccess?: (profile: Profile) => void;
  readonly onClose?: () => void;
  readonly variant?: 'dialog' | 'panel';
}

/**
 * Profile generator component.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileGenerator(
  props: ProfileGeneratorProps,
): JSX.Element {
  const {
    labManualContent,
    labManualFilename,
    onGenerateSuccess,
    onClose,
    variant = 'dialog',
  } =
    props;
  const [content, setContent] = useState<string>(labManualContent || '');
  const [profileName, setProfileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedProfile, setGeneratedProfile] = useState<Profile | null>(
    null,
  );

  /**
   * Handles content change.
   *
   * @param event - Textarea change event
   */
  const handleContentChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    setError(null);
  };

  /**
   * Handles form submission.
   *
   * @param event - Form submit event
   */
  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }

    if (!content.trim()) {
      setError('实验文档内容不能为空');
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const request: GenerateProfileRequest = {
        lab_manual_content: content,
        profile_name: profileName.trim() || undefined,
        filename: labManualFilename || undefined,
      };
      const profile = await generateProfile(request);
      setGeneratedProfile(profile);
      if (onGenerateSuccess) {
        onGenerateSuccess(profile);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '生成失败，请重试';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles reset for new generation.
   */
  const handleReset = () => {
    setContent(labManualContent || '');
    setProfileName('');
    setGeneratedProfile(null);
    setError(null);
  };

  const contentBody = (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      {generatedProfile ? (
        <Stack spacing={2}>
          <Alert severity="success">Profile 生成成功。</Alert>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Profile 名称
            </Typography>
            <Typography variant="body2">
              {generatedProfile.profile_name || generatedProfile.topic_name}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              主题
            </Typography>
            <Typography variant="body2">
              {generatedProfile.topic_name}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              目标受众
            </Typography>
            <Typography variant="body2">
              {generatedProfile.target_audience}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Profile ID
            </Typography>
            <Typography variant="body2" sx={{fontFamily: 'var(--font-heading)'}}>
              {generatedProfile.profile_id}
            </Typography>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <TextField
            id="profile-name"
            label="Profile 名称（可选）"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            disabled={isLoading}
            fullWidth
          />
          <TextField
            id="lab-manual-content"
            label="实验文档内容"
            value={content}
            onChange={handleContentChange}
            disabled={isLoading}
            fullWidth
            multiline
            minRows={10}
          />
        </Stack>
      )}
    </Stack>
  );

  const actions = generatedProfile ? (
    <>
      <Button onClick={handleReset} color="inherit">
        生成新的
      </Button>
      {onClose && (
        <Button onClick={onClose} variant="contained">
          完成
        </Button>
      )}
    </>
  ) : (
    <>
      {onClose && (
        <Button onClick={onClose} color="inherit" disabled={isLoading}>
          取消
        </Button>
      )}
      <Button
        onClick={() => handleSubmit()}
        variant="contained"
        disabled={isLoading}
      >
        {isLoading ? '生成中...' : '生成 Profile'}
      </Button>
    </>
  );

  if (variant === 'panel') {
    return (
      <Stack spacing={2}>
        {contentBody}
        <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{pt: 1}}>
          {actions}
        </Stack>
      </Stack>
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>生成 Profile</DialogTitle>
      <DialogContent dividers>{contentBody}</DialogContent>
      <DialogActions>{actions}</DialogActions>
    </Dialog>
  );
}
