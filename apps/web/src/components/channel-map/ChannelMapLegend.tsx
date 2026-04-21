import { Badge, Group, Stack, Text } from '@mantine/core';
import { CHANNEL_MAP_SOURCE_META } from '../../lib/channelMap.js';

export function ChannelMapLegend() {
  return (
    <Stack gap='xs'>
      <Text fw={700}>凡例</Text>
      <Group>
        {Object.entries(CHANNEL_MAP_SOURCE_META).map(([sourceType, meta]) => (
          <Badge
            key={sourceType}
            variant='light'
            radius='sm'
            styles={{ root: { backgroundColor: `${meta.accent}22`, color: meta.color } }}
          >
            {meta.label}
          </Badge>
        ))}
      </Group>
    </Stack>
  );
}
