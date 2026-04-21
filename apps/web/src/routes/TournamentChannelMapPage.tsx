import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { BANDS, type Band } from '@wifiman/shared';
import { useMemo, useState } from 'react';
import { ChannelMapDetailPanel } from '../components/channel-map/ChannelMapDetailPanel.js';
import { ChannelMapFilters } from '../components/channel-map/ChannelMapFilters.js';
import { ChannelMapLegend } from '../components/channel-map/ChannelMapLegend.js';
import { ChannelMapView } from '../components/channel-map/ChannelMapView.js';
import {
  type ChannelMapDisplayEntry,
  type ChannelMapFilters as ChannelMapFiltersState,
  createChannelMapModel,
  createInitialBand,
  DEFAULT_CHANNEL_MAP_FILTERS,
  getRelevantPractices,
} from '../lib/channelMap.js';
import {
  useTournament,
  useTournamentBestPractices,
  useTournamentChannelMap,
} from '../lib/useTeamManagement.js';

type TournamentChannelMapPageProps = {
  tournamentId: string;
};

export function TournamentChannelMapPage({ tournamentId }: TournamentChannelMapPageProps) {
  const tournamentQuery = useTournament(tournamentId);
  const channelMapQuery = useTournamentChannelMap(tournamentId);
  const bestPracticesQuery = useTournamentBestPractices(tournamentId);
  const [band, setBand] = useState<Band>(() => createInitialBand(undefined));
  const [filters, setFilters] = useState<ChannelMapFiltersState>(DEFAULT_CHANNEL_MAP_FILTERS);
  const [selectedEntry, setSelectedEntry] = useState<ChannelMapDisplayEntry | null>(null);

  const model = useMemo(() => {
    if (!channelMapQuery.data) {
      return null;
    }

    return createChannelMapModel({
      band,
      entries: channelMapQuery.data,
      filters,
      practices: bestPracticesQuery.data ?? [],
    });
  }, [band, bestPracticesQuery.data, channelMapQuery.data, filters]);

  const relevantPractices = useMemo(() => {
    return getRelevantPractices(bestPracticesQuery.data ?? [], band, selectedEntry);
  }, [band, bestPracticesQuery.data, selectedEntry]);

  if (tournamentQuery.isLoading || channelMapQuery.isLoading) {
    return (
      <Stack align='center' py='xl'>
        <Loader color='teal' />
        <Text c='dimmed'>チャンネルマップを読み込んでいます</Text>
      </Stack>
    );
  }

  if (tournamentQuery.isError || channelMapQuery.isError || !tournamentQuery.data || !model) {
    return (
      <Alert color='red' title='チャンネルマップを取得できませんでした'>
        少し時間を置いて再度お試しください。
      </Alert>
    );
  }

  return (
    <Stack gap='xl'>
      <Card
        className='hero-card tournament-hero-card channel-map-hero-card'
        padding='xl'
        radius='xl'
      >
        <Stack gap='lg'>
          <Group justify='space-between' align='flex-start'>
            <div>
              <Text tt='uppercase' fw={700} c='teal'>
                Channel Map
              </Text>
              <Title order={1}>{tournamentQuery.data.name} チャンネルマップ</Title>
              <Text c='dimmed'>
                帯域別に、公開可能な WiFi 構成と観測 WiFi を同じルールで可視化します。
              </Text>
            </div>
            <Button component={Link} to={`/tournaments/${tournamentId}`} variant='subtle'>
              大会トップへ戻る
            </Button>
          </Group>

          <Group justify='space-between' align='center'>
            <SegmentedControl
              value={band}
              onChange={(value) => {
                setBand(value as Band);
                setSelectedEntry(null);
              }}
              data={BANDS.map((value) => ({ value, label: value }))}
            />

            <Group>
              <Badge color='teal' variant='light'>
                総数 {model.stats.total}
              </Badge>
              <Badge color='orange' variant='light'>
                警告 {model.stats.warningCount}
              </Badge>
              {model.hiddenCount > 0 ? (
                <Badge color='gray' variant='light'>
                  非表示 {model.hiddenCount}
                </Badge>
              ) : null}
            </Group>
          </Group>
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing='lg'>
        <Card className='feature-card' padding='lg' radius='xl'>
          <Stack gap='lg'>
            <ChannelMapLegend />
            <ChannelMapFilters
              filters={filters}
              availableModels={model.availableModels}
              onChange={(next) => {
                setFilters(next);
                setSelectedEntry(null);
              }}
            />
            <Stack gap='xs'>
              <Text fw={700}>帯域サマリ</Text>
              <Text size='sm'>自チーム: {model.stats.sourceCounts.own_team}</Text>
              <Text size='sm'>参加チーム: {model.stats.sourceCounts.participant_team}</Text>
              <Text size='sm'>観測 WiFi: {model.stats.sourceCounts.observed_wifi}</Text>
            </Stack>
          </Stack>
        </Card>

        <Card
          className='feature-card channel-map-stage'
          padding='lg'
          radius='xl'
          style={{ gridColumn: 'span 2' }}
        >
          <Stack gap='md'>
            <Group justify='space-between'>
              <div>
                <Title order={3}>{model.title}</Title>
                <Text c='dimmed'>バーを選択すると詳細パネルが更新されます。</Text>
              </div>
            </Group>

            <ChannelMapView
              entries={model.visibleEntries}
              domain={model.domain}
              selectedId={selectedEntry?.id ?? null}
              onSelect={(entry) => setSelectedEntry(entry)}
            />
          </Stack>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing='lg'>
        <ChannelMapDetailPanel entry={selectedEntry} tournamentId={tournamentId} />

        <Card className='feature-card' padding='lg' radius='xl'>
          <Stack gap='md'>
            <Title order={4}>参考ベストプラクティス</Title>
            {(relevantPractices.length === 0 ? (bestPracticesQuery.data ?? []) : relevantPractices)
              .slice(0, 4)
              .map((practice) => (
                <Card key={practice.id} className='notice-card' padding='md' radius='lg'>
                  <Stack gap='xs'>
                    <Group justify='space-between'>
                      <Text fw={700}>{practice.title}</Text>
                      <Badge variant='light'>{practice.scope}</Badge>
                    </Group>
                    <Text c='dimmed' size='sm'>
                      {practice.body}
                    </Text>
                  </Stack>
                </Card>
              ))}

            {(bestPracticesQuery.data ?? []).length === 0 ? (
              <Text c='dimmed'>参考ベストプラクティスはまだありません。</Text>
            ) : null}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
