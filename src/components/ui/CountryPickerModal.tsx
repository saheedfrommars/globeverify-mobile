import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../theme';

export interface CountryItem {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

export const COUNTRIES: CountryItem[] = [
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
];

export interface CountryPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedCode: string;
  onSelectCountry: (country: CountryItem) => void;
}

export const CountryPickerModal: React.FC<CountryPickerModalProps> = ({
  visible,
  onClose,
  selectedCode,
  onSelectCountry,
}) => {
  const { colors, typography, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.dial.includes(search)
  );

  const handleSelect = (item: CountryItem) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } else {
      Haptics.selectionAsync();
    }
    onSelectCountry(item);
    onClose();
    setSearch('');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#141722' : '#ffffff',
              borderColor: isDark ? '#262c3e' : '#e2e8f0',
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                typography.title3,
                { color: colors.text, fontWeight: '700' },
              ]}
            >
              Select Country
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              style={[
                styles.closeBtn,
                { backgroundColor: isDark ? '#222838' : '#f1f5f9' },
              ]}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View
            style={[
              styles.searchWrapper,
              {
                backgroundColor: isDark ? '#0d1017' : '#f8fafc',
                borderColor: isDark ? '#232838' : '#e2e8f0',
              },
            ]}
          >
            <Search size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
            <TextInput
              placeholder="Search by country or code..."
              placeholderTextColor={colors.textTertiary}
              value={search}
              onChangeText={setSearch}
              style={[typography.body, styles.searchInput, { color: colors.text }]}
              autoCorrect={false}
            />
          </View>

          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isSelected = item.code === selectedCode;
              return (
                <Pressable
                  onPress={() => handleSelect(item)}
                  style={({ pressed }) => [
                    styles.itemRow,
                    {
                      backgroundColor: pressed
                        ? isDark
                          ? '#1e2333'
                          : '#f1f5f9'
                        : isSelected
                        ? isDark
                          ? 'rgba(59, 130, 246, 0.12)'
                          : 'rgba(37, 99, 235, 0.08)'
                        : 'transparent',
                    },
                  ]}
                >
                  <Text style={styles.flagText}>{item.flag}</Text>
                  <Text
                    style={[
                      typography.body,
                      styles.countryName,
                      {
                        color: colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {item.name}
                  </Text>
                  <Text
                    style={[
                      typography.subhead,
                      styles.dialText,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {item.dial}
                  </Text>
                  {isSelected && (
                    <Check
                      size={18}
                      color={colors.primary}
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '80%',
    paddingTop: 16,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  flagText: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
  },
  dialText: {
    fontWeight: '600',
  },
});
