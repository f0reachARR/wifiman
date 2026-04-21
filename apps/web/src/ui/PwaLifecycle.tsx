import { useRegisterSW } from 'virtual:pwa-register/react';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';

export function PwaLifecycle() {
  const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW() {
      notifications.show({
        title: 'PWA を登録しました',
        message: '次回以降のアクセスからオフラインで App Shell を利用できます。',
        color: 'teal',
      });
    },
  });

  useEffect(() => {
    if (!offlineReady[0]) {
      return;
    }

    notifications.show({
      title: 'オフライン準備完了',
      message: 'キャッシュ済みアセットで起動できる状態です。',
      color: 'teal',
    });
  }, [offlineReady]);

  useEffect(() => {
    if (!needRefresh[0]) {
      return;
    }

    notifications.show({
      title: '更新があります',
      message: '最新アセットを反映するため再読み込みします。',
      color: 'orange',
      autoClose: false,
      onClose: () => {
        void updateServiceWorker(true);
      },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}
