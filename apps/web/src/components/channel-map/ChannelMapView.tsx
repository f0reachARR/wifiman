import { Badge, Box, Stack, Text } from '@mantine/core';
import type { KeyboardEvent } from 'react';
import { useState } from 'react';
import { CHANNEL_MAP_SOURCE_META, type ChannelMapLaneEntry } from '../../lib/channelMap.js';

type ChannelMapViewProps = {
  entries: ChannelMapLaneEntry[];
  domain: {
    minFreqMHz: number;
    maxFreqMHz: number;
    ticks: Array<{
      channel: number;
      centerFreqMHz: number;
    }>;
  };
  selectedId: string | null;
  onSelect: (entry: ChannelMapLaneEntry) => void;
};

const SVG_WIDTH = 920;
const ROW_HEIGHT = 52;
const TOP_PADDING = 36;
const LEFT_PADDING = 24;
const RIGHT_PADDING = 24;

function toXPosition(freqMHz: number, domain: ChannelMapViewProps['domain']) {
  const width = SVG_WIDTH - LEFT_PADDING - RIGHT_PADDING;
  const ratio = (freqMHz - domain.minFreqMHz) / (domain.maxFreqMHz - domain.minFreqMHz);
  return LEFT_PADDING + width * ratio;
}

function handleBarKeyDown(
  event: KeyboardEvent<SVGRectElement>,
  entry: ChannelMapLaneEntry,
  onSelect: ChannelMapViewProps['onSelect'],
) {
  if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
    return;
  }

  event.preventDefault();
  onSelect(entry);
}

export function ChannelMapView({ entries, domain, selectedId, onSelect }: ChannelMapViewProps) {
  const height = TOP_PADDING + Math.max(entries.length, 1) * ROW_HEIGHT + 24;
  const [focusedId, setFocusedId] = useState<string | null>(null);

  return (
    <Box className='channel-map-view'>
      <svg viewBox={`0 0 ${SVG_WIDTH} ${height}`} role='img' aria-label='チャンネルマップ SVG'>
        {domain.ticks.map((tick) => {
          const tickX = toXPosition(tick.centerFreqMHz, domain);
          return (
            <g key={tick.channel}>
              <line
                x1={tickX}
                y1={22}
                x2={tickX}
                y2={height - 12}
                stroke='rgba(16, 40, 34, 0.12)'
                strokeDasharray='3 6'
              />
              <text
                x={tickX}
                y={16}
                textAnchor='middle'
                fontSize='11'
                fill='#5b6b67'
                data-channel={String(tick.channel)}
              >
                {tick.channel}
              </text>
            </g>
          );
        })}

        {entries.map((entry) => {
          const y = TOP_PADDING + entry.lane * ROW_HEIGHT;
          const x = toXPosition(entry.startFreqMHz, domain);
          const width = Math.max(14, toXPosition(entry.endFreqMHz, domain) - x);
          const meta = CHANNEL_MAP_SOURCE_META[entry.sourceType];
          const isSelected = selectedId === entry.id;
          const isFocused = focusedId === entry.id;

          return (
            <g key={entry.id} transform={`translate(0 ${y})`}>
              {isFocused ? (
                <rect
                  x={x - 5}
                  y={4}
                  width={width + 10}
                  height={32}
                  rx={16}
                  fill='none'
                  stroke='rgba(16, 40, 34, 0.9)'
                  strokeWidth={2}
                  strokeDasharray='5 3'
                  pointerEvents='none'
                  data-focus-outline-for={entry.id}
                />
              ) : null}
              <rect
                x={x}
                y={8}
                width={width}
                height={24}
                rx={12}
                role='button'
                aria-label={`${entry.label} bar`}
                aria-pressed={isSelected}
                data-entry-id={entry.id}
                data-focus-visible={isFocused ? 'true' : undefined}
                tabIndex={0}
                fill={meta.accent}
                fillOpacity={isSelected ? 0.92 : 0.72}
                stroke={meta.color}
                strokeWidth={isSelected ? 3 : 1.5}
                style={{ cursor: 'pointer' }}
                onClick={() => onSelect(entry)}
                onFocus={() => setFocusedId(entry.id)}
                onBlur={() => {
                  setFocusedId((current) => (current === entry.id ? null : current));
                }}
                onKeyDown={(event) => handleBarKeyDown(event, entry, onSelect)}
              />
              <text
                x={x + 10}
                y={24}
                fontSize='11'
                fill={meta.color}
                style={{ pointerEvents: 'none' }}
              >
                {entry.label}
              </text>
              {entry.isWarning ? <circle cx={x + width - 10} cy={20} r={5} fill='#b45309' /> : null}
            </g>
          );
        })}
      </svg>
      <Stack gap='xs' mt='sm'>
        {entries.length === 0 ? (
          <Text c='dimmed'>条件に一致する構成はありません。</Text>
        ) : (
          entries.slice(0, 3).map((entry) => (
            <Badge key={entry.id} variant='light' color='gray'>
              {entry.label} / {entry.channel}ch / {entry.channelWidthMHz}MHz
            </Badge>
          ))
        )}
      </Stack>
    </Box>
  );
}
