import {
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { canViewParticipantData } from '../lib/authz.js';
import { useAuthSession } from '../lib/useAuthSession.js';
import { useTournament, useTournamentTeams } from '../lib/useTeamManagement.js';

type TeamListPageProps = {
  tournamentId: string;
};

export function TeamListPage({ tournamentId }: TeamListPageProps) {
  const { data: session } = useAuthSession();
  const tournamentQuery = useTournament(tournamentId);
  const teamsQuery = useTournamentTeams(tournamentId);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'updatedAt'>('name');

  const filteredTeams = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const source = [...(teamsQuery.data ?? [])];
    const visible =
      normalizedSearch.length === 0
        ? source
        : source.filter((team) =>
            [team.name, team.organization ?? '', team.pitId ?? '']
              .join(' ')
              .toLowerCase()
              .includes(normalizedSearch),
          );

    visible.sort((left, right) => {
      if (sortKey === 'updatedAt') {
        return right.updatedAt.localeCompare(left.updatedAt);
      }
      return left.name.localeCompare(right.name, 'ja');
    });
    return visible;
  }, [search, sortKey, teamsQuery.data]);

  if (tournamentQuery.isLoading || teamsQuery.isLoading) {
    return (
      <Stack align='center' py='xl'>
        <Loader color='teal' />
        <Text c='dimmed'>チーム一覧を読み込んでいます</Text>
      </Stack>
    );
  }

  return (
    <Stack gap='lg'>
      <Group justify='space-between' align='flex-end'>
        <div>
          <Title order={2}>{tournamentQuery.data?.name ?? '大会'} チーム一覧</Title>
          <Text c='dimmed'>
            公開情報は未認証でも閲覧できます。詳細画面は参加者または運営者向けです。
          </Text>
        </div>
        <Button component={Link} to={`/tournaments/${tournamentId}`} variant='subtle'>
          大会トップへ戻る
        </Button>
      </Group>

      <Group grow align='flex-end'>
        <TextInput
          label='検索'
          placeholder='チーム名、学校名、ピット番号'
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <Select
          label='並び替え'
          data={[
            { value: 'name', label: 'チーム名順' },
            { value: 'updatedAt', label: '更新日時順' },
          ]}
          value={sortKey}
          onChange={(value) => setSortKey((value as 'name' | 'updatedAt') ?? 'name')}
          allowDeselect={false}
        />
      </Group>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing='lg'>
        {filteredTeams.map((team) => {
          const hasPrivateFields = 'contactEmail' in team;
          const canOpenDetail = canViewParticipantData(session);

          return (
            <Card key={team.id} className='feature-card' padding='lg' radius='xl'>
              <Stack gap='sm'>
                <Group justify='space-between' align='flex-start'>
                  <div>
                    <Title order={3}>{team.name}</Title>
                    <Text c='dimmed'>{team.organization ?? '所属未設定'}</Text>
                  </div>
                  <Badge color={hasPrivateFields ? 'teal' : 'gray'} variant='light'>
                    {hasPrivateFields ? '自チーム/運営表示' : '公開情報'}
                  </Badge>
                </Group>

                <Text size='sm'>ピット番号: {team.pitId ?? '未設定'}</Text>
                <Text size='sm' c='dimmed'>
                  更新: {new Date(team.updatedAt).toLocaleString('ja-JP')}
                </Text>

                <Group mt='sm'>
                  {canOpenDetail ? (
                    <Button component={Link} to={`/tournaments/${tournamentId}/teams/${team.id}`}>
                      詳細を開く
                    </Button>
                  ) : (
                    <Button component={Link} to='/team-access' color='orange' variant='light'>
                      詳細はログイン後
                    </Button>
                  )}
                </Group>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
