import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  NativeSelect,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { BANDS, type Band, PURPOSES } from '@wifiman/shared';
import { useMemo, useState } from 'react';
import { filterBestPractices, inferBestPracticePurposes } from '../lib/teamManagement.js';
import { useTournament, useTournamentBestPractices } from '../lib/useTeamManagement.js';

type BestPracticesPageProps = {
  tournamentId: string;
};

export function BestPracticesPage({ tournamentId }: BestPracticesPageProps) {
  const tournamentQuery = useTournament(tournamentId);
  const bestPracticesQuery = useTournamentBestPractices(tournamentId);
  const [band, setBand] = useState<Band>('5GHz');
  const [purpose, setPurpose] = useState('');
  const [model, setModel] = useState('');

  const filtered = useMemo(
    () =>
      filterBestPractices(bestPracticesQuery.data ?? [], {
        band,
        purpose,
        model,
      }),
    [band, bestPracticesQuery.data, model, purpose],
  );

  if (tournamentQuery.isLoading || bestPracticesQuery.isLoading) {
    return (
      <Stack align='center' py='xl'>
        <Loader color='teal' />
        <Text c='dimmed'>ベストプラクティスを読み込んでいます</Text>
      </Stack>
    );
  }

  if (tournamentQuery.isError || bestPracticesQuery.isError || !tournamentQuery.data) {
    return (
      <Alert color='red' title='ベストプラクティスを取得できませんでした'>
        少し時間を置いて再度お試しください。
      </Alert>
    );
  }

  return (
    <Stack gap='lg'>
      <Card className='hero-card tournament-hero-card' padding='xl' radius='xl'>
        <Stack gap='md'>
          <Group justify='space-between' align='flex-start'>
            <div>
              <Text tt='uppercase' fw={700} c='teal'>
                Best Practices
              </Text>
              <Title order={1}>{tournamentQuery.data.name} ベストプラクティス</Title>
              <Text c='dimmed'>帯域・用途分類・型番キーワードで参照先を絞り込みます。</Text>
            </div>
            <Button component={Link} to={`/tournaments/${tournamentId}`} variant='subtle'>
              大会トップへ戻る
            </Button>
          </Group>

          <SegmentedControl
            value={band}
            onChange={(value) => setBand(value as Band)}
            data={BANDS.map((value) => ({ value, label: value }))}
          />

          <Group grow align='flex-start'>
            <NativeSelect
              label='用途フィルタ'
              data={[
                { value: '', label: 'すべて' },
                ...PURPOSES.map((value) => ({ value, label: value })),
              ]}
              value={purpose}
              onChange={(event) => setPurpose(event.currentTarget.value)}
            />
            <TextInput
              label='型番フィルタ'
              value={model}
              onChange={(event) => setModel(event.currentTarget.value)}
            />
          </Group>
        </Stack>
      </Card>

      <Stack gap='md' role='list' aria-label='ベストプラクティス一覧'>
        {filtered.map((practice) => (
          <Card key={practice.id} className='feature-card' padding='lg' radius='xl'>
            <Stack gap='xs'>
              <Text size='sm' c='dimmed'>
                用途候補: {(() => {
                  const purposeCandidates = inferBestPracticePurposes(practice);

                  return purposeCandidates.length > 0 ? purposeCandidates.join(', ') : '未分類';
                })()}
              </Text>
              <Group justify='space-between'>
                <Title order={4}>{practice.title}</Title>
                <Badge variant='light'>{practice.scope}</Badge>
              </Group>
              <Text c='dimmed'>{practice.body}</Text>
              <Group gap='xs'>
                {practice.targetBand ? (
                  <Badge color='teal' variant='light'>
                    {practice.targetBand}
                  </Badge>
                ) : null}
                {practice.targetModel ? (
                  <Badge color='orange' variant='light'>
                    {practice.targetModel}
                  </Badge>
                ) : null}
              </Group>
            </Stack>
          </Card>
        ))}

        {filtered.length === 0 ? (
          <Alert color='gray' variant='light'>
            条件に一致するベストプラクティスはありません。
          </Alert>
        ) : null}
      </Stack>
    </Stack>
  );
}
