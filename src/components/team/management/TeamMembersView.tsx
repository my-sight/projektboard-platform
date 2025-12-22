
import React from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useLanguage } from '@/contexts/LanguageContext';
import { ClientProfile } from '@/lib/clientProfiles';
import { MemberWithProfile } from './types';

interface TeamMembersViewProps {
    members: MemberWithProfile[];
    availableProfiles: ClientProfile[];
    memberSelect: string;
    canEdit: boolean;
    onMemberSelectChange: (id: string) => void;
    onAddMember: () => void;
    onRemoveMember: (id: string) => void;
}

export function TeamMembersView({
    members,
    availableProfiles,
    memberSelect,
    canEdit,
    onMemberSelectChange,
    onAddMember,
    onRemoveMember
}: TeamMembersViewProps) {
    const { t } = useLanguage();

    return (
        <Card>
            <CardContent>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    spacing={2}
                    alignItems="flex-start"
                >
                    <Box>
                        <Typography variant="h6">👥 {t('boardManagement.teamMembers')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('boardManagement.manageMembers')}
                        </Typography>
                    </Box>
                    {canEdit && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel>{t('boardManagement.addMember')}</InputLabel>
                                <Select
                                    label={t('boardManagement.addMember')}
                                    value={memberSelect}
                                    onChange={(event) => onMemberSelectChange(String(event.target.value))}
                                >
                                    <MenuItem value="">
                                        <em>{t('boardManagement.select')}</em>
                                    </MenuItem>
                                    {availableProfiles.map((profile) => (
                                        <MenuItem key={profile.id} value={profile.id}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                    {profile.full_name || profile.name || profile.email}
                                                </Typography>
                                                {(profile.department || profile.company) && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {profile.department || profile.company}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                disabled={!memberSelect}
                                onClick={onAddMember}
                            >
                                {t('boardManagement.add')}
                            </Button>
                        </Stack>
                    )}
                </Stack>

                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 3 }}>
                    {members.length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                            {t('boardManagement.noMembers')}
                        </Typography>
                    )}
                    {members.map((member) => {
                        const label = member.profile?.full_name || member.profile?.email || 'Unbekannt';
                        const detail = member.profile?.company ? ` • ${member.profile.company}` : '';
                        return (
                            <Chip
                                key={member.id}
                                label={`${label}${detail}`}
                                variant="outlined"
                                onDelete={canEdit ? () => onRemoveMember(member.id) : undefined}
                                deleteIcon={canEdit ? <DeleteIcon fontSize="small" /> : undefined}
                                sx={{ mr: 1, mb: 1 }}
                            />
                        );
                    })}
                </Stack>
            </CardContent>
        </Card>
    );
}
