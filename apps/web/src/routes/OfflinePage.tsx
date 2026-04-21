import { Card, Grid, Stack, Text, Title } from '@mantine/core';

const offlineNotes = [
  'Workbox navigation fallback を /index.html に固定し、SPA 遷移をオフラインでも継続できるようにします。',
  'API runtime cache は未導入とし、誤ったレスポンス再利用を避けています。',
  '閲覧キャッシュと同期レコードは Dexie に分離し、のちの同期 UI に備えます。',
];

const verificationSteps = [
  '一度オンラインでトップ画面を開き、PWA 登録完了トーストを確認する',
  'ブラウザの DevTools で Offline に切り替えたあと、/offline と / を相互遷移する',
  '直接 /app や /app/sync を開く場合は、事前に有効なサーバ session があることを確認する',
];

export function OfflinePage() {
  return (
    <Stack gap='lg'>
      <div>
        <Title order={2}>オフライン運用</Title>
        <Text c='dimmed'>
          会場ネットワーク断でも画面遷移とローカル閲覧キャッシュを維持する前提です。
        </Text>
      </div>
      <Grid>
        {offlineNotes.map((note) => (
          <Grid.Col key={note} span={{ base: 12, md: 4 }}>
            <Card className='feature-card' h='100%' padding='lg' radius='xl'>
              <Text>{note}</Text>
            </Card>
          </Grid.Col>
        ))}
      </Grid>
      <Card className='feature-card' padding='lg' radius='xl'>
        <Stack gap='sm'>
          <Title order={3}>オフライン遷移の確認手順</Title>
          {verificationSteps.map((step, index) => (
            <Text key={step}>
              {index + 1}. {step}
            </Text>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
