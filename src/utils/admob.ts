// ==========================================
// admob.ts
// react-native-google-mobile-ads のネイティブモジュール読み込みと
// 初期化をアプリ全体で共有するための共通ユーティリティ。
//
// ネイティブモジュールはネイティブ側を再ビルドする前(Expo Go や旧ビルド)
// では存在しないため、require をtry/catchで包み、利用できない場合は
// null を返す(呼び出し側は広告なしとして振る舞う)。
// ==========================================

import { Platform } from 'react-native';
import { ADMOB } from '@config';

export let adsModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  adsModule = require('react-native-google-mobile-ads');
} catch (_) {
  adsModule = null;
}

let initPromise: Promise<void> | null = null;

// アプリ全体で一度だけ初期化する
export const ensureAdsInitialized = (): Promise<void> => {
  if (!adsModule) return Promise.resolve();
  if (!initPromise) {
    const mobileAds = adsModule.default;
    initPromise = Promise.resolve(mobileAds?.().initialize?.())
      .then(() => undefined)
      .catch(() => undefined);
  }
  return initPromise;
};

type RewardedPlacement = keyof typeof ADMOB.REWARDED_UNIT_IDS;

const resolveRewardedUnitId = (placement: RewardedPlacement): string => {
  const TestIds = adsModule?.TestIds;
  const unitIds = ADMOB.REWARDED_UNIT_IDS[placement];
  const configured =
    (Platform.select({
      ios: unitIds.IOS,
      android: unitIds.ANDROID,
    }) as string | undefined) ?? '';

  // 開発ビルド or 本番ユニットID未設定なら必ずテストIDを使う(ポリシー違反防止)
  if (__DEV__ || !configured) {
    return TestIds?.REWARDED ?? '';
  }
  return configured;
};

// リワード広告を読み込んで表示する。
// 視聴完了して報酬を獲得できたら true、キャンセル・読み込み失敗時は false を返す。
// ネイティブモジュール未ビルド時(Expo Go)は広告を出せないため true を返し、機能をブロックしない。
export const showRewardedAd = (placement: RewardedPlacement): Promise<boolean> => {
  if (!adsModule) return Promise.resolve(true);

  const { RewardedAd, RewardedAdEventType, AdEventType } = adsModule;
  const unitId = resolveRewardedUnitId(placement);
  if (!RewardedAd || !unitId) return Promise.resolve(true);

  return ensureAdsInitialized().then(
    () =>
      new Promise<boolean>((resolve) => {
        const rewarded = RewardedAd.createForAdRequest(unitId, {
          requestNonPersonalizedAdsOnly: false,
        });

        let earned = false;
        let settled = false;
        const unsubscribers: Array<() => void> = [];

        const finish = (result: boolean) => {
          if (settled) return;
          settled = true;
          unsubscribers.forEach((unsub) => unsub());
          resolve(result);
        };

        unsubscribers.push(
          rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
            rewarded.show();
          })
        );
        unsubscribers.push(
          rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
            earned = true;
          })
        );
        unsubscribers.push(
          rewarded.addAdEventListener(AdEventType.ERROR, () => {
            finish(false);
          })
        );
        unsubscribers.push(
          rewarded.addAdEventListener(AdEventType.CLOSED, () => {
            finish(earned);
          })
        );

        rewarded.load();
      })
  );
};
