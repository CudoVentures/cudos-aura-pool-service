import React from 'react';

import { Tooltip as MuiTooltip, TooltipProps } from '@mui/material';

import '../styles/tooltip.css';

export default function Tooltip(props: TooltipProps) {

    return (
        <MuiTooltip
            { ...props }
            classes = { {
                'popper': 'TooltipPopper',
                'tooltip': 'TooltipItself',
                'arrow': 'TooltipArrow',
            } }
            enterTouchDelay = { 1 }
            leaveTouchDelay = { 10 * 60 * 1000 } />
    )
}
