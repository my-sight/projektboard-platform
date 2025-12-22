
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
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useLanguage } from '@/contexts/LanguageContext';
import { ClientProfile } from '@/lib/clientProfiles';
import { isSuperuserEmail } from '@/constants/superuser';
import { Member } from './types';

interface MembersViewProps {
    members: (Member & { profile?: ClientProfile })[];
    availableProfiles: ClientProfile[];
    memberSelect: string;
    onMemberSelectChange: (value: string) => void;
    onAddMember: () => void;
    onRemoveMember: (id: string) => void;
    canEdit: boolean;
}

export function MembersView({
    members,
    availableProfiles,
    memberSelect,
    onMemberSelectChange,
    onAddMember,
    onRemoveMember,
    canEdit,
}: MembersViewProps) {
    const { t } = useLanguage();

    return (
        <Card>
            <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} flexWrap="wrap">
                    <Box>
                        <Typography variant="h6">👥 {t('boardManagement.boardMembers')}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {t('boardManagement.boardMembersDesc')}
                        </Typography>
                    </Box>
                    {canEdit && (
                        <Stack direction="row" spacing={1} alignItems="center">
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                                <InputLabel>{t('boardManagement.addMember')}</InputLabel>
                                <Select
                                    label={t('boardManagement.addMember')}
                                    value={memberSelect}
                                    onChange={(event) => onMemberSelectChange(event.target.value)}
                                >
                                    <MenuItem value="">
                                        <em>{t('boardManagement.select')}</em>
                                    </MenuItem>
                                    {availableProfiles.map(profile => (
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
                                onClick={onAddMember}
                                disabled={!memberSelect}
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
                    {members.map(member => {
                        const label = member.profile?.full_name || member.profile?.email || 'Unbekannt';
                        const detail = member.profile?.company ? ` (${member.profile.company})` : '';
                        const deletable = canEdit && !isSuperuserEmail(member.profile?.email ?? null);
                        return (
                            <Chip
                                key={member.id}
                                label={`${label}${detail}`}
                                variant="outlined"
                                onDelete={deletable ? () => onRemoveMember(member.id) : undefined}
                                sx={{ mr: 1, mb: 1 }}
                            />
                        );
                    })}
                </Stack>
            </CardContent>
        </Card>
    );
}
