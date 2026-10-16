import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle, DimensionValue } from 'react-native';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const opacityAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.8,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.3,
          duration: 850,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
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
export const SkeletonStatsRow: React.FC = () => (
  <View style={styles.statsRow}>
    <View style={styles.statCard}>
      <Skeleton width={32} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
      <Skeleton width={50} height={22} borderRadius={6} />
    </View>
    <View style={styles.statCard}>
      <Skeleton width={36} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
      <Skeleton width={60} height={22} borderRadius={6} />
    </View>
    <View style={styles.statCard}>
      <Skeleton width={42} height={12} borderRadius={4} style={{ marginBottom: 8 }} />
      <Skeleton width={60} height={22} borderRadius={6} />
    </View>
  </View>
);

/**
 * Skeleton placeholder for number & rental cards (MyNumbers & Rentals)
 */
export const SkeletonNumberCard: React.FC = () => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Skeleton width={36} height={36} borderRadius={18} />
        <View style={{ gap: 6 }}>
          <Skeleton width={110} height={16} borderRadius={4} />
          <Skeleton width={70} height={12} borderRadius={4} />
        </View>
      </View>
      <Skeleton width={64} height={24} borderRadius={12} />
    </View>

    <View style={styles.cardOtpBox}>
      <Skeleton width={140} height={28} borderRadius={6} />
      <Skeleton width={60} height={12} borderRadius={4} style={{ marginTop: 6 }} />
    </View>

    <View style={styles.cardFooter}>
      <Skeleton width={80} height={32} borderRadius={8} />
      <Skeleton width={80} height={32} borderRadius={8} />
    </View>
  </View>
);

/**
 * Skeleton placeholder for list items (Services, Transactions, Available Numbers)
 */
export const SkeletonListItem: React.FC = () => (
  <View style={styles.listItem}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Skeleton width={38} height={38} borderRadius={10} />
      <View style={{ gap: 6 }}>
        <Skeleton width={120} height={15} borderRadius={4} />
        <Skeleton width={75} height={11} borderRadius={4} />
      </View>
    </View>
    <Skeleton width={60} height={18} borderRadius={6} />
  </View>
);

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#27272A',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#121214',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 14,
  },
  card: {
    backgroundColor: '#121214',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E1E20',
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
    backgroundColor: '#18181A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242426',
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1C',
  },
  listItem: {
    backgroundColor: '#121214',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E1E20',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
});
