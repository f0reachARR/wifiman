import {
  Alert,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  List,
  Loader,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { Link } from '@tanstack/react-router';
import { useMemo } from 'react';
import { useAuthSession } from '../lib/useAuthSession.js';
import {
  useTournamentBestPractices,
  useTournamentNotices,
  useTournamentPublicOverview,
} from '../lib/useTeamManagement.js';

type TournamentOverviewPageProps = {
  tournamentId: string;
};

function formatDateRange(startDate: string, endDate: string) {
  return `${startDate} - ${endDate}`;
}

export function TournamentOverviewPage({ tournamentId }: TournamentOverviewPageProps) {
  const { data: session } = useAuthSession();
  const overviewQuery = useTournamentPublicOverview(tournamentId);
  const noticesQuery = useTournamentNotices(tournamentId);
  const bestPracticesQuery = useTournamentBestPractices(tournamentId);

  const highlightPractices = useMemo(
    () => (bestPracticesQuery.data ?? []).slice(0, 3),
    [bestPracticesQuery.data],
  );

  if (overviewQuery.isLoading) {
    return (
      <Stack align='center' py='xl'>
        <Loader color='teal' />
        <Text c='dimmed'>大会情報を読み込んでいます</Text>
      </Stack>
    );
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <Alert color='red' title='大会情報を取得できませんでした'>
        少し時間を置いて再度お試しください。
      </Alert>
    );
  }

  const { tournament, wifiConfigSummary, teamCount, publicIssueReportCount, noticeCount } =
    overviewQuery.data;

  return (
    <Stack gap='xl'>
      <Card className='hero-card tournament-hero-card' padding='xl' radius='xl'>
        <Stack gap='lg'>
          <Group justify='space-between' align='flex-start'>
            <div>
              <Text tt='uppercase' fw={700} c='teal'>
                Tournament Overview
              </Text>
              <Title order={1}>{tournament.name}</Title>
              <Text c='dimmed'>
                {tournament.venueName} / {formatDateRange(tournament.startDate, tournament.endDate)}
              </Text>
            </div>
            <Badge color={session ? 'teal' : 'gray'} variant='light'>
              {session ? '参加者表示' : '公開表示'}
            </Badge>
          </Group>

          {tournament.description ? <Text size='lg'>{tournament.description}</Text> : null}

          <Group>
            <Button component={Link} to={`/tournaments/${tournamentId}/teams`}>
              チーム一覧を見る
            </Button>
            {session?.kind === 'team' && session.tournamentId === tournamentId ? (
              <Button
                component={Link}
                to={`/tournaments/${tournamentId}/teams/${session.teamId}`}
                variant='light'
                color='orange'
              >
                自チームを開く
              </Button>
            ) : null}
            {!session ? (
              <Button component={Link} to='/team-access' variant='subtle' color='dark'>
                チームアクセスを開始
              </Button>
            ) : null}
          </Group>
        </Stack>
      </Card>

      <Grid>
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <Group justify='space-between'>
                <Title order={3}>帯域別サマリ</Title>
                <Text c='dimmed'>公開情報ベース</Text>
              </Group>
              <Grid>
                {Object.entries(wifiConfigSummary).map(([band, count]) => (
                  <Grid.Col key={band} span={{ base: 12, sm: 4 }}>
                    <Card className='summary-card' padding='md' radius='lg'>
                      <Stack gap='xs'>
                        <Text c='dimmed' size='sm'>
                          {band}
                        </Text>
                        <Title order={2}>{count}</Title>
                        <Text size='sm' c='dimmed'>
                          稼働中または待機中の構成数
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>

              <Group grow>
                <Card className='summary-card' padding='md' radius='lg'>
                  <Text c='dimmed' size='sm'>
                    参加チーム数
                  </Text>
                  <Title order={2}>{teamCount}</Title>
                </Card>
                <Card className='summary-card' padding='md' radius='lg'>
                  <Text c='dimmed' size='sm'>
                    報告件数
                  </Text>
                  <Title order={2}>{publicIssueReportCount}</Title>
                </Card>
                <Card className='summary-card' padding='md' radius='lg'>
                  <Text c='dimmed' size='sm'>
                    お知らせ
                  </Text>
                  <Title order={2}>{noticeCount}</Title>
                </Card>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='sm'>
              <Group>
                <ThemeIcon color='orange' variant='light' radius='xl'>
                  1
                </ThemeIcon>
                <Title order={4}>参加導線</Title>
              </Group>
              <Text c='dimmed'>
                未認証では公開情報のみ表示されます。自チーム編集や他チーム詳細の参照には、チームアクセス
                または運営ログインが必要です。
              </Text>
              <Button component={Link} to='/login' variant='light' color='teal'>
                運営ログイン
              </Button>
              <Button component={Link} to='/team-access' variant='light' color='orange'>
                チームアクセス
              </Button>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <Title order={3}>お知らせ / 注意喚起</Title>
              {(noticesQuery.data ?? []).length === 0 ? (
                <Text c='dimmed'>現在公開中のお知らせはありません。</Text>
              ) : (
                (noticesQuery.data ?? []).map((notice) => (
                  <Card key={notice.id} className='notice-card' padding='md' radius='lg'>
                    <Stack gap='xs'>
                      <Group justify='space-between'>
                        <Title order={4}>{notice.title}</Title>
                        <Badge
                          color={
                            notice.severity === 'critical'
                              ? 'red'
                              : notice.severity === 'warning'
                                ? 'orange'
                                : 'blue'
                          }
                          variant='light'
                        >
                          {notice.severity}
                        </Badge>
                      </Group>
                      <Text>{notice.body}</Text>
                      <Text size='sm' c='dimmed'>
                        公開日時: {new Date(notice.publishedAt).toLocaleString('ja-JP')}
                      </Text>
                    </Stack>
                  </Card>
                ))
              )}
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card className='feature-card' padding='lg' radius='xl'>
            <Stack gap='md'>
              <Title order={3}>ベストプラクティス</Title>
              {highlightPractices.length === 0 ? (
                <Text c='dimmed'>公開中のベストプラクティスはまだありません。</Text>
              ) : (
                <List spacing='md'>
                  {highlightPractices.map((practice) => (
                    <List.Item key={practice.id}>
                      <Stack gap={2}>
                        <Text fw={700}>{practice.title}</Text>
                        <Text c='dimmed' size='sm'>
                          {practice.body}
                        </Text>
                      </Stack>
                    </List.Item>
                  ))}
                </List>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
