/**
 * ProfileSelector component for selecting a profile to start a session.
 *
 * This component displays a modal with available profiles for selection.
 */

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  TextField,
  Typography,
} from "@mui/material";
import { School } from "@mui/icons-material";
import { CircularProgress } from "../common/CircularProgress";
import { Profile } from "../../types";
import { extractCurriculumSteps } from "../../utils/curriculum";

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
  const { profiles, isLoading, onSelect, onClose } = props;
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState<string>("");

  const filteredProfiles = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return profiles;
    }

    return profiles.filter((profile) => {
      const fields = [
        profile.profile_name,
        profile.topic_name,
        profile.target_audience,
        profile.lab_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return fields.includes(query);
    });
  }, [profiles, searchText]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth='md'>
      <DialogTitle>{t("profile.selector.title")}</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 2 }}>
          <TextField
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder={t("profile.selector.searchPlaceholder")}
            size='small'
            fullWidth
          />
        </Box>
        {filteredProfiles.length > 0 ? (
          <Grid container spacing={2}>
            {filteredProfiles.map((profile) => (
              <Grid item xs={12} md={6} key={profile.profile_id}>
                <Card variant='outlined'>
                  <CardActionArea
                    onClick={() => onSelect(profile)}
                    disabled={isLoading}
                    sx={{ position: "relative" }}
                  >
                    {isLoading && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "rgba(255, 255, 255, 0.7)",
                          zIndex: 1,
                        }}
                      >
                        <CircularProgress size={24} />
                      </Box>
                    )}
                    <CardContent>
                      <Typography variant='h6' sx={{ mb: 1 }}>
                        {profile.profile_name || profile.topic_name}
                      </Typography>
                      <Typography
                        variant='body2'
                        color='text.secondary'
                        sx={{ mb: 1 }}
                      >
                        {t("profile.selector.targetAudience")}:{" "}
                        {profile.target_audience}
                      </Typography>
                      <Typography
                        variant='body2'
                        color='text.secondary'
                        sx={{ mb: 1 }}
                      >
                        {t("profile.selector.courseTopic")}:{" "}
                        {profile.topic_name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {t("profile.selector.learningSteps")}:{" "}
                        {extractCurriculumSteps(profile.curriculum).length}
                        {t("profile.selector.stepsCount")}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : profiles.length > 0 ? (
          <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <School sx={{ fontSize: 48, color: "var(--color-border)" }} />
            <Typography variant='h6' sx={{ mt: 2 }}>
              {t("profile.selector.noMatchingCourses")}
            </Typography>
            <Typography variant='body2'>
              {t("profile.selector.tryOtherKeywords")}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ py: 6, textAlign: "center", color: "text.secondary" }}>
            <School sx={{ fontSize: 48, color: "var(--color-border)" }} />
            <Typography variant='h6' sx={{ mt: 2 }}>
              {t("profile.selector.noCoursesAvailable")}
            </Typography>
            <Typography variant='body2'>
              {t("profile.selector.waitForTeacher")}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color='inherit'>
          {t("common.cancel")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
