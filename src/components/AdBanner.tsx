// ==========================================
// AdBanner.tsx
// AdMob バナー広告を表示する共通コンポーネント。
//
// 設計方針:
// - react-native-google-mobile-ads はネイティブモジュールのため、
//   ネイティブ側を再ビルドする前（Expo Go や旧ビルド）では存在しない。
//   そのままトップレベル import するとJSバンドルが落ちるので、
//   require をtry/catchで包み、利用できない場合は何も描画しない（null）。
// - 開発中（__DEV__）やユニットID未設定時は Google 公式のテストIDを使う。
//   本番ユニットIDは config.ts の ADMOB.*_BANNER_UNIT_ID に設定する。
// ==========================================

import React, { useEffect, useState } from 'react';
import { Platform, View, StyleProp, ViewStyle } from 'react-native';
import { ADMOB } from '@config';
import { adsModule, ensureAdsInitialized } from '../utils/admob';

type Placement = keyof typeof ADMOB.BANNER_UNIT_IDS;

const resolveBannerUnitId = (placement: Placement): string => {
  const TestIds = adsModule?.TestIds;
  const unitIds = ADMOB.BANNER_UNIT_IDS[placement];
  const configured =
    (Platform.select({
      ios: unitIds.IOS,
      android: unitIds.ANDROID,
    }) as string | undefined) ?? '';

  // 開発ビルド or 本番ユニットID未設定なら必ずテストIDを使う（ポリシー違反防止）
  if (__DEV__ || !configured) {
    return TestIds?.BANNER ?? '';
  }
  return configured;
};

type Props = {
  // どの画面に表示するバナーか。config.ts の ADMOB.BANNER_UNIT_IDS のキーに対応する。
  placement: Placement;
  style?: StyleProp<ViewStyle>;
  // バナーの実際の描画高さ(dp)を上位に通知する。
  // アダプティブバナーは端末幅やタブレットで高さが変わる(最大90dp)ため、
  // 受け取った高さを使って枠・FAB・リスト余白を調整して被りを防ぐ。
  onHeightChange?: (height: number) => void;
};

const AdBanner: React.FC<Props> = ({ placement, style, onHeightChange }) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!adsModule) {
      setFailed(true);
      return;
    }

    let mounted = true;
    ensureAdsInitialized().then(() => {
      if (mounted) setReady(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  if (!adsModule || failed) return null;

  const BannerAd = adsModule.BannerAd;
  const BannerAdSize = adsModule.BannerAdSize;
  if (!BannerAd) return null;
  if (!ready) return null;

  return (
    <View
      style={style}
      onLayout={(e) => {
        const h = Math.round(e.nativeEvent.layout.height);
        if (h > 0) onHeightChange?.(h);
      }}
    >
      <BannerAd
        unitId={resolveBannerUnitId(placement)}
        size={BannerAdSize?.ANCHORED_ADAPTIVE_BANNER ?? 'ANCHORED_ADAPTIVE_BANNER'}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={() => {
          // 取得失敗時は黙ってリトライ（SDKが内部で処理）。ログのみ。
          if (__DEV__) console.log('[AdBanner] 広告の読み込みに失敗しました');
        }}
      />
    </View>
  );
};

export default AdBanner;
