
import {
    Box, IconButton, TextField, InputAdornment, Button, Menu, MenuItem, Tooltip, Stack, Chip
} from '@mui/material';
import {
    Search, FilterList, ViewHeadline, ViewModule, Settings, Assessment, Inventory2, Add,
    TableRows, DensitySmall, DensityMedium, DensityLarge, Star
} from '@mui/icons-material';
import { useLanguage } from '@/contexts/LanguageContext';
import { ViewMode, LayoutDensity } from '@/types';

export interface KanbanFilters {
    mine: boolean;
    overdue: boolean;
    critical: boolean;
    phaseTransition: boolean;
}

interface KanbanHeaderProps {
    boardName: string;
    searchTerm: string;
    onSearchChange: (val: string) => void;
    filters: KanbanFilters;
    onToggleFilter: (key: keyof KanbanFilters) => void;
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    density: LayoutDensity;
    onDensityChange: (density: LayoutDensity) => void;
    onOpenSettings: () => void;
    onOpenKpis: () => void;
    onOpenTopTopics: () => void;
    onOpenArchive: () => void;
    onNewCard: () => void;
    canModify: boolean;
    kpiBadgeCount: number;
}

export function KanbanHeader({
    boardName,
    searchTerm,
    onSearchChange,
    filters,
    onToggleFilter,
    viewMode,
    onViewModeChange,
    density,
    onDensityChange,
    onOpenSettings,
    onOpenKpis,
    onOpenTopTopics,
    onOpenArchive,
    onNewCard,
    canModify,
    kpiBadgeCount
}: KanbanHeaderProps) {
    const { t } = useLanguage();

    return (
        <Box sx={{
            p: 2,
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            flexWrap: 'wrap'
        }}>
            <TextField
                size="small"
                placeholder={t('kanban.search')}
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                InputProps={{
                    startAdornment: <InputAdornment position="start"><Search /></InputAdornment>
                }}
                sx={{ width: 220 }}
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1, overflowX: 'auto' }}>
                <Tooltip title={t('kanban.filterMine')}>
                    <Chip
                        icon={<FilterList />}
                        label={t('kanban.myCards')}
                        onClick={() => onToggleFilter('mine')}
                        color={filters.mine ? 'primary' : 'default'}
                        variant={filters.mine ? 'filled' : 'outlined'}
                    />
                </Tooltip>

                <Tooltip title={t('kanban.filterOverdue')}>
                    <Chip
                        label={t('kanban.overdue')}
                        onClick={() => onToggleFilter('overdue')}
                        color={filters.overdue ? 'error' : 'default'}
                        variant={filters.overdue ? 'filled' : 'outlined'}
                    />
                </Tooltip>

                <Tooltip title={t('kanban.filterCritical')}>
                    <Chip
                        label={t('kanban.critical')}
                        onClick={() => onToggleFilter('critical')}
                        color={filters.critical ? 'error' : 'default'}
                        variant={filters.critical ? 'filled' : 'outlined'}
                    />
                </Tooltip>

                <Tooltip title={t('kanban.phaseTransition')}>
                    <Chip
                        label={t('kanban.phaseTransition')}
                        onClick={() => onToggleFilter('phaseTransition')}
                        color={filters.phaseTransition ? 'warning' : 'default'}
                        variant={filters.phaseTransition ? 'filled' : 'outlined'}
                    />
                </Tooltip>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {/* View Mode */}
                {/* 
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex' }}>
                    <Tooltip title={t('kanban.viewColumns')}>
                        <IconButton
                            size="small"
                            color={viewMode === 'columns' ? 'primary' : 'default'}
                            onClick={() => onViewModeChange('columns')}
                        >
                            <ViewModule />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('kanban.viewSwimlanes')}>
                        <IconButton
                            size="small"
                            color={viewMode === 'swim' ? 'primary' : 'default'}
                            onClick={() => onViewModeChange('swim')}
                        >
                            <TableRows sx={{ transform: 'rotate(90deg)' }} />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('kanban.viewLanes')}>
                        <IconButton
                            size="small"
                            color={viewMode === 'lane' ? 'primary' : 'default'}
                            onClick={() => onViewModeChange('lane')}
                        >
                            <ViewHeadline />
                        </IconButton>
                    </Tooltip>
                </Box>
                 */}

                {/* Density */}
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, display: 'flex' }}>
                    <Tooltip title={t('kanban.densityCompact')}>
                        <IconButton
                            size="small"
                            color={density === 'compact' ? 'primary' : 'default'}
                            onClick={() => onDensityChange('compact')}
                        >
                            <DensityMedium />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('kanban.densityLarge')}>
                        <IconButton
                            size="small"
                            color={density === 'large' ? 'primary' : 'default'}
                            onClick={() => onDensityChange('large')}
                        >
                            <DensityLarge />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={t('kanban.densityXCompact')}>
                        <IconButton
                            size="small"
                            color={density === 'xcompact' ? 'primary' : 'default'}
                            onClick={() => onDensityChange('xcompact')}
                        >
                            <DensitySmall />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Actions */}
                <Tooltip title={t('kanban.topTopicsTitle')}>
                    <IconButton onClick={onOpenTopTopics}>
                        <Star />
                    </IconButton>
                </Tooltip>

                <Tooltip title={t('kanban.settings')}>
                    <IconButton onClick={onOpenSettings}>
                        <Settings />
                    </IconButton>
                </Tooltip>

                <Tooltip title={t('kanban.kpis')}>
                    <IconButton onClick={onOpenKpis} color={kpiBadgeCount > 0 ? 'warning' : 'default'}>
                        <Assessment />
                    </IconButton>
                </Tooltip>

                <Tooltip title={t('kanban.archive')}>
                    <IconButton onClick={onOpenArchive}>
                        <Inventory2 />
                    </IconButton>
                </Tooltip>

                {canModify && (
                    <Button
                        variant="contained"
                        startIcon={<Add />}
                        onClick={onNewCard}
                    >
                        {t('kanban.newCard')}
                    </Button>
                )}
            </Box>
        </Box>
    );
}
