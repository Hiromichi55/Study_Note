import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { RootStackParamList } from '../App';
import { StackNavigationProp } from '@react-navigation/stack';

const LICENSES: Array<{ name: string; version: string; license: string }> = [
  { name: '@expo/vector-icons', version: '15.0.2', license: 'MIT' },
  { name: '@react-native-community/masked-view', version: '0.1.11', license: 'MIT' },
  { name: '@react-native-community/slider', version: '5.0.1', license: 'MIT' },
  { name: '@react-navigation/native', version: '7.1.17', license: 'MIT' },
  { name: '@react-navigation/native-stack', version: '7.5.1', license: 'MIT' },
  { name: '@react-navigation/stack', version: '7.4.8', license: 'MIT' },
  { name: '@shopify/react-native-skia', version: '2.3.9', license: 'MIT' },
  { name: 'expo', version: '54.0.9', license: 'MIT' },
  { name: 'expo-app-loading', version: '2.1.1', license: 'MIT' },
  { name: 'expo-asset', version: '12.0.9', license: 'MIT' },
  { name: 'expo-crypto', version: '15.0.7', license: 'MIT' },
  { name: 'expo-file-system', version: '19.0.17', license: 'MIT' },
  { name: 'expo-font', version: '14.0.8', license: 'MIT' },
  { name: 'expo-image-manipulator', version: '14.0.8', license: 'MIT' },
  { name: 'expo-image-picker', version: '17.0.10', license: 'MIT' },
  { name: 'expo-sqlite', version: '16.0.8', license: 'MIT' },
  { name: 'expo-status-bar', version: '3.0.8', license: 'MIT' },
  { name: 'react', version: '19.1.0', license: 'MIT' },
  { name: 'react-native', version: '0.81.4', license: 'MIT' },
  { name: 'react-native-draggable-flatlist', version: '4.0.3', license: 'MIT' },
  { name: 'react-native-draggable-grid', version: '2.2.2', license: 'ISC' },
  { name: 'react-native-gesture-handler', version: '2.28.0', license: 'MIT' },
  { name: 'react-native-pager-view', version: '6.9.1', license: 'MIT' },
  { name: 'react-native-paper', version: '5.14.5', license: 'MIT' },
  { name: 'react-native-reanimated', version: '4.1.0', license: 'MIT' },
  { name: 'react-native-safe-area-context', version: '5.6.1', license: 'MIT' },
  { name: 'react-native-screens', version: '4.16.0', license: 'MIT' },
  { name: 'react-native-vector-icons', version: '10.3.0', license: 'MIT' },
  { name: 'react-native-view-shot', version: '4.0.3', license: 'MIT' },
  { name: 'sql.js', version: '1.13.0', license: 'MIT' },
];

const FONT_LICENSES: Array<{
  name: string;
  author: string;
  license: string;
}> = [
  {
    name: '細鳴りフォント (SanariFont)',
    author: 'Narisa.s',
    license: 'SIL Open Font License 1.1',
  },
];

const LicenseScreen: React.FC = () => {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
  const buildVersion = Constants.nativeBuildVersion ?? '-';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: '詳細情報',
      headerTitleStyle: { fontSize: 17, fontWeight: '700', color: '#342C24' },
      headerStyle: { backgroundColor: '#E9DCCD' },
      headerShadowVisible: false,
      headerTintColor: '#342C24',
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}
        >
          <Ionicons name="chevron-back" size={24} color="#342C24" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>アプリ情報</Text>
      <Text style={styles.description}>現在インストールされているアプリのバージョン情報です。</Text>

      <View style={styles.card}>
        <Text style={styles.name}>らくらく美ノート</Text>
        <Text style={styles.meta}>Version: {appVersion}</Text>
        <Text style={styles.meta}>Build: {buildVersion}</Text>
      </View>

      <Text style={[styles.title, { marginTop: 24 }]}>オープンソースライセンス</Text>
      <Text style={styles.description}>
        このアプリで利用している主要な依存パッケージとライセンスを表示しています。
      </Text>

      {LICENSES.map((item) => (
        <View key={item.name} style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>Version: {item.version}</Text>
          <Text style={styles.meta}>License: {item.license}</Text>
        </View>
      ))}

      <Text style={[styles.title, { marginTop: 24 }]}>フォント</Text>
      <Text style={styles.description}>
        このアプリで使用しているフォントのライセンス情報です。
      </Text>

      {FONT_LICENSES.map((item) => (
        <View key={item.name} style={styles.card}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>作者: {item.author}</Text>
          <Text style={styles.meta}>License: {item.license}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F1EA',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3D2F22',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6B5A49',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5D9CC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D2F22',
    marginBottom: 4,
  },
  meta: {
    fontSize: 12,
    color: '#6B5A49',
    lineHeight: 18,
  },
});

export default LicenseScreen;
