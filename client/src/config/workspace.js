import { ChartIcon, CompassIcon, SearchIcon, TagIcon, TargetIcon, UsersIcon, VideoIcon } from '../components/icons';

export const roleLabels = {
  admin: 'Admin',
  scout: 'Scout',
  team: 'Team',
  player: 'Player',
};

export const workspaceNavigation = {
  admin: [
    { to: '/', label: 'Overview', icon: CompassIcon },
    { to: '/admin', label: 'Admin portal', icon: ChartIcon },
    { to: '/scouting', label: 'Scouting', icon: TargetIcon },
    { to: '/reports', label: 'Saved reports', icon: VideoIcon },
    { to: '/search', label: 'Search workspace', icon: SearchIcon },
    { to: '/team-portal', label: 'Team portal', icon: TagIcon },
    { to: '/player-portal', label: 'Player portal', icon: UsersIcon },
    { to: '/dashboard', label: 'Analytics', icon: VideoIcon },
    { to: '/teams', label: 'Teams', icon: TagIcon },
    { to: '/players', label: 'Players', icon: UsersIcon },
  ],
  scout: [
    { to: '/', label: 'Overview', icon: CompassIcon },
    { to: '/scouting', label: 'Scout portal', icon: TargetIcon },
    { to: '/reports', label: 'Saved reports', icon: VideoIcon },
    { to: '/search', label: 'Search workspace', icon: SearchIcon },
    { to: '/dashboard', label: 'Dashboard', icon: ChartIcon },
    { to: '/players', label: 'Players', icon: UsersIcon },
    { to: '/teams', label: 'Teams', icon: TagIcon },
  ],
  team: [
    { to: '/team-portal', label: 'Team portal', icon: CompassIcon },
    { to: '/search', label: 'Search workspace', icon: SearchIcon },
    { to: '/dashboard', label: 'Performance', icon: ChartIcon },
    { to: '/teams', label: 'Squads', icon: TagIcon },
    { to: '/players', label: 'Players', icon: UsersIcon },
  ],
  player: [
    { to: '/player-portal', label: 'Player portal', icon: CompassIcon },
    { to: '/search', label: 'Search workspace', icon: SearchIcon },
    { to: '/dashboard', label: 'Performance', icon: ChartIcon },
    { to: '/players', label: 'Profiles', icon: UsersIcon },
  ],
};

export const roleExperience = {
  admin: {
    title: 'Control the platform, not just the data.',
    lead:
      'Monitor users, teams, moderation workload, and pipeline health from an operator-grade football analytics workspace.',
    primaryAction: { label: 'Open admin portal', to: '/admin' },
    quickActions: [
      { label: 'Review user roles', description: 'Approve access and assign portal roles', to: '/admin' },
      { label: 'Moderate video jobs', description: 'Retry failed processing and inspect platform health', to: '/admin' },
      { label: 'Open analytics workspace', description: 'Review scouting throughput and report output', to: '/dashboard' },
    ],
  },
  scout: {
    title: 'Turn footage into actionable recruitment decisions.',
    lead:
      'Move from upload to report, comparison, and shortlist review inside one premium scouting workflow.',
    primaryAction: { label: 'Upload highlight', action: 'upload' },
    quickActions: [
      { label: 'Open scout portal', description: 'Manage watchlists, notes, and recruitment stages', to: '/scouting' },
      { label: 'Manage players', description: 'Build profiles, compare targets, and review output', to: '/players' },
      { label: 'Review teams', description: 'Track rosters and opponent context', to: '/teams' },
      { label: 'Open analytics dashboard', description: 'Check reports, throughput, and activity', to: '/dashboard' },
    ],
  },
  team: {
    title: 'Run squad intelligence from one shared football workspace.',
    lead:
      'Monitor team footage, player depth, and analysis outputs with a role-specific portal built for staff workflows.',
    primaryAction: { label: 'Open team portal', to: '/team-portal' },
    quickActions: [
      { label: 'Open team portal', description: 'Review squad depth, match context, and video output', to: '/team-portal' },
      { label: 'Review squads', description: 'Manage team structures and opposition context', to: '/teams' },
      { label: 'Open player profiles', description: 'Track contributors and development focus', to: '/players' },
      { label: 'Check match library', description: 'Open the latest reports and pending jobs', to: '/' },
    ],
  },
  player: {
    title: 'See your performance story in one place.',
    lead:
      'Follow match output, video analysis, and personal progress through a cleaner player-facing analytics experience.',
    primaryAction: { label: 'Open player portal', to: '/player-portal' },
    quickActions: [
      { label: 'Open player portal', description: 'Review highlighted profiles, reports, and performance output', to: '/player-portal' },
      { label: 'Review profile', description: 'Open player pages and match history views', to: '/players' },
      { label: 'Check recent reports', description: 'Jump back into analyzed clips and heatmaps', to: '/dashboard' },
    ],
  },
};

export const scoutingStages = [
  { value: 'discovery', label: 'Discovery' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'shortlist', label: 'Shortlist' },
  { value: 'live', label: 'Live view' },
  { value: 'decision', label: 'Decision' },
];

export const scoutingPriorities = [
  { value: 'high', label: 'High priority' },
  { value: 'medium', label: 'Medium priority' },
  { value: 'low', label: 'Low priority' },
];
