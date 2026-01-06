
import React from 'react';
import { 
    Terminal, FileText, Share2, Sparkles, Activity, Bot, 
    Calculator, Calendar, Camera, Clock, FolderOpen, Settings,
    Grid, Presentation, PenTool
} from 'lucide-react';
import { AppConfig, AppId } from '../types';

// Lazy Load Components
const TerminalApp = React.lazy(() => import('../components/apps/Terminal'));
const AetherText = React.lazy(() => import('../components/apps/AetherText'));
const Wormhole = React.lazy(() => import('../components/apps/Wormhole'));
const ImageFilter = React.lazy(() => import('../components/apps/ImageFilter'));
const SystemMonitor = React.lazy(() => import('../components/apps/SystemMonitor'));
const Cortex = React.lazy(() => import('../components/apps/Cortex'));
const Abacus = React.lazy(() => import('../components/apps/Abacus'));
const Chronos = React.lazy(() => import('../components/apps/Chronos'));
const Lens = React.lazy(() => import('../components/apps/Lens'));
const FileManager = React.lazy(() => import('../components/apps/FileManager'));
const CalendarApp = React.lazy(() => import('../components/apps/Calendar'));
const SettingsApp = React.lazy(() => import('../components/apps/Settings'));

// New Office Suite
const Scribe = React.lazy(() => import('../components/apps/Scribe/Editor'));
const AetherGrid = React.lazy(() => import('../components/apps/Grid/VirtualSheet'));
const Slides = React.lazy(() => import('../components/apps/Slides/SlideDeck'));

export const APP_REGISTRY: Record<AppId, AppConfig> = {
    'terminal': {
        id: 'terminal',
        title: 'Terminal',
        icon: <Terminal size={20} />,
        component: TerminalApp,
        defaultWidth: 600,
        defaultHeight: 400
    },
    'aether-text': {
        id: 'aether-text',
        title: 'Aether Text',
        icon: <FileText size={20} />,
        component: AetherText,
        defaultWidth: 800,
        defaultHeight: 600
    },
    'scribe': {
        id: 'scribe',
        title: 'Aether Scribe',
        icon: <PenTool size={20} />,
        component: Scribe,
        defaultWidth: 900,
        defaultHeight: 700
    },
    'grid': {
        id: 'grid',
        title: 'Aether Grid',
        icon: <Grid size={20} />,
        component: AetherGrid,
        defaultWidth: 1000,
        defaultHeight: 600
    },
    'slides': {
        id: 'slides',
        title: 'Aether Slides',
        icon: <Presentation size={20} />,
        component: Slides,
        defaultWidth: 1000,
        defaultHeight: 600
    },
    'files': {
        id: 'files',
        title: 'Aether Files',
        icon: <FolderOpen size={20} />,
        component: FileManager,
        defaultWidth: 700,
        defaultHeight: 500
    },
    'chronos': {
        id: 'chronos',
        title: 'Chronos',
        icon: <Clock size={20} />,
        component: Chronos,
        defaultWidth: 350,
        defaultHeight: 500
    },
    'abacus': {
        id: 'abacus',
        title: 'Abacus',
        icon: <Calculator size={20} />,
        component: Abacus,
        defaultWidth: 320,
        defaultHeight: 480
    },
    'lens': {
        id: 'lens',
        title: 'Lens',
        icon: <Camera size={20} />,
        component: Lens,
        defaultWidth: 640,
        defaultHeight: 520
    },
    'wormhole': {
        id: 'wormhole',
        title: 'Wormhole',
        icon: <Share2 size={20} />,
        component: Wormhole,
        defaultWidth: 400,
        defaultHeight: 600
    },
    'image-filter': {
        id: 'image-filter',
        title: 'Aether Native',
        icon: <Sparkles size={20} />,
        component: ImageFilter,
        defaultWidth: 600,
        defaultHeight: 600
    },
    'system-monitor': {
        id: 'system-monitor',
        title: 'Monitor',
        icon: <Activity size={20} />,
        component: SystemMonitor,
        defaultWidth: 500,
        defaultHeight: 400
    },
    'cortex': {
        id: 'cortex',
        title: 'Cortex AI',
        icon: <Bot size={20} />,
        component: Cortex,
        defaultWidth: 400,
        defaultHeight: 600
    },
    'epoch': {
        id: 'epoch',
        title: 'Epoch',
        icon: <Calendar size={20} />,
        component: CalendarApp,
        defaultWidth: 800,
        defaultHeight: 600
    },
    'settings': {
        id: 'settings',
        title: 'Settings',
        icon: <Settings size={20} />,
        component: SettingsApp,
        defaultWidth: 700,
        defaultHeight: 500
    }
};

export const getAppIdForExtension = (filename: string): AppId => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'txt':
        case 'md':
            return 'scribe';
        case 'csv':
        case 'grid':
            return 'grid';
        case 'pres':
            return 'slides';
        case 'png':
        case 'jpg':
        case 'jpeg':
            return 'image-filter';
        default:
            return 'aether-text'; 
    }
};
