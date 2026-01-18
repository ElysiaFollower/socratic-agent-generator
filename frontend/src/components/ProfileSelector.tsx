/**
 * ProfileSelector component for selecting a profile to start a session.
 *
 * This component displays a modal with available profiles for selection.
 */

import React from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Button,
  Typography,
} from '@mui/material';
import {School} from '@mui/icons-material';
import {Profile} from '../types';
import {extractCurriculumSteps} from '../utils/curriculum';

/**
 * Props for ProfileSelector component.
 */
export interface ProfileSelectorProps {
  readonly profiles: readonly Profile[];
  readonly isLoading: boolean;
  readonly onSelect: (profile: Profile) => void;
  readonly onClose: () => void;
}

/**
 * ProfileSelector component for selecting a profile.
 *
 * @param props - Component props
 * @returns React component
 */
export function ProfileSelector(props: ProfileSelectorProps): JSX.Element {
  const {profiles, isLoading, onSelect, onClose} = props;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>选择学习课程</DialogTitle>
      <DialogContent dividers>
        {profiles.length > 0 ? (
          <Grid container spacing={2}>
            {profiles.map((profile) => (
              <Grid item xs={12} md={6} key={profile.profile_id}>
                <Card variant="outlined">
                  <CardActionArea
                    onClick={() => onSelect(profile)}
                    disabled={isLoading}
                  >
                    <CardContent>
                      <Typography variant="h6" sx={{mb: 1}}>
                        {profile.profile_name || profile.topic_name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                        目标受众: {profile.target_audience}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
                        课程主题: {profile.topic_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        学习步骤: {extractCurriculumSteps(profile.curriculum).length} 个步骤
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{py: 6, textAlign: 'center', color: 'text.secondary'}}>
            <School sx={{fontSize: 48, color: 'var(--color-border)'}} />
            <Typography variant="h6" sx={{mt: 2}}>
              暂无可用的课程配置
            </Typography>
            <Typography variant="body2">请联系管理员添加学习课程</Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          取消
        </Button>
      </DialogActions>
    </Dialog>
  );
}
