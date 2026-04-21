import { Alert, Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from '@tanstack/react-router';
import {
  CHANNEL_MAP_REPORT_WARNING_THRESHOLD,
  CHANNEL_MAP_SOURCE_META,
  type ChannelMapDisplayEntry,
} from '../../lib/channelMap.js';

type ChannelMapDetailPanelProps = {
  entry: ChannelMapDisplayEntry | null;
  tournamentId: string;
};

function formatObservedAt(value: string | null) {
  if (!value) {
    return '不明';
  }

  return new Date(value).toLocaleString('ja-JP');
}

export function ChannelMapDetailPanel({ entry, tournamentId }: ChannelMapDetailPanelProps) {
  if (!entry) {
    return (
      <Card className='feature-card' padding='lg' radius='xl'>
        <Stack gap='sm'>
          <Title order={4}>詳細パネル</Title>
          <Text c='dimmed'>バーを選択すると、公開可能な詳細をここに表示します。</Text>
        </Stack>
      </Card>
    );
  }

  const meta = CHANNEL_MAP_SOURCE_META[entry.sourceType];

  return (
    <Card className='feature-card' padding='lg' radius='xl'>
      <Stack gap='md'>
        <Group justify='space-between' align='flex-start'>
          <div>
            <Title order={4}>{entry.label}</Title>
            <Text c='dimmed'>{entry.subtitle}</Text>
          </div>
          <Badge
            variant='light'
            styles={{ root: { color: meta.color, backgroundColor: `${meta.accent}22` } }}
          >
            {meta.label}
          </Badge>
        </Group>

        {entry.isWarning ? (
          <Alert color='orange' title='問題報告が集中しています'>
            報告件数が {CHANNEL_MAP_REPORT_WARNING_THRESHOLD}{' '}
            件以上です。再設定前に既存報告を確認してください。
          </Alert>
        ) : null}

        <Stack gap='xs'>
          <Text>
            チャンネル: {entry.channel}ch / {entry.channelWidthMHz}MHz
          </Text>
          {entry.purposeLabel ? <Text>用途: {entry.purposeLabel}</Text> : null}
          {entry.status ? <Text>状態: {entry.status}</Text> : null}
          {entry.apDeviceModel ? <Text>AP 型番: {entry.apDeviceModel}</Text> : null}
          {entry.clientDeviceModel ? <Text>Client 型番: {entry.clientDeviceModel}</Text> : null}
          {entry.reportCount > 0 ? <Text>問題報告: {entry.reportCount} 件</Text> : null}
          {entry.ssid ? <Text>SSID: {entry.ssid}</Text> : null}
          {entry.sourceLabel ? <Text>観測ソース: {entry.sourceLabel}</Text> : null}
          {entry.rssi !== null ? <Text>RSSI: {entry.rssi} dBm</Text> : null}
          {entry.locationLabel ? <Text>観測位置: {entry.locationLabel}</Text> : null}
          {entry.observedAt ? <Text>観測日時: {formatObservedAt(entry.observedAt)}</Text> : null}
        </Stack>

        <Group>
          <Button component={Link} to={`/tournaments/${tournamentId}`} variant='light'>
            ベストプラクティスを見る
          </Button>
          <Button
            component={Link}
            to={`/tournaments/${tournamentId}/teams`}
            color='orange'
            variant='light'
          >
            報告作成に進むチームを探す
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
