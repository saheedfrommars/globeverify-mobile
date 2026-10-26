import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ViewStyle,
  DimensionValue,
} from 'react-native';
import { useAppSettings } from '../../context/WalletSettingsContext';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

const SPEED_MAP = {
  fast: 450,
  normal: 850,
  calm: 1350,
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const { settings, colors } = useAppSettings();
  const opacityAnim = useRef(new Animated.Value(0.35)).current;
  const duration = SPEED_MAP[settings.loadingSpeed] || 850;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim, duration]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: colors.isDark ? '#26262C' : '#E2E8F0',
          width,
          height,
          borderRadius,
          opacity: opacityAnim,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton placeholder for stats cards (Dashboard)
 */
export const SkeletonStatsRow: React.FC = () => {
  const { settings, colors } = useAppSettings();

  if (settings.loadingStyle === 'spinner') {
    return (
      <View
        style={[
          styles.spinnerCompactBox,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.spinnerText, { color: colors.textMuted }]}>Loading stats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.statsColumn}>
      {[1, 2, 3, 4].map((idx) => (
        <View
          key={idx}
          style={[
            styles.statCardRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Skeleton width={46} height={46} borderRadius={13} />
          <View style={{ gap: 7, flex: 1 }}>
            <Skeleton width={95} height={12} borderRadius={4} />
            <Skeleton width={125} height={20} borderRadius={6} />
          </View>
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton placeholder for number & rental cards (MyNumbers & Rentals)
 */
export const SkeletonNumberCard: React.FC = () => {
  const { settings, colors } = useAppSettings();

  if (settings.loadingStyle === 'spinner') {
    return (
      <View
        style={[
          styles.spinnerBox,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.spinnerText, { color: colors.textMuted }]}>
          Syncing active numbers...
        </Text>
      </View>
    );
  }

  if (settings.loadingStyle === 'minimal') {
    return (
      <View
        style={[
          styles.minimalLineRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Skeleton width="60%" height={13} borderRadius={4} />
        <Skeleton width={70} height={13} borderRadius={4} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Skeleton width={38} height={38} borderRadius={12} />
          <View style={{ gap: 6 }}>
            <Skeleton width={110} height={16} borderRadius={4} />
            <Skeleton width={70} height={12} borderRadius={4} />
          </View>
        </View>
        <Skeleton width={64} height={24} borderRadius={12} />
      </View>

      <View
        style={[
          styles.cardOtpBox,
          { backgroundColor: colors.surfaceSecondary },
        ]}
      >
        <Skeleton width={140} height={26} borderRadius={6} />
        <Skeleton width={60} height={11} borderRadius={4} style={{ marginTop: 6 }} />
      </View>

      <View style={styles.cardFooter}>
        <Skeleton width={85} height={32} borderRadius={8} />
        <Skeleton width={85} height={32} borderRadius={8} />
      </View>
    </View>
  );
};

/**
 * Skeleton placeholder for list items (Services, Transactions, Available Numbers)
 */
export const SkeletonListItem: React.FC = () => {
  const { settings, colors } = useAppSettings();

  if (settings.loadingStyle === 'spinner') {
    return (
      <View
        style={[
          styles.spinnerCompactBox,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.spinnerText, { color: colors.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  if (settings.loadingStyle === 'minimal') {
    return (
      <View
        style={[
          styles.minimalLineRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Skeleton width="55%" height={12} borderRadius={4} />
        <Skeleton width={56} height={12} borderRadius={4} />
      </View>
    );
  }

  if (settings.loadingStyle === 'wave') {
    return (
      <View
        style={[
          styles.waveItem,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={[styles.waveBar, { backgroundColor: colors.primary }]} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="65%" height={14} borderRadius={4} />
          <Skeleton width="35%" height={10} borderRadius={4} />
        </View>
        <Skeleton width={64} height={16} borderRadius={6} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.listItem,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Skeleton width={38} height={38} borderRadius={10} />
        <View style={{ gap: 6 }}>
          <Skeleton width={120} height={14} borderRadius={4} />
          <Skeleton width={75} height={11} borderRadius={4} />
        </View>
      </View>
      <Skeleton width={60} height={18} borderRadius={6} />
    </View>
  );
};

const styles = StyleSheet.create({
  statsColumn: {
    gap: 10,
    marginBottom: 16,
  },
  statCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardOtpBox: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  listItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  waveItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  waveBar: {
    width: 3,
    height: 26,
    borderRadius: 2,
  },
  minimalLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 15,
    marginBottom: 8,
  },
  spinnerBox: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  spinnerCompactBox: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  spinnerText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
});
